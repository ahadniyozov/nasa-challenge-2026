// Right panel: live resource budgets, design review and the Go / No-Go poll.
import { ROLES, useGame } from '../store';
import { useT } from '../i18n';
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
  const { budgets: b, issues, launchable, votes, vote, mc, runMonteCarlo, launch, loadExample } = useGame();
  const { t, msg } = useT();
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  if (!b) return <div className="panel">{issues[0]?.message}</div>;
  const allGo = ROLES.every((r) => votes[r.id] === true);
  const spend = b.cost.totalM + b.cost.reserveM;
  const goCount = ROLES.filter((r) => votes[r.id] === true).length;

  return (
    <div className="panel resources">
      <h3>{t('Mission budgets')}</h3>
      <Bar label={t('Launch mass (+20%)')} used={b.mass.withMarginKg} limit={b.mass.launcherCapacityKg} text={`${kg(b.mass.withMarginKg)} / ${kg(b.mass.launcherCapacityKg)}`}
        why={t('Total mass with a 20% growth margin vs what the rocket can lift to this orbit.')} />
      <Bar label={t('Equipment on bus')} used={b.mass.partsKg} limit={b.mass.equipmentCapacityKg}
        text={t('{a} / {b} · {u}/{s} slots', { a: kg(b.mass.partsKg), b: kg(b.mass.equipmentCapacityKg), u: b.slots.used, s: b.slots.available })} />
      <Bar label={t('Power (end of life)')} used={b.power.averageLoadW} limit={b.power.endOfLifeAverageW} text={`${W(b.power.averageLoadW)} / ${W(b.power.endOfLifeAverageW)}`} />
      <Bar label={t('Battery ({m} min eclipse)', { m: Math.round(b.orbitInfo.eclipseMin) })} used={b.power.eclipseNeedWh} limit={b.power.batteryUsableWh}
        text={`${b.power.eclipseNeedWh.toFixed(0)} / ${b.power.batteryUsableWh.toFixed(0)} ${t('Wh')}`} />
      <Bar label={t('Data delivered')} used={b.data.deliveredFraction} limit={1} invert text={t('{a} of {b}/day', { a: GB(b.data.downlinkGBPerDay), b: GB(b.data.generatedGBPerDay) })} />
      <Bar label={t('Budget')} used={spend} limit={b.cost.budgetM} text={`${M(spend)} / ${M(b.cost.budgetM)}`} />
      <Bar label={t('Lifetime')} used={b.lifetime.expectedYears} limit={b.lifetime.requiredYears} invert text={t('{a} / {b} yr needed', { a: yr(b.lifetime.expectedYears), b: b.lifetime.requiredYears })} />
      <Bar label={t('Expected science')} used={b.science.expectedTotal} limit={Math.max(1, b.scenario.requirements.minScience)} invert
        text={t('{a} / {b} pts', { a: Math.round(b.science.expectedTotal), b: b.scenario.requirements.minScience })} />

      <h3>{t('Design review')} {errorCount > 0 && <span className="err-count">{t('{n} to fix', { n: errorCount })}</span>}</h3>
      {issues.length === 0 && <div className="issue ok">{t('✓ No problems found. Ready for the Go / No-Go poll.')}</div>}
      <div className="issues">
        {issues.map((i, k) => (
          <div key={k} className={`issue ${i.severity}`}>
            <div>{i.severity === 'error' ? '⛔' : i.severity === 'warning' ? '⚠️' : 'ℹ️'} {msg(i.message)}</div>
            {i.hint && <div className="hint">{msg(i.hint)}</div>}
          </div>
        ))}
      </div>
      <button className="btn ghost small" onClick={loadExample}>{t('💡 Stuck? Load a working example')}</button>

      <h3>{t('Risk analysis')}</h3>
      <button className="btn ghost" onClick={runMonteCarlo}>{t('Simulate 400 missions')}</button>
      {mc && (
        <div className="mc">
          <div className="big">{pct(mc.successProbability)}</div>
          <div>{t('chance of success · science {a}–{b} pts', { a: Math.round(mc.p10Science), b: Math.round(mc.p90Science) })}</div>
          {mc.topCauses.map((c, k) => (
            <div key={k} className="hint">{pct(c.share)} — {msg(c.reason)}</div>
          ))}
        </div>
      )}

      <h3>{t('Go / No-Go poll')}</h3>
      {!launchable && <p className="hint">{t('Voting opens when the design review has no ⛔ errors. Each role tab (FD / ENG / SCI / OPS) on the left controls different parts.')}</p>}
      <div className="poll">
        {ROLES.map((r) => (
          <div key={r.id} className="poll-row">
            <span style={{ color: r.color }}>{t(r.name)}</span>
            <button className={votes[r.id] === true ? 'go on' : 'go'} disabled={!launchable} onClick={() => vote(r.id, true)}>GO</button>
            <button className={votes[r.id] === false ? 'nogo on' : 'nogo'} onClick={() => vote(r.id, false)}>NO-GO</button>
          </div>
        ))}
      </div>
      <button className="btn launch" disabled={!launchable || !allGo} onClick={launch}>
        {!launchable
          ? t(errorCount === 1 ? 'Fix {n} error to launch' : 'Fix {n} errors to launch', { n: errorCount })
          : allGo ? t('🚀 LAUNCH') : t('Waiting for GO ({n}/4)', { n: goCount })}
      </button>
    </div>
  );
}
