// Turns a MissionDesign into resource budgets (mass, power, data, cost, lifetime, science).
import { busById, componentById, launcherById, orbitById, scenarioById, stationById } from './catalog';
import * as P from './physics';
import type { Adcs, Battery, Bus, Comms, Component, Instrument, LaunchVehicle, MissionDesign, Orbit, Propulsion, Scenario, SolarArray } from './types';

export const MASS_MARGIN = 0.2; // design maturity margin
export const BATTERY_DOD_LEO = 0.3; // depth of discharge for ~5,000 cycles/year
export const BATTERY_DOD_GEO = 0.7;
export const SOLAR_DEGRADATION_PER_YEAR = 0.025;
export const INTEGRATION_TEST_FACTOR = 0.3; // assembly, integration & test cost vs hardware

export interface Budgets {
  scenario: Scenario;
  bus: Bus;
  orbit: Orbit;
  launcher: LaunchVehicle;
  parts: Component[];
  instruments: Instrument[];

  orbitInfo: { periodMin: number; eclipseMin: number; eclipseFraction: number; speedKms: number; orbitsPerDay: number };

  mass: { busKg: number; partsKg: number; totalKg: number; withMarginKg: number; launcherCapacityKg: number; equipmentCapacityKg: number };
  slots: { used: number; available: number };

  power: {
    sunlitGenerationW: number; // beginning of life, in sunlight
    orbitAverageW: number; // beginning of life
    endOfLifeAverageW: number;
    averageLoadW: number;
    peakLoadW: number;
    marginPct: number; // (EOL avg generation - load) / load
    batteryWh: number;
    eclipseNeedWh: number;
    batteryUsableWh: number;
  };

  data: {
    generatedGBPerDay: number;
    downlinkGBPerDay: number;
    contactMinPerDay: number;
    deliveredFraction: number;
    perStation: { id: string; name: string; contactMin: number; passes: number }[];
  };

  cost: {
    hardwareM: number;
    integrationM: number;
    launchM: number;
    groundM: number;
    operationsM: number;
    totalM: number;
    reserveM: number;
    budgetM: number;
    remainingM: number;
  };

  lifetime: { orbitYears: number; propulsionExtraYears: number; designYears: number; expectedYears: number; requiredYears: number };

  science: {
    perYear: number;
    expectedTotal: number;
    bestResolutionM: number | null;
    pointingDeg: number | null;
    coversTarget: boolean;
    tagsCovered: string[];
  };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const of = <T extends Component>(parts: Component[], cat: T['category']) => parts.filter((p) => p.category === cat) as T[];

function must<T>(v: T | undefined, what: string): T {
  if (!v) throw new Error(`Unknown ${what}`);
  return v;
}

/** Instrument science multiplier for an orbit type. */
export function orbitScienceFit(inst: Instrument, orbit: Orbit): number {
  const imaging = inst.tags.includes('imaging');
  switch (orbit.kind) {
    case 'SSO': return imaging ? 1.2 : 1.0;
    case 'LEO': return 1.0;
    case 'MEO': return imaging ? 0.4 : 0.9;
    case 'GEO': return imaging ? 0.6 : 0.8;
  }
}

export function computeBudgets(design: MissionDesign): Budgets {
  const scenario = must(scenarioById.get(design.scenarioId), 'scenario');
  const bus = must(busById.get(design.busId), 'bus');
  const orbit = must(orbitById.get(design.orbitId), 'orbit');
  const launcher = must(launcherById.get(design.launcherId), 'launcher');
  const parts = design.components.map((id) => must(componentById.get(id), `component ${id}`));
  const h = orbit.altitudeKm;
  const years = scenario.durationYears;

  // ---- Orbit
  const orbitInfo = {
    periodMin: P.periodMin(h),
    eclipseMin: h > 30000 ? 72 : P.eclipseMinutes(h),
    eclipseFraction: h > 30000 ? 72 / 1440 : P.eclipseFraction(h),
    speedKms: P.orbitalSpeedKms(h),
    orbitsPerDay: P.orbitsPerDay(h),
  };

  // ---- Mass
  const partsKg = sum(parts.map((p) => p.massKg));
  const totalKg = bus.dryMassKg + partsKg;
  const mass = {
    busKg: bus.dryMassKg,
    partsKg,
    totalKg,
    withMarginKg: totalKg * (1 + MASS_MARGIN),
    launcherCapacityKg: launcher.capacityKg[orbit.kind] ?? 0,
    equipmentCapacityKg: bus.maxPayloadKg,
  };
  const slots = { used: sum(parts.map((p) => p.slots)), available: bus.slots };

  // ---- Power
  const solar = of<SolarArray>(parts, 'solar');
  const instruments = of<Instrument>(parts, 'instrument');
  const comms = of<Comms>(parts, 'comms');
  const batteries = of<Battery>(parts, 'battery');
  const sunlitGenerationW = sum(solar.map((s) => s.areaM2 * P.SOLAR_CONSTANT * s.efficiency * 0.75));
  const orbitAverageW = sunlitGenerationW * (1 - orbitInfo.eclipseFraction);
  const endOfLifeAverageW = orbitAverageW * Math.max(0.3, 1 - SOLAR_DEGRADATION_PER_YEAR * years);
  const dutyFor = (p: Component) =>
    p.category === 'instrument' ? (p as Instrument).dutyCycle : p.category === 'comms' ? 0.15 : p.category === 'propulsion' ? 0.05 : 1;
  const averageLoadW = bus.baseLoadW + sum(parts.map((p) => p.powerW * dutyFor(p)));
  const peakLoadW = bus.baseLoadW + sum(parts.map((p) => p.powerW));
  const batteryWh = sum(batteries.map((b) => b.capacityWh));
  const dod = orbit.kind === 'GEO' ? BATTERY_DOD_GEO : BATTERY_DOD_LEO;
  const power = {
    sunlitGenerationW,
    orbitAverageW,
    endOfLifeAverageW,
    averageLoadW,
    peakLoadW,
    marginPct: averageLoadW > 0 ? (endOfLifeAverageW - averageLoadW) / averageLoadW : 0,
    batteryWh,
    eclipseNeedWh: (averageLoadW * orbitInfo.eclipseMin) / 60,
    batteryUsableWh: batteryWh * dod,
  };

  // ---- Data
  const generatedGBPerDay = sum(instruments.map((i) => P.mbpsToGB(i.dataRateMbps * i.dutyCycle, 86400)));
  const bestLinkMbps = Math.max(0, ...comms.map((c) => c.downlinkMbps)) * P.linkDistanceFactor(h);
  const stations = design.groundStationIds.map((id) => must(stationById.get(id), `station ${id}`));
  const perStation = stations.map((s) => ({
    id: s.id,
    name: s.name,
    contactMin: P.contactMinPerDay(h, orbit.inclinationDeg, s.lat),
    passes: h > 30000 ? (Math.abs(s.lat) < 70 ? 1 : 0) : P.passesPerDay(h, orbit.inclinationDeg, s.lat),
  }));
  const contactMinPerDay = Math.min(1440, sum(perStation.map((s) => s.contactMin)));
  const downlinkGBPerDay = P.mbpsToGB(bestLinkMbps, contactMinPerDay * 60) * 0.8; // 80% protocol efficiency
  const deliveredFraction = generatedGBPerDay <= 0 ? 0 : Math.min(1, downlinkGBPerDay / generatedGBPerDay);

  // ---- Cost
  const hardwareM = bus.costM + sum(parts.map((p) => p.costM));
  const integrationM = hardwareM * INTEGRATION_TEST_FACTOR;
  const launchM = launcher.costPerKgM ? launcher.costPerKgM * mass.withMarginKg : launcher.costM;
  const groundM = sum(stations.map((s) => s.costPerYearM)) * years;
  const operationsM = (0.1 + bus.costM * 0.05) * years;
  const totalM = hardwareM + integrationM + launchM + groundM + operationsM;
  const reserveM = scenario.budgetM * design.reservePct;
  const cost = {
    hardwareM, integrationM, launchM, groundM, operationsM, totalM, reserveM,
    budgetM: scenario.budgetM,
    remainingM: scenario.budgetM - totalM - reserveM,
  };

  // ---- Lifetime
  const totalDv = sum(of<Propulsion>(parts, 'propulsion').map((p) => p.deltaVms));
  const orbitYears = P.dragLifetimeYears(h);
  const propulsionExtraYears = totalDv > 0 ? totalDv / P.dragMakeupDvPerYear(h) : 0;
  const lifetime = {
    orbitYears,
    propulsionExtraYears,
    designYears: bus.designLifeYears,
    expectedYears: Math.min(bus.designLifeYears * 1.5, orbitYears + propulsionExtraYears),
    requiredYears: years,
  };

  // ---- Science
  const pointingDeg = of<Adcs>(parts, 'adcs').reduce<number | null>((best, a) => (best === null ? a.pointingDeg : Math.min(best, a.pointingDeg)), null);
  const seen = new Map<string, number>();
  const perYear = sum(
    instruments.map((i) => {
      const n = (seen.get(i.id) ?? 0) + 1;
      seen.set(i.id, n);
      if (n > 1) return 0; // spare copies add reliability, not science
      const pointingOk = pointingDeg !== null && pointingDeg <= i.requiredPointingDeg;
      return i.scienceValue * orbitScienceFit(i, orbit) * (pointingOk ? 1 : 0.25);
    }),
  );
  const imagers = instruments.filter((i) => i.resolutionAt500m > 0);
  const bestResolutionM = imagers.length ? Math.min(...imagers.map((i) => P.resolutionAt(i.resolutionAt500m, h))) : null;
  const target = scenario.requirements.targetLatDeg;
  const coversTarget = target === undefined || P.maxObservedLatitude(orbit.inclinationDeg) + 2 >= target || orbit.kind === 'GEO' && target < 70;
  const tagsCovered = [...new Set(instruments.flatMap((i) => i.tags))];
  const science = {
    perYear,
    expectedTotal: perYear * deliveredFraction * Math.min(years, lifetime.expectedYears) * (coversTarget ? 1 : 0.3),
    bestResolutionM,
    pointingDeg,
    coversTarget,
    tagsCovered,
  };

  return { scenario, bus, orbit, launcher, parts, instruments, orbitInfo, mass, slots, power, data: { generatedGBPerDay, downlinkGBPerDay, contactMinPerDay, deliveredFraction, perStation }, cost, lifetime, science };
}
