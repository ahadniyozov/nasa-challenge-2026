// Month-by-month mission operations with seeded randomness, plus Monte Carlo.
import { computeBudgets, type Budgets } from './budgets';
import { mulberry32 } from './rng';
import type { Category, Component, MissionDesign } from './types';

export type EventKind = 'launch' | 'failure' | 'solar-storm' | 'station-outage' | 'debris' | 'glitch' | 'opportunity' | 'reentry' | 'end' | 'mitigated';

export interface TimelineEvent {
  month: number;
  kind: EventKind;
  severity: 'good' | 'info' | 'bad' | 'fatal';
  title: string;
  text: string;
}

export interface SimResult {
  seed: number;
  success: boolean;
  monthsPlanned: number;
  monthsSurvived: number;
  endReason: string;
  science: number;
  dataDeliveredGB: number;
  reserveLeftM: number;
  timeline: TimelineEvent[];
  /** science accumulated per month, for charts */
  scienceByMonth: number[];
}

const CRITICAL: Category[] = ['solar', 'battery', 'comms', 'computer'];

/** Probability that one unit fails within a month, from yearly reliability. */
export function monthlyFailure(yearlyReliability: number, stress = 1): number {
  return Math.min(0.5, (1 - Math.pow(yearlyReliability, 1 / 12)) * stress);
}

export function simulateMission(design: MissionDesign, seed: number, budgets: Budgets = computeBudgets(design)): SimResult {
  const b = budgets;
  const rnd = mulberry32(seed);
  const months = Math.round(b.scenario.durationYears * 12);
  const timeline: TimelineEvent[] = [];
  const scienceByMonth: number[] = [];
  const log = (e: TimelineEvent) => timeline.push(e);

  let reserve = b.cost.reserveM;
  let science = 0;
  let dataGB = 0;
  let solarHealth = 1;
  let alive = true;
  let endReason = 'Mission completed its planned lifetime.';
  let month = 0;

  // working units per component id
  const units = new Map<string, { part: Component; count: number }>();
  for (const p of b.parts) {
    const u = units.get(p.id);
    if (u) u.count++;
    else units.set(p.id, { part: p, count: 1 });
  }
  const working = (cat: Category) => [...units.values()].some((u) => u.part.category === cat && u.count > 0);
  const hasProp = () => working('propulsion');

  const kill = (title: string, text: string) => {
    alive = false;
    endReason = text;
    log({ month, kind: 'end', severity: 'fatal', title, text });
  };

  /** Pay from reserve if possible. */
  const pay = (costM: number) => {
    if (reserve >= costM) {
      reserve -= costM;
      return true;
    }
    return false;
  };

  // ---- Launch
  if (rnd() > b.launcher.reliability) {
    kill('Launch failure', `The ${b.launcher.name} failed during ascent (reliability ${(b.launcher.reliability * 100).toFixed(0)}%). Launch is the riskiest 10 minutes of any mission.`);
    return { seed, success: false, monthsPlanned: months, monthsSurvived: 0, endReason, science: 0, dataDeliveredGB: 0, reserveLeftM: reserve, timeline, scienceByMonth };
  }
  log({ month: 0, kind: 'launch', severity: 'good', title: 'Launch success', text: `${b.launcher.name} placed the spacecraft into ${b.orbit.name}.` });

  const lifeLimitMonths = (b.lifetime.orbitYears + b.lifetime.propulsionExtraYears) * 12;

  for (month = 1; month <= months && alive; month++) {
    let dataFactor = b.data.deliveredFraction;
    let uptime = 1;
    let bonus = 1;

    // ---- Orbit decay
    if (month > lifeLimitMonths) {
      log({ month, kind: 'reentry', severity: 'fatal', title: 'Re-entry', text: `Atmospheric drag pulled the spacecraft down from ${b.orbit.altitudeKm} km. It burned up in the atmosphere.` });
      alive = false;
      endReason = 'Orbit decayed before the end of the mission.';
      break;
    }

    // ---- Random events
    let radiationStress = b.orbit.radiation;
    const r = rnd();
    if (r < 0.035) {
      radiationStress *= 4;
      solarHealth *= 0.97;
      log({ month, kind: 'solar-storm', severity: 'bad', title: 'Solar storm', text: 'A burst of energetic particles from the Sun hits the spacecraft. Electronics are at risk and solar cells lose a little efficiency.' });
    } else if (r < 0.085) {
      if (pay(0.1)) log({ month, kind: 'mitigated', severity: 'info', title: 'Ground station outage', text: 'A station went offline. You rented backup antenna time from the reserve ($0.1M).' });
      else {
        dataFactor *= 0.6;
        log({ month, kind: 'station-outage', severity: 'bad', title: 'Ground station outage', text: 'A station went offline and there was no reserve to rent a backup - 40% of this month\'s data was lost.' });
      }
    } else if (r < 0.1) {
      if (hasProp()) log({ month, kind: 'mitigated', severity: 'info', title: 'Debris conjunction avoided', text: 'A piece of debris was on a collision course. Your thruster moved the spacecraft out of the way.' });
      else if (rnd() < 0.3) {
        const list = [...units.values()].filter((u) => u.count > 0);
        const hit = list[Math.floor(rnd() * list.length)];
        hit.count--;
        log({ month, kind: 'debris', severity: 'bad', title: 'Debris strike', text: `With no thruster to dodge, a debris fragment hit the spacecraft and destroyed one ${hit.part.name}.` });
      } else log({ month, kind: 'debris', severity: 'info', title: 'Close call', text: 'Debris passed a few hundred metres away. Without propulsion you could only watch.' });
    } else if (r < 0.14) {
      if (pay(0.2)) {
        uptime = 0.9;
        log({ month, kind: 'glitch', severity: 'info', title: 'Software glitch', text: 'The computer entered safe mode. Engineers uploaded a patch paid from reserve ($0.2M) - 3 days lost.' });
      } else {
        uptime = 0.5;
        log({ month, kind: 'glitch', severity: 'bad', title: 'Software glitch', text: 'Safe mode for two weeks - no reserve to pay engineers for a fast fix.' });
      }
    } else if (r < 0.165 && b.instruments.length) {
      bonus = 1.5;
      log({ month, kind: 'opportunity', severity: 'good', title: 'Science opportunity', text: 'An unusual event on Earth (eruption, fire outbreak, storm) made this month\'s observations especially valuable.' });
    }

    // ---- Component failures
    for (const u of units.values()) {
      if (u.count === 0) continue;
      const isSoftComputer = u.part.category === 'computer' && !(u.part as { radHard?: boolean }).radHard;
      const stress = isSoftComputer ? radiationStress : Math.sqrt(radiationStress);
      for (let k = u.count; k > 0; k--) {
        if (rnd() < monthlyFailure(u.part.reliability, stress)) {
          u.count--;
          const left = u.count;
          log({ month, kind: 'failure', severity: left > 0 ? 'info' : 'bad', title: `${u.part.name} failed`,
            text: left > 0 ? `A backup ${u.part.name} took over - redundancy saved the day.` : `The ${u.part.name} stopped working${CRITICAL.includes(u.part.category) ? '' : ' - the mission continues without it'}.` });
        }
      }
    }
    if (rnd() < monthlyFailure(b.bus.reliability)) kill('Structural failure', `The ${b.bus.name} suffered a structural or wiring failure.`);
    for (const cat of CRITICAL) if (alive && !working(cat)) kill('Loss of mission', `Lost the last working ${cat === 'comms' ? 'radio' : cat === 'computer' ? 'flight computer' : cat === 'solar' ? 'solar array' : 'battery'}.`);
    if (!alive) break;

    // ---- Science this month
    const degradation = Math.max(0.3, 1 - 0.025 * (month / 12)) * solarHealth;
    const powerFactor = Math.min(1, (b.power.orbitAverageW * degradation) / Math.max(b.power.averageLoadW, 0.1));
    const pointingFactor = working('adcs') ? 1 : 0.25;
    const liveInstrumentShare = (() => {
      const all = b.instruments.filter((i, idx, arr) => arr.findIndex((x) => x.id === i.id) === idx);
      const total = all.reduce((s, i) => s + i.scienceValue, 0) || 1;
      const live = all.filter((i) => (units.get(i.id)?.count ?? 0) > 0).reduce((s, i) => s + i.scienceValue, 0);
      return live / total;
    })();
    const coverage = b.science.coversTarget ? 1 : 0.3;
    const monthScience = (b.science.perYear / 12) * dataFactor * powerFactor * pointingFactor * liveInstrumentShare * uptime * bonus * coverage;
    science += monthScience;
    dataGB += b.data.generatedGBPerDay * 30 * dataFactor * uptime * liveInstrumentShare;
    scienceByMonth.push(science);
  }

  const monthsSurvived = Math.min(months, alive ? months : Math.max(0, month - 1));
  const minScience = b.scenario.requirements.minScience;
  const success = monthsSurvived >= months * 0.9 && science >= minScience;
  if (alive) log({ month: months, kind: 'end', severity: 'good', title: 'Mission complete', text: `The spacecraft completed its ${b.scenario.durationYears}-year mission.` });
  if (alive && science < minScience) endReason = `The spacecraft survived, but returned ${science.toFixed(0)} science points - the customer needed ${minScience}.`;

  return { seed, success, monthsPlanned: months, monthsSurvived, endReason, science, dataDeliveredGB: dataGB, reserveLeftM: reserve, timeline, scienceByMonth };
}

export interface MonteCarloResult {
  runs: number;
  successProbability: number;
  meanScience: number;
  p10Science: number;
  p90Science: number;
  topCauses: { reason: string; share: number }[];
}

export function monteCarlo(design: MissionDesign, runs = 300, baseSeed = 1): MonteCarloResult {
  const budgets = computeBudgets(design);
  const results = Array.from({ length: runs }, (_, i) => simulateMission(design, baseSeed + i * 7919, budgets));
  const sci = results.map((r) => r.science).sort((a, b) => a - b);
  const causes = new Map<string, number>();
  for (const r of results) if (!r.success) causes.set(r.endReason, (causes.get(r.endReason) ?? 0) + 1);
  return {
    runs,
    successProbability: results.filter((r) => r.success).length / runs,
    meanScience: sci.reduce((a, b) => a + b, 0) / runs,
    p10Science: sci[Math.floor(runs * 0.1)],
    p90Science: sci[Math.floor(runs * 0.9)],
    topCauses: [...causes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([reason, n]) => ({ reason, share: n / runs })),
  };
}
