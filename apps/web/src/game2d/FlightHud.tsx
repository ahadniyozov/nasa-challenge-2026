// What the 2D and 3D flights share around the simulation: the HTML HUD over the canvas,
// keyboard / touch controls, the bot hooks and the messages for SimState.events.
import { useEffect, useRef, type MutableRefObject } from 'react';
import { sfx } from '../game3d/audio';
import { useT, type T } from '../i18n';
import type { FlightParams } from './config';
import type { Mission, TargetKind } from './missions';
import { botInput, flightDuration, type Lane, type SimEvent, type SimInput, type SimState } from './sim';
import './flighthud.css';

export interface HudState {
  t: number; battery: number; memory: number; delivered: number; hearts: number;
  shadow: boolean; contact: boolean; asleep: boolean; safe: boolean; storm: 0 | 1 | 2; log: LogEntry[];
}
/** good: data gained; info: a state change; warn: a problem the player can fix; bad: something lost */
export type Tone = 'good' | 'info' | 'warn' | 'bad';
export interface LogEntry { id: number; text: string; tone: Tone }
export const initialHud = (p: FlightParams): HudState => ({
  t: 0, battery: 100, memory: 0, delivered: 0, hearts: p.hearts, shadow: false, contact: false, asleep: false, safe: false, storm: 0, log: [],
});

/** Short messages for the flight's events: an operations log, the last three show for a moment under the HUD. */
export class FlightMessages {
  private log: (LogEntry & { until: number })[] = [];
  private n = 0;
  constructor(private t: T['t']) {}
  /** Reads this frame's events (call after every stepSim). */
  take(s: SimState) {
    for (const e of s.events) {
      const m = this.message(e, s);
      if (!m) continue;
      const last = this.log[this.log.length - 1];
      // the same message again only refreshes its time
      if (last && last.text === m[0] && last.until > s.t) { last.until = s.t + m[1]; continue; }
      this.log.push({ id: ++this.n, text: m[0], until: s.t + m[1], tone: m[2] });
      if (this.log.length > 3) this.log.shift();
    }
  }
  /** The messages still on screen, oldest first. */
  entries(s: SimState): LogEntry[] {
    return this.log.filter((e) => e.until > s.t).map(({ id, text, tone }) => ({ id, text, tone }));
  }
  private message(e: SimEvent, s: SimState): [string, number, Tone] | null {
    const t = this.t;
    switch (e.type) {
      case 'photo': return [t('Photo taken'), 1.1, 'good'];
      case 'contact': return null;
      case 'hit': return [t('Debris strike. One photo lost'), 1.8, 'bad'];
      case 'memoryFull': return [t('Memory full. Fly over a ground station'), 1.8, 'warn'];
      case 'dark': return [t('Too dark for this camera'), 1.6, 'warn'];
      case 'blurry': return [t('Too blurry from this altitude'), 1.6, 'warn'];
      case 'asleep': return [t('Satellite asleep'), 1.6, 'warn'];
      case 'outOfReach': {
        const n = s.stats.outOfReach;
        return n <= 2 || n % 4 === 0 ? [t('Out of reach: this orbit never flies that far north'), 2, 'warn'] : null;
      }
      case 'stormWarn': return [t('Solar storm ahead. Safe mode protects the computer'), 2.8, 'warn'];
      case 'stormSafe': return [t('Safe mode: asleep, but safe'), 1.6, 'info'];
      case 'stormSurvived': return [t('Hardened computer kept working'), 2.2, 'good'];
      case 'stormHit': return [t('Radiation crashed the computer. Memory lost'), 2.6, 'bad'];
      case 'batteryOut': return [t('Battery empty. Satellite asleep'), 1.8, 'bad'];
      case 'decay': return [t('Orbit decayed. The satellite burned up'), 3, 'bad'];
      case 'wornOut': return [t('Parts wore out. The satellite stopped working'), 3, 'bad'];
      case 'end': return null;
    }
  }
}

/** Sounds for this frame's events (call after every stepSim, in 2D and 3D). */
export function playFlightSounds(s: SimState) {
  for (const e of s.events) {
    switch (e.type) {
      case 'photo': sfx.photo(); break;
      case 'hit': sfx.hit(); break;
      case 'contact': sfx.station(); break;
      case 'stormWarn': sfx.storm(); break;
      case 'stormHit': sfx.zap(); break;
      case 'batteryOut': sfx.powerDown(); break;
      default: break;
    }
  }
}

export function hudOf(s: SimState, log: LogEntry[]): HudState {
  return {
    t: s.t, battery: s.battery, memory: s.memory, delivered: s.delivered, hearts: s.hearts,
    shadow: s.shadow, contact: s.contact, asleep: s.asleep, safe: s.safe, storm: s.storm, log,
  };
}

/**
 * Player input for a flight: ← → / A D, SPACE for safe mode, and bot hooks on `window`
 * (`__<prefix>Move(±1)`, `__<prefix>Safe(on)`; the bot can also call `__simBot(state, useSafe)`).
 */
export function useFlightControls(p: FlightParams, prefix: 'g2d' | 'g3d'): MutableRefObject<SimInput> {
  const control = useRef<SimInput>({ lane: 1, safe: false });
  useEffect(() => {
    const move = (d: number) => { control.current.lane = Math.max(0, Math.min(2, control.current.lane + d)) as Lane; };
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'a', 'A', 'ф', 'Ф'].includes(e.key)) { e.preventDefault(); move(-1); }
      if (['ArrowRight', 'd', 'D', 'в', 'В'].includes(e.key)) { e.preventDefault(); move(1); }
      if (e.key === ' ' && p.storms > 0) { e.preventDefault(); control.current.safe = !control.current.safe; }
    };
    window.addEventListener('keydown', onKey);
    const w = window as unknown as Record<string, unknown>;
    w[`__${prefix}Move`] = move;
    w[`__${prefix}Safe`] = (on: boolean) => { control.current.safe = on; };
    w.__simBot = botInput;
    return () => window.removeEventListener('keydown', onKey);
  }, [p, prefix]);
  return control;
}

/** The HTML HUD drawn over the flight canvas (same for 2D and 3D). */
export function FlightHud({ p, m, hud, control }: { p: FlightParams; m: Mission; hud: HudState; control: MutableRefObject<SimInput> }) {
  const { t } = useT();
  const tap = (d: number) => { control.current.lane = Math.max(0, Math.min(2, control.current.lane + d)) as Lane; };
  const duration = flightDuration(p);
  const ph = (hud.t / p.orbitSec) % 1;
  const lap = Math.min(p.orbits, Math.floor(hud.t / p.orbitSec) + 1);
  const bat = Math.round(hud.battery);
  const safeBtn = (
    <button type="button" className={`fh-lamp fh-switch ${hud.safe ? 'on' : ''}`} aria-pressed={hud.safe}
      onPointerDown={(e) => { e.stopPropagation(); control.current.safe = !control.current.safe; }}>
      {t('Safe mode')}{!TOUCH && <kbd>{t('Space')}</kbd>}
    </button>
  );
  return (
    <>
      {/* top: one instrument band on the left, the orbit dial on the right */}
      <div className="fh-band">
        <div className="fh-cell fh-goal"><span className="k">{t('Delivered to Earth')}</span><b>{Math.floor(hud.delivered)}<em> / {p.goal}</em></b></div>
        <div className="fh-cell"><span className="k">{t('Memory')}</span>
          <span className="fh-cells mem">{Array.from({ length: p.memory }, (_, i) => <i key={i} className={i < Math.round(hud.memory) ? 'on' : ''} />)}</span></div>
        <div className="fh-cell"><span className="k">{t('Hull')}</span>
          <span className="fh-cells hull">{Array.from({ length: p.hearts }, (_, i) => <i key={i} className={i < hud.hearts ? 'on' : ''} />)}</span></div>
        <div className={`fh-cell fh-bat ${bat < 25 ? 'low' : ''}`}><span className="k">{t('Battery')}</span>
          <span className="fh-batrow"><span className="fh-batbar"><i style={{ width: `${bat}%` }} /></span><b>{bat}%</b></span></div>
      </div>
      <div className="fh-orbit" title={t('Sunlight and Earth\'s shadow on this orbit')}>
        <OrbitDial phase={ph} shadow={p.shadowFraction} />
        <div>
          <span className="k">{m.laps ? t('Orbit {n} of {m}', { n: lap, m: p.orbits }) : t('Year {n} of {m}', { n: lap, m: p.orbits })}</span>
          <span className="fh-progress"><i style={{ width: `${Math.min(100, (hud.t / duration) * 100)}%` }} /></span>
        </div>
      </div>

      {/* operations log */}
      <ol className="fh-log" aria-live="polite">
        {hud.log.map((e) => <li key={e.id} className={e.tone}>{e.text}</li>)}
      </ol>

      {hud.t < 5 && (
        <div className="fh-tip">
          {TOUCH ? t('Tap the left or right side of the screen to change lane.') : t('Use the arrow keys to change lane.')} {t(TIPS[m.targets.kind])}
          {p.storms > 0 ? ' ' + (TOUCH ? t('Tap Safe mode during solar storms.') : t('SPACE turns on safe mode during solar storms.')) : ''}
        </div>
      )}

      {/* bottom: the annunciator panel - each lamp lights while its state is true */}
      <div className="fh-annun" role="group" aria-label={t('Spacecraft status')}>
        <span className={`fh-lamp ${hud.shadow ? 'on shadow' : 'on sun'}`}>{hud.shadow ? t('In Earth\'s shadow') : t('Charging')}</span>
        <span className={`fh-lamp ${hud.contact ? 'on downlink' : ''}`}>{t('Downlink')}</span>
        {p.storms > 0 && <span className={`fh-lamp ${hud.storm === 2 ? 'on storm now' : hud.storm === 1 ? 'on storm' : ''}`}>{hud.storm === 1 ? t('Solar storm ahead') : t('Solar storm')}</span>}
        {p.storms > 0 && safeBtn}
      </div>

      <div className="g2d-touch">
        <button className="lane left" onPointerDown={() => tap(-1)} aria-label={t('Move left')}><span className="key"><Chevron dir={-1} /></span></button>
        <button className="lane right" onPointerDown={() => tap(1)} aria-label={t('Move right')}><span className="key"><Chevron dir={1} /></span></button>
      </div>
    </>
  );
}

/** The orbit seen from above the pole: Earth in the middle, the shadow side darkened, the satellite as a dot. */
function OrbitDial({ phase, shadow }: { phase: number; shadow: number }) {
  const C = 24, R = 18;
  const at = (a: number) => [C + R * Math.sin(a * 2 * Math.PI), C - R * Math.cos(a * 2 * Math.PI)] as const;
  const arc = (a0: number, a1: number) => {
    const [x0, y0] = at(a0), [x1, y1] = at(a1);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 ${a1 - a0 > 0.5 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const [sx, sy] = at(phase);
  return (
    <svg className="fh-dial" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx={C} cy={C} r={R} className="sunlit" />
      <path d={arc(0.5 - shadow / 2, 0.5 + shadow / 2)} className="dark" />
      <circle cx={C} cy={C} r={7} className="earth" />
      <path d={`M${C - 7} ${C}A7 7 0 0 0 ${C + 7} ${C}Z`} className="night" />
      <circle cx={sx} cy={sy} r={3.4} className="sat" />
    </svg>
  );
}

/** a phone or tablet: explain taps, not keys */
const TOUCH = typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches;

const TIPS: Record<TargetKind, string> = {
  star: 'Fly over a target to take a photo, then over a ground station to send it home.',
  fire: 'Fly over a fire to photograph it, then over a ground station to send the photo home.',
  ice: 'Fly over glaciers to photograph them, then over a ground station to send the photos home.',
  storm: 'Fly over hurricanes to image them and send the images home.',
  particle: 'Fly through particle clouds to measure them, then over a ground station to send the data home.',
  city: 'Fly over cities to photograph them, then over a ground station to send the photos home.',
};

function Chevron({ dir }: { dir: -1 | 1 }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d={dir < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
