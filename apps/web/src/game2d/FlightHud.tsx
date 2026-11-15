// What the 2D and 3D flights share around the simulation: the HTML HUD over the canvas,
// keyboard / touch controls, the bot hooks and the messages for SimState.events.
import { useEffect, useRef, type MutableRefObject } from 'react';
import { sfx } from '../game3d/audio';
import { useT, type T } from '../i18n';
import type { FlightParams } from './config';
import type { Mission, TargetKind } from './missions';
import { botInput, flightDuration, type Lane, type SimEvent, type SimInput, type SimState } from './sim';

export interface HudState {
  t: number; battery: number; memory: number; delivered: number; hearts: number;
  shadow: boolean; contact: boolean; asleep: boolean; safe: boolean; storm: 0 | 1 | 2; flash: string;
}
export const initialHud = (p: FlightParams): HudState => ({
  t: 0, battery: 100, memory: 0, delivered: 0, hearts: p.hearts, shadow: false, contact: false, asleep: false, safe: false, storm: 0, flash: '',
});

/** Short messages for the flight's events; the latest one shows for a moment in the middle of the screen. */
export class FlightMessages {
  text = '';
  until = 0;
  constructor(private t: T['t']) {}
  /** Reads this frame's events (call after every stepSim). */
  take(s: SimState) {
    for (const e of s.events) {
      const m = this.message(e, s);
      if (m) { this.text = m[0]; this.until = s.t + m[1]; }
    }
  }
  current(s: SimState) { return s.t < this.until ? this.text : ''; }
  private message(e: SimEvent, s: SimState): [string, number] | null {
    const t = this.t;
    switch (e.type) {
      case 'photo': return [t('Photo taken'), 0.6];
      case 'contact': return null;
      case 'hit': return [t('Debris strike. One photo lost'), 1.3];
      case 'memoryFull': return [t('Memory full. Fly over a ground station'), 1.3];
      case 'dark': return [t('Too dark for this camera'), 1.3];
      case 'blurry': return [t('Too blurry from this altitude'), 1.3];
      case 'asleep': return [t('Satellite asleep'), 1.3];
      case 'outOfReach': {
        const n = s.stats.outOfReach;
        return n <= 2 || n % 4 === 0 ? [t('Out of reach: this orbit never flies that far north'), 1.6] : null;
      }
      case 'stormWarn': return [t('Solar storm ahead. Safe mode protects the computer'), 2.6];
      case 'stormSafe': return [t('Safe mode: asleep, but safe'), 1.3];
      case 'stormSurvived': return [t('Hardened computer kept working'), 2];
      case 'stormHit': return [t('Radiation crashed the computer. Memory lost'), 2.2];
      case 'batteryOut': return [t('Battery empty. Satellite asleep'), 1.3];
      case 'decay': return [t('Orbit decayed. The satellite burned up'), 3];
      case 'wornOut': return [t('Parts wore out. The satellite stopped working'), 3];
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

export function hudOf(s: SimState, flash: string): HudState {
  return {
    t: s.t, battery: s.battery, memory: s.memory, delivered: s.delivered, hearts: s.hearts,
    shadow: s.shadow, contact: s.contact, asleep: s.asleep, safe: s.safe, storm: s.storm, flash,
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
  return (
    <>
      <div className="r-hud top">
        <div className="r-goal"><span className="k">{t('Delivered to Earth')}</span><b>{Math.floor(hud.delivered)} <em>/ {p.goal}</em></b></div>
        <div className="r-mem"><span className="k">{t('Memory')}</span><span className="cells">{Array.from({ length: p.memory }, (_, i) => <span key={i} className={i < Math.round(hud.memory) ? 'full' : ''} />)}</span></div>
        <div className="r-hp"><span className="k">{t('Hull')}</span><span className="cells">{Array.from({ length: p.hearts }, (_, i) => <span key={i} className={i < hud.hearts ? '' : 'lost'} />)}</span></div>
        <div className="r-orbit">
          <span className="k">{m.laps ? t('Orbit {n} of {m}', { n: lap, m: p.orbits }) : t('Year {n} of {m}', { n: lap, m: p.orbits })}</span>
          <div className="r-strip" title={t('Sunlight and Earth\'s shadow on this orbit')}>
            <div className="shadow" style={{ left: `${(0.5 - p.shadowFraction / 2) * 100}%`, width: `${p.shadowFraction * 100}%` }} />
            <div className="you" style={{ left: `${ph * 100}%` }} />
          </div>
          <div className="mini-track"><div style={{ width: `${Math.min(100, (hud.t / duration) * 100)}%` }} /></div>
        </div>
      </div>
      <div className="r-hud bottom">
        <div className={`r-chip ${hud.shadow ? 'night' : 'day'}`}>{hud.shadow ? t('In Earth\'s shadow') : t('In sunlight, charging')}</div>
        <div className="r-battery">{t('Battery')}<div className="r-bar"><div className={hud.battery < 25 ? 'low' : ''} style={{ width: `${hud.battery}%` }} /></div></div>
        {hud.contact && <div className="r-chip contact">{t('Downlink: sending data home')}</div>}
        {hud.storm > 0 && <div className={`r-chip storm ${hud.storm === 2 ? 'now' : ''}`}>{hud.storm === 1 ? t('Solar storm ahead') : t('Solar storm')}</div>}
      </div>
      {hud.flash && <div className="r-flash" role="status">{hud.flash}</div>}
      {hud.t < 5 && (
        <div className="r-tip">
          {TOUCH ? t('Tap the left or right side of the screen to change lane.') : t('Use the arrow keys to change lane.')} {t(TIPS[m.targets.kind])}
          {p.storms > 0 ? ' ' + (TOUCH ? t('Tap Safe mode during solar storms.') : t('SPACE turns on safe mode during solar storms.')) : ''}
        </div>
      )}
      <div className="g2d-touch">
        <button className="lane left" onPointerDown={() => tap(-1)} aria-label={t('Move left')}><span className="key"><Chevron dir={-1} /></span></button>
        {p.storms > 0 && (
          <button className={`safe ${hud.safe ? 'on' : ''}`} onPointerDown={() => { control.current.safe = !control.current.safe; }} aria-pressed={hud.safe}>
            <span className="lamp" aria-hidden="true" />{t('Safe mode')}{!TOUCH && <kbd>{t('Space')}</kbd>}
          </button>
        )}
        <button className="lane right" onPointerDown={() => tap(1)} aria-label={t('Move right')}><span className="key"><Chevron dir={1} /></span></button>
      </div>
    </>
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
