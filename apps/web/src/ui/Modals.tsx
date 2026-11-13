import { useState } from 'react';
import { SCENARIOS, monteCarlo } from '@mission/engine';
import { ROLES, shareUrl, useGame } from '../store';
import { useT } from '../i18n';
import { GB, M, pct } from './format';

export function BriefModal() {
  const startScenario = useGame((s) => s.startScenario);
  const { t, name, blurb } = useT();
  return (
    <div className="modal-bg">
      <div className="modal">
        <div className="eyebrow">{t('NASA Space Apps 2026 · Space Mission Design Game')}</div>
        <h1>GO / NO-GO: Mission Control</h1>
        <p>
          {t('You are the mission team. Pick a customer brief, design the spacecraft, choose the rocket and orbit, then fly the mission. Every choice costs mass, power, money, data or time - and there is never just one right answer.')}
        </p>
        <div className="roles">
          {ROLES.map((r) => (
            <span key={r.id} style={{ borderColor: r.color, color: r.color }}>{t(r.name)}</span>
          ))}
        </div>
        <p className="blurb">{t('Play alone, or with up to 4 people on one screen - each takes a role tab and votes in the Go / No-Go poll before launch.')}</p>
        <div className="scenarios">
          {SCENARIOS.map((s) => (
            <button key={s.id} className="scenario" onClick={() => startScenario(s.id)}>
              <span className={`diff ${s.difficulty}`}>{t(s.difficulty)}</span>
              <b>{name(s.title)}</b>
              <p>{blurb(`scenario:${s.id}`, s.brief)}</p>
              <small>{t('Budget {b} · {y} yr mission', { b: M(s.budgetM), y: s.durationYears })}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReportModal() {
  const { score, sim, design, budgets, setPhase, startScenario } = useGame();
  const { t, name, msg } = useT();
  const [copied, setCopied] = useState(false);
  const [mc] = useState(() => monteCarlo(design, 300));
  if (!score || !sim || !budgets) return null;
  return (
    <div className="modal-bg">
      <div className="modal report">
        <div className="eyebrow">{t('Mission report · {s}', { s: name(budgets.scenario.title) })}</div>
        <div className="grade-row">
          <div className={`grade g${score.grade}`}>{score.grade}</div>
          <div>
            <h2>{sim.success ? t('Mission success') : t('Mission failed')}</h2>
            <p>{msg(sim.endReason)}</p>
            <p className="blurb">
              {t('Score {s} · {p} science pts · {m}/{n} months · {g} delivered', { s: score.total, p: Math.round(sim.science), m: sim.monthsSurvived, n: sim.monthsPlanned, g: GB(sim.dataDeliveredGB) })}
            </p>
          </div>
        </div>
        <table className="breakdown">
          <tbody>
            {score.breakdown.map((x) => (
              <tr key={x.label}><td>{t(x.label)}</td><td className={x.points < 0 ? 'neg' : ''}>{x.points > 0 ? '+' : ''}{x.points}</td></tr>
            ))}
          </tbody>
        </table>
        <h3>{t('Why it went this way')}</h3>
        <ul className="lessons">{score.lessons.map((l, k) => <li key={k}>{msg(l)}</li>)}</ul>
        <p className="blurb">
          {t('Luck matters, but design matters more: across 300 simulated flights this exact design succeeds {p} of the time.', { p: pct(mc.successProbability) })}
        </p>
        <div className="actions">
          <button className="btn" onClick={() => setPhase('design')}>{t('↺ Improve this design')}</button>
          <button className="btn ghost" onClick={() => startScenario(design.scenarioId)}>{t('Start over')}</button>
          <button className="btn ghost" onClick={() => setPhase('brief')}>{t('Other scenarios')}</button>
          <button className="btn ghost" onClick={() => { navigator.clipboard?.writeText(shareUrl(design)); setCopied(true); }}>{copied ? t('Link copied ✓') : t('Share design')}</button>
        </div>
      </div>
    </div>
  );
}
