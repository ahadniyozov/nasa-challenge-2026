// Flat 2D illustration of the satellite: every choice is visible on the drawing.
import { useMemo } from 'react';
import { analyse, type Build } from './config';
import type { Mission } from './missions';

const BODY: Record<string, [number, number]> = { 'cubesat-3u': [56, 120], 'cubesat-12u': [96, 96], smallsat: [124, 116], 'medium-bus': [150, 136] };

export function SatelliteArt({ build, mission }: { build: Build; mission?: Mission }) {
  const bus = useMemo(() => analyse(build, mission).design.busId, [build, mission]);
  const [w, h] = BODY[bus] ?? [96, 96];
  const cx = 200, cy = 150, left = cx - w / 2, top = cy - h / 2;
  const wing = build.panels === 'solar-deploy-l' ? 120 : build.panels === 'solar-deploy-s' ? 70 : 0;
  const cells = (x: number, y: number, ww: number, hh: number) => {
    const cols = Math.max(1, Math.round(ww / 18)), rows = Math.max(1, Math.round(hh / 14));
    return Array.from({ length: cols * rows }, (_, i) => (
      <rect key={i} x={x + (i % cols) * (ww / cols) + 1.5} y={y + Math.floor(i / cols) * (hh / rows) + 1.5} width={ww / cols - 3} height={hh / rows - 3} rx="1.5" fill="#2b56c9" stroke="#8fb0ff" strokeWidth="0.6" />
    ));
  };
  const batteryBars = build.battery === 'batt-l' ? 3 : build.battery === 'batt-m' ? 2 : 1;
  const memory = build.memory === 'm12' ? 12 : build.memory === 'm8' ? 8 : 4;

  return (
    <svg viewBox="0 0 400 320" className="g2d-sat" role="img" aria-label="satellite">
      <defs><linearGradient id="rainbow"><stop offset="0" stopColor="#f33" /><stop offset=".33" stopColor="#fd3" /><stop offset=".66" stopColor="#3d6" /><stop offset="1" stopColor="#38f" /></linearGradient></defs>
      {/* stars */}
      {[[30, 40], [80, 260], [350, 50], [370, 230], [130, 30], [300, 290], [50, 160], [340, 140]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 1.2 : 2} fill="#fff" opacity="0.6" />)}
      {build.shield === 'shield' && <circle cx={cx} cy={cy} r={Math.max(w, h) / 2 + wing + 18} fill="#4dd2ff" fillOpacity="0.08" stroke="#4dd2ff" strokeOpacity="0.5" strokeWidth="3" strokeDasharray="8 6" />}

      {/* solar wings */}
      {wing > 0 && (
        <g>
          <rect x={left - 8} y={cy - 3} width="8" height="6" fill="#aaa" />
          <rect x={left + w} y={cy - 3} width="8" height="6" fill="#aaa" />
          {cells(left - 8 - wing, cy - 26, wing, 52)}
          {cells(left + w + 8, cy - 26, wing, 52)}
        </g>
      )}

      {/* antenna */}
      {build.antenna === 'uhf' && <line x1={left + w - 6} y1={top} x2={left + w + 34} y2={top - 44} stroke="#ddd" strokeWidth="3" strokeLinecap="round" />}
      {build.antenna === 's-band' && <rect x={cx - 18} y={top - 8} width="36" height="8" rx="2" fill="#c9a96e" />}
      {build.antenna === 'x-band' && (
        <g>
          <line x1={cx} y1={top} x2={cx} y2={top - 22} stroke="#bbb" strokeWidth="4" />
          <path d={`M${cx - 34} ${top - 44} Q${cx} ${top - 4} ${cx + 34} ${top - 44}`} fill="#f2f2f2" stroke="#ccc" strokeWidth="2" />
        </g>
      )}

      {/* body */}
      <rect x={left} y={top} width={w} height={h} rx="6" fill="#f1b93a" stroke="#a87412" strokeWidth="2" />
      {build.panels === 'solar-body' && cells(left + 8, top + 10, w - 16, h * 0.45)}
      {/* battery bars */}
      {Array.from({ length: batteryBars }, (_, i) => <rect key={i} x={left + 10} y={top + h - 18 - i * 11} width={w * 0.35} height="7" rx="2" fill="#3ddc84" />)}
      {/* memory chip */}
      <rect x={left + w - 34} y={top + h - 30} width="24" height="20" rx="3" fill="#1b2463" stroke="#4dd2ff" />
      <text x={left + w - 22} y={top + h - 16} textAnchor="middle" fontSize="11" fontWeight="800" fill="#4dd2ff">{memory}</text>

      {/* camera (looks down at Earth) */}
      {build.camera === 'cam-cubesat' && <g><rect x={cx - 12} y={top + h} width="24" height="14" rx="3" fill="#ddd" /><circle cx={cx} cy={top + h + 14} r="7" fill="#1c2a55" /></g>}
      {build.camera === 'cam-thermal' && <g><rect x={cx - 18} y={top + h} width="36" height="18" rx="4" fill="#ddd" /><circle cx={cx} cy={top + h + 18} r="10" fill="#7a1f1f" stroke="#ff6a3d" strokeWidth="3" /></g>}
      {build.camera === 'cam-hires' && <g><rect x={cx - 24} y={top + h} width="48" height="46" rx="6" fill="#e6e6e6" stroke="#aaa" /><ellipse cx={cx} cy={top + h + 46} rx="22" ry="7" fill="#1c2a55" /></g>}

      {/* thruster */}
      {build.camera === 'spectro' && <g><rect x={cx - 20} y={top + h} width="40" height="26" rx="4" fill="#ddd" /><rect x={cx - 14} y={top + h + 22} width="28" height="8" rx="2" fill="url(#rainbow)" /></g>}
      {build.camera === 'radiometer' && <g><path d={`M${cx - 30} ${top + h} q30 44 60 0 z`} fill="#e6e6e6" stroke="#aaa" /><circle cx={cx} cy={top + h + 14} r="4" fill="#555" /></g>}
      {build.camera === 'magnetometer' && <g><line x1={left} y1={cy + 10} x2={left - 60} y2={cy + 44} stroke="#ccc" strokeWidth="3" /><rect x={left - 72} y={cy + 38} width="18" height="14" rx="3" fill="#c0392b" /><rect x={left - 63} y={cy + 38} width="9" height="14" fill="#2c6fd1" /></g>}
      {build.camera === 'radiation-mon' && <g><rect x={cx - 12} y={top + h} width="24" height="16" rx="3" fill="#ffd23f" /><circle cx={cx} cy={top + h + 8} r="5" fill="#222" /></g>}
      {/* computer */}
      {build.computer === 'obc-rad'
        ? <g><rect x={cx - 16} y={cy + 4} width="32" height="22" rx="3" fill="#20304f" stroke="#4dd2ff" strokeWidth="2.5" /><text x={cx} y={cy + 19} textAnchor="middle" fontSize="11" fill="#4dd2ff" fontWeight="700">RAD</text></g>
        : <rect x={cx - 12} y={cy + 6} width="24" height="16" rx="2" fill="#20304f" stroke="#7d8bab" />}
      {build.thruster === 'prop-cold' && <path d={`M${left + w} ${cy + 18} l18 -8 l0 22 z`} fill="#777" />}
    </svg>
  );
}
