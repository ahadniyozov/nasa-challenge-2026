// 2D side-scroller: the satellite flies right over a scrolling map of Earth's northern forests.
// 3 lanes (↑ ↓). Fires photograph themselves when you pass over them; photos count only after a station.
import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import type { FlightParams } from './config';
import { MISSION } from './config';

export interface FlightStats {
  delivered: number;
  captured: number;
  lostInMemory: number;
  survived: boolean;
  decayed: boolean;
  hits: number;
  batteryOuts: number;
  memoryFull: number;
  nightMissed: number;
  blurry: number;
}

type Kind = 'fire' | 'debris' | 'station';
interface Obj { kind: Kind; lane: number; x: number; done: boolean; spin: number }

const LANES = [0.3, 0.52, 0.74]; // fraction of canvas height
const SAT_X = 0.2;

export function Flight2D({ p, onEnd }: { p: FlightParams; onEnd(s: FlightStats): void }) {
  const { t } = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState({ t: 0, battery: 100, memory: 0, delivered: 0, hearts: p.hearts, shadow: false, contact: false, asleep: false, flash: '' as string });
  const control = useRef({ lane: 1 });
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    const day = new Image(); day.src = '/textures/earth-day.webp';
    const night = new Image(); night.src = '/textures/earth-night.webp';

    const duration = p.orbitSec * p.orbits;
    const endAt = p.orbitSec * p.orbitsBeforeDecay;
    const s = {
      t: 0, y: 1, battery: 100, asleepUntil: 0, memory: 0, delivered: 0, hearts: p.hearts, invuln: 0,
      objs: [] as Obj[], nextFire: 1, nextDebris: 2.5, stations: new Set<string>(), scroll: 0, shadowMix: 0,
      flash: '', flashUntil: 0, ended: false, contact: false,
      st: { delivered: 0, captured: 0, lostInMemory: 0, survived: true, decayed: false, hits: 0, batteryOuts: 0, memoryFull: 0, nightMissed: 0, blurry: 0 } as FlightStats,
    };
    const say = (m: string, sec = 1.3) => { s.flash = m; s.flashUntil = s.t + sec; };
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
      const asleep = s.t < s.asleepUntil;

      if (!s.ended) {
        // mission end: planned end, decay, or destroyed
        if (s.t >= endAt && endAt < duration) { s.st.decayed = true; s.st.survived = false; say(t('🔥 The air pulled the satellite down - it burned up'), 3); finish(); }
        else if (s.t >= duration) finish();
        else if (s.hearts <= 0) { s.st.survived = false; finish(); }

        // battery
        if (shadow) s.battery -= p.shadowDrain * dt; else s.battery += p.sunCharge * dt;
        if (s.battery <= 0 && !asleep) { s.battery = 0; s.asleepUntil = s.t + 2.5; s.st.batteryOuts++; say(t('🪫 Battery empty - satellite asleep')); }
        s.battery = Math.max(0, Math.min(100, s.battery));

        // spawning
        if (s.t >= s.nextFire) { s.objs.push({ kind: 'fire', lane: Math.floor(Math.random() * 3), x: W + 40, done: false, spin: 0 }); s.nextFire = s.t + 1.8 + Math.random() * 1.2; }
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
          if (o.kind === 'fire' && !o.done && o.x <= satX) {
            o.done = true;
            if (!sameLane) continue;
            if (shadow && !p.nightVision) { s.st.nightMissed++; say(t('🌑 Too dark for this camera')); }
            else if (asleep) say(t('😴 Camera asleep'));
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
        // northern band of the map (≈ lat 75°N → 20°N), scrolling west → east
        const sy = day.naturalHeight * (15 / 180), sh = day.naturalHeight * (55 / 180), sw = sh * (W / H);
        s.scroll = (s.scroll + (s.ended ? 0 : dt * sw * 0.16)) % day.naturalWidth;
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
      // lanes
      ctx.strokeStyle = 'rgba(77,210,255,0.18)'; ctx.setLineDash([10, 14]); ctx.lineWidth = 2;
      for (const l of LANES) { ctx.beginPath(); ctx.moveTo(0, l * H); ctx.lineTo(W, l * H); ctx.stroke(); }
      ctx.setLineDash([]);

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const o of s.objs) {
        const y = LANES[o.lane] * H;
        if (o.kind === 'station') {
          const g = ctx.createLinearGradient(o.x, H, o.x, 0);
          g.addColorStop(0, 'rgba(61,220,132,0.45)'); g.addColorStop(1, 'rgba(61,220,132,0.03)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(o.x - 10, H); ctx.lineTo(o.x - W * 0.09, 0); ctx.lineTo(o.x + W * 0.09, 0); ctx.lineTo(o.x + 10, H); ctx.fill();
          // dish on a mast (drawn, so it looks the same on every computer)
          ctx.fillStyle = '#cfd6e6'; ctx.fillRect(o.x - 3, H - 40, 6, 30);
          ctx.beginPath(); ctx.ellipse(o.x, H - 46, 22, 10, -0.5, 0, Math.PI); ctx.fill();
          ctx.strokeStyle = '#3ddc84'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(o.x + 6, H - 58, 8 + (s.t * 20) % 10, -1.2, 0.2); ctx.stroke();
        } else if (o.kind === 'fire') {
          if (o.done) continue;
          // flame: glow + two tongues
          const f = 1 + Math.sin(s.t * 14 + o.x) * 0.08;
          const glow = ctx.createRadialGradient(o.x, y, 2, o.x, y, 30);
          glow.addColorStop(0, 'rgba(255,170,40,0.55)'); glow.addColorStop(1, 'rgba(255,90,0,0)');
          ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(o.x, y, 30, 0, Math.PI * 2); ctx.fill();
          const flame = (sc: number, col: string) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(o.x, y - 20 * sc * f); ctx.bezierCurveTo(o.x + 12 * sc, y - 6 * sc, o.x + 11 * sc, y + 10 * sc, o.x, y + 11 * sc); ctx.bezierCurveTo(o.x - 11 * sc, y + 10 * sc, o.x - 12 * sc, y - 6 * sc, o.x, y - 20 * sc * f); ctx.fill(); };
          flame(1, '#ff5a1f'); flame(0.6, '#ffd23f');
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
        ctx.restore();
      }

      if (++hudTick % 6 === 0) setHud({ t: s.t, battery: s.battery, memory: s.memory, delivered: s.delivered, hearts: s.hearts, shadow, contact: s.contact, asleep, flash: s.t < s.flashUntil ? s.flash : '' });
      (window as unknown as Record<string, unknown>).__g2d = s;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const move = (d: number) => { control.current.lane = Math.max(0, Math.min(2, control.current.lane + d)); };
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'w', 'W', 'ц', 'Ц'].includes(e.key)) { e.preventDefault(); move(-1); }
      if (['ArrowDown', 's', 'S', 'ы', 'Ы'].includes(e.key)) { e.preventDefault(); move(1); }
    };
    window.addEventListener('keydown', onKey);
    (window as unknown as Record<string, unknown>).__g2dMove = move;
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKey); };
  }, [p, t]);

  const tap = (d: number) => { control.current.lane = Math.max(0, Math.min(2, control.current.lane + d)); };
  const duration = p.orbitSec * p.orbits;
  const ph = (hud.t / p.orbitSec) % 1;

  return (
    <div className="runner-stage g2d-flight">
      <canvas ref={canvas} className="g2d-canvas" />
      <div className="r-hud top">
        <div className="r-goal"><b>📡 {Math.floor(hud.delivered)} / {MISSION.goalPhotos}</b><small>{t('fire photos delivered')}</small></div>
        <div className="r-mem">💾 {Array.from({ length: p.memory }, (_, i) => <span key={i} className={i < Math.round(hud.memory) ? 'full' : ''} />)}</div>
        <div className="r-hp">{Array.from({ length: p.hearts }, (_, i) => <span key={i}>{i < hud.hearts ? '❤️' : '🖤'}</span>)}</div>
        <div className="r-orbit">
          <small>{t('Year {n} of {m}', { n: Math.min(p.orbits, Math.floor(hud.t / p.orbitSec) + 1), m: p.orbits })}</small>
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
        {hud.contact && <div className="r-chip contact">{t('📡 Sending photos home!')}</div>}
      </div>
      {hud.flash && <div className="r-flash">{hud.flash}</div>}
      {hud.t < 5 && <div className="r-tip">{t('↑ ↓ to change lane. Fly over 🔥 to photograph, then over 📡 to send photos home!')}</div>}
      <div className="g2d-touch">
        <button onPointerDown={() => tap(-1)} aria-label="up">▲</button>
        <button onPointerDown={() => tap(1)} aria-label="down">▼</button>
      </div>
    </div>
  );
}
