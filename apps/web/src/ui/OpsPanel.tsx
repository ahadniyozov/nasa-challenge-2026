// Mission operations playback: months tick by, events arrive, science accumulates.
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store';

export const MONTH_MS = 450;

export function useOpsClock() {
  const sim = useGame((s) => s.sim);
  const [month, setMonth] = useState(0);
  useEffect(() => {
    setMonth(0);
    if (!sim) return;
    const last = sim.monthsSurvived + 1;
    const id = setInterval(() => setMonth((m) => (m >= last ? m : m + 1)), MONTH_MS);
    return () => clearInterval(id);
  }, [sim]);
  return month;
}

export function OpsPanel({ month }: { month: number }) {
  const { sim, finishOps, budgets } = useGame();
  const feed = useRef<HTMLDivElement>(null);
  useEffect(() => { feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: 'smooth' }); }, [month]);
  if (!sim || !budgets) return null;
  const events = sim.timeline.filter((e) => e.month <= month);
  const science = month === 0 ? 0 : sim.scienceByMonth[Math.min(month, sim.scienceByMonth.length) - 1] ?? sim.science;
  const done = month > sim.monthsSurvived;
  const target = budgets.scenario.requirements.minScience;

  return (
    <div className="panel ops">
      <h3>Mission operations</h3>
      <div className="ops-stats">
        <div><small>Mission time</small><b>{Math.floor(Math.min(month, sim.monthsPlanned) / 12)}y {Math.min(month, sim.monthsPlanned) % 12}m</b></div>
        <div><small>Science</small><b>{Math.round(science)} / {target}</b></div>
        <div><small>Reserve</small><b>${budgets.cost.reserveM.toFixed(1)}M</b></div>
      </div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, (science / Math.max(1, target)) * 100)}%`, background: '#22c55e' }} /></div>
      <div className="feed" ref={feed}>
        {events.map((e, k) => (
          <div key={k} className={`event ${e.severity}`}>
            <small>M{e.month}</small> <b>{e.title}</b>
            <div>{e.text}</div>
          </div>
        ))}
      </div>
      <button className="btn launch" disabled={!done} onClick={finishOps}>{done ? 'Mission report →' : 'Mission in progress…'}</button>
    </div>
  );
}
