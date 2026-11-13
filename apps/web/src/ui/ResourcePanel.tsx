// Right panel: live resource budgets, design review and the Go / No-Go poll.
import { ROLES, useGame } from '../store';
import { GB, kg, M, pct, W, yr } from './format';

function Bar({ label, used, limit, text, invert = false, why }: { label: string; used: number; limit: number; text: string; invert?: boolean; why?: string }) {
  const ratio = limit > 0 ? used / limit : used > 0 ? 9 : 0;
  // usage bars: red when over; "invert" bars (lifetime, science, data): red when under
  const level = invert ? (ratio >= 1 ? 'ok' : ratio >= 0.8 ? 'warn' : 'bad') : ratio <= 0.8 ? 'ok' : ratio <= 1 ? 'warn' : 'bad';
  return (
    <div className={`bar ${level}`} title={why}>
      <div className="bar-head">
        <span>{label}</span>
        <span>{text}</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
    </div>
  );
}

export function ResourcePanel() {
  const { budgets: b, issues, launchable, votes, vote, mc, runMonteCarlo, launch } = useGame();
  if (!b) return <div className="panel">{issues[0]?.message}</div>;
  const allGo = ROLES.every((r) => votes[r.id] === true);
  const spend = b.cost.totalM + b.cost.reserveM;

  return (
    <div className="panel resources">
      <h3>Mission budgets</h3>
      <Bar label="Launch mass (+20%)" used={b.mass.withMarginKg} limit={b.mass.launcherCapacityKg} text={`${kg(b.mass.withMarginKg)} / ${kg(b.mass.launcherCapacityKg)}`}
        why="Total mass with a 20% growth margin vs what the rocket can lift to this orbit." />
      <Bar label="Equipment on bus" used={b.mass.partsKg} limit={b.mass.equipmentCapacityKg} text={`${kg(b.mass.partsKg)} / ${kg(b.mass.equipmentCapacityKg)} · ${b.slots.used}/${b.slots.available} slots`} />
      <Bar label="Power (end of life)" used={b.power.averageLoadW} limit={b.power.endOfLifeAverageW} text={`${W(b.power.averageLoadW)} / ${W(b.power.endOfLifeAverageW)}`}
        why={`Average load vs orbit-average solar power after ${b.scenario.durationYears} years of degradation. ${pct(b.orbitInfo.eclipseFraction)} of each orbit is in shadow.`} />
      <Bar label={`Battery (${Math.round(b.orbitInfo.eclipseMin)} min eclipse)`} used={b.power.eclipseNeedWh} limit={b.power.batteryUsableWh} text={`${b.power.eclipseNeedWh.toFixed(0)} / ${b.power.batteryUsableWh.toFixed(0)} Wh`} />
      <Bar label="Data delivered" used={b.data.deliveredFraction} limit={1} invert text={`${GB(b.data.downlinkGBPerDay)} of ${GB(b.data.generatedGBPerDay)}/day`}
        why={`Contact time ${Math.round(b.data.contactMinPerDay)} min/day with ${b.data.perStation.length} station(s).`} />
      <Bar label="Budget" used={spend} limit={b.cost.budgetM} text={`${M(spend)} / ${M(b.cost.budgetM)}`}
        why={`Hardware ${M(b.cost.hardwareM)} · Integration & test ${M(b.cost.integrationM)} · Launch ${M(b.cost.launchM)} · Ground ${M(b.cost.groundM)} · Ops ${M(b.cost.operationsM)} · Reserve ${M(b.cost.reserveM)}`} />
      <Bar label="Lifetime" used={b.lifetime.expectedYears} limit={b.lifetime.requiredYears} invert text={`${yr(b.lifetime.expectedYears)} / ${b.lifetime.requiredYears} yr needed`} />
      <Bar label="Expected science" used={b.science.expectedTotal} limit={Math.max(1, b.scenario.requirements.minScience)} invert text={`${Math.round(b.science.expectedTotal)} / ${b.scenario.requirements.minScience} pts`} />

      <h3>Design review</h3>
      {issues.length === 0 && <div className="issue ok">✓ No problems found. Ready for the Go / No-Go poll.</div>}
      <div className="issues">
        {issues.map((i, k) => (
          <div key={k} className={`issue ${i.severity}`}>
            <div>{i.severity === 'error' ? '⛔' : i.severity === 'warning' ? '⚠️' : 'ℹ️'} {i.message}</div>
            {i.hint && <div className="hint">{i.hint}</div>}
          </div>
        ))}
      </div>

      <h3>Risk analysis</h3>
      <button className="btn ghost" onClick={runMonteCarlo}>Simulate 400 missions</button>
      {mc && (
        <div className="mc">
          <div className="big">{pct(mc.successProbability)}</div>
          <div>chance of success · science {Math.round(mc.p10Science)}–{Math.round(mc.p90Science)} pts</div>
          {mc.topCauses.map((c, k) => (
            <div key={k} className="hint">{pct(c.share)} — {c.reason}</div>
          ))}
        </div>
      )}

      <h3>Go / No-Go poll</h3>
      <div className="poll">
        {ROLES.map((r) => (
          <div key={r.id} className="poll-row">
            <span style={{ color: r.color }}>{r.name}</span>
            <button className={votes[r.id] === true ? 'go on' : 'go'} disabled={!launchable} onClick={() => vote(r.id, true)}>GO</button>
            <button className={votes[r.id] === false ? 'nogo on' : 'nogo'} onClick={() => vote(r.id, false)}>NO-GO</button>
          </div>
        ))}
      </div>
      <button className="btn launch" disabled={!launchable || !allGo} onClick={launch}>
        {!launchable ? 'Fix errors to launch' : allGo ? '🚀 LAUNCH' : 'Waiting for all GO'}
      </button>
    </div>
  );
}
