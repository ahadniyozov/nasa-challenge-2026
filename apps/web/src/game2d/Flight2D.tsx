// 2D vertical scroller: the satellite flies up over a scrolling map of the mission's part of Earth.
// The rules live in sim.ts (shared with the 3D flight); this file only draws SimState on a canvas.
// Distances in the sim are seconds of flight; here one second = SPEED × screen height.
import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import type { FlightParams } from './config';
import { FlightHud, FlightMessages, hudOf, initialHud, playFlightSounds, useFlightControls } from './FlightHud';
import type { Mission, TargetKind } from './missions';
import { createSim, stepSim, type FlightStats } from './sim';

export type { FlightStats } from './sim';

// The ground track runs bottom → top (the map is turned so east is up, north is left).
// The satellite sits at SAT_X of the height; objects `ahead` seconds away are SPEED × H × ahead pixels higher.
const SAT_X = 0.28;
const SPEED = 0.42; // screen heights per second
const gapOf = (W: number) => Math.min(W * 0.22, 150);
const laneX = (W: number, l: number) => (l < 0 ? Math.max(26, W / 2 - gapOf(W) * 2.3) : W / 2 + (l - 1) * gapOf(W));
/** each object gets its own fixed spin from its id (looks random, same every time) */
const spinOf = (id: number) => (id * 2.399) % (Math.PI * 2);

export function Flight2D({ p, m, onEnd, seed }: { p: FlightParams; m: Mission; onEnd(s: FlightStats): void; seed?: number }) {
  const { t } = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState(() => initialHud(p));
  const control = useFlightControls(p, 'g2d');
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    const day = new Image(); day.src = '/textures/earth-day.webp';
    const night = new Image(); night.src = '/textures/earth-night.webp';
    const kind = m.targets.kind;
    const [north, south] = m.targets.band;
    const s = createSim(p, m, seed);
    const msgs = new FlightMessages(t);
    const w = window as unknown as Record<string, unknown>;
    w.__g2d = s;
    let scroll = 0, shadowMix = 0, endTimer = 0;

    let raf = 0, last = performance.now(), hudTick = 0;
    const resize = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = r.width * dpr; cv.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const W = cv.clientWidth, H = cv.clientHeight;
      stepSim(s, dt, control.current);
      msgs.take(s);
      playFlightSounds(s);
      if (s.events.some((e) => e.type === 'end')) endTimer = window.setTimeout(() => endRef.current({ ...s.stats }), 900);
      const shadow = s.shadow, safe = s.safe;

      // ---- draw
      shadowMix += ((shadow ? 1 : 0) - shadowMix) * Math.min(1, dt * 3);
      ctx.fillStyle = '#04081c'; ctx.fillRect(0, 0, W, H);
      const gap = gapOf(W);
      if (day.complete && day.naturalWidth) {
        // the mission's latitude band of the map, turned so the west → east track scrolls downwards
        // show at least 90° of latitude across the screen so the map is not blown up on wide screens
        const span = Math.max(north - south, 90), mid = Math.max(-90 + span / 2, Math.min(90 - span / 2, (north + south) / 2));
        const sy = day.naturalHeight * ((90 - (mid + span / 2)) / 180), sh = day.naturalHeight * (span / 180), sw = Math.min(day.naturalWidth * 0.6, sh * (H / W));
        scroll = (scroll + (s.ended ? 0 : dt * sw * (p.alwaysInContact ? 0.02 : 0.16))) % day.naturalWidth;
        const drawMap = (img: HTMLImageElement, alpha: number) => {
          ctx.save(); ctx.globalAlpha = alpha;
          ctx.translate(0, H); ctx.rotate(-Math.PI / 2); // x → up the screen (east), y → right (south)
          const x0 = scroll, first = Math.min(sw, img.naturalWidth - x0);
          ctx.drawImage(img, x0, sy, first, sh, 0, 0, (first / sw) * H, W);
          if (first < sw) ctx.drawImage(img, 0, sy, sw - first, sh, (first / sw) * H, 0, ((sw - first) / sw) * H, W);
          ctx.restore();
        };
        drawMap(day, 1);
        ctx.fillStyle = `rgba(2,6,24,${0.72 * shadowMix})`; ctx.fillRect(0, 0, W, H);
        if (night.complete && shadowMix > 0.05) drawMap(night, 0.9 * shadowMix);
      }
      // solar storm tint
      if (s.storm === 2) { ctx.fillStyle = `rgba(255,140,30,${0.16 + Math.sin(s.t * 9) * 0.06})`; ctx.fillRect(0, 0, W, H); }
      // lanes
      ctx.strokeStyle = 'rgba(77,210,255,0.22)'; ctx.setLineDash([10, 14]); ctx.lineWidth = 2;
      for (const l of [0, 1, 2]) { const x = laneX(W, l); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      // compass: north is to the left
      ctx.setLineDash([]); ctx.font = '800 13px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const north_ = t('◀ North');
      ctx.fillStyle = 'rgba(4,8,28,0.6)'; ctx.fillRect(6, H * 0.5 - 12, ctx.measureText(north_).width + 10, 24);
      ctx.fillStyle = '#cfe6ff'; ctx.fillText(north_, 11, H * 0.5);
      // the orbit's northern limit
      if (!p.reachesTargets) {
        const lx = W / 2 - gap * 1.6;
        ctx.strokeStyle = 'rgba(255,90,90,0.85)'; ctx.setLineDash([6, 8]);
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke(); ctx.setLineDash([]);
        const label = t('◀ your orbit never flies north of this line');
        ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        const lw = Math.min(ctx.measureText(label).width, W - lx - 16);
        ctx.fillStyle = 'rgba(40,6,12,0.8)'; ctx.fillRect(lx + 4, H * 0.2, lw + 12, 22);
        ctx.fillStyle = '#ff9a9a'; ctx.fillText(label, lx + 10, H * 0.2 + 4, lw);
      }

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const satY = H * (1 - SAT_X), px = H * SPEED;
      for (const o of s.objects) {
        const x = laneX(W, o.lane), y = satY - o.ahead * px;
        if (y < -80 || y > H + 80) continue;
        if (o.kind === 'station') {
          // a station's radio cone reaches across the track from the dish at the edge
          const bh = H * 0.09;
          const g = ctx.createLinearGradient(W, y, 0, y);
          g.addColorStop(0, 'rgba(61,220,132,0.45)'); g.addColorStop(1, 'rgba(61,220,132,0.04)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(W, y - 10); ctx.lineTo(0, y - bh); ctx.lineTo(0, y + bh); ctx.lineTo(W, y + 10); ctx.fill();
          ctx.fillStyle = '#cfd6e6'; ctx.fillRect(W - 40, y - 3, 30, 6);
          ctx.beginPath(); ctx.ellipse(W - 46, y, 10, 22, -0.5, Math.PI / 2, Math.PI * 1.5); ctx.fill();
          ctx.strokeStyle = '#3ddc84'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(W - 58, y - 6, 8 + (s.t * 20) % 10, Math.PI * 0.8, Math.PI * 1.4); ctx.stroke();
        } else if (o.kind === 'target') {
          if (o.done) continue;
          ctx.globalAlpha = o.lane < 0 ? 0.55 : 1;
          drawTarget(ctx, kind, x, y, s.t, spinOf(o.id));
          ctx.globalAlpha = 1;
        } else {
          if (o.done) continue;
          ctx.save(); ctx.translate(x, y); ctx.rotate(spinOf(o.id) + s.t * 2);
          ctx.fillStyle = '#9aa1ad'; ctx.strokeStyle = '#4b5160'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-16, -6); ctx.lineTo(-4, -16); ctx.lineTo(14, -10); ctx.lineTo(16, 8); ctx.lineTo(0, 16); ctx.lineTo(-14, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      }

      // satellite (flies "up"; wings left and right, camera dot looks down at Earth)
      const sx = W / 2 + (s.laneY - 1) * gap;
      const blink = s.invulnerable && Math.floor(s.t * 12) % 2 === 0;
      if (!blink) {
        ctx.save(); ctx.translate(sx, satY); ctx.rotate((s.lane - s.laneY) * 0.3);
        ctx.fillStyle = '#2b56c9'; ctx.fillRect(-46, -8, 30, 16); ctx.fillRect(16, -8, 30, 16);
        ctx.strokeStyle = '#8fb0ff'; ctx.lineWidth = 1; ctx.strokeRect(-46, -8, 30, 16); ctx.strokeRect(16, -8, 30, 16);
        ctx.fillStyle = s.asleep ? '#7a6630' : '#f1b93a'; ctx.fillRect(-15, -15, 30, 30);
        ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        if (s.contact) { ctx.strokeStyle = 'rgba(61,220,132,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 30 + (s.t * 30) % 14, 0, Math.PI * 2); ctx.stroke(); }
        if (p.hearts > 3 && s.hearts > 3) { ctx.strokeStyle = 'rgba(77,210,255,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke(); }
        if (safe) { ctx.strokeStyle = 'rgba(255,210,63,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        ctx.restore();
      }

      if (++hudTick % 6 === 0) setHud(hudOf(s, msgs.current(s)));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); clearTimeout(endTimer); window.removeEventListener('resize', resize); };
  }, [p, m, t, seed, control]);

  return (
    <div className="runner-stage g2d-flight">
      <canvas ref={canvas} className="g2d-canvas" />
      <FlightHud p={p} m={m} hud={hud} control={control} />
    </div>
  );
}

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
