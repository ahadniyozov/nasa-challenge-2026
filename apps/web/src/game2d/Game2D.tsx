// 2D mission game: career map → brief → (test flight) → report → build → flight → report.
// Six missions from easy to hard; each one adds a new engineering trade-off.
// "Play first, design later": early missions start with a ready-made satellite that fails in instructive ways.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT, type T } from '../i18n';
import { analyse, slotsFor, type Analysis, type Build, type SlotId } from './config';
import { Flight2D, type FlightStats } from './Flight2D';
import { Launch2D } from './Launch2D';
import { MISSIONS, type Mission } from './missions';
import { SatelliteArt } from './SatelliteArt';

type Phase = 'career' | 'brief' | 'launch' | 'flight' | 'report' | 'build';

// ---- progress (stars per mission), kept in this browser only
const KEY = 'g2d-progress-v1';
function loadStars(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number>; } catch { return {}; }
}
function saveStars(v: Record<string, number>) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: progress lasts this visit only */ }
}

export function Game2D({ links }: { links: React.ReactNode }) {
  const tr = useT();
  const { t } = tr;
  const [phase, setPhase] = useState<Phase>('career');
  const [mission, setMission] = useState<Mission>(MISSIONS[0]);
  const [build, setBuild] = useState<Build>(MISSIONS[0].start);
  const [isTest, setIsTest] = useState(true);
  const [stats, setStats] = useState<FlightStats | null>(null);
  const [focus, setFocus] = useState<SlotId | null>(null);
  const [runId, setRunId] = useState(0);
  const [stars, setStars] = useState<Record<string, number>>(loadStars);
  const [openAll, setOpenAll] = useState(() => location.search.includes('all'));
  const a = useMemo(() => analyse(build, mission), [build, mission]);

  const onEnd = useCallback((s: FlightStats) => { setStats(s); setPhase('report'); }, []);
  // test hook for the bot playthroughs (scripts/bot-2d): fly mission X with build Y
  (window as unknown as Record<string, unknown>).__g2dPlay = (id: string, patch: Partial<Build>, test = false) => {
    const m = MISSIONS.find((x) => x.id === id)!;
    setMission(m); setBuild({ ...(test ? m.test! : m.start), ...patch } as Build); setIsTest(test); setRunId((n) => n + 1); setPhase('flight');
  };
  const fly = (test: boolean) => { setIsTest(test); setRunId((n) => n + 1); setPhase('launch'); };
  const toBuild = (slot: SlotId | null) => { setFocus(slot); setPhase('build'); };
  const pick = (m: Mission) => { setMission(m); setBuild(m.start); setStats(null); setPhase('brief'); };
  const record = (n: number) => {
    if (n <= (stars[mission.id] ?? 0)) return;
    const next = { ...stars, [mission.id]: n };
    setStars(next); saveStars(next);
  };

  return (
    <div className="runner g2d">
      <header className="runner-top">
        <div className="logo">GO<span>/</span>NO-GO <small>{phase === 'career' ? t('Mission Control') : `${mission.num}. ${t(mission.title)}`}</small></div>
        <div className="runner-links">
          {phase !== 'career' && phase !== 'flight' && phase !== 'launch' && <button className="link" onClick={() => setPhase('career')}>{t('🗺️ All missions')}</button>}
          {links}
        </div>
      </header>
      {phase === 'career' && <Career stars={stars} openAll={openAll} onOpenAll={() => setOpenAll(true)} onPick={pick} />}
      {phase === 'brief' && <Brief m={mission} onTest={() => { setBuild(mission.test!); fly(true); }} onBuild={() => toBuild(null)} />}
      {phase === 'launch' && <Launch2D key={runId} build={build} onDone={() => setPhase('flight')} />}
      {phase === 'flight' && <Flight2D key={runId} p={a.flight} m={mission} onEnd={onEnd} />}
      {phase === 'report' && stats && (
        <Report tr={tr} m={mission} a={a} stats={stats} isTest={isTest} onStars={record} onFix={toBuild} onAgain={() => fly(isTest)}
          onNext={mission.num < MISSIONS.length ? () => pick(MISSIONS[mission.num]) : undefined} onCareer={() => setPhase('career')} />
      )}
      {phase === 'build' && <BuildScreen m={mission} build={build} setBuild={setBuild} focus={focus} setFocus={setFocus} onLaunch={() => fly(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
function Career({ stars, openAll, onOpenAll, onPick }: { stars: Record<string, number>; openAll: boolean; onOpenAll(): void; onPick(m: Mission): void }) {
  const { t } = useT();
  const unlocked = (m: Mission) => openAll || m.num === 1 || (stars[MISSIONS[m.num - 2].id] ?? 0) > 0;
  const total = MISSIONS.reduce((s, m) => s + (stars[m.id] ?? 0), 0);
  return (
    <div className="g2d-page">
      <div className="g2d-career">
        <h1>{t('Choose a mission')}</h1>
        <p className="g2d-note center">{t('Each customer needs a different satellite. Earn at least 1 ★ to unlock the next mission.')} <b>★ {total} / {MISSIONS.length * 3}</b></p>
        <div className="g2d-missions">
          {MISSIONS.map((m) => {
            const open = unlocked(m);
            const n = stars[m.id] ?? 0;
            return (
              <button key={m.id} className={`g2d-mcard ${open ? '' : 'locked'} lvl-${m.level.split(' ')[0].toLowerCase()}`} disabled={!open} onClick={() => onPick(m)}>
                <div className="num">{m.num}</div>
                <div className="emoji">{open ? m.emoji : '🔒'}</div>
                <b>{t(m.title)}</b>
                <span className="lvl">{t(m.level)}</span>
                <small>{t(m.learn)}</small>
                <div className="mstars">{[0, 1, 2].map((i) => <span key={i} className={i < n ? 'on' : ''}>★</span>)}</div>
              </button>
            );
          })}
        </div>
        {!openAll && <div className="g2d-actions"><button className="g2d-ghost small" onClick={onOpenAll}>{t('🔓 Open all missions')}</button></div>}
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
    ? { ok: s.delivered >= m.goal, text: t('{label} delivered: {d} of {n}', { label: t(m.targets.label), d: s.delivered, n: m.goal }) }
    : { ok: true, text: t('Deliver at least {n} {label} to Earth', { n: m.goal, label: t(m.targets.label) }) });
  out.push(s
    ? { ok: s.survived, text: s.survived ? t('Worked for all {n} years', { n: m.years }) : s.decayed ? t('Fell from orbit early') : s.wornOut ? t('Wore out before the end') : t('Destroyed by space junk or radiation') }
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

function Brief({ m, onTest, onBuild }: { m: Mission; onTest(): void; onBuild(): void }) {
  const tr = useT();
  const { t } = tr;
  const a = useMemo(() => analyse(m.start, m), [m]);
  return (
    <div className="g2d-page">
      <div className="g2d-card brief">
        <div className="g2d-tag">{t('Mission {n} of {m}', { n: m.num, m: MISSIONS.length })} · {t(m.level)} · <i>{t('based on')} {m.source}</i></div>
        <div className="g2d-customer">
          <div className="g2d-avatar">{m.customer.emoji}</div>
          <div className="g2d-bubble">
            <small>{t('Customer')}: {t(m.customer.who)}</small>
            {t(m.customer.text)}
          </div>
        </div>
        <h2>{t('Mission requirements')}</h2>
        <ul className="g2d-reqs">{requirements(t, m, a).map((r, i) => <li key={i}>{r.text}</li>)}</ul>
        <p className="g2d-note">💡 {t('You will learn')}: {t(m.learn)}</p>
        {m.test && <p className="g2d-note">{t('Our engineers already built a cheap test satellite. Fly it first and see what happens!')}</p>}
        <div className="g2d-actions">
          {m.test && <button className="r-btn" onClick={onTest}>{t('🚀 Fly the test satellite')}</button>}
          <button className={m.test ? 'g2d-ghost' : 'r-btn'} onClick={onBuild}>{t('🔧 Design the satellite')}</button>
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
  if (s.stormHits > 0) out.push({ text: 'Solar storms crashed the computer {n} time(s). Turn on safe mode before a storm (SPACE / 🛡️), or pay for a radiation-hardened computer.', params: { n: s.stormHits }, slot: 'computer' });
  if (f.photosPerSec < 0.5 && can('antenna')) out.push({ text: 'The walkie-talkie radio is far too slow - photos stayed on board. A real antenna sends them home in seconds.', slot: 'antenna' });
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

function Report({ tr, m, a, stats, isTest, onStars, onFix, onAgain, onNext, onCareer }: {
  tr: T; m: Mission; a: Analysis; stats: FlightStats; isTest: boolean; onStars(n: number): void; onFix(s: SlotId): void; onAgain(): void; onNext?: () => void; onCareer(): void;
}) {
  const { t } = tr;
  const reqs = requirements(t, m, a, stats);
  const met = reqs.filter((r) => r.ok).length;
  const all = met === reqs.length;
  const stars = all ? (stats.delivered >= m.goal * 1.5 ? 3 : 2) : met >= reqs.length - 1 && stats.delivered >= m.goal / 2 ? 1 : 0;
  // record once per report
  useEffect(() => { if (!isTest) onStars(stars); }, [stats]); // eslint-disable-line react-hooks/exhaustive-deps
  const lessons = lessonsFor(m, a, stats);
  const slots = slotsFor(m);
  const slotTitle = (id: SlotId) => t(slots.find((s) => s.id === id)?.title ?? id);
  return (
    <div className="g2d-page">
      <div className="g2d-card report">
        <div className="stars">{[0, 1, 2].map((i) => <span key={i} className={i < stars ? 'on' : ''}>★</span>)}</div>
        <h1>{all ? t('Mission accomplished!') : isTest ? t('The test satellite was not good enough') : t('Not all requirements were met')}</h1>
        <ul className="g2d-check">
          {reqs.map((r, i) => <li key={i} className={r.ok ? 'ok' : 'bad'}>{r.ok ? '✅' : '❌'} {r.text}</li>)}
        </ul>
        {stats.stormsSafe + stats.stormsSurvived > 0 && <p className="g2d-note">☀️ {t('Solar storms: {a} slept through in safe mode, {b} survived with a hardened computer.', { a: stats.stormsSafe, b: stats.stormsSurvived })}</p>}
        {lessons.length > 0 && (
          <div className="g2d-lessons">
            <h3>{t('Why - and what to change')}</h3>
            {lessons.map((l, i) => (
              <div key={i} className="g2d-lesson">
                <span>💡 {t(l.text, l.params)}</span>
                {!l.locked && <button onClick={() => onFix(l.slot)}>{t('Change: {s}', { s: slotTitle(l.slot) })} →</button>}
              </div>
            ))}
          </div>
        )}
        {all && stars < 3 && <p className="g2d-note center">{t('For ★★★ deliver {n} or more.', { n: Math.ceil(m.goal * 1.5) })}</p>}
        <div className="g2d-actions">
          {all && onNext && <button className="r-btn" onClick={onNext}>{t('Next mission')} →</button>}
          {all && !onNext && <button className="r-btn" onClick={onCareer}>{t('🏆 All missions done!')}</button>}
          {!all && <button className="r-btn" onClick={() => onFix(lessons.find((l) => !l.locked)?.slot ?? m.slots[0])}>{t('🔧 Design a better satellite')}</button>}
          <button className="g2d-ghost" onClick={onAgain}>{t('🔁 Fly again')}</button>
          {all && <button className="g2d-ghost" onClick={() => onFix(m.slots[0])}>{t('🔧 Improve')}</button>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function BuildScreen({ m, build, setBuild, focus, setFocus, onLaunch }: { m: Mission; build: Build; setBuild(b: Build): void; focus: SlotId | null; setFocus(s: SlotId | null): void; onLaunch(): void }) {
  const { t } = useT();
  const a = useMemo(() => analyse(build, m), [build, m]);
  const slots = useMemo(() => slotsFor(m), [m]);
  const busName = { 'cubesat-3u': 'Tiny (3U)', 'cubesat-12u': 'Medium (12U)', smallsat: 'Large (150 kg)', 'medium-bus': 'Huge (800 kg)' }[a.design.busId] ?? a.design.busId;
  const face = { good: '🙂', warn: '😬', bad: '😱' } as const;

  const slotRow = (id: SlotId) => {
    const slot = slots.find((s) => s.id === id)!;
    const chosen = slot.options.find((o) => o.id === build[id]) ?? slot.options[0];
    const open = focus === id;
    return (
      <div key={id} className={`g2d-slot ${open ? 'open' : ''}`}>
        <button className="g2d-slot-head" onClick={() => setFocus(open ? null : id)}>
          <span className="e">{slot.emoji}</span><b>{t(slot.title)}</b><span className="v">{chosen.emoji} {t(chosen.title)}</span><span className="chev">{open ? '▴' : '▾'}</span>
        </button>
        {open && (
          <div className="g2d-opts">
            {slot.options.map((o) => (
              <button key={o.id} className={`g2d-opt ${build[id] === o.id ? 'on' : ''}`} onClick={() => setBuild({ ...build, [id]: o.id })}>
                <span className="e">{o.emoji}</span><b>{t(o.title)}</b>{o.text && <small>{t(o.text)}</small>}
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
        <SatelliteArt build={build} mission={m} />
        <div className="g2d-size">{t('Satellite size')}: <b>{t(busName)}</b> · {Math.round(a.flight.massKg)} {t('kg')}</div>
        {m.slots.length < 6 && <div className="g2d-size">{t('On this mission you choose only {n} things - the rest is ready.', { n: m.slots.length })}</div>}
      </div>
      <div className="g2d-slots">
        {sat.length > 0 && <h3>{t('🛰️ Satellite')}</h3>}
        {sat.map((s) => slotRow(s.id))}
        {mis.length > 0 && <h3>{t('🚀 Mission')}</h3>}
        {mis.map((s) => slotRow(s.id))}
      </div>
      <footer className="g2d-foot">
        <div className="g2d-gauges">
          {a.gauges.map((g) => (
            <div key={g.id} className={`g2d-gauge ${g.level}`} title={t(g.detail, g.params)}>
              <div className="top"><span>{g.emoji} {t(g.label)}</span><span>{face[g.level]}</span></div>
              <div className="track"><div style={{ width: `${Math.min(100, Math.max(4, g.value * 100))}%` }} /></div>
              <small>{t(g.detail, g.params)}</small>
            </div>
          ))}
        </div>
        <div className="g2d-launch">
          {a.blockers.map((b) => <div key={b} className="g2d-blocker">⛔ {t(b)}</div>)}
          <button className="r-btn" disabled={!a.canLaunch} onClick={onLaunch}>{t('🚀 Launch!')}</button>
        </div>
      </footer>
    </div>
  );
}
