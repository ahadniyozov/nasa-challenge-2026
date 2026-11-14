// 2D side-scroller: the satellite flies right over a scrolling map of the mission's part of Earth.
// 3 lanes (↑ ↓). Targets are recorded when you pass over them; data counts only after a ground station.
// Each mission adds rules: targets out of the orbit's reach, solar storms (safe mode), wear-out.
import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import type { FlightParams } from './config';
import type { Mission, TargetKind } from './missions';

export interface FlightStats {
  delivered: number;
  captured: number;
  lostInMemory: number;
  survived: boolean;
  decayed: boolean;
  wornOut: boolean;
  hits: number;
  batteryOuts: number;
  memoryFull: number;
  nightMissed: number;
  blurry: number;
  outOfReach: number;
  stormHits: number;
  stormsSafe: number;
  stormsSurvived: number;
}

type Kind = 'target' | 'debris' | 'station';
interface Obj { kind: Kind; lane: number; x: number; done: boolean; spin: number }

const LANES = [0.3, 0.52, 0.74]; // fraction of canvas height
const OUT_Y = 0.1; // targets the orbit cannot reach fly past up here
const SAT_X = 0.2;
const STORM_WARN = 3, STORM_LEN = 4.5;

export function Flight2D({ p, m, onEnd }: { p: FlightParams; m: Mission; onEnd(s: FlightStats): void }) {
  const { t } = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState({ t: 0, battery: 100, memory: 0, delivered: 0, hearts: p.hearts, shadow: false, contact: false, asleep: false, flash: '' as string, safe: false, storm: 0 as 0 | 1 | 2 });
  const control = useRef({ lane: 1, safe: false });
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    const day = new Image(); day.src = '/textures/earth-day.webp';
    const night = new Image(); night.src = '/textures/earth-night.webp';
    const kind = m.targets.kind;
    const [north, south] = m.targets.band;

    const duration = p.orbitSec * p.orbits;
    const endAt = p.orbitSec * p.orbitsBeforeDecay;
    // storms spread over the mission, never in the first seconds
    const storms = Array.from({ length: p.storms }, (_, i) => ({ at: duration * ((i + 0.55) / p.storms), state: 0 as 0 | 1 | 2 | 3 }));
    const s = {
      t: 0, y: 1, battery: 100, asleepUntil: 0, memory: 0, delivered: 0, hearts: p.hearts, invuln: 0,
      objs: [] as Obj[], nextTarget: 1, nextDebris: 2.5, stations: new Set<string>(), scroll: 0, shadowMix: 0,
      flash: '', flashUntil: 0, ended: false, contact: false, storm: 0 as 0 | 1 | 2,
      st: { delivered: 0, captured: 0, lostInMemory: 0, survived: true, decayed: false, wornOut: false, hits: 0, batteryOuts: 0, memoryFull: 0, nightMissed: 0, blurry: 0, outOfReach: 0, stormHits: 0, stormsSafe: 0, stormsSurvived: 0 } as FlightStats,
    };
    const say = (msg: string, sec = 1.3) => { s.flash = msg; s.flashUntil = s.t + sec; };
    const phase = (tt: number) => (tt / p.orbitSec) % 1;
    const inShadow = (tt: number) => { const ph = phase(tt); return ph > 0.5 - p.shadowFraction / 2 && ph < 0.5 + p.shadowFraction / 2; };

    let raf = 0, last = performance.now(), hudTick = 0;
    const resize = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = r.width * dpr; cv.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const finish = () => {
      if (s.ended) return;
      s.ended = true;
      s.st.delivered = Math.floor(s.delivered);
      s.st.lostInMemory = Math.round(s.memory);
      setTimeout(() => endRef.current({ ...s.st }), 900);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const W = cv.clientWidth, H = cv.clientHeight;
      const speed = W * 0.42; // px per second
      if (!s.ended) s.t += dt;
      const shadow = inShadow(s.t);
      const safe = control.current.safe;
      const asleep = s.t < s.asleepUntil || safe;

      if (!s.ended) {
        // mission end: planned end, decay / wear-out, or destroyed
        if (s.t >= endAt && endAt < duration) {
          s.st.survived = false;
          if (p.endReason === 'decay') { s.st.decayed = true; say(t('🔥 The air pulled the satellite down - it burned up'), 3); }
          else { s.st.wornOut = true; say(t('🔧 Its parts wore out - the satellite stopped working'), 3); }
          finish();
        } else if (s.t >= duration) finish();
        else if (s.hearts <= 0) { s.st.survived = false; finish(); }

        // solar storms: warning → storm → over
        s.storm = 0;
        for (const st of storms) {
          if (st.state === 0 && s.t >= st.at - STORM_WARN) { st.state = 1; say(t('☀️ Solar storm coming! Safe mode protects the computer'), 2.6); }
          if (st.state === 1 && s.t >= st.at) {
            st.state = 2;
            if (safe) { s.st.stormsSafe++; say(t('🛡️ Safe mode: asleep, but safe')); }
            else if (p.radHard) { s.st.stormsSurvived++; say(t('💪 Radiation-hardened computer keeps working!'), 2); }
            else { s.st.stormHits++; s.hearts--; s.memory = 0; s.asleepUntil = s.t + 3; s.invuln = s.t + 1.5; say(t('⚡ Radiation crashed the computer! Memory lost'), 2.2); }
          }
          if (st.state === 2 && s.t >= st.at + STORM_LEN) st.state = 3;
          if (st.state === 1) s.storm = Math.max(s.storm, 1) as 1;
          if (st.state === 2) s.storm = 2;
        }

        // battery (safe mode uses little power)
        if (shadow) s.battery -= p.shadowDrain * dt * (safe ? 0.4 : 1); else s.battery += p.sunCharge * dt;
        if (s.battery <= 0 && !asleep) { s.battery = 0; s.asleepUntil = s.t + 2.5; s.st.batteryOuts++; say(t('🪫 Battery empty - satellite asleep')); }
        s.battery = Math.max(0, Math.min(100, s.battery));

        // spawning: storms bring dense particle clouds on the space-weather mission
        if (s.t >= s.nextTarget) {
          s.objs.push({ kind: 'target', lane: p.reachesTargets ? Math.floor(Math.random() * 3) : -1, x: W + 40, done: false, spin: Math.random() * 6 });
          const gap = s.storm === 2 && kind === 'particle' ? 0.45 : (1.8 + Math.random() * 1.2) / p.targetRate;
          s.nextTarget = s.t + gap;
        }
        if (s.t >= s.nextDebris) {
          s.objs.push({ kind: 'debris', lane: Math.floor(Math.random() * 3), x: W + 40, done: false, spin: Math.random() * 6 });
          s.nextDebris = s.t + (1.6 + Math.random()) / p.debrisRate;
        }
        const orbit = Math.floor(s.t / p.orbitSec);
        for (let i = 0; i < p.stationsPerOrbit; i++) {
          const at = (0.15 + i * (0.8 / Math.max(1, p.stationsPerOrbit))) % 1;
          const key = `${orbit}-${i}`;
          const lead = (W * (1 - SAT_X) + 40) / speed / p.orbitSec;
          if (!s.stations.has(key) && phase(s.t) >= at - lead && phase(s.t) < at) { s.stations.add(key); s.objs.push({ kind: 'station', lane: 1, x: W + 60, done: false, spin: 0 }); }
        }

        // movement
        const target = control.current.lane;
        s.y += (target - s.y) * Math.min(1, dt * 10 * p.laneSpeed);

        // objects
        const satX = W * SAT_X;
        let contact = p.alwaysInContact;
        for (const o of s.objs) {
          o.x -= speed * dt;
          const sameLane = Math.abs(o.lane - s.y) < 0.45;
          if (o.kind === 'target' && !o.done && o.x <= satX) {
            o.done = true;
            if (o.lane < 0) { s.st.outOfReach++; if (s.st.outOfReach <= 2 || s.st.outOfReach % 4 === 0) say(t('🧭 Too far north - your orbit never flies there'), 1.6); continue; }
            if (!sameLane) continue;
            if (shadow && !p.nightVision) { s.st.nightMissed++; say(t('🌑 Too dark for this camera')); }
            else if (asleep) say(t('😴 Satellite asleep'));
            else if (s.memory >= p.memory) { s.st.memoryFull++; say(t('💾 Memory full! Find a station')); }
            else if (!p.sharp) { s.st.blurry++; say(t('😕 Too blurry from this height')); }
            else { s.memory++; s.st.captured++; s.battery -= 2; say('📸 +1', 0.6); }
          } else if (o.kind === 'debris' && !o.done && Math.abs(o.x - satX) < 26 && sameLane && s.t > s.invuln) {
            o.done = true; s.hearts--; s.st.hits++; s.invuln = s.t + 1.2; if (s.memory > 0) s.memory--;
            say(t('💥 Space junk hit! Lost a photo'));
          } else if (o.kind === 'station' && Math.abs(o.x - satX) < W * 0.09) contact = true;
        }
        s.objs = s.objs.filter((o) => o.x > -80);
        s.contact = contact && !asleep;
        if (s.contact && s.memory > 0) { const sent = Math.min(s.memory, p.photosPerSec * dt); s.memory -= sent; s.delivered += sent; s.battery -= 3 * dt; }
      }

      // ---- draw
      s.shadowMix += ((shadow ? 1 : 0) - s.shadowMix) * Math.min(1, dt * 3);
      ctx.fillStyle = '#04081c'; ctx.fillRect(0, 0, W, H);
      if (day.complete && day.naturalWidth) {
        // the mission's latitude band of the map, scrolling west → east
        const sy = day.naturalHeight * ((90 - north) / 180), sh = day.naturalHeight * ((north - south) / 180), sw = Math.min(day.naturalWidth * 0.6, sh * (W / H));
        s.scroll = (s.scroll + (s.ended ? 0 : dt * sw * (p.alwaysInContact ? 0.02 : 0.16))) % day.naturalWidth;
        const drawMap = (img: HTMLImageElement, alpha: number) => {
          ctx.globalAlpha = alpha;
          const x0 = s.scroll, first = Math.min(sw, img.naturalWidth - x0);
          ctx.drawImage(img, x0, sy, first, sh, 0, 0, (first / sw) * W, H);
          if (first < sw) ctx.drawImage(img, 0, sy, sw - first, sh, (first / sw) * W, 0, ((sw - first) / sw) * W, H);
          ctx.globalAlpha = 1;
        };
        drawMap(day, 1);
        ctx.fillStyle = `rgba(2,6,24,${0.72 * s.shadowMix})`; ctx.fillRect(0, 0, W, H);
        if (night.complete && s.shadowMix > 0.05) drawMap(night, 0.9 * s.shadowMix);
      }
      // solar storm tint
      if (s.storm === 2) { ctx.fillStyle = `rgba(255,140,30,${0.16 + Math.sin(s.t * 9) * 0.06})`; ctx.fillRect(0, 0, W, H); }
      // lanes
      ctx.strokeStyle = 'rgba(77,210,255,0.18)'; ctx.setLineDash([10, 14]); ctx.lineWidth = 2;
      for (const l of LANES) { ctx.beginPath(); ctx.moveTo(0, l * H); ctx.lineTo(W, l * H); ctx.stroke(); }
      // the orbit's northern limit
      if (!p.reachesTargets) {
        ctx.strokeStyle = 'rgba(255,90,90,0.8)'; ctx.setLineDash([6, 8]);
        ctx.beginPath(); ctx.moveTo(0, 0.19 * H); ctx.lineTo(W, 0.19 * H); ctx.stroke();
        const label = t('▲ your orbit never flies north of this line');
        ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        const lw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(40,6,12,0.75)'; ctx.fillRect(W - 20 - lw, 0.19 * H + 4, lw + 12, 20);
        ctx.fillStyle = '#ff9a9a'; ctx.fillText(label, W - 14, 0.19 * H + 7);
      }
      ctx.setLineDash([]);

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const o of s.objs) {
        const y = o.lane < 0 ? OUT_Y * H : LANES[o.lane] * H;
        if (o.kind === 'station') {
          const g = ctx.createLinearGradient(o.x, H, o.x, 0);
          g.addColorStop(0, 'rgba(61,220,132,0.45)'); g.addColorStop(1, 'rgba(61,220,132,0.03)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(o.x - 10, H); ctx.lineTo(o.x - W * 0.09, 0); ctx.lineTo(o.x + W * 0.09, 0); ctx.lineTo(o.x + 10, H); ctx.fill();
          // dish on a mast (drawn, so it looks the same on every computer)
          ctx.fillStyle = '#cfd6e6'; ctx.fillRect(o.x - 3, H - 40, 6, 30);
          ctx.beginPath(); ctx.ellipse(o.x, H - 46, 22, 10, -0.5, 0, Math.PI); ctx.fill();
          ctx.strokeStyle = '#3ddc84'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(o.x + 6, H - 58, 8 + (s.t * 20) % 10, -1.2, 0.2); ctx.stroke();
        } else if (o.kind === 'target') {
          if (o.done) continue;
          ctx.globalAlpha = o.lane < 0 ? 0.55 : 1;
          drawTarget(ctx, kind, o.x, y, s.t, o.spin);
          ctx.globalAlpha = 1;
        } else {
          if (o.done) continue;
          ctx.save(); ctx.translate(o.x, y); ctx.rotate(o.spin + s.t * 2);
          ctx.fillStyle = '#9aa1ad'; ctx.strokeStyle = '#4b5160'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-16, -6); ctx.lineTo(-4, -16); ctx.lineTo(14, -10); ctx.lineTo(16, 8); ctx.lineTo(0, 16); ctx.lineTo(-14, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      }

      // satellite
      const sx = W * SAT_X, sy = (LANES[0] + (LANES[2] - LANES[0]) * (s.y / 2)) * H;
      const blink = s.t < s.invuln && Math.floor(s.t * 12) % 2 === 0;
      if (!blink) {
        ctx.save(); ctx.translate(sx, sy); ctx.rotate((control.current.lane - s.y) * 0.25);
        ctx.fillStyle = '#2b56c9'; ctx.fillRect(-46, -8, 30, 16); ctx.fillRect(16, -8, 30, 16);
        ctx.strokeStyle = '#8fb0ff'; ctx.lineWidth = 1; ctx.strokeRect(-46, -8, 30, 16); ctx.strokeRect(16, -8, 30, 16);
        ctx.fillStyle = asleep ? '#7a6630' : '#f1b93a'; ctx.fillRect(-15, -15, 30, 30);
        ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(0, 18, 6, 0, Math.PI * 2); ctx.fill();
        if (s.contact) { ctx.strokeStyle = 'rgba(61,220,132,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 30 + (s.t * 30) % 14, 0, Math.PI * 2); ctx.stroke(); }
        if (p.hearts > 3 && s.hearts > 3) { ctx.strokeStyle = 'rgba(77,210,255,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke(); }
        if (safe) { ctx.strokeStyle = 'rgba(255,210,63,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        ctx.restore();
      }

      if (++hudTick % 6 === 0) setHud({ t: s.t, battery: s.battery, memory: s.memory, delivered: s.delivered, hearts: s.hearts, shadow, contact: s.contact, asleep, flash: s.t < s.flashUntil ? s.flash : '', safe, storm: s.storm });
      (window as unknown as Record<string, unknown>).__g2d = s;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const move = (d: number) => { control.current.lane = Math.max(0, Math.min(2, control.current.lane + d)); };
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'w', 'W', 'ц', 'Ц'].includes(e.key)) { e.preventDefault(); move(-1); }
      if (['ArrowDown', 's', 'S', 'ы', 'Ы'].includes(e.key)) { e.preventDefault(); move(1); }
      if (e.key === ' ' && p.storms > 0) { e.preventDefault(); control.current.safe = !control.current.safe; }
    };
    window.addEventListener('keydown', onKey);
    (window as unknown as Record<string, unknown>).__g2dMove = move;
    (window as unknown as Record<string, unknown>).__g2dSafe = (on: boolean) => { control.current.safe = on; };
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKey); };
  }, [p, m, t]);

  const tap = (d: number) => { control.current.lane = Math.max(0, Math.min(2, control.current.lane + d)); };
  const duration = p.orbitSec * p.orbits;
  const ph = (hud.t / p.orbitSec) % 1;
  const lap = Math.min(p.orbits, Math.floor(hud.t / p.orbitSec) + 1);

  return (
    <div className="runner-stage g2d-flight">
      <canvas ref={canvas} className="g2d-canvas" />
      <div className="r-hud top">
        <div className="r-goal"><b>📡 {Math.floor(hud.delivered)} / {p.goal}</b><small>{t(m.targets.label)} {t('delivered')}</small></div>
        <div className="r-mem">💾 {Array.from({ length: p.memory }, (_, i) => <span key={i} className={i < Math.round(hud.memory) ? 'full' : ''} />)}</div>
        <div className="r-hp">{Array.from({ length: p.hearts }, (_, i) => <span key={i}>{i < hud.hearts ? '❤️' : '🖤'}</span>)}</div>
        <div className="r-orbit">
          <small>{m.laps ? t('Orbit {n} of {m}', { n: lap, m: p.orbits }) : t('Year {n} of {m}', { n: lap, m: p.orbits })}</small>
          <div className="r-strip">
            <div className="shadow" style={{ left: `${(0.5 - p.shadowFraction / 2) * 100}%`, width: `${p.shadowFraction * 100}%` }} />
            <div className="you" style={{ left: `${ph * 100}%` }} />
          </div>
          <div className="mini-track"><div style={{ width: `${Math.min(100, (hud.t / duration) * 100)}%` }} /></div>
        </div>
      </div>
      <div className="r-hud bottom">
        <div className={`r-chip ${hud.shadow ? 'night' : 'day'}`}>{hud.shadow ? t('🌑 Earth\'s shadow') : t('☀️ Sunlight - charging')}</div>
        <div className="r-battery">🔋<div className="r-bar"><div className={hud.battery < 25 ? 'low' : ''} style={{ width: `${hud.battery}%` }} /></div></div>
        {hud.contact && <div className="r-chip contact">{t('📡 Sending data home!')}</div>}
        {hud.storm > 0 && <div className="r-chip storm">{hud.storm === 1 ? t('⚠️ Solar storm coming') : t('☀️ Solar storm!')}</div>}
      </div>
      {hud.flash && <div className="r-flash">{hud.flash}</div>}
      {hud.t < 5 && <div className="r-tip">{t(TIPS[m.targets.kind])}{p.storms > 0 ? ' ' + t('SPACE = safe mode during solar storms.') : ''}</div>}
      <div className="g2d-touch">
        <button onPointerDown={() => tap(-1)} aria-label="up">▲</button>
        {p.storms > 0 && <button className={`safe ${hud.safe ? 'on' : ''}`} onPointerDown={() => { control.current.safe = !control.current.safe; }} aria-label="safe mode">🛡️</button>}
        <button onPointerDown={() => tap(1)} aria-label="down">▼</button>
      </div>
    </div>
  );
}

const TIPS: Record<TargetKind, string> = {
  star: '↑ ↓ to change lane. Fly over ✦ to take a photo, then over 📡 to send it home!',
  fire: '↑ ↓ to change lane. Fly over 🔥 to photograph, then over 📡 to send photos home!',
  ice: '↑ ↓ to change lane. Fly over glaciers to photograph them, then over 📡 to send photos home!',
  storm: '↑ ↓ to change lane. Fly over 🌀 hurricanes to image them and send the images home!',
  particle: '↑ ↓ to change lane. Fly through particle clouds to measure them, then over 📡 to send data home!',
  city: '↑ ↓ to change lane. Fly over cities to photograph them, then over 📡 to send photos home!',
};

/** Targets are drawn with shapes so they look the same on every computer (no emoji fonts needed). */
function drawTarget(ctx: CanvasRenderingContext2D, kind: TargetKind, x: number, y: number, time: number, spin: number) {
  const pulse = 1 + Math.sin(time * 6 + x * 0.05) * 0.08;
  const glow = (r: number, inner: string, outer: string) => {
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, inner); g.addColorStop(1, outer);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  };
  if (kind === 'fire') {
    const f = 1 + Math.sin(time * 14 + x) * 0.08;
    glow(30, 'rgba(255,170,40,0.55)', 'rgba(255,90,0,0)');
    const flame = (sc: number, col: string) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - 20 * sc * f); ctx.bezierCurveTo(x + 12 * sc, y - 6 * sc, x + 11 * sc, y + 10 * sc, x, y + 11 * sc); ctx.bezierCurveTo(x - 11 * sc, y + 10 * sc, x - 12 * sc, y - 6 * sc, x, y - 20 * sc * f); ctx.fill(); };
    flame(1, '#ff5a1f'); flame(0.6, '#ffd23f');
  } else if (kind === 'star') {
    glow(28, 'rgba(255,230,120,0.5)', 'rgba(255,230,120,0)');
    ctx.fillStyle = '#ffe066'; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? 6 : 17 * pulse, a = (i / 8) * Math.PI * 2 - Math.PI / 2; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  } else if (kind === 'ice') {
    // a turquoise iceberg - clearly not grey space junk
    glow(30, 'rgba(90,230,255,0.6)', 'rgba(90,230,255,0)');
    ctx.fillStyle = '#5fe3ff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath();
    ctx.moveTo(x - 18, y + 10); ctx.lineTo(x - 9, y - 8); ctx.lineTo(x - 2, y - 2); ctx.lineTo(x + 5, y - 18 * pulse); ctx.lineTo(x + 18, y + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x + 5, y - 18 * pulse); ctx.lineTo(x + 10, y - 6); ctx.lineTo(x + 1, y - 7); ctx.closePath(); ctx.fill();
  } else if (kind === 'storm') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-time * 3 + spin);
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) { const a = arm * Math.PI + i * 0.22, r = 3 + i * 1.05; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.stroke();
    }
    ctx.fillStyle = '#9ad1ff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (kind === 'particle') {
    glow(30 * pulse, 'rgba(190,120,255,0.6)', 'rgba(120,60,255,0)');
    ctx.fillStyle = '#e9d5ff';
    for (let i = 0; i < 6; i++) { const a = spin + time * 2 + i * 1.05; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 12, y + Math.sin(a * 1.3) * 10, 3, 0, Math.PI * 2); ctx.fill(); }
  } else {
    // city: a little skyline
    glow(28, 'rgba(255,220,150,0.35)', 'rgba(255,220,150,0)');
    ctx.fillStyle = '#d8dde8'; ctx.strokeStyle = '#59607a'; ctx.lineWidth = 1.5;
    const blocks = [[-15, 10, 8, 18], [-6, 10, 9, 26], [4, 10, 7, 14], [12, 10, 6, 21]];
    for (const [bx, by, bw, bh] of blocks) { ctx.fillRect(x + bx, y + by - bh, bw, bh); ctx.strokeRect(x + bx, y + by - bh, bw, bh); }
    ctx.fillStyle = '#ffd86b';
    for (const [bx, by, bw, bh] of blocks) for (let wy = by - bh + 4; wy < by - 3; wy += 6) ctx.fillRect(x + bx + bw / 2 - 1, y + wy, 2, 2);
  }
}
