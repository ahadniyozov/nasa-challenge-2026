// Simple mode: what a first-time player (age 10+) sees. One question per screen, three big choices,
// a crew member who explains problems in plain words, then the flight mini-game.
import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { GROUND_STATIONS, stationById } from '@mission/engine';
import { useT, type T } from '../i18n';
import { HangarScene } from '../scenes/HangarScene';
import { OrbitScene } from '../scenes/OrbitScene';
import { LaunchScene } from '../scenes/LaunchScene';
import { EXTRAS, LEVELS, STATION_FLAGS, STEPS, type Choices, type Option } from './choices';
import { CREW, type Advice } from './advice';
import { stars, useKid } from './store';
import { FlightGame } from './FlightGame';

export function KidApp({ onExpert, langToggle }: { onExpert(): void; langToggle: React.ReactNode }) {
  const phase = useKid((s) => s.phase);
  const { t } = useT();
  return (
    <div className="kid">
      <header className="kid-top">
        <div className="logo">GO<span>/</span>NO-GO</div>
        {phase !== 'home' && <LevelTitle />}
        <div className="kid-top-right">
          {langToggle}
          <button className="link" onClick={onExpert}>{t('🔧 Engineer mode')}</button>
        </div>
      </header>
      {phase === 'home' && <Home />}
      {phase === 'build' && <Build />}
      {phase === 'launch' && <Launch />}
      {phase === 'flight' && <Flight />}
      {phase === 'result' && <Result />}
    </div>
  );
}

function LevelTitle() {
  const level = useKid((s) => s.level);
  const { t } = useT();
  const L = LEVELS[level];
  return <div className="kid-level">{L.emoji} {t(L.title)}</div>;
}

function Home() {
  const { start, unlocked } = useKid();
  const { t } = useT();
  return (
    <div className="kid-home">
      <div className="hero-emoji">🛰️</div>
      <h1>{t('Build a satellite. Launch it. Complete the mission!')}</h1>
      <p className="lead">{t('You are the boss of a space mission. Choose the parts, launch the rocket and catch photos from space.')}</p>
      <div className="levels">
        {LEVELS.map((L, i) => {
          const locked = i > unlocked;
          return (
            <button key={L.scenarioId} className={`level-card ${locked ? 'locked' : ''}`} disabled={locked} onClick={() => start(i)}>
              <div className="level-emoji">{locked ? '🔒' : L.emoji}</div>
              <b>{t(L.title)}</b>
              <span>{t(L.goal, { n: L.goalPhotos })}</span>
              {!locked && <span className="play">{t('▶ Play')}</span>}
              {locked && <small>{t('Finish the previous mission to unlock')}</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Meters() {
  const meters = useKid((s) => s.meters);
  const { t } = useT();
  const face = { good: '🙂', warn: '😬', bad: '😱' } as const;
  return (
    <div className="meters">
      {meters.map((m) => (
        <div key={m.id} className={`meter ${m.level}`} title={t(m.detail, m.detailParams)}>
          <div className="meter-top"><span className="meter-emoji">{m.emoji}</span><span>{t(m.label)}</span><span className="face">{face[m.level]}</span></div>
          <div className="meter-track"><div style={{ width: `${Math.max(4, m.fill * 100)}%` }} /></div>
          <small>{t(m.detail, m.detailParams)}</small>
        </div>
      ))}
    </div>
  );
}

function adviceText(a: Advice, { t, name }: T) {
  const params = { ...a.params };
  if (typeof params.s === 'string') params.s = name(params.s);
  if (typeof params.what === 'string') params.what = t(STEPS.find((s) => s.id === params.what)!.title).toLowerCase();
  return t(a.text, params);
}

function Guide({ advice, fallback }: { advice: Advice | undefined; fallback: string }) {
  const tr = useT();
  const { t } = tr;
  const who = CREW[advice?.who ?? 'boss'];
  return (
    <div className={`guide ${advice ? advice.level : ''}`}>
      <div className="avatar">{who.emoji}</div>
      <div className="bubble">
        <small>{t(who.name)} · {t(who.role)}</small>
        <div>{advice ? adviceText(advice, tr) : t(fallback)}</div>
      </div>
    </div>
  );
}

function OptionCard({ o, active, onClick }: { o: Option; active: boolean; onClick(): void }) {
  const { t } = useT();
  return (
    <button className={`opt ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="opt-emoji">{o.emoji}</div>
      <div className="opt-body">
        <b>{t(o.title)}</b>
        <span>{t(o.text)}</span>
        <span className="pro">✓ {t(o.good)}</span>
        <span className="con">✗ {t(o.bad)}</span>
      </div>
      {active && <div className="tick">✔</div>}
    </button>
  );
}

function Build() {
  const { step, goStep, choices, choose, advice, ready, budgets, launch } = useKid();
  const tr = useT();
  const { t, name } = tr;
  const S = STEPS[step];
  const stepAdvice = advice.find((a) => a.step === S.id);
  const showGlobe = S.id === 'orbit' || S.id === 'stations';
  const stations = choices.stations.map((id) => stationById.get(id)!).filter(Boolean);
  const isCheck = S.id === 'check';

  return (
    <div className="build">
      <nav className="stepper">
        {STEPS.map((s, i) => {
          const problem = advice.some((a) => a.step === s.id && a.level === 'bad');
          return (
            <button key={s.id} className={`dot ${i === step ? 'on' : ''} ${i < step ? 'done' : ''} ${problem ? 'problem' : ''}`} onClick={() => goStep(i)}>
              <span>{s.emoji}</span><small>{t(s.title)}</small>
            </button>
          );
        })}
      </nav>

      <div className="build-main">
        <div className="build-view">
          <Canvas camera={{ position: [3, 2, 4], fov: 45 }} dpr={[1, 2]}>
            <Suspense fallback={null}>
              {showGlobe ? <OrbitScene orbit={budgets.orbit} stations={stations} timeScale={500} /> : <HangarScene bus={budgets.bus} parts={budgets.parts} />}
            </Suspense>
          </Canvas>
        </div>

        <div className="build-side">
          <Guide advice={isCheck ? undefined : stepAdvice} fallback={S.guide} />
          <h2>{S.emoji} {t(S.question)}</h2>

          {S.options.length > 0 && (
            <div className="opts">
              {S.options.map((o) => (
                <OptionCard key={o.id} o={o} active={choices[S.id as keyof Choices] === o.id} onClick={() => choose({ [S.id]: o.id } as Partial<Choices>)} />
              ))}
            </div>
          )}

          {S.id === 'stations' && (
            <div className="station-grid">
              {GROUND_STATIONS.map((s) => {
                const on = choices.stations.includes(s.id);
                return (
                  <button key={s.id} className={`station ${on ? 'active' : ''}`}
                    onClick={() => choose({ stations: on ? choices.stations.filter((x) => x !== s.id) : [...choices.stations, s.id].slice(-3) })}>
                    <span className="flag">{STATION_FLAGS[s.id]}</span>
                    <span>{name(s.name)}</span>
                    {Math.abs(s.lat) > 60 && <small>{t('near the pole')}</small>}
                  </button>
                );
              })}
            </div>
          )}

          {isCheck && (
            <div className="check-list">
              {advice.length === 0 && <div className="all-good">{t('🎉 All systems GO! Your satellite is ready.')}</div>}
              {advice.map((a, i) => (
                <div key={i} className={`advice ${a.level}`}>
                  <span className="avatar sm">{CREW[a.who].emoji}</span>
                  <span className="advice-text">{a.level === 'bad' ? '⛔ ' : '⚠️ '}{adviceText(a, tr)}</span>
                  <button className="kbtn small" onClick={() => goStep(STEPS.findIndex((s) => s.id === a.step))}>{t('Fix it →')}</button>
                </div>
              ))}
              <h3>{t('Extra upgrades (optional)')}</h3>
              <div className="extras">
                {EXTRAS.map((o) => {
                  const on = choices.extras.includes(o.id);
                  return <OptionCard key={o.id} o={o} active={on} onClick={() => choose({ extras: on ? choices.extras.filter((x) => x !== o.id) : [...choices.extras, o.id] })} />;
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="build-foot">
        <Meters />
        <div className="nav-btns">
          <button className="kbtn ghost" disabled={step === 0} onClick={() => goStep(step - 1)}>{t('← Back')}</button>
          {isCheck ? (
            <button className="kbtn launch" disabled={!ready} onClick={launch}>{ready ? t('🚀 LAUNCH!') : t('Fix the ⛔ first')}</button>
          ) : (
            <button className="kbtn" onClick={() => goStep(step + 1)}>{t('Next →')}</button>
          )}
        </div>
      </footer>
    </div>
  );
}

function Launch() {
  const { sim, choices, setPhase, finish } = useKid();
  const { t, msg } = useT();
  const [count, setCount] = useState(3);
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (count <= 0) { setGo(true); return; }
    const id = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(id);
  }, [count]);
  if (!sim) return null;
  const failed = sim.monthsSurvived === 0;
  return (
    <div className="launch-screen">
      <Canvas camera={{ position: [10, 3, 14], fov: 45 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          {go && (
            <LaunchScene launcherId={choices.rocket} failed={failed}
              onDone={() => failed
                ? finish({ delivered: 0, captured: 0, survived: false, endText: sim.endReason, lostInSpace: 0, batteryOuts: 0, missedFar: 0, stormChoice: null })
                : setPhase('flight')} />
          )}
        </Suspense>
      </Canvas>
      {!go && <div className="countdown">{count}</div>}
      {go && <div className="countdown small">{failed ? '' : t('LIFT-OFF!')}</div>}
      {go && failed && <div className="flash-msg">{msg('Launch failure')}</div>}
    </div>
  );
}

function Flight() {
  const { budgets, sim, choices, level, finish } = useKid();
  if (!sim) return null;
  const L = LEVELS[level];
  return <FlightGame budgets={budgets} sim={sim} stationIds={choices.stations} targetKind={L.targetKind} goal={L.goalPhotos} onEnd={finish} />;
}

function Result() {
  const { result, level, start, goStep, launch, unlocked, advice } = useKid();
  const tr = useT();
  const { t, msg } = tr;
  if (!result) return null;
  const L = LEVELS[level];
  const n = stars(result, L.goalPhotos);
  const lessons: string[] = [];
  if (result.endText) {
    lessons.push(msg(result.endText));
    if (/computer/.test(result.endText)) lessons.push(t('A "Spare brain" upgrade (backup computer) would have saved this mission. Real satellites carry backups!'));
    else if (/drag|decayed/i.test(result.endText)) lessons.push(t('Fly higher - thin air pulls low satellites down.'));
    else if (/failed during ascent/.test(result.endText)) lessons.push(t('Rockets sometimes fail - it was bad luck, not your design. Try again!'));
    else lessons.push(t('Backup parts and a dodge thruster make satellites tougher.'));
  }
  if (result.lostInSpace > 0) lessons.push(t('{n} photos never reached Earth - they were stuck in memory. More stations or a faster antenna would help.', { n: result.lostInSpace }));
  if (result.batteryOuts > 0) lessons.push(t('The battery ran out in Earth\'s shadow. A bigger battery keeps the camera awake.'));
  if (result.missedFar > 3) lessons.push(t('Many taps were too far away. Wait until the target is inside the green circle - that is what the camera can see.'));
  if (result.stormChoice === 'risk') lessons.push(t('You risked it during the solar storm. Real teams usually put satellites in safe mode.'));
  advice.filter((a) => a.level === 'warn').slice(0, 2).forEach((a) => lessons.push(adviceText(a, tr)));
  if (!lessons.length && n === 3) lessons.push(t('Perfect mission! Real engineers would be proud.'));

  return (
    <div className="result">
      <div className="result-card">
        <div className="stars">{[0, 1, 2].map((i) => <span key={i} className={i < n ? 'on' : ''}>★</span>)}</div>
        <h1>{result.delivered >= L.goalPhotos ? t('Mission complete!') : result.survived ? t('Not enough photos this time') : t('The satellite was lost')}</h1>
        <div className="result-num">{L.targetKind === 'fire' ? '🔥' : '📸'} {result.delivered} / {L.goalPhotos} <small>{t('photos delivered')}</small></div>
        <ul className="star-list">
          <li className={result.survived ? 'ok' : ''}>{result.survived ? '★' : '☆'} {t('Satellite worked until the end')}</li>
          <li className={result.delivered >= L.goalPhotos ? 'ok' : ''}>{result.delivered >= L.goalPhotos ? '★' : '☆'} {t('Goal reached')}</li>
          <li className={result.delivered >= L.goalPhotos * 2 ? 'ok' : ''}>{result.delivered >= L.goalPhotos * 2 ? '★' : '☆'} {t('Double the goal - expert!')}</li>
        </ul>
        {lessons.length > 0 && (
          <div className="lessons-kid">
            <h3>{t('What the crew learned')}</h3>
            {lessons.map((l, i) => <p key={i}>💡 {l}</p>)}
          </div>
        )}
        <div className="result-actions">
          <button className="kbtn" onClick={launch}>{t('🔁 Fly again')}</button>
          <button className="kbtn ghost" onClick={() => goStep(0)}>{t('🔧 Change the satellite')}</button>
          {level + 1 < LEVELS.length && unlocked > level && <button className="kbtn launch" onClick={() => start(level + 1)}>{t('Next mission →')}</button>}
        </div>
      </div>
    </div>
  );
}
