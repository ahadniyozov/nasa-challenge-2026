// Final score + grade + post-mission analysis ("why did it go this way?").
import type { Budgets } from './budgets';
import type { SimResult } from './simulate';

export interface Score {
  total: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: { label: string; points: number }[];
  lessons: string[];
}

export function scoreMission(b: Budgets, sim: SimResult): Score {
  const minSci = Math.max(1, b.scenario.requirements.minScience);
  const sciencePts = Math.round((sim.science / minSci) * 500);
  const successPts = sim.success ? 300 : 0;
  const unspent = Math.max(0, b.cost.remainingM + sim.reserveLeftM);
  const efficiencyPts = Math.round(Math.min(150, (unspent / b.cost.budgetM) * 300));
  const overrun = b.cost.remainingM < 0 ? Math.round((-b.cost.remainingM / b.cost.budgetM) * 400) : 0;
  const breakdown = [
    { label: 'Science returned', points: sciencePts },
    { label: 'Mission success', points: successPts },
    { label: 'Budget efficiency', points: efficiencyPts },
    { label: 'Budget overrun', points: -overrun },
  ];
  const total = breakdown.reduce((s, x) => s + x.points, 0);
  const grade = total >= 1000 ? 'S' : total >= 850 ? 'A' : total >= 700 ? 'B' : total >= 500 ? 'C' : total >= 300 ? 'D' : 'F';
  return { total, grade, breakdown, lessons: lessons(b, sim) };
}

export function lessons(b: Budgets, sim: SimResult): string[] {
  const out: string[] = [];
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  if (sim.monthsSurvived === 0) out.push('The mission was lost at launch. Every rocket has a failure rate - that is why insurance and reliable launchers matter.');
  if (b.data.deliveredFraction < 0.95) out.push(`Only ${pct(b.data.deliveredFraction)} of the collected data reached Earth. Downlink time (${Math.round(b.data.contactMinPerDay)} min/day) was the bottleneck, not the instruments.`);
  if (b.power.marginPct < 0.1) out.push('Power was tight: as solar cells degraded, instruments had to be switched off part of the time.');
  if (!b.science.coversTarget) out.push('The orbit never passed over the target region. Inclination limits which latitudes a satellite can see.');
  const failures = sim.timeline.filter((e) => e.kind === 'failure');
  const saved = failures.filter((e) => e.severity === 'info').length;
  if (saved) out.push(`Redundancy saved the mission ${saved} time(s): a spare unit took over after a failure.`);
  if (sim.timeline.some((e) => e.kind === 'debris' && e.severity === 'bad')) out.push('A debris strike hurt the spacecraft. Even a small thruster lets operators dodge known debris.');
  if (sim.timeline.some((e) => e.kind === 'station-outage')) out.push('With no cash reserve left, a ground-station outage cost real data. Reserves exist for exactly these moments.');
  if (b.lifetime.expectedYears < b.lifetime.requiredYears) out.push(`The orbit at ${b.orbit.altitudeKm} km decays in ~${b.lifetime.orbitYears.toFixed(1)} years - too short for the plan.`);
  if (sim.success && !out.length) out.push('A well-balanced design: every subsystem had margin, and the mission delivered. Try a harder scenario or a lower budget!');
  return out;
}
