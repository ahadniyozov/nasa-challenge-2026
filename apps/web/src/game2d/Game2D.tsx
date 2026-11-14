// 2D mission game: brief → test flight → report → build your own → flight → report.
// "Play first, design later": the test satellite fails in instructive ways, then the player fixes it.
import { useCallback, useMemo, useState } from 'react';
import { useT, type T } from '../i18n';
import { analyse, MISSION, SLOTS, TEST_SATELLITE, type Build, type SlotId } from './config';
import { Flight2D, type FlightStats } from './Flight2D';
import { SatelliteArt } from './SatelliteArt';

type Phase = 'brief' | 'flight' | 'report' | 'build';

export function Game2D({ links }: { links: React.ReactNode }) {
  const tr = useT();
  const { t } = tr;
  const [phase, setPhase] = useState<Phase>('brief');
  const [build, setBuild] = useState<Build>(TEST_SATELLITE);
  const [isTest, setIsTest] = useState(true);
  const [stats, setStats] = useState<FlightStats | null>(null);
  const [focus, setFocus] = useState<SlotId | null>(null);
  const [runId, setRunId] = useState(0);
  const a = useMemo(() => analyse(build), [build]);
  const onEnd = useCallback((s: FlightStats) => { setStats(s); setPhase('report'); }, []);

  const fly = (test: boolean) => { setIsTest(test); setRunId((n) => n + 1); setPhase('flight'); };
  const toBuild = (slot: SlotId | null) => { setFocus(slot); setPhase('build'); };

  return (
    <div className="runner g2d">
      <header className="runner-top">
        <div className="logo">GO<span>/</span>NO-GO <small>{t('Wildfire Watch')}</small></div>
        <div className="runner-links">{links}</div>
      </header>
      {phase === 'brief' && <Brief onTest={() => { setBuild(TEST_SATELLITE); fly(true); }} onBuild={() => toBuild(null)} />}
      {phase === 'flight' && <Flight2D key={runId} p={a.flight} onEnd={onEnd} />}
      {phase === 'report' && stats && <Report tr={tr} stats={stats} isTest={isTest} sharp={a.flight.sharp} onFix={toBuild} onAgain={() => fly(isTest)} />}
      {phase === 'build' && <BuildScreen build={build} setBuild={setBuild} focus={focus} setFocus={setFocus} onLaunch={() => fly(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
function Brief({ onTest, onBuild }: { onTest(): void; onBuild(): void }) {
  const { t } = useT();
  return (
    <div className="g2d-page">
      <div className="g2d-card brief">
        <div className="g2d-customer">
          <div className="g2d-avatar">👩‍🚒</div>
          <div className="g2d-bubble">
            <small>{t('Customer: Forest Fire Service')}</small>
            {t('Every summer, fires burn the northern forests. We need a satellite that finds them and sends us photos - for 3 years.')}
          </div>
        </div>
        <h2>{t('Mission requirements')}</h2>
        <ul className="g2d-reqs">
          <li>🔥 {t('Deliver at least {n} fire photos to Earth', { n: MISSION.goalPhotos })}</li>
          <li>⏳ {t('Work for the whole {n}-year mission', { n: MISSION.years })}</li>
          <li>🔍 {t('Photos sharp enough to see a fire ({m} m or better)', { m: MISSION.maxResolutionM })}</li>
          <li>💰 {t('Stay within the $45M budget')}</li>
        </ul>
        <p className="g2d-note">{t('Our engineers already built a cheap test satellite. Fly it first and see what happens!')}</p>
        <div className="g2d-actions">
          <button className="r-btn" onClick={onTest}>{t('🚀 Fly the test satellite')}</button>
          <button className="g2d-ghost" onClick={onBuild}>{t('🔧 Build my own')}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
interface Lesson { text: string; params?: Record<string, string | number>; slot: SlotId }

function lessonsFor(s: FlightStats): Lesson[] {
  const out: Lesson[] = [];
  if (s.decayed) out.push({ text: 'At 400 km thin air slowly pulls the satellite down - it fell after about 1 year. Choose a higher orbit or add a thruster.', slot: 'orbit' });
  if (s.batteryOuts > 0) out.push({ text: 'The battery ran flat in Earth\'s shadow {n} time(s). A bigger battery or bigger solar panels keep the satellite awake.', params: { n: s.batteryOuts }, slot: 'battery' });
  if (s.memoryFull > 0) out.push({ text: 'Memory was full {n} time(s) - new photos were lost. More memory, or send photos home more often.', params: { n: s.memoryFull }, slot: 'memory' });
  if (s.lostInMemory > 0) out.push({ text: '{n} photos were still in memory at the end. More ground stations or a faster antenna would bring them home.', params: { n: s.lostInMemory }, slot: 'stations' });
  if (s.nightMissed >= 2) out.push({ text: '{n} fires passed in the dark. A normal camera needs sunlight - a heat camera sees fires at night.', params: { n: s.nightMissed }, slot: 'camera' });
  if (s.blurry > 0) out.push({ text: 'From this height the photos are too blurry to see a fire. Fly lower.', slot: 'orbit' });
  if (s.hits >= 2) out.push({ text: 'Space junk hit the satellite {n} times. A shield adds one more life.', params: { n: s.hits }, slot: 'shield' });
  return out;
}

function Report({ tr, stats, isTest, sharp, onFix, onAgain }: { tr: T; stats: FlightStats; isTest: boolean; sharp: boolean; onFix(s: SlotId): void; onAgain(): void }) {
  const { t, name } = tr;
  const reqs = [
    { ok: stats.delivered >= MISSION.goalPhotos, text: t('Fire photos delivered: {d} of {n}', { d: stats.delivered, n: MISSION.goalPhotos }) },
    { ok: stats.survived && !stats.decayed, text: stats.survived ? t('Worked for all {n} years', { n: MISSION.years }) : stats.decayed ? t('Fell from orbit early') : t('Destroyed by space junk') },
    { ok: sharp, text: sharp ? t('Photos sharp enough') : t('Photos too blurry') },
    { ok: true, text: t('Within budget') },
  ];
  const met = reqs.filter((r) => r.ok).length;
  const stars = met === 4 ? (stats.delivered >= MISSION.goalPhotos * 1.5 ? 3 : 2) : met >= 3 ? 1 : 0;
  const lessons = lessonsFor(stats);
  const slotTitle = (id: SlotId) => t(SLOTS.find((s) => s.id === id)!.title);
  void name;
  return (
    <div className="g2d-page">
      <div className="g2d-card report">
        <div className="stars">{[0, 1, 2].map((i) => <span key={i} className={i < stars ? 'on' : ''}>★</span>)}</div>
        <h1>{met === 4 ? t('Mission accomplished!') : isTest ? t('The test satellite was not good enough') : t('Not all requirements were met')}</h1>
        <ul className="g2d-check">
          {reqs.map((r, i) => <li key={i} className={r.ok ? 'ok' : 'bad'}>{r.ok ? '✅' : '❌'} {r.text}</li>)}
        </ul>
        {lessons.length > 0 && (
          <div className="g2d-lessons">
            <h3>{t('Why - and what to change')}</h3>
            {lessons.map((l, i) => (
              <div key={i} className="g2d-lesson">
                <span>💡 {t(l.text, l.params)}</span>
                <button onClick={() => onFix(l.slot)}>{t('Change: {s}', { s: slotTitle(l.slot) })} →</button>
              </div>
            ))}
          </div>
        )}
        <div className="g2d-actions">
          {isTest || met < 4 ? <button className="r-btn" onClick={() => onFix(lessons[0]?.slot ?? 'camera')}>{t('🔧 Design a better satellite')}</button> : null}
          <button className="g2d-ghost" onClick={onAgain}>{t('🔁 Fly again')}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function BuildScreen({ build, setBuild, focus, setFocus, onLaunch }: { build: Build; setBuild(b: Build): void; focus: SlotId | null; setFocus(s: SlotId | null): void; onLaunch(): void }) {
  const { t } = useT();
  const a = useMemo(() => analyse(build), [build]);
  const busName = { 'cubesat-3u': 'Tiny (3U)', 'cubesat-12u': 'Medium (12U)', smallsat: 'Large (150 kg)', 'medium-bus': 'Huge (800 kg)' }[a.design.busId] ?? a.design.busId;
  const face = { good: '🙂', warn: '😬', bad: '😱' } as const;

  const slotRow = (id: SlotId) => {
    const slot = SLOTS.find((s) => s.id === id)!;
    const chosen = slot.options.find((o) => o.id === build[id])!;
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

  return (
    <div className="g2d-build">
      <div className="g2d-art">
        <SatelliteArt build={build} />
        <div className="g2d-size">{t('Satellite size')}: <b>{t(busName)}</b> · {Math.round(a.flight.massKg)} {t('kg')}</div>
      </div>
      <div className="g2d-slots">
        <h3>{t('🛰️ Satellite')}</h3>
        {SLOTS.filter((s) => s.group === 'satellite').map((s) => slotRow(s.id))}
        <h3>{t('🚀 Mission')}</h3>
        {SLOTS.filter((s) => s.group === 'mission').map((s) => slotRow(s.id))}
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
