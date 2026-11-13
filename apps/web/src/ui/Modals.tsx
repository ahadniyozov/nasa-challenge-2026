import { useState } from 'react';
import { SCENARIOS, monteCarlo } from '@mission/engine';
import { ROLES, shareUrl, useGame } from '../store';
import { M, pct } from './format';

export function BriefModal() {
  const startScenario = useGame((s) => s.startScenario);
  return (
    <div className="modal-bg">
      <div className="modal">
        <div className="eyebrow">NASA Space Apps 2026 · Space Mission Design Game</div>
        <h1>GO / NO-GO: Mission Control</h1>
        <p>
          You are the mission team. Pick a customer brief, design the spacecraft, choose the rocket and orbit, then fly the mission.
          Every choice costs mass, power, money, data or time - and there is never just one right answer.
        </p>
        <div className="roles">
          {ROLES.map((r) => (
            <span key={r.id} style={{ borderColor: r.color, color: r.color }}>{r.name}</span>
          ))}
        </div>
        <p className="blurb">Play alone, or with up to 4 people on one screen - each takes a role tab and votes in the Go / No-Go poll before launch.</p>
        <div className="scenarios">
          {SCENARIOS.map((s) => (
            <button key={s.id} className="scenario" onClick={() => startScenario(s.id)}>
              <span className={`diff ${s.difficulty}`}>{s.difficulty}</span>
              <b>{s.title}</b>
              <p>{s.brief}</p>
              <small>Budget {M(s.budgetM)} · {s.durationYears} yr mission</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReportModal() {
  const { score, sim, design, budgets, setPhase, startScenario } = useGame();
  const [copied, setCopied] = useState(false);
  const [mc] = useState(() => monteCarlo(design, 300));
  if (!score || !sim || !budgets) return null;
  return (
    <div className="modal-bg">
      <div className="modal report">
        <div className="eyebrow">Mission report · {budgets.scenario.title}</div>
        <div className="grade-row">
          <div className={`grade g${score.grade}`}>{score.grade}</div>
          <div>
            <h2>{sim.success ? 'Mission success' : 'Mission failed'}</h2>
            <p>{sim.endReason}</p>
            <p className="blurb">Score {score.total} · {Math.round(sim.science)} science pts · {sim.monthsSurvived}/{sim.monthsPlanned} months · {sim.dataDeliveredGB.toFixed(0)} GB delivered</p>
          </div>
        </div>
        <table className="breakdown">
          <tbody>
            {score.breakdown.map((x) => (
              <tr key={x.label}><td>{x.label}</td><td className={x.points < 0 ? 'neg' : ''}>{x.points > 0 ? '+' : ''}{x.points}</td></tr>
            ))}
          </tbody>
        </table>
        <h3>Why it went this way</h3>
        <ul className="lessons">{score.lessons.map((l, k) => <li key={k}>{l}</li>)}</ul>
        <p className="blurb">
          Luck matters, but design matters more: across 300 simulated flights this exact design succeeds {pct(mc.successProbability)} of the time.
        </p>
        <div className="actions">
          <button className="btn" onClick={() => setPhase('design')}>↺ Improve this design</button>
          <button className="btn ghost" onClick={() => startScenario(design.scenarioId)}>Start over</button>
          <button className="btn ghost" onClick={() => setPhase('brief')}>Other scenarios</button>
          <button className="btn ghost" onClick={() => { navigator.clipboard?.writeText(shareUrl(design)); setCopied(true); }}>{copied ? 'Link copied ✓' : 'Share design'}</button>
        </div>
      </div>
    </div>
  );
}
