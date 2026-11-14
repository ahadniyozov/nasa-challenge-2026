// Launch cinematic before every flight: countdown → lift-off → staging → fairing opens → satellite released.
// The rocket's size follows the chosen launcher; the target altitude follows the chosen orbit. Click / any key skips.
import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { sfx } from '../game3d/audio';
import type { Build } from './config';

const ROCKET: Record<string, { w: number; h: number; boosters: boolean; color: string; name: string }> = {
  rideshare: { w: 34, h: 190, boosters: false, color: '#f2f4f8', name: 'Rideshare' },
  medium: { w: 42, h: 230, boosters: false, color: '#f2f4f8', name: 'Medium' },
  heavy: { w: 46, h: 260, boosters: true, color: '#f2f4f8', name: 'Heavy' },
};
const ORBIT_KM: Record<string, number> = { 'leo-400': 400, 'sso-550': 550, 'sso-800': 800, 'meo-8000': 8000, geo: 35786 };

const COUNT = 3; // countdown seconds
const T_STAGE = COUNT + 2.6, T_FAIRING = COUNT + 3.6, T_RELEASE = COUNT + 4.3, T_END = COUNT + 6;

export function Launch2D({ build, onDone }: { build: Build; onDone(): void }) {
  const { t } = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [caption, setCaption] = useState('');
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    const R = ROCKET[build.rocket] ?? ROCKET.rideshare;
    const km = ORBIT_KM[build.orbit] ?? 500;
    const smoke: { x: number; y: number; r: number; vx: number; vy: number; a: number }[] = [];
    const stars = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.3 }));
    let raf = 0, start = performance.now(), last = start, finished = false, lastCap = '';

    const resize = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = r.width * dpr; cv.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    let beeps = 0, roared = false;
    const finish = () => { if (!finished) { finished = true; doneRef.current(); } };
    const cap = (s: string) => { if (s !== lastCap) { lastCap = s; setCaption(s); } };

    const frame = (now: number) => {
      const W = cv.clientWidth, H = cv.clientHeight;
      const tt = (now - start) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
      const fly = Math.max(0, tt - COUNT); // seconds since lift-off
      const climb = fly * fly * 120; // px the rocket has risen (accelerating)
      const scale = Math.min(1, H / 620);
      const space = Math.min(1, climb / (H * 2.2)); // 0 = ground, 1 = space

      // sky: blue → black, stars fade in
      const g = ctx.createLinearGradient(0, 0, 0, H);
      const mix = (a: number[], b: number[], k: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
      g.addColorStop(0, mix([70, 130, 220], [2, 4, 16], space));
      g.addColorStop(1, mix([170, 205, 245], [8, 12, 40], space));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      for (const s of stars) { ctx.globalAlpha = space * 0.9; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;

      // camera follows the rocket once it leaves the pad
      const cam = Math.max(0, climb - H * 0.25);
      const groundY = H * 0.86 + cam;
      const cx = W / 2;

      // Earth's curve appears when high up
      if (space > 0.55) {
        const k = (space - 0.55) / 0.45;
        const rr = W * 2.2;
        ctx.fillStyle = '#1d5fb8'; ctx.beginPath(); ctx.arc(cx, H + rr - H * 0.16 * k, rr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(120,200,255,0.8)'; ctx.lineWidth = 6; ctx.stroke();
      }

      // ground, pad and tower
      if (groundY < H + 200) {
        ctx.fillStyle = '#3c7a3a'; ctx.fillRect(0, groundY, W, H);
        ctx.fillStyle = '#6d6f76'; ctx.fillRect(cx - 90 * scale, groundY - 10, 180 * scale, 10);
        ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 4;
        const tx = cx + (R.w / 2 + 26) * scale, th = R.h * 1.05 * scale;
        ctx.beginPath(); ctx.moveTo(tx, groundY - 10); ctx.lineTo(tx, groundY - 10 - th); ctx.stroke();
        for (let y = 0; y < th; y += 22) { ctx.beginPath(); ctx.moveTo(tx, groundY - 10 - y); ctx.lineTo(tx + 14, groundY - 22 - y); ctx.stroke(); }
        // arm swings away at lift-off
        const arm = Math.min(1, fly * 2);
        ctx.save(); ctx.translate(tx, groundY - 10 - th * 0.8); ctx.rotate(arm * 0.9); ctx.fillStyle = '#c0392b'; ctx.fillRect(-26 * scale, -3, 26 * scale, 6); ctx.restore();
      }

      // rocket
      const rw = R.w * scale, rh = R.h * scale;
      const shake = tt > COUNT - 0.6 && fly < 1.5 ? (Math.random() - 0.5) * 3 : 0;
      const base = groundY - 10 - climb + shake;
      const staged = tt > T_STAGE, open = tt > T_FAIRING, released = tt > T_RELEASE;
      const upperH = rh * 0.42;

      // spent first stage falls away
      if (staged) {
        const k = tt - T_STAGE;
        ctx.save(); ctx.translate(cx - 10 * k, base + k * k * 160 + rh * 0.3); ctx.rotate(-0.4 * k);
        ctx.fillStyle = R.color; ctx.fillRect(-rw / 2, -rh * 0.3, rw, rh * 0.58);
        ctx.restore();
      }
      const bodyTop = base - rh;
      const stageBottom = staged ? base - rh * 0.58 : base;

      // flame + smoke
      if (tt > COUNT - 0.4 && !released) {
        const fl = (staged ? 0.6 : 1) * (0.8 + Math.random() * 0.3);
        const fy = stageBottom;
        const fg = ctx.createLinearGradient(0, fy, 0, fy + 90 * fl * scale);
        fg.addColorStop(0, '#fff6c2'); fg.addColorStop(0.3, '#ffb03a'); fg.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = fg; ctx.beginPath();
        ctx.moveTo(cx - rw * 0.35, fy); ctx.quadraticCurveTo(cx, fy + 120 * fl * scale, cx + rw * 0.35, fy); ctx.fill();
        if (R.boosters && !staged) for (const side of [-1, 1]) {
          const bx = cx + side * (rw / 2 + 7 * scale);
          ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(bx - 7 * scale, fy); ctx.quadraticCurveTo(bx, fy + 80 * fl * scale, bx + 7 * scale, fy); ctx.fill();
        }
        if (space < 0.6) for (let i = 0; i < 3; i++) smoke.push({ x: cx + (Math.random() - 0.5) * rw, y: fy + 30 * scale - cam, r: 14 + Math.random() * 10, vx: (Math.random() - 0.5) * (fly < 1 ? 220 : 40), vy: 10 + Math.random() * 30, a: 0.75 });
      }
      for (const p of smoke) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.r += 26 * dt; p.a -= 0.22 * dt;
        if (p.a <= 0) continue;
        ctx.fillStyle = `rgba(235,235,240,${p.a})`; ctx.beginPath(); ctx.arc(p.x, p.y + cam, p.r, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = smoke.length - 1; i >= 0; i--) if (smoke[i].a <= 0) smoke.splice(i, 1);

      // body
      if (!released) {
        ctx.fillStyle = R.color; ctx.strokeStyle = '#9aa3b5'; ctx.lineWidth = 1.5;
        ctx.fillRect(cx - rw / 2, bodyTop + upperH * 0.35, rw, stageBottom - bodyTop - upperH * 0.35);
        ctx.strokeRect(cx - rw / 2, bodyTop + upperH * 0.35, rw, stageBottom - bodyTop - upperH * 0.35);
        ctx.fillStyle = '#2b56c9'; ctx.fillRect(cx - rw / 2, bodyTop + upperH * 0.9, rw, 6 * scale); // stripe
        if (!staged) {
          // fins + boosters
          ctx.fillStyle = '#2b2f3a';
          ctx.beginPath(); ctx.moveTo(cx - rw / 2, base - 30 * scale); ctx.lineTo(cx - rw / 2 - 14 * scale, base); ctx.lineTo(cx - rw / 2, base); ctx.fill();
          ctx.beginPath(); ctx.moveTo(cx + rw / 2, base - 30 * scale); ctx.lineTo(cx + rw / 2 + 14 * scale, base); ctx.lineTo(cx + rw / 2, base); ctx.fill();
          if (R.boosters) for (const side of [-1, 1]) {
            ctx.fillStyle = '#e8eaf0'; ctx.fillRect(cx + side * (rw / 2 + 7 * scale) - 7 * scale, base - rh * 0.55, 14 * scale, rh * 0.55);
            ctx.beginPath(); ctx.moveTo(cx + side * (rw / 2 + 7 * scale) - 7 * scale, base - rh * 0.55); ctx.lineTo(cx + side * (rw / 2 + 7 * scale), base - rh * 0.62); ctx.lineTo(cx + side * (rw / 2 + 7 * scale) + 7 * scale, base - rh * 0.55); ctx.fill();
          }
        }
      }

      // fairing: two halves open and drift away, the satellite comes out
      const noseH = upperH * 0.6, noseY = bodyTop + upperH * 0.35;
      const split = open ? (tt - T_FAIRING) : 0;
      for (const side of [-1, 1]) {
        if (released && split > 2) break;
        ctx.save(); ctx.translate(cx + side * split * 70, noseY + split * split * 40); ctx.rotate(side * split * 0.8);
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#9aa3b5';
        ctx.beginPath(); ctx.moveTo(0, -noseH); ctx.quadraticCurveTo(side * rw * 0.55, -noseH * 0.4, side * rw / 2, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      if (open) {
        const k = released ? (tt - T_RELEASE) : 0;
        const sy = noseY - noseH * 0.45 - k * 60;
        const wing = Math.min(1, k * 1.5) * 26 * scale;
        ctx.save(); ctx.translate(cx, sy); ctx.rotate(k * 0.3);
        ctx.fillStyle = '#2b56c9'; if (wing > 1) { ctx.fillRect(-9 * scale - wing, -5, wing, 10); ctx.fillRect(9 * scale, -5, wing, 10); }
        ctx.fillStyle = '#f1b93a'; ctx.fillRect(-9 * scale, -9 * scale, 18 * scale, 18 * scale);
        ctx.restore();
      }

      // sounds: a beep each countdown second, engine roar at lift-off
      if (tt < COUNT && Math.floor(tt) >= beeps) { beeps++; sfx.countdown(); }
      if (tt >= COUNT && !roared) { roared = true; sfx.countdown(true); sfx.liftoff(); }

      // captions
      if (tt < COUNT) cap(String(COUNT - Math.floor(tt)));
      else if (fly < 1.2) cap(t('Lift-off!'));
      else if (tt < T_STAGE) cap(t('Climbing to {km} km…', { km: km.toLocaleString() }));
      else if (tt < T_FAIRING) cap(t('First stage separation'));
      else if (tt < T_RELEASE) cap(t('Fairing opens'));
      else cap(t('Spacecraft separation. In orbit'));

      if (tt > T_END) finish();
      else raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const skip = (e: KeyboardEvent) => { if (e.key !== 'Tab') finish(); };
    window.addEventListener('keydown', skip);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('keydown', skip); };
  }, [build, t]);

  const R = ROCKET[build.rocket] ?? ROCKET.rideshare;
  return (
    <div className="runner-stage g2d-launch" onClick={() => doneRef.current()}>
      <canvas ref={canvas} className="g2d-canvas" />
      <div className={`g2d-countdown ${/^\d$/.test(caption) ? 'big' : ''}`} key={caption}>{caption}</div>
      <div className="g2d-launch-info">{t('{rocket} rocket to {km} km', { rocket: t(R.name), km: (ORBIT_KM[build.orbit] ?? 0).toLocaleString() })}</div>
      <div className="g2d-skip">{t('Click to skip')}</div>
    </div>
  );
}
