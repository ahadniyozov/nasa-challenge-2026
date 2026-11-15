// 2D mission game: career map → brief → (test flight) → report → build → flight → report.
// Six missions from easy to hard; each one adds a new engineering trade-off.
// "Play first, design later": early missions start with a ready-made satellite that fails in instructive ways.
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useT, type T } from '../i18n';
import { analyse, slotsFor, type Analysis, type Build, type SlotId } from './config';
import { RealityCard, Sketch } from '../content/RealityCard';
import { REAL_MISSIONS } from '../content/realMissions';
import { PART_PHOTOS, photoUrl, sourceUrl } from '../content/partPhotos';
import { ResourcesScreen } from '../content/ResourcesScreen';
import { sfx } from '../game3d/audio';
import { SoundToggle } from '../game3d/SoundToggle';
import { Flight2D, type FlightStats } from './Flight2D';
import { Launch2D } from './Launch2D';
import { MISSIONS, type Mission } from './missions';
import { SatelliteArt } from './SatelliteArt';

// the 3D flight (and three.js) is loaded only when it is used
const Flight3D = lazy(() => import('../game3d/Flight3D'));
const Launch3D = lazy(() => import('../game3d/Launch3D').then((m) => ({ default: m.Launch3D })));
const HangarView = lazy(() => import('../game3d/Hangar3D').then((m) => ({ default: m.HangarView })));
const GlobeHero = lazy(() => import('../game3d/Career3D').then((m) => ({ default: m.GlobeHero })));

/** If the 3D flight cannot start (no WebGL context, chunk failed to load), fly the same mission in 2D. */
export class Fallback2D extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('3D flight failed, switching to 2D', e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

type Phase = 'career' | 'brief' | 'launch' | 'flight' | 'report' | 'build' | 'resources' | 'crew';
/** crew mode (2-4 players) lives in its own chunk with the network client */
const CrewGame = lazy(() => import('../crew/CrewGame').then((m) => ({ default: m.CrewGame })));
const CREW_CODE = new URLSearchParams(location.search).get('crew');

// ---- progress (stars per mission), kept in this browser only
const KEY = 'g2d-progress-v1';
function loadStars(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number>; } catch { return {}; }
}
function saveStars(v: Record<string, number>) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: progress lasts this visit only */ }
}

export function Game2D({ links, flight3d = false }: { links: React.ReactNode; flight3d?: boolean }) {
  const tr = useT();
  const { t } = tr;
  const [phase, setPhase] = useState<Phase>(CREW_CODE !== null ? 'crew' : 'career');
  const [mission, setMission] = useState<Mission>(MISSIONS[0]);
  const [build, setBuild] = useState<Build>(MISSIONS[0].start);
  const [isTest, setIsTest] = useState(true);
  const [stats, setStats] = useState<FlightStats | null>(null);
  const [focus, setFocus] = useState<SlotId | null>(null);
  const [runId, setRunId] = useState(0);
  const [stars, setStars] = useState<Record<string, number>>(loadStars);
  const [openAll, setOpenAll] = useState(() => location.search.includes('all'));
  const a = useMemo(() => analyse(build, mission), [build, mission]);
  // start downloading the 3D flight (three.js) while the player reads the brief, so the flight starts at once
  useEffect(() => { if (flight3d && phase !== 'career' && phase !== 'resources') void import('../game3d/Flight3D'); }, [flight3d, phase]);

  const onEnd = useCallback((s: FlightStats) => { setStats(s); setPhase('report'); }, []);
  // test hook for the bot playthroughs (scripts/bot-2d): fly mission X with build Y
  (window as unknown as Record<string, unknown>).__g2dPlay = (id: string, patch: Partial<Build>, test = false) => {
    const m = MISSIONS.find((x) => x.id === id)!;
    setMission(m); setBuild({ ...(test ? m.test! : m.start), ...patch } as Build); setIsTest(test); setRunId((n) => n + 1); setPhase('flight');
  };
  // test hook for the model screenshots (scripts/model-shots): open the build screen of mission X with build Y
  (window as unknown as Record<string, unknown>).__g2dBuild = (id: string, patch: Partial<Build>, slot: SlotId | null = null) => {
    const m = MISSIONS.find((x) => x.id === id)!;
    setMission(m); setBuild({ ...m.start, ...patch } as Build); setFocus(slot); setPhase('build');
  };
  const fly = (test: boolean) => { setIsTest(test); setRunId((n) => n + 1); setPhase('launch'); };
  const toBuild = (slot: SlotId | null) => { setFocus(slot); setPhase('build'); };
  const pick = (m: Mission) => { setMission(m); setBuild(m.start); setStats(null); setPhase('brief'); };
  const record = (n: number) => {
    if (n <= (stars[mission.id] ?? 0)) return;
    const next = { ...stars, [mission.id]: n };
    setStars(next); saveStars(next);
  };

  const [crewSpace, setCrewSpace] = useState(false);
  const inSpace = phase === 'flight' || phase === 'launch' || (phase === 'crew' && crewSpace);
  return (
    <div className={`runner g2d ${inSpace ? 'in-space' : ''}`}>
      <header className="runner-top">
        <div className="logo">GO<span>/</span>NO-GO <small>{phase === 'career' || phase === 'resources' ? t('Mission Control') : phase === 'crew' ? t('Crew mode') : t(mission.title)}</small></div>
        <nav className="runner-links" aria-label={t('Menu')}>
          {!inSpace && phase !== 'career' && phase !== 'crew' && <button className="link" onClick={() => setPhase('career')}>{t('Missions')}</button>}
          {!inSpace && phase !== 'resources' && phase !== 'crew' && <button className="link" onClick={() => setPhase('resources')} title={t('NASA Resources')}>{t('Resources')}</button>}
          <SoundToggle />
          {/* in flight only the sound button: nothing that leaves the mission or restarts it by accident */}
          {!inSpace && links}
        </nav>
      </header>
      {phase === 'career' && <Career stars={stars} openAll={openAll} onOpenAll={() => setOpenAll(true)} onPick={pick} globe={flight3d} onCrew={() => setPhase('crew')} />}
      {phase === 'crew' && <Suspense fallback={<div className="g2d-page" />}><CrewGame code={CREW_CODE} flight3d={flight3d} onSpace={setCrewSpace} onExit={() => { setCrewSpace(false); setPhase('career'); }} /></Suspense>}
      {phase === 'brief' && <Brief m={mission} onTest={() => { setBuild(mission.test!); fly(true); }} onBuild={() => toBuild(null)} onBack={() => setPhase('career')} />}
      {phase === 'launch' && (flight3d
        ? (
          <Fallback2D key={runId} fallback={<Launch2D build={build} onDone={() => setPhase('flight')} />}>
            <Suspense fallback={<div className="runner-stage g2d-launch" />}><Launch3D build={build} mission={mission} onDone={() => setPhase('flight')} /></Suspense>
          </Fallback2D>
        )
        : <Launch2D key={runId} build={build} onDone={() => setPhase('flight')} />)}
      {phase === 'flight' && (flight3d
        ? (
          <Fallback2D key={runId} fallback={<Flight2D p={a.flight} m={mission} onEnd={onEnd} />}>
            <Suspense fallback={<div className="runner-stage g2d-flight" />}><Flight3D p={a.flight} m={mission} build={build} onEnd={onEnd} /></Suspense>
          </Fallback2D>
        )
        : <Flight2D key={runId} p={a.flight} m={mission} onEnd={onEnd} />)}
      {phase === 'report' && stats && (
        <Report tr={tr} m={mission} a={a} stats={stats} isTest={isTest} onStars={record} onFix={toBuild} onAgain={() => fly(isTest)}
          onNext={mission.num < MISSIONS.length ? () => pick(MISSIONS[mission.num]) : undefined} onCareer={() => setPhase('career')} />
      )}
      {phase === 'resources' && <ResourcesScreen onBack={() => setPhase('career')} />}
      {phase === 'build' && <BuildScreen m={mission} build={build} setBuild={setBuild} focus={focus} setFocus={setFocus} onLaunch={() => fly(false)} use3d={flight3d} />}
    </div>
  );
}

/** Three stars as small drawn marks (no emoji fonts needed). */
function Stars({ n, label }: { n: number; label: string }) {
  const star = 'M10 1.8l2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.7 4.9 17.5 6 11.8 1.7 7.8l5.8-.7z';
  return (
    <span className="g2d-stars" role="img" aria-label={label}>
      {[0, 1, 2].map((i) => <svg key={i} viewBox="0 0 20 20"><path d={star} className={i < n ? 'on' : 'off'} /></svg>)}
    </span>
  );
}

/** Line drawings for the two ways to play: one operator and a satellite, or four crew consoles linked to it. */
function ModeArt({ crew }: { crew: boolean }) {
  const sat = (
    <g transform="translate(80 34)">
      <rect x="-26" y="-5" width="18" height="10" className="wing" /><rect x="8" y="-5" width="18" height="10" className="wing" />
      <rect x="-8" y="-9" width="16" height="18" rx="1.5" className="bus" />
    </g>
  );
  const node = (x: number, y: number, k: number) => (
    <g key={k} transform={`translate(${x} ${y})`}>
      <line x1="0" y1="-9" x2={80 - x} y2={44 - y} className="link" />
      <rect x="-11" y="-8" width="22" height="16" rx="2" className="console" />
      <line x1="-6" y1="10" x2="6" y2="10" className="stand" />
    </g>
  );
  return (
    <svg className="g2d-mode-art" viewBox="0 0 160 110" aria-hidden="true">
      <path d="M8 104 Q80 84 152 104" className="earth" />
      {crew ? [node(26, 86, 0), node(62, 92, 1), node(98, 92, 2), node(134, 86, 3)] : node(80, 90, 0)}
      {sat}
    </svg>
  );
}

// ---------------------------------------------------------------------------
function Career({ stars, openAll, onOpenAll, onPick, globe, onCrew }: { stars: Record<string, number>; openAll: boolean; onOpenAll(): void; onPick(m: Mission): void; globe: boolean; onCrew(): void }) {
  const { t } = useT();
  const unlocked = (m: Mission) => openAll || m.num === 1 || (stars[MISSIONS[m.num - 2].id] ?? 0) > 0;
  // the globe faces the next mission to fly, then follows the row under the pointer or keyboard focus
  const [activeId, setActiveId] = useState(() => (MISSIONS.find((m) => unlocked(m) && !(stars[m.id] ?? 0)) ?? MISSIONS[0]).id);
  const total = MISSIONS.reduce((s, m) => s + (stars[m.id] ?? 0), 0);
  const levelBars = { Cadet: 1, Engineer: 2, 'Flight Director': 3 } as const;
  const next = MISSIONS.find((m) => unlocked(m) && !(stars[m.id] ?? 0)) ?? MISSIONS.filter(unlocked).at(-1) ?? MISSIONS[0];
  return (
    <div className="g2d-page">
      <div className="g2d-doc">
        <h1>{t('Mission control')}</h1>
        <p className="g2d-lead">{t('Design a real satellite for a real customer, launch it and fly it. Alone, or with a crew of up to four.')}</p>
        <div className="g2d-modes">
          <section className="g2d-mode">
            <ModeArt crew={false} />
            <div className="g2d-mode-text">
              <span className="g2d-mode-tag">{t('1 player')}</span>
              <h2>{t('Solo missions')}</h2>
              <p>{t('You are the whole team: six customers, six satellites, from a student CubeSat to a city map.')}</p>
              <p className="g2d-mode-meta">{t('Stars earned: {n} of {m}', { n: total, m: MISSIONS.length * 3 })}. <a className="g2d-mode-link" href="#manifest">{t('All missions')}</a></p>
            </div>
            <div className="g2d-mode-go">
              <button className="r-btn" onClick={() => onPick(next)}>{total === 0 ? t('Start mission 1') : t('Continue: mission {n}', { n: next.num })}</button>
            </div>
          </section>
          <section className="g2d-mode">
            <ModeArt crew />
            <div className="g2d-mode-text">
              <span className="g2d-mode-tag">{t('2-4 players')}</span>
              <h2>{t('Crew mission')}</h2>
              <p>{t('Flight director, engineer, scientist and communications design one satellite together, each from their own phone or laptop. Nothing flies until everyone says GO.')}</p>
              <p className="g2d-mode-meta">{t('Create a crew or join one with a code.')}</p>
            </div>
            <div className="g2d-mode-go">
              <button className="r-btn" onClick={onCrew}>{t('Play as a crew')}</button>
            </div>
          </section>
        </div>
        <h2 id="manifest" className="g2d-manifest-title">{t('Solo missions')}</h2>
        <p className="g2d-lead small">{t('Six customers, six satellites. Each mission adds one new engineering problem. Earn a star to unlock the next one.')}</p>
        {globe && (
          <Fallback2D fallback={null}>
            <Suspense fallback={<div className="g3d-globe-wait" />}>
              <GlobeHero stars={stars} openAll={openAll} activeId={activeId} onHover={setActiveId} onPick={onPick} />
            </Suspense>
          </Fallback2D>
        )}
        <ol className="g2d-manifest">
          {MISSIONS.map((m) => {
            const open = unlocked(m);
            const n = stars[m.id] ?? 0;
            const sketch = REAL_MISSIONS[m.id]?.sketch ?? 'low';
            return (
              <li key={m.id} className={`g2d-mrow ${open ? '' : 'locked'} ${globe && activeId === m.id ? 'active' : ''}`}
                onPointerEnter={() => setActiveId(m.id)} onFocus={() => setActiveId(m.id)}>
                <button disabled={!open} onClick={() => onPick(m)}>
                  <span className="num">{m.num}</span>
                  <Sketch kind={sketch} className="sk" />
                  <span className="t">
                    <b>{t(m.title)}</b>
                    <span>{open ? t(m.customer.who) : t('Earn a star on mission {n} to unlock', { n: m.num - 1 })}</span>
                  </span>
                  <span className="lvl">{t(m.level)}<i>{[1, 2, 3].map((k) => <s key={k} className={k <= levelBars[m.level] ? 'on' : ''} />)}</i></span>
                  <span className="spec"><b>${m.budgetM}M</b> {t('budget')}<br />{m.years === 1 ? t('1 year') : t('{n} years', { n: m.years })}</span>
                  <Stars n={n} label={t('{n} of 3 stars', { n })} />
                </button>
              </li>
            );
          })}
        </ol>
        <div className="g2d-manifest-foot">
          <span>{t('Stars earned: {n} of {m}', { n: total, m: MISSIONS.length * 3 })}</span>
          {!openAll && <button className="g2d-ghost small" onClick={onOpenAll}>{t('Unlock all missions')}</button>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
interface Req { ok: boolean; text: string }

/** The customer's requirements; the same list is shown in the brief and checked in the report. */
function requirements(t: T['t'], m: Mission, a: Analysis, s?: FlightStats): Req[] {
  const out: Req[] = [];
  out.push(s
    ? { ok: s.delivered >= m.goal, text: t('Delivered to Earth: {d} of {n} {label}', { label: t(m.targets.label), d: s.delivered, n: m.goal }) }
    : { ok: true, text: t('Deliver at least {n} {label} to Earth', { n: m.goal, label: t(m.targets.label) }) });
  out.push(s
    ? { ok: s.survived, text: s.survived ? (m.years === 1 ? t('Worked for the whole year') : t('Worked for all {n} years', { n: m.years })) : s.decayed ? t('Fell from orbit early') : s.wornOut ? t('Wore out before the end') : t('Destroyed by space junk or radiation') }
    : { ok: true, text: t('Work for the whole {n}-year mission', { n: m.years }) });
  if (m.maxResolutionM !== undefined) out.push(s
    ? { ok: a.flight.sharp, text: a.flight.sharp ? t('Images sharp enough') : t('Images too blurry') }
    : { ok: true, text: m.maxResolutionM >= 1000 ? t('Images sharp enough to see a hurricane ({m} km or better)', { m: m.maxResolutionM / 1000 }) : t('Images sharp enough ({m} m or better)', { m: m.maxResolutionM }) });
  if (m.farNorth) out.push(s
    ? { ok: a.flight.reachesTargets, text: a.flight.reachesTargets ? t('The orbit flies over the glaciers') : t('The orbit never reached the glaciers') }
    : { ok: true, text: t('Reach the far north (75° latitude)') });
  if (m.needsContact) out.push(s
    ? { ok: a.flight.alwaysInContact, text: a.flight.alwaysInContact ? t('Watched nonstop') : t('Only passed over now and then') }
    : { ok: true, text: t('Watch the ocean nonstop, day and night') });
  if (m.storms > 0 && !s) out.push({ ok: true, text: t('Survive {n} solar storm(s)', { n: m.storms }) });
  out.push({ ok: true, text: s ? t('Within budget') : t('Stay within the ${b}M budget', { b: m.budgetM }) });
  return out;
}

function Brief({ m, onTest, onBuild, onBack }: { m: Mission; onTest(): void; onBuild(): void; onBack(): void }) {
  const tr = useT();
  const { t } = tr;
  const a = useMemo(() => analyse(m.start, m), [m]);
  const reqs = requirements(t, m, a);
  return (
    <div className="g2d-page">
      <div className="g2d-doc">
        <button className="g2d-back" onClick={onBack}>{t('All missions')}</button>
        <h1>{t('Mission {n}: {title}', { n: m.num, title: t(m.title) })}</h1>
        <div className="g2d-brief">
          <div>
            <figure className="g2d-request">
              <blockquote>{t(m.customer.text)}</blockquote>
              <figcaption>{t(m.customer.who)}</figcaption>
            </figure>
            <h2>{t('Requirements')}</h2>
            <table className="g2d-reqs">
              <thead><tr><th scope="col">{t('ID')}</th><th scope="col">{t('The satellite must')}</th></tr></thead>
              <tbody>{reqs.map((r, i) => <tr key={i}><td className="id">REQ-{i + 1}</td><td>{r.text}</td></tr>)}</tbody>
            </table>
            {m.test && <p className="g2d-note">{t('Our engineers already built a cheap test satellite. Fly it first and see what happens.')}</p>}
            <div className="g2d-actions">
              {m.test
                ? <><button className="r-btn" onClick={onTest}>{t('Fly the test satellite')}</button><button className="g2d-ghost" onClick={onBuild}>{t('Design my own')}</button></>
                : <button className="r-btn" onClick={onBuild}>{t('Design the satellite')}</button>}
            </div>
          </div>
          <aside className="g2d-facts">
            <dl>
              <div><dt>{t('Budget')}</dt><dd>${m.budgetM}M</dd></div>
              <div><dt>{t('Mission length')}</dt><dd>{m.years === 1 ? t('1 year') : t('{n} years', { n: m.years })}</dd></div>
              <div><dt>{t('Goal')}</dt><dd>{m.goal} {t(m.targets.label)}</dd></div>
              <div><dt>{t('Difficulty')}</dt><dd>{t(m.level)}</dd></div>
            </dl>
            <p><b>{t('What you will learn')}</b>{t(m.learn)}</p>
            <p><b>{t('Based on')}</b>{m.source}</p>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
interface Lesson { text: string; params?: Record<string, string | number>; slot: SlotId; locked?: boolean }

function lessonsFor(m: Mission, a: Analysis, s: FlightStats): Lesson[] {
  const out: Lesson[] = [];
  const can = (id: SlotId) => m.slots.includes(id);
  const f = a.flight;
  if (s.outOfReach > 0) out.push({ text: 'The glaciers are far north, but a 400 km orbit is tilted only 52° - it never flies that far. A polar orbit passes over the poles.', slot: 'orbit' });
  if (m.needsContact && !f.alwaysInContact) out.push({ text: 'A low orbit flies over the ocean only now and then. A satellite 36,000 km high turns with the Earth and watches the same place nonstop - but it needs a big rocket.', slot: 'orbit' });
  if (s.decayed) out.push({ text: 'At 400 km thin air slowly pulls the satellite down - it fell after about 1 year. Choose a higher orbit or add a thruster.', slot: 'orbit' });
  if (s.wornOut) out.push({ text: 'A small CubeSat wears out after 3-4 years. A sturdy body lasts longer.', slot: 'body' });
  if (s.stormHits > 0) out.push({ text: 'Solar storms crashed the computer {n} time(s). Turn on safe mode before a storm (SPACE or the Safe mode button), or pay for a radiation-hardened computer.', params: { n: s.stormHits }, slot: 'computer' });
  if (f.photosPerSec < 0.5 && can('antenna')) out.push({ text: 'The UHF radio is far too slow - photos stayed on board. An S-band radio sends them home in seconds.', slot: 'antenna' });
  if (s.batteryOuts > 0) out.push({ text: 'The battery ran flat in Earth\'s shadow {n} time(s). A bigger battery or bigger solar panels keep the satellite awake.', params: { n: s.batteryOuts }, slot: can('battery') ? 'battery' : 'orbit' });
  if (s.memoryFull > 0) out.push({ text: 'Memory was full {n} time(s) - new photos were lost. More memory, or send photos home more often.', params: { n: s.memoryFull }, slot: can('memory') ? 'memory' : 'stations' });
  if (s.lostInMemory > 0 && f.photosPerSec >= 0.5) out.push({ text: '{n} photos were still in memory at the end. More ground stations or a faster antenna would bring them home.', params: { n: s.lostInMemory }, slot: 'stations' });
  if (s.nightMissed >= 2) out.push({ text: '{n} targets passed in the dark. A normal camera needs sunlight - heat cameras and radiometers see at night.', params: { n: s.nightMissed }, slot: 'camera' });
  if (s.blurry > 0) out.push({ text: m.maxResolutionM !== undefined && m.maxResolutionM < 10 ? 'Only a telescope sees single buildings - and it must fly low.' : 'From this height the photos are too blurry. Fly lower.', slot: m.maxResolutionM !== undefined && m.maxResolutionM < 10 ? 'camera' : 'orbit' });
  if (s.hits >= 2) out.push({ text: 'Space junk hit the satellite {n} times. A shield adds one more life.', params: { n: s.hits }, slot: 'shield' });
  if (out.length === 0 && s.delivered < m.goal) out.push({ text: 'Fly over more targets: change lanes with ← →.', slot: m.slots[0] });
  // lessons about locked parts still explain what happened, just without a 'change' button
  return out.map((l) => (can(l.slot) ? l : { ...l, locked: true }));
}

export function Report({ tr, m, a, stats, isTest, onStars, onFix, onAgain, onNext, onCareer, ownerOf, waiting }: {
  tr: T; m: Mission; a: Analysis; stats: FlightStats; isTest: boolean; onStars(n: number): void; onFix(s: SlotId): void; onAgain?: () => void; onNext?: () => void; onCareer?: () => void;
  /** crew mode: who decided each part (shown next to each finding) */
  ownerOf?: (s: SlotId) => string;
  /** crew mode: the next step belongs to the flight director */
  waiting?: string;
}) {
  const { t } = tr;
  const reqs = requirements(t, m, a, stats);
  const met = reqs.filter((r) => r.ok).length;
  const all = met === reqs.length;
  const stars = all ? (stats.delivered >= m.goal * 1.5 ? 3 : 2) : met >= reqs.length - 1 && stats.delivered >= m.goal / 2 ? 1 : 0;
  // record once per report
  useEffect(() => { if (!isTest) onStars(stars); if (all) sfx.win(); else sfx.lose(); }, [stats]); // eslint-disable-line react-hooks/exhaustive-deps
  const lessons = lessonsFor(m, a, stats);
  const slots = slotsFor(m);
  const slotTitle = (id: SlotId) => t(slots.find((s) => s.id === id)?.title ?? id);
  const headline = all ? t('Mission accomplished') : isTest ? t('The test satellite was not good enough') : t('Not all requirements were met');
  return (
    <div className="g2d-page">
      <div className="g2d-doc narrow">
        <div className="g2d-verdict">
          <strong className={all ? 'go' : 'nogo'}>{all ? 'GO' : 'NO-GO'}</strong>
          <div>
            <h1>{headline}</h1>
            <p>{t('{met} of {n} requirements met', { met, n: reqs.length })}</p>
            {!isTest && <Stars n={stars} label={t('{n} of 3 stars', { n: stars })} />}
          </div>
        </div>
        <h2>{t('Verification')}</h2>
        <table className="g2d-reqs">
          <thead><tr><th scope="col">{t('ID')}</th><th scope="col">{t('Result in flight')}</th><th scope="col">{t('Status')}</th></tr></thead>
          <tbody>
            {reqs.map((r, i) => (
              <tr key={i}><td className="id">REQ-{i + 1}</td><td>{r.text}</td><td className={`res ${r.ok ? 'ok' : 'bad'}`}>{r.ok ? t('Met') : t('Not met')}</td></tr>
            ))}
          </tbody>
        </table>
        {stats.stormsSafe + stats.stormsSurvived > 0 && <p className="g2d-note">{t('Solar storms: {a} slept through in safe mode, {b} survived with a hardened computer.', { a: stats.stormsSafe, b: stats.stormsSurvived })}</p>}
        {lessons.length > 0 && (
          <>
            <h2>{t('Findings')}</h2>
            <ul className="g2d-findings">
              {lessons.map((l, i) => (
                <li key={i}>
                  <span>{ownerOf && <em className="g2d-owner">{ownerOf(l.slot)}</em>}{t(l.text, l.params)}</span>
                  {l.locked
                    ? <small className="g2d-later">{t('You can change this on later missions.')}</small>
                    : <button className="g2d-ghost small" onClick={() => onFix(l.slot)}>{t('Change {s}', { s: slotTitle(l.slot).toLowerCase() })}</button>}
                </li>
              ))}
            </ul>
          </>
        )}
        {all && stars < 3 && !isTest && <p className="g2d-note">{t('For three stars deliver {n} or more.', { n: Math.ceil(m.goal * 1.5) })}</p>}
        {all && <RealityCard missionId={m.id} />}
        <div className="g2d-actions">
          {all && onNext && <button className="r-btn" onClick={onNext}>{t('Next mission')}</button>}
          {all && !onNext && onCareer && <button className="r-btn" onClick={onCareer}>{t('All missions done')}</button>}
          {!all && <button className="r-btn" onClick={() => onFix(lessons.find((l) => !l.locked)?.slot ?? m.slots[0])}>{t('Redesign the satellite')}</button>}
          {onAgain && <button className="g2d-ghost" onClick={onAgain}>{t('Fly again')}</button>}
          {waiting && <p className="g2d-note">{waiting}</p>}
          {all && <button className="g2d-ghost" onClick={() => onFix(m.slots[0])}>{t('Improve the design')}</button>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function BuildScreen({ m, build, setBuild, focus, setFocus, onLaunch, use3d, canEdit, ownerOf, top, actions }: {
  m: Mission; build: Build; setBuild(b: Build): void; focus: SlotId | null; setFocus(s: SlotId | null): void; onLaunch(): void; use3d: boolean;
  /** crew mode: only the parts this player's role decides can be changed */
  canEdit?: (id: SlotId) => boolean;
  ownerOf?: (id: SlotId) => string;
  /** crew mode: the team panel above the parts, and the poll in place of the launch button */
  top?: React.ReactNode;
  actions?: (a: Analysis) => React.ReactNode;
}) {
  const { t } = useT();
  const a = useMemo(() => analyse(build, m), [build, m]);
  const slots = useMemo(() => slotsFor(m), [m]);
  const busName = { 'cubesat-3u': 'CubeSat 3U', 'cubesat-12u': 'CubeSat 12U', smallsat: 'SmallSat 150 kg', 'medium-bus': 'Medium bus 800 kg' }[a.design.busId] ?? a.design.busId;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  // the real NASA photo next to the drawing: the last part picked, or the chosen option of the open slot
  const [shownId, setShown] = useState<string | null>(null);
  const focusPhotoId = shownId && PART_PHOTOS[shownId] ? shownId : focus ? build[focus] : null;
  const photo = focusPhotoId ? PART_PHOTOS[focusPhotoId] : undefined;
  // the rocket and the budget block a launch; power and battery problems are the player's risk to take
  const overLimit = a.gauges.filter((g) => g.level === 'bad').map((g) => t(g.label).toLowerCase());

  const slotRow = (id: SlotId) => {
    const slot = slots.find((s) => s.id === id)!;
    const chosen = slot.options.find((o) => o.id === build[id]) ?? slot.options[0];
    const open = focus === id;
    const mine = !canEdit || canEdit(id);
    return (
      <div key={id} className={`g2d-slot ${open ? 'open' : ''}`}>
        <button className="g2d-slot-head" aria-expanded={open} onClick={() => { setFocus(open ? null : id); setShown(null); }}>
          <b>{t(slot.title)}{ownerOf && <em className={`g2d-owner ${mine ? 'mine' : ''}`}>{ownerOf(id)}</em>}</b><span className="v">{t(chosen.title)}</span>
          <svg className="chev" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
        </button>
        {open && (
          <div className="g2d-opts" role="radiogroup" aria-label={t(slot.title)}>
            {slot.options.map((o) => (
              <button key={o.id} role="radio" disabled={!mine} aria-checked={build[id] === o.id} className={`g2d-opt ${build[id] === o.id ? 'on' : ''} ${PART_PHOTOS[o.id] ? 'has-photo' : ''}`} onClick={() => { setBuild({ ...build, [id]: o.id }); setShown(o.id); }}>
                <b>{t(o.title)}</b>{o.text && <small>{t(o.text)}</small>}
                {PART_PHOTOS[o.id] && <img src={photoUrl(PART_PHOTOS[o.id])} alt="" loading="lazy" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };
  const sat = slots.filter((s) => s.group === 'satellite');
  const mis = slots.filter((s) => s.group === 'mission');

  return (
    <div className="g2d-build">
      <div className="g2d-art">
        {m.slots.length < 6 && <p className="g2d-hint">{t('On this mission you choose only {n} things - the rest is ready.', { n: m.slots.length })}</p>}
        {use3d
          ? (
            <Fallback2D fallback={<SatelliteArt build={build} mission={m} />}>
              <Suspense fallback={<SatelliteArt build={build} mission={m} />}>
                <HangarView build={build} mission={m} focus={focus} />
                <p className="g3d-hangar-hint">{t('Drag to turn the satellite.')}</p>
              </Suspense>
            </Fallback2D>
          )
          : <SatelliteArt build={build} mission={m} />}
        <div className="g2d-art-foot">
          <div className="g2d-titleblock">
            <div><span>{t('Platform')}</span><b>{busName}</b></div>
            <div><span>{t('Mass')}</span><b>{Math.round(a.flight.massKg)} {t('kg')}</b></div>
          </div>
          {photo && (
            <figure className="g2d-photo">
              <img src={photoUrl(photo)} alt={t(photo.caption)} />
              <figcaption>{t(photo.caption)}. <a className="c-link" href={sourceUrl(photo)} target="_blank" rel="noopener noreferrer">{t('Photo: {credit}', { credit: photo.credit })}</a></figcaption>
            </figure>
          )}
        </div>
      </div>
      <div className="g2d-slots">
        {top}
        {sat.length > 0 && <h3>{t('Spacecraft')}</h3>}
        {sat.map((s) => slotRow(s.id))}
        {mis.length > 0 && <h3>{t('Launch and operations')}</h3>}
        {mis.map((s) => slotRow(s.id))}
      </div>
      <footer className="g2d-foot">
        <div className="g2d-gauges">
          {a.gauges.map((g) => (
            <div key={g.id} className={`g2d-gauge ${g.level}`} title={t(g.detail, g.params)}>
              <div className="top"><span>{t(g.label)}</span><b>{pct(g.value)}</b></div>
              <div className="track"><div style={{ width: `${Math.min(100, Math.max(3, g.value * 100))}%` }} /></div>
              <small>{t(g.detail, g.params)}</small>
            </div>
          ))}
        </div>
        <div className="g2d-launch">
          {a.blockers.map((b) => <div key={b} className="g2d-blocker">{t(b)}</div>)}
          {a.canLaunch && overLimit.length > 0 && <div className="g2d-blocker caution">{t('Over the limit: {list}', { list: overLimit.join(', ') })}</div>}
          {actions ? actions(a) : <button className="r-btn" disabled={!a.canLaunch} onClick={onLaunch}>{!a.canLaunch ? t('NO-GO') : overLimit.length > 0 ? t('Launch anyway') : t('GO for launch')}</button>}
        </div>
      </footer>
    </div>
  );
}
