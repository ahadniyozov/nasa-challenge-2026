// The satellite as a figure in an engineering drawing: realistic materials (gold MLI foil,
// dark solar cells with silver busbars, aluminium), every choice visible, with callouts naming the parts.
import { useMemo } from 'react';
import { useT } from '../i18n';
import { analyse, slotsFor, type Build, type SlotId } from './config';
import type { Mission } from './missions';
import { INSTRUMENT_INFO, MISSIONS } from './missions';

const BODY: Record<string, [number, number]> = { 'cubesat-3u': [52, 112], 'cubesat-12u': [92, 92], smallsat: [118, 110], 'medium-bus': [146, 132] };
const INK = '#1d2329';

export function SatelliteArt({ build, mission }: { build: Build; mission?: Mission }) {
  const { t } = useT();
  const m = mission ?? MISSIONS[1];
  const bus = useMemo(() => analyse(build, m).design.busId, [build, m]);
  const slots = useMemo(() => slotsFor(m), [m]);
  const [w, h] = BODY[bus] ?? [92, 92];
  const cx = 190, cy = 156, left = cx - w / 2, top = cy - h / 2;
  const wing = build.panels === 'solar-deploy-l' ? 112 : build.panels === 'solar-deploy-s' ? 66 : 0;
  // small satellites are drawn larger, so every part stays readable; the drawing always fits its frame
  const halfSpan = Math.max(w / 2 + (wing ? 10 + wing : 0), build.camera === 'magnetometer' ? w / 2 + 70 : 0, build.antenna === 'uhf' ? w / 2 + 32 : 0);
  const halfHeight = h / 2 + Math.max(build.antenna === 'x-band' ? 44 : build.antenna === 'uhf' ? 42 : 8, build.camera === 'cam-hires' ? 46 : build.camera === 'radiometer' ? 22 : 18);
  const sc = Math.min(1.9, 168 / halfSpan, 128 / halfHeight);
  const px = (x: number) => cx + (x - cx) * sc, py = (y: number) => cy + (y - cy) * sc;
  const optionTitle = (id: SlotId) => {
    const slot = slots.find((s) => s.id === id);
    const opt = slot?.options.find((o) => o.id === build[id]);
    if (opt) return t(opt.title);
    // the slot is locked on this mission: name the part from the full list
    const all = slotsFor({ ...m, slots: [id] }).find((x) => x.id === id);
    const o = all?.options.find((x) => x.id === build[id]);
    return o ? t(o.title) : '';
  };

  // solar cells: dark blue-black cells, thin silver busbars
  const cells = (x: number, y: number, ww: number, hh: number, key: string) => {
    const cols = Math.max(1, Math.round(ww / 16)), rows = Math.max(1, Math.round(hh / 13));
    const cw = ww / cols, ch = hh / rows;
    return (
      <g key={key}>
        <rect x={x} y={y} width={ww} height={hh} fill="#172238" stroke={INK} strokeWidth="1" />
        {Array.from({ length: cols * rows }, (_, i) => (
          <rect key={i} x={x + (i % cols) * cw + 1} y={y + Math.floor(i / cols) * ch + 1} width={cw - 2} height={ch - 2} fill="url(#cell)" />
        ))}
        {Array.from({ length: rows - 1 }, (_, i) => <line key={`b${i}`} x1={x} x2={x + ww} y1={y + (i + 1) * ch} y2={y + (i + 1) * ch} stroke="#8d99a8" strokeWidth=".5" />)}
      </g>
    );
  };

  const camY = top + h; // instruments look down at Earth (bottom of the drawing)
  const callouts: { x: number; y: number; label: string; caption: string }[] = [];
  callouts.push({ x: left + w - 4, y: top + 14, label: t('Body'), caption: t('gold MLI foil') });
  if (wing > 0) callouts.push({ x: left + w + 8 + wing * 0.7, y: cy - 22, label: t('Solar panels'), caption: optionTitle('panels') });
  else callouts.push({ x: left + w - 10, y: cy - 6, label: t('Solar panels'), caption: optionTitle('panels') });
  callouts.push({ x: cx + 16, y: top - (build.antenna === 'x-band' ? 40 : 10), label: t('Antenna'), caption: optionTitle('antenna') });
  const camSlot = slots.find((s) => s.id === 'camera');
  callouts.push({ x: build.camera === 'magnetometer' ? left - 60 : cx + 10, y: build.camera === 'magnetometer' ? cy + 46 : camY + 14, label: t(camSlot?.title ?? 'Camera'), caption: t(INSTRUMENT_INFO[build.camera]?.title ?? build.camera) });

  return (
    <svg viewBox="0 0 520 330" className="g2d-sat" role="img" aria-label={t('Drawing of your satellite')}>
      <defs>
        <linearGradient id="mli" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e7c46a" /><stop offset=".45" stopColor="#c8922a" /><stop offset=".7" stopColor="#e2b85a" /><stop offset="1" stopColor="#9c6d1b" />
        </linearGradient>
        <linearGradient id="cell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a3c62" /><stop offset="1" stopColor="#141f36" />
        </linearGradient>
        <linearGradient id="alu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6eaee" /><stop offset="1" stopColor="#a4adb6" />
        </linearGradient>
      </defs>

      {/* centre lines, like a drawing */}
      <line x1={cx} x2={cx} y1="16" y2="318" stroke="#9aa6b2" strokeWidth=".6" strokeDasharray="10 3 2 3" />
      <line x1="20" x2="360" y1={cy} y2={cy} stroke="#9aa6b2" strokeWidth=".6" strokeDasharray="10 3 2 3" />

      <g transform={`translate(${cx} ${cy}) scale(${sc}) translate(${-cx} ${-cy})`}>
      {build.shield === 'shield' && <rect x={left - 7} y={top - 7} width={w + 14} height={h + 14} rx="3" fill="none" stroke="#5f6b77" strokeWidth="1.2" strokeDasharray="5 3" />}

      {/* solar wings on aluminium yokes */}
      {wing > 0 && (
        <g>
          <rect x={left - 10} y={cy - 2} width="10" height="4" fill="url(#alu)" stroke={INK} strokeWidth=".8" />
          <rect x={left + w} y={cy - 2} width="10" height="4" fill="url(#alu)" stroke={INK} strokeWidth=".8" />
          {cells(left - 10 - wing, cy - 26, wing, 52, 'l')}
          {cells(left + w + 10, cy - 26, wing, 52, 'r')}
        </g>
      )}

      {/* antenna */}
      {build.antenna === 'uhf' && <line x1={left + w - 6} y1={top} x2={left + w + 30} y2={top - 42} stroke={INK} strokeWidth="1.6" strokeLinecap="round" />}
      {build.antenna === 's-band' && <rect x={cx - 16} y={top - 7} width="32" height="7" fill="#e9ecef" stroke={INK} strokeWidth=".8" />}
      {build.antenna === 'x-band' && (
        <g>
          <rect x={cx - 2} y={top - 20} width="4" height="20" fill="url(#alu)" stroke={INK} strokeWidth=".6" />
          <path d={`M${cx - 32} ${top - 42} Q${cx} ${top - 6} ${cx + 32} ${top - 42} Z`} fill="#f4f5f6" stroke={INK} strokeWidth="1" />
          <line x1={cx} y1={top - 26} x2={cx} y2={top - 44} stroke={INK} strokeWidth=".8" />
        </g>
      )}

      {/* body: gold MLI with seams; radiator strip; body-mounted cells */}
      <rect x={left} y={top} width={w} height={h} fill="url(#mli)" stroke={INK} strokeWidth="1.2" />
      <path d={`M${left + w * 0.3} ${top} l-${w * 0.08} ${h} M${left + w * 0.68} ${top} l${w * 0.06} ${h} M${left} ${top + h * 0.55} l${w} -${h * 0.08}`} stroke="#8a5f17" strokeWidth=".6" opacity=".7" fill="none" />
      <rect x={left + w - 10} y={top + 6} width="6" height={h - 12} fill="#eef1f3" stroke={INK} strokeWidth=".6" />
      {build.panels === 'solar-body' && cells(left + 6, top + 8, w - 20, h * 0.42, 'body')}
      {/* computer box, battery and memory as small labelled boxes on the bus */}
      <rect x={left + 6} y={top + h - 22} width={Math.min(34, w * 0.36)} height="14" fill="#2b333b" stroke={INK} strokeWidth=".6" />
      {build.computer === 'obc-rad' && <text x={left + 6 + Math.min(34, w * 0.36) / 2} y={top + h - 12} textAnchor="middle" fontSize="8" fontWeight="700" fill="#f2c463" fontFamily="Barlow, sans-serif">RAD</text>}

      {/* instruments */}
      {build.camera === 'cam-cubesat' && <g><rect x={cx - 10} y={camY} width="20" height="12" fill="url(#alu)" stroke={INK} strokeWidth=".8" /><ellipse cx={cx} cy={camY + 12} rx="7" ry="2.5" fill="#1d2329" /></g>}
      {build.camera === 'cam-thermal' && <g><rect x={cx - 15} y={camY} width="30" height="16" fill="url(#alu)" stroke={INK} strokeWidth=".8" /><ellipse cx={cx} cy={camY + 16} rx="10" ry="3.5" fill="#5a1d14" /></g>}
      {build.camera === 'cam-hires' && <g><rect x={cx - 20} y={camY} width="40" height="44" fill="#eef1f3" stroke={INK} strokeWidth="1" /><rect x={cx - 20} y={camY + 30} width="40" height="5" fill="#2b333b" /><ellipse cx={cx} cy={camY + 44} rx="18" ry="5" fill="#1d2329" /></g>}
      {build.camera === 'spectro' && <g><rect x={cx - 17} y={camY} width="34" height="22" fill="url(#alu)" stroke={INK} strokeWidth=".8" /><rect x={cx - 12} y={camY + 22} width="24" height="5" fill="#3c4b66" stroke={INK} strokeWidth=".6" /></g>}
      {build.camera === 'radiometer' && <g><path d={`M${cx - 28} ${camY} q28 40 56 0 z`} fill="#f4f5f6" stroke={INK} strokeWidth="1" /><circle cx={cx} cy={camY + 13} r="3" fill={INK} /></g>}
      {build.camera === 'magnetometer' && <g><line x1={left} y1={cy + 12} x2={left - 58} y2={cy + 46} stroke={INK} strokeWidth="1.4" /><rect x={left - 68} y={cy + 40} width="16" height="12" fill="url(#alu)" stroke={INK} strokeWidth=".8" /></g>}
      {build.camera === 'radiation-mon' && <g><rect x={cx - 11} y={camY} width="22" height="14" fill="url(#alu)" stroke={INK} strokeWidth=".8" /><circle cx={cx} cy={camY + 7} r="4" fill="#2b333b" /></g>}
      {/* thruster nozzle */}
      {build.thruster === 'prop-cold' && <path d={`M${left + w} ${cy + 18} l14 -6 l0 20 l-14 -6 z`} fill="url(#alu)" stroke={INK} strokeWidth=".8" />}

      </g>

      {/* callouts: leader lines to a label column on the right, in the same order as their anchors */}
      {callouts.map((c) => ({ ...c, x: px(c.x), y: py(c.y) })).sort((p1, p2) => p1.y - p2.y).map((c, i, list) => {
        const ly = 40 + i * ((270 - 40) / Math.max(1, list.length - 1));
        return (
          <g key={i} fontFamily="Barlow, sans-serif">
            <circle cx={c.x} cy={c.y} r="2" fill={INK} />
            <polyline points={`${c.x},${c.y} ${Math.max(c.x + 14, 360)},${ly} 384,${ly}`} fill="none" stroke={INK} strokeWidth=".7" />
            <text x="390" y={ly - 2} fontSize="13" fill="#5f6b77">{c.label}</text>
            <text x="390" y={ly + 15} fontSize="15" fontWeight="600" fill={INK}>{c.caption}</text>
          </g>
        );
      })}
      <line x1="20" x2="360" y1="318" y2="318" stroke="#5f6b77" strokeWidth=".6" />
      <text x="24" y="312" fontSize="12" fill="#5f6b77" fontFamily="Barlow, sans-serif">{t('Earth (nadir)')}</text>
      <path d={`M${cx} 300 l-5 -9 h10 z`} fill="#5f6b77" />
    </svg>
  );
}
