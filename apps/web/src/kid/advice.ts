// Turns engine budgets into 5 kid-friendly meters and plain-language advice that points to the step to fix.
import type { Budgets } from '@mission/engine';
import type { StepId } from './choices';

export type Level = 'good' | 'warn' | 'bad';

export interface Meter {
  id: 'weight' | 'energy' | 'money' | 'photos' | 'time';
  emoji: string;
  label: string;
  /** 0..1 how full the bar is */
  fill: number;
  level: Level;
  detail: string;
  detailParams: Record<string, string | number>;
}

const lvl = (ratio: number): Level => (ratio <= 0.85 ? 'good' : ratio <= 1 ? 'warn' : 'bad');
const lvlInv = (ratio: number): Level => (ratio >= 1 ? 'good' : ratio >= 0.6 ? 'warn' : 'bad');

export function meters(b: Budgets): Meter[] {
  const launchRatio = b.mass.launcherCapacityKg > 0 ? b.mass.withMarginKg / b.mass.launcherCapacityKg : 9;
  const fitRatio = Math.max(b.mass.partsKg / b.mass.equipmentCapacityKg, b.slots.used / b.slots.available);
  const weight = Math.max(launchRatio, fitRatio);
  const powerRatio = b.power.endOfLifeAverageW > 0 ? b.power.averageLoadW / b.power.endOfLifeAverageW : 9;
  const batteryRatio = b.power.batteryUsableWh > 0 ? b.power.eclipseNeedWh / b.power.batteryUsableWh : 9;
  const energy = Math.max(powerRatio, batteryRatio);
  const money = (b.cost.totalM + b.cost.reserveM) / b.cost.budgetM;
  const time = b.lifetime.expectedYears / b.lifetime.requiredYears;
  return [
    { id: 'weight', emoji: '⚖️', label: 'Weight', fill: Math.min(1, weight), level: lvl(weight), detail: '{kg} kg', detailParams: { kg: Math.round(b.mass.totalKg * 10) / 10 } },
    { id: 'energy', emoji: '⚡', label: 'Energy', fill: Math.min(1, energy), level: lvl(energy), detail: 'uses {a} W of {b} W', detailParams: { a: Math.round(b.power.averageLoadW), b: Math.round(b.power.endOfLifeAverageW) } },
    { id: 'money', emoji: '💰', label: 'Money', fill: Math.min(1, money), level: lvl(money), detail: '${a}M of ${b}M', detailParams: { a: (b.cost.totalM + b.cost.reserveM).toFixed(1), b: b.cost.budgetM } },
    { id: 'photos', emoji: '📡', label: 'Photos home', fill: b.data.deliveredFraction, level: lvlInv(b.data.deliveredFraction / 0.95), detail: '{p}% reach Earth', detailParams: { p: Math.round(b.data.deliveredFraction * 100) } },
    { id: 'time', emoji: '⏳', label: 'Lifetime', fill: Math.min(1, time), level: lvlInv(time), detail: '{a} of {b} years', detailParams: { a: b.lifetime.expectedYears > 99 ? '99+' : Math.round(b.lifetime.expectedYears * 10) / 10, b: b.lifetime.requiredYears } },
  ];
}

export interface Advice {
  level: 'bad' | 'warn';
  who: 'eng' | 'sci' | 'ops' | 'boss';
  step: StepId;
  text: string;
  params?: Record<string, string | number>;
}

/** bestStation: the unselected ground station that would deliver the most photos, if any helps. */
export function advise(b: Budgets, bestStation?: { name: string; gain: number } | null): Advice[] {
  const out: Advice[] = [];
  const stationTip = bestStation && bestStation.gain > 0.05;
  const has = (tag: string) => b.science.tagsCovered.includes(tag);
  // blocking problems (match engine errors)
  if (b.mass.launcherCapacityKg <= 0) out.push({ level: 'bad', who: 'ops', step: 'rocket', text: 'This rocket cannot fly that high. Pick a bigger rocket or a lower orbit.' });
  else if (b.mass.withMarginKg > b.mass.launcherCapacityKg) out.push({ level: 'bad', who: 'ops', step: 'rocket', text: 'The rocket cannot lift {kg} kg. Pick a bigger rocket or a smaller satellite.', params: { kg: Math.round(b.mass.withMarginKg) } });
  if (b.slots.used > b.slots.available || b.mass.partsKg > b.mass.equipmentCapacityKg)
    out.push({ level: 'bad', who: 'eng', step: 'size', text: 'The parts weigh {a} kg but this satellite can only carry {b} kg. Pick a bigger satellite or lighter parts.', params: { a: Math.round(b.mass.partsKg * 10) / 10, b: b.mass.equipmentCapacityKg } });
  if (b.power.marginPct < 0) out.push({ level: 'bad', who: 'eng', step: 'energy', text: 'The solar panels can\'t power everything. Pick bigger panels.' });
  if (b.power.eclipseNeedWh > b.power.batteryUsableWh) out.push({ level: 'bad', who: 'eng', step: 'energy', text: 'Every orbit there are {m} minutes of darkness - the battery runs flat! Pick a bigger battery.', params: { m: Math.round(b.orbitInfo.eclipseMin) } });
  if (b.scenario.requirements.requiredTags?.includes('fire') && !has('fire')) out.push({ level: 'bad', who: 'sci', step: 'camera', text: 'Firefighters need a camera that sees heat. Pick the heat camera.' });
  if (b.data.contactMinPerDay === 0) out.push({ level: 'bad', who: 'ops', step: 'stations', text: 'None of your stations can see the satellite. Add stations closer to its path.' });
  else if (b.data.deliveredFraction < 0.5) {
    const slowRadio = b.data.downlinkGBPerDay < 1 || !stationTip;
    out.push(slowRadio
      ? { level: 'bad', who: 'ops', step: 'antenna', text: 'The camera takes more photos than the antenna can send home - only {p}% would arrive! Pick a faster antenna.', params: { p: Math.round(b.data.deliveredFraction * 100) } }
      : { level: 'bad', who: 'ops', step: 'stations', text: 'Only {p}% of photos would reach Earth. Add the station in {s} - your satellite flies over it often.', params: { p: Math.round(b.data.deliveredFraction * 100), s: bestStation!.name } });
  }
  if (b.cost.remainingM < 0) {
    const parts: [StepId, number][] = [['rocket', b.cost.launchM], ['size', b.bus.costM], ['camera', b.instruments.reduce((s, i) => s + i.costM, 0)], ['stations', b.cost.groundM]];
    const top = parts.sort((x, y) => y[1] - x[1])[0][0];
    out.push({ level: 'bad', who: 'boss', step: top, text: 'We are ${m}M over budget! The most expensive choice right now is the {what}.', params: { m: (-b.cost.remainingM).toFixed(1), what: top } });
  }
  // warnings
  if (!b.science.coversTarget) out.push({ level: 'warn', who: 'sci', step: 'orbit', text: 'This orbit never flies over the northern forests. Try the polar orbit.' });
  if (b.lifetime.expectedYears < b.lifetime.requiredYears)
    out.push({ level: 'warn', who: 'eng', step: 'orbit', text: 'At this height thin air slowly pulls the satellite down - it falls after ~{y} years, but the mission needs {n}. Fly higher.', params: { y: Math.round(b.lifetime.expectedYears * 10) / 10, n: b.lifetime.requiredYears } });
  const maxRes = b.scenario.requirements.maxResolutionM;
  if (maxRes && b.science.bestResolutionM && b.science.bestResolutionM > maxRes) out.push({ level: 'warn', who: 'sci', step: 'orbit', text: 'From this height the photos are too blurry. Fly lower.' });
  if (b.data.deliveredFraction >= 0.5 && b.data.deliveredFraction < 0.9)
    out.push(stationTip
      ? { level: 'warn', who: 'ops', step: 'stations', text: 'Some photos will get stuck in space. The station in {s} would help.', params: { s: bestStation!.name } }
      : { level: 'warn', who: 'ops', step: 'antenna', text: 'Some photos will get stuck in space. A faster antenna would help.' });
  if (b.power.marginPct >= 0 && b.power.marginPct < 0.15) out.push({ level: 'warn', who: 'eng', step: 'energy', text: 'Energy is just barely enough - panels get weaker every year.' });
  if (b.mass.launcherCapacityKg > 0 && b.mass.withMarginKg < b.mass.launcherCapacityKg * 0.05 && b.launcher.costM > 20) out.push({ level: 'warn', who: 'boss', step: 'rocket', text: 'This rocket is way too big for us - that wastes a lot of money!' });
  return out;
}

export const CREW: Record<Advice['who'], { emoji: string; name: string; role: string }> = {
  boss: { emoji: '👩‍🚀', name: 'Nova', role: 'Mission boss' },
  eng: { emoji: '👨‍🔧', name: 'Max', role: 'Engineer' },
  sci: { emoji: '👩‍🔬', name: 'Lia', role: 'Scientist' },
  ops: { emoji: '🧑‍💻', name: 'Sam', role: 'Radio operator' },
};
