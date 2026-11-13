// Design review ("PDR"): turns budgets into errors / warnings with a "why" and a hint.
import type { Budgets } from './budgets';
import type { Issue } from './types';

const f1 = (n: number) => n.toFixed(1);
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function reviewDesign(b: Budgets, reservePct: number): Issue[] {
  const out: Issue[] = [];
  const has = (cat: string) => b.parts.some((p) => p.category === cat);

  // Essentials
  if (!has('solar')) out.push({ severity: 'error', resource: 'power', message: 'No power source: the spacecraft dies as soon as the launch battery runs out.', hint: 'Add solar cells.' });
  if (!has('battery')) out.push({ severity: 'error', resource: 'power', message: 'No battery: every pass through Earth\'s shadow switches the spacecraft off.', hint: 'Add a battery pack.' });
  if (!has('comms')) out.push({ severity: 'error', resource: 'comms', message: 'No radio: you can never hear from the spacecraft again.', hint: 'Add a transmitter.' });
  if (!has('computer')) out.push({ severity: 'error', resource: 'design', message: 'No flight computer to run the spacecraft.', hint: 'Add a flight computer.' });
  if (!has('adcs')) out.push({ severity: 'warning', resource: 'design', message: 'No attitude control: the spacecraft will tumble and cannot aim its instruments or panels.', hint: 'Add magnetorquers or reaction wheels.' });
  if (!b.instruments.length) out.push({ severity: 'error', resource: 'science', message: 'No instruments: the mission returns no science.', hint: 'Pick at least one instrument.' });

  // Scenario constraints
  if (!b.scenario.allowedBuses.includes(b.bus.id)) out.push({ severity: 'error', resource: 'design', message: `${b.bus.name} is not allowed in this scenario.` });
  if (!b.scenario.allowedOrbits.includes(b.orbit.id)) out.push({ severity: 'error', resource: 'design', message: `${b.orbit.name} is not allowed in this scenario.` });

  // Mass & volume
  if (b.slots.used > b.slots.available) out.push({ severity: 'error', resource: 'mass', message: `Not enough room: ${b.slots.used} slots used, the ${b.bus.name} has ${b.slots.available}.`, hint: 'Remove components or choose a bigger bus.' });
  if (b.mass.partsKg > b.mass.equipmentCapacityKg) out.push({ severity: 'error', resource: 'mass', message: `Equipment weighs ${f1(b.mass.partsKg)} kg, but the bus structure carries only ${b.mass.equipmentCapacityKg} kg.`, hint: 'Lighter components or a larger bus.' });
  if (b.mass.launcherCapacityKg <= 0) out.push({ severity: 'error', resource: 'launch', message: `${b.launcher.name} cannot reach ${b.orbit.kind}.`, hint: 'Choose a more powerful launcher or a lower orbit.' });
  else if (b.mass.withMarginKg > b.mass.launcherCapacityKg) out.push({ severity: 'error', resource: 'launch', message: `Too heavy for the rocket: ${f1(b.mass.withMarginKg)} kg (incl. 20% margin) vs ${b.mass.launcherCapacityKg} kg capacity to ${b.orbit.kind}.`, hint: 'Engineers always add margin - real designs grow heavier. Trim mass or pick a bigger launcher.' });
  else if (b.mass.withMarginKg < b.mass.launcherCapacityKg * 0.1 && b.launcher.costM > 20) out.push({ severity: 'info', resource: 'launch', message: `The rocket is ${Math.round(b.mass.launcherCapacityKg / b.mass.withMarginKg)}x bigger than needed.`, hint: 'A rideshare or small launcher would save money.' });

  // Power
  if (has('solar')) {
    if (b.power.marginPct < 0) out.push({ severity: 'error', resource: 'power', message: `Power deficit: panels give ${f1(b.power.endOfLifeAverageW)} W on average at end of life, systems need ${f1(b.power.averageLoadW)} W.`, hint: `In ${b.orbit.name} the spacecraft spends ${pct(b.orbitInfo.eclipseFraction)} of each orbit in shadow, and panels degrade every year. Bigger arrays or fewer loads.` });
    else if (b.power.marginPct < 0.15) out.push({ severity: 'warning', resource: 'power', message: `Thin power margin: ${pct(b.power.marginPct)}.`, hint: 'Real missions keep 15-30% margin for surprises.' });
  }
  if (has('battery') && b.power.eclipseNeedWh > b.power.batteryUsableWh) out.push({ severity: 'error', resource: 'power', message: `The battery can't carry you through the ${Math.round(b.orbitInfo.eclipseMin)}-minute eclipse: need ${f1(b.power.eclipseNeedWh)} Wh, usable ${f1(b.power.batteryUsableWh)} Wh.`, hint: 'Batteries may only be discharged partly (≈30% in LEO) or they wear out from thousands of cycles. Add capacity.' });

  // Data & comms
  if (b.instruments.length && has('comms')) {
    if (b.data.contactMinPerDay === 0) out.push({ severity: 'error', resource: 'comms', message: 'No ground station can see this orbit.', hint: 'Add stations near the orbit\'s ground track - polar stations see polar orbits every revolution.' });
    else if (b.data.deliveredFraction < 0.5) out.push({ severity: 'error', resource: 'data', message: `Only ${pct(b.data.deliveredFraction)} of the data gets home: generating ${f1(b.data.generatedGBPerDay)} GB/day, downlink ${f1(b.data.downlinkGBPerDay)} GB/day.`, hint: 'A faster radio band, more ground stations, or lower instrument duty cycle.' });
    else if (b.data.deliveredFraction < 0.95) out.push({ severity: 'warning', resource: 'data', message: `${pct(1 - b.data.deliveredFraction)} of the data will be lost - downlink is the bottleneck.`, hint: 'More stations or a faster band.' });
  }

  // Pointing
  for (const i of new Set(b.instruments)) {
    if (b.science.pointingDeg !== null && b.science.pointingDeg > i.requiredPointingDeg)
      out.push({ severity: 'warning', resource: 'science', message: `${i.name} needs ${i.requiredPointingDeg}° pointing, your attitude control gives ${b.science.pointingDeg}°. Most images will be blurred or miss the target.`, hint: 'Reaction wheels + star tracker.' });
  }

  // Requirements
  const r = b.scenario.requirements;
  for (const t of r.requiredTags ?? []) if (!b.science.tagsCovered.includes(t)) out.push({ severity: 'error', resource: 'science', message: `The customer requires a "${t}" capability - none of your instruments provides it.` });
  if (r.maxResolutionM !== undefined && b.science.bestResolutionM !== null && b.science.bestResolutionM > r.maxResolutionM)
    out.push({ severity: 'warning', resource: 'science', message: `Image resolution ${Math.round(b.science.bestResolutionM)} m is worse than required ${r.maxResolutionM} m.`, hint: 'Pixel size grows with altitude: fly lower or use a sharper instrument.' });
  if (!b.science.coversTarget) out.push({ severity: 'warning', resource: 'science', message: `This orbit never flies over latitude ${r.targetLatDeg}° - the target region is out of reach.`, hint: 'Inclination sets the highest latitude a satellite passes over. Choose a polar (sun-synchronous) orbit.' });

  // Lifetime
  if (b.lifetime.expectedYears < b.lifetime.requiredYears) {
    const drag = b.lifetime.orbitYears + b.lifetime.propulsionExtraYears < b.lifetime.designYears * 1.5;
    out.push({ severity: 'warning', resource: 'lifetime', message: `Expected life ${f1(b.lifetime.expectedYears)} yr is shorter than the ${b.lifetime.requiredYears}-yr mission.`,
      hint: drag ? `At ${b.orbit.altitudeKm} km the thin atmosphere drags the satellite down in ~${f1(b.lifetime.orbitYears)} yr. Fly higher or add propulsion.` : `The ${b.bus.name} is designed for ${b.bus.designLifeYears} yr.` });
  }

  // Budget
  if (b.cost.remainingM < 0) out.push({ severity: 'error', resource: 'budget', message: `Over budget by $${f1(-b.cost.remainingM)}M (cost $${f1(b.cost.totalM)}M + reserve $${f1(b.cost.reserveM)}M vs $${b.cost.budgetM}M).`, hint: 'Launch is often the biggest single bill. Check also integration (30% of hardware) and years of operations.' });
  if (reservePct < 0.1) out.push({ severity: 'warning', resource: 'budget', message: `Reserve is only ${pct(reservePct)}.`, hint: 'Reserve pays for fixing anomalies in flight. NASA projects typically hold 25-30% early on.' });

  return out;
}

export function canLaunch(issues: Issue[]): boolean {
  return !issues.some((i) => i.severity === 'error');
}
