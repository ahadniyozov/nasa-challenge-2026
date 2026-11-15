// Crew mode: 2-4 players design and fly one satellite together, as a mission-control team.
// Screens: join → lobby (mission and roles) → design (each role changes its own parts, the money is shared)
// → GO / NO-GO poll (every role must say GO) → launch → flight (the director flies, the others work consoles) → report.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { analyse, slotsFor, type Analysis, type Build, type SlotId } from '../game2d/config';
import { MISSIONS, type Mission } from '../game2d/missions';
import { BuildScreen, Fallback2D, Report } from '../game2d/Game2D';
import { Flight2D, type FlightStats } from '../game2d/Flight2D';
import { Launch2D } from '../game2d/Launch2D';
import type { HudState } from '../game2d/FlightHud';
import type { SimState } from '../game2d/sim';
import { CALL_TEXT, OWNER, ROLE_JOB, ROLE_TITLE, ROLES, type CrewState, type Role, type Snapshot } from './roles';
import { useCrew, type CrewApi } from './useCrew';
import { CrewConsole } from './CrewConsole';
import './crew.css';

const Flight3D = lazy(() => import('../game3d/Flight3D'));
const Launch3D = lazy(() => import('../game3d/Launch3D').then((m) => ({ default: m.Launch3D })));

export function CrewGame({ code, flight3d, onSpace, onExit }: { code: string | null; flight3d: boolean; onSpace(on: boolean): void; onExit(): void }) {
  const c = useCrew();
  const { crew } = c;
  useEffect(() => { onSpace(crew?.phase === 'launch' || crew?.phase === 'flight'); }, [crew?.phase, onSpace]);
  if (!crew) return <Entry c={c} code={code} onExit={onExit} />;
  return <InCrew c={c} crew={crew} flight3d={flight3d} onExit={() => { c.leave(); onExit(); }} />;
}

// ---------------------------------------------------------------------------
function Entry({ c, code, onExit }: { c: CrewApi; code: string | null; onExit(): void }) {
  const { t } = useT();
  const [name, setName] = useState(c.savedName);
  const [join, setJoin] = useState(code ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ok = name.trim().length > 0 && c.connected && !busy;
  return (
    <div className="g2d-page">
      <div className="g2d-doc crew-entry">
        <button className="g2d-back" onClick={onExit}>{t('All missions')}</button>
        <h1>{t('Crew mode')}</h1>
        <p className="g2d-lead">{t('Design one satellite as a team. Each of you decides your own parts, the budget is shared, and nothing flies until every role says GO.')}</p>
        {c.failed && <p className="crew-error">{t('The crew server cannot be reached. Check the connection and try again.')}</p>}
        <label className="crew-field">
          <span>{t('Your name')}</span>
          <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder={t('For example, Alex')} autoComplete="nickname" />
        </label>
        <div className="crew-entry-row">
          <section>
            <h2>{t('Start a new crew')}</h2>
            <p>{t('You become the flight director and get a code to share.')}</p>
            <button className="r-btn" disabled={!ok} onClick={async () => { setBusy(true); await c.create(name.trim(), MISSIONS[0].id); setBusy(false); }}>{t('Create a crew')}</button>
          </section>
          <section>
            <h2>{t('Join a crew')}</h2>
            <label className="crew-field">
              <span>{t('Crew code')}</span>
              <input className="code" value={join} maxLength={4} onChange={(e) => setJoin(e.target.value.toUpperCase())} placeholder="ABCD" autoCapitalize="characters" />
            </label>
            <button className="g2d-ghost" disabled={!ok || join.length !== 4} onClick={async () => {
              setBusy(true); setErr(await c.join(join, name.trim())); setBusy(false);
            }}>{t('Join')}</button>
            {err && <p className="crew-error">{t(err)}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function InCrew({ c, crew, flight3d, onExit }: { c: CrewApi; crew: CrewState; flight3d: boolean; onExit(): void }) {
  const tr = useT();
  const { t } = tr;
  const m = useMemo(() => MISSIONS.find((x) => x.id === crew.missionId) ?? MISSIONS[0], [crew.missionId]);
  const build = crew.build;
  const a = useMemo(() => analyse(build, m), [build, m]);
  const mine = c.me?.roles ?? [];
  const has = (r: Role) => mine.includes(r);
  const holder = (r: Role) => crew.players.find((p) => p.roles.includes(r));
  const ownerOf = (s: SlotId) => t(ROLE_TITLE[OWNER[s]]);
  const [focus, setFocus] = useState<SlotId | null>(null);
  // the launch animation finished on this screen (per run)
  const [launched, setLaunched] = useState(-1);

  if (crew.phase === 'lobby') return <Lobby c={c} crew={crew} onExit={onExit} />;

  if (crew.phase === 'build' || crew.phase === 'poll') {
    const setBuild = (b: Build) => {
      const slot = (Object.keys(b) as SlotId[]).find((k) => b[k] !== build[k]);
      if (slot) c.emit('crew:slot', { slot, option: b[slot] });
    };
    return (
      <BuildScreen m={m} build={build} setBuild={setBuild} focus={focus} setFocus={setFocus} onLaunch={() => undefined} use3d={flight3d}
        canEdit={(s) => has(OWNER[s])} ownerOf={ownerOf}
        top={<TeamPanel crew={crew} m={m} mine={mine} />}
        actions={(an) => <PollActions c={c} crew={crew} a={an} mine={mine} />} />
    );
  }

  if (crew.phase === 'launch' && launched !== crew.run) {
    const done = () => { setLaunched(crew.run); if (has('director')) c.emit('crew:flying'); };
    return flight3d
      ? (
        <Fallback2D key={crew.run} fallback={<Launch2D build={build} onDone={done} />}>
          <Suspense fallback={<div className="runner-stage g2d-launch" />}><Launch3D build={build} mission={m} onDone={done} /></Suspense>
        </Fallback2D>
      )
      : <Launch2D key={crew.run} build={build} onDone={done} />;
  }

  if (crew.phase === 'launch' || crew.phase === 'flight') {
    if (has('director')) return <PilotFlight key={crew.run} c={c} crew={crew} m={m} a={a} flight3d={flight3d} />;
    return <CrewConsole c={c} crew={crew} m={m} a={a} mine={mine} />;
  }

  // report
  const stats = crew.stats as FlightStats | null;
  if (!stats) return <div className="g2d-page" />;
  const director = holder('director');
  return (
    <Report tr={tr} m={m} a={a} stats={stats} isTest={false} onStars={() => undefined} ownerOf={ownerOf}
      onFix={(s) => { setFocus(s); c.emit('crew:redesign'); }}
      onAgain={has('director') ? () => c.emit('crew:again') : undefined}
      onNext={has('director') ? () => c.emit('crew:lobby') : undefined}
      waiting={has('director') ? undefined : t('{name} (flight director) decides whether to fly again or pick the next mission. Anyone can send the team back to the design.', { name: director?.name ?? '' })} />
  );
}

/** roles, who holds them, and the poll as it goes round the room */
function TeamPanel({ crew, m, mine }: { crew: CrewState; m: Mission; mine: Role[] }) {
  const { t } = useT();
  const slots = slotsFor(m);
  return (
    <section className="crew-team" aria-label={t('Crew')}>
      <div className="crew-team-head">
        <b>{t('Crew {code}', { code: crew.code })}</b>
        <span>{crew.phase === 'poll' ? t('GO / NO-GO poll') : t('You change the parts marked with your role. The budget is shared.')}</span>
      </div>
      <ul>
        {ROLES.map((r) => {
          const p = crew.players.find((x) => x.roles.includes(r));
          const vote = crew.votes[r];
          const parts = slots.filter((s) => OWNER[s.id] === r).length;
          return (
            <li key={r} className={`${mine.includes(r) ? 'mine' : ''} ${p?.online === false ? 'off' : ''}`}>
              <span className="role">{t(ROLE_TITLE[r])}</span>
              <span className="who">{p?.name ?? '-'}{mine.includes(r) ? ` (${t('you')})` : ''}</span>
              {crew.phase === 'poll'
                ? <span className={`lamp ${vote === true ? 'go' : 'wait'}`}>{vote === true ? 'GO' : t('Standing by')}</span>
                : <span className="parts">{t('{n} parts', { n: parts })}</span>}
            </li>
          );
        })}
      </ul>
      {crew.noGo.length > 0 && crew.phase === 'build' && (
        <p className="crew-nogo">{t('{role} called NO-GO. Talk it through, change the design and poll again.', { role: t(ROLE_TITLE[crew.noGo[0]]) })}</p>
      )}
    </section>
  );
}

function PollActions({ c, crew, a, mine }: { c: CrewApi; crew: CrewState; a: Analysis; mine: Role[] }) {
  const { t } = useT();
  if (crew.phase === 'build') {
    if (!mine.includes('director')) return <p className="crew-wait">{t('The flight director starts the GO / NO-GO poll when the team is ready.')}</p>;
    return <button className="r-btn" disabled={!a.canLaunch} onClick={() => c.emit('crew:poll')}>{a.canLaunch ? t('Poll the room') : t('NO-GO')}</button>;
  }
  const open = mine.filter((r) => crew.votes[r] !== true);
  if (open.length === 0) return <p className="crew-wait">{t('You said GO. Waiting for the rest of the crew.')}</p>;
  const vote = (go: boolean) => open.forEach((role) => c.emit('crew:vote', { role, go }));
  return (
    <div className="crew-vote">
      <span>{open.map((r) => t(ROLE_TITLE[r])).join(', ')}:</span>
      <button className="r-btn" onClick={() => vote(true)}>GO</button>
      <button className="g2d-ghost" onClick={() => vote(false)}>NO-GO</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Lobby({ c, crew, onExit }: { c: CrewApi; crew: CrewState; onExit(): void }) {
  const { t } = useT();
  const mine = c.me?.roles ?? [];
  const director = mine.includes('director');
  const allHeld = ROLES.every((r) => crew.players.some((p) => p.roles.includes(r)));
  const link = `${location.origin}${location.pathname}?crew=${crew.code}`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="g2d-page">
      <div className="g2d-doc crew-lobby">
        <button className="g2d-back" onClick={onExit}>{t('Leave the crew')}</button>
        <div className="crew-code">
          <div>
            <span>{t('Crew code')}</span>
            <b>{crew.code}</b>
          </div>
          <button className="g2d-ghost small" onClick={() => { void navigator.clipboard?.writeText(link).then(() => setCopied(true)); }}>{copied ? t('Link copied') : t('Copy the invite link')}</button>
        </div>
        <p className="g2d-lead">{t('Friends open the game, choose Play as a crew and enter this code. Up to 4 players; with fewer, one player takes several roles.')}</p>

        <h2>{t('Roles')}</h2>
        <ul className="crew-roles">
          {ROLES.map((r) => {
            const p = crew.players.find((x) => x.roles.includes(r));
            const isMine = mine.includes(r);
            return (
              <li key={r} className={isMine ? 'mine' : ''}>
                <div><b>{t(ROLE_TITLE[r])}</b><small>{t(ROLE_JOB[r])}</small></div>
                <span className="who">{p ? `${p.name}${isMine ? ` (${t('you')})` : ''}` : t('Free')}</span>
                {isMine
                  ? <button className="g2d-ghost small" onClick={() => c.emit('crew:role', { role: r, take: false })}>{t('Give up')}</button>
                  : <button className="g2d-ghost small" disabled={!!p && p.online} onClick={() => c.emit('crew:role', { role: r, take: true })}>{t('Take')}</button>}
              </li>
            );
          })}
        </ul>

        <h2>{t('Mission')}</h2>
        <ol className="crew-missions">
          {MISSIONS.map((m) => (
            <li key={m.id}>
              <button className={crew.missionId === m.id ? 'on' : ''} disabled={!director} onClick={() => c.emit('crew:mission', { missionId: m.id })} aria-pressed={crew.missionId === m.id}>
                <span className="num">{m.num}</span><b>{t(m.title)}</b><small>{t(m.level)}</small>
              </button>
            </li>
          ))}
        </ol>

        <div className="g2d-actions">
          {director
            ? <button className="r-btn" disabled={!allHeld} onClick={() => c.emit('crew:start')}>{t('Start designing')}</button>
            : <p className="crew-wait">{t('The flight director picks the mission and starts.')}</p>}
          {director && !allHeld && <p className="crew-wait">{t('Every role needs a player first.')}</p>}
        </div>
        <p className="crew-players">{t('In the crew')}: {crew.players.map((p) => `${p.name}${p.online ? '' : ` (${t('offline')})`}`).join(', ')}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
/** The flight director's screen: the real flight, streamed to the crew; safe mode can come from the engineer. */
function PilotFlight({ c, crew, m, a, flight3d }: { c: CrewApi; crew: CrewState; m: Mission; a: Analysis; flight3d: boolean }) {
  const { t } = useT();
  const sent = useRef(false);
  useEffect(() => {
    c.onSafe((on) => {
      const w = window as unknown as Record<string, ((on: boolean) => void) | undefined>;
      (w.__g3dSafe ?? w.__g2dSafe)?.(on);
    });
  }, [c]);
  const onTick = (s: SimState, h: HudState) => {
    const snap: Snapshot = {
      t: s.t, battery: s.battery, memory: s.memory, delivered: s.delivered, hearts: s.hearts,
      shadow: s.shadow, contact: s.contact, safe: s.safe, asleep: s.asleep, storm: s.storm, laneY: s.laneY,
      objs: s.objects.filter((o) => !o.done && o.ahead > -0.2 && o.ahead < 2.8).map((o) => [o.kind[0], o.lane, Math.round(o.ahead * 100) / 100]),
      log: h.log,
    };
    c.emit('crew:tick', snap);
  };
  const onEnd = (stats: FlightStats) => { if (!sent.current) { sent.current = true; c.emit('crew:end', { stats }); } };
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(id); }, []);
  const recent = c.calls.filter((x) => Date.now() - x.at < 4000);
  return (
    <div className="crew-pilot">
      {flight3d
        ? (
          <Fallback2D fallback={<Flight2D p={a.flight} m={m} onEnd={onEnd} seed={crew.seed} onTick={onTick} />}>
            <Suspense fallback={<div className="runner-stage g2d-flight" />}><Flight3D p={a.flight} m={m} build={crew.build} onEnd={onEnd} seed={crew.seed} onTick={onTick} /></Suspense>
          </Fallback2D>
        )
        : <Flight2D p={a.flight} m={m} onEnd={onEnd} seed={crew.seed} onTick={onTick} />}
      <ol className="crew-calls" aria-live="assertive">
        {recent.map((x) => <li key={x.at}><b>{x.from}</b> {t(CALL_TEXT[x.key] ?? x.key)}</li>)}
      </ol>
    </div>
  );
}
