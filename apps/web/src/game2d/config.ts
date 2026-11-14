// 2D mission: the player's build maps onto real engine components; the engine's budgets
// then set every flight parameter (shadow length, battery, downlink, lifetime, mass).
import { BUSES, componentById, computeBudgets, physics, type Budgets, type MissionDesign } from '@mission/engine';
import { INSTRUMENT_INFO, MISSIONS, type Mission } from './missions';

export type SlotId = 'camera' | 'body' | 'panels' | 'battery' | 'antenna' | 'memory' | 'orbit' | 'rocket' | 'stations' | 'shield' | 'thruster' | 'computer';

export interface Choice { id: string; emoji: string; title: string; text: string }
export interface Slot { id: SlotId; emoji: string; title: string; group: 'satellite' | 'mission'; options: Choice[] }

export const SLOTS: Slot[] = [
  { id: 'camera', emoji: '📷', title: 'Camera', group: 'satellite', options: [
    { id: 'cam-cubesat', emoji: '📷', title: 'Simple camera', text: 'Colour photos, only in daylight. Tiny.' },
    { id: 'cam-thermal', emoji: '🌡️', title: 'Heat camera', text: 'Sees fires day and night. Needs more power.' },
    { id: 'cam-hires', emoji: '🔭', title: 'Telescope', text: 'Super sharp, 25 kg, huge files.' },
  ] },
  { id: 'body', emoji: '📦', title: 'Body', group: 'satellite', options: [
    { id: 'auto', emoji: '📦', title: 'Smallest that fits', text: 'Light and cheap. A CubeSat wears out in 3-4 years.' },
    { id: 'smallsat', emoji: '🧳', title: 'Sturdy 150 kg body', text: 'Heavier and $12M, but lasts 7 years.' },
  ] },
  { id: 'panels', emoji: '☀️', title: 'Solar panels', group: 'satellite', options: [
    { id: 'solar-body', emoji: '▫️', title: 'On the body', text: 'Light, little power.' },
    { id: 'solar-deploy-s', emoji: '🪁', title: 'Small wings', text: 'Good power, a bit heavier.' },
    { id: 'solar-deploy-l', emoji: '🦅', title: 'Big wings', text: 'Lots of power, 12 kg.' },
  ] },
  { id: 'battery', emoji: '🔋', title: 'Battery', group: 'satellite', options: [
    { id: 'batt-s', emoji: '🔋', title: 'Small', text: '40 Wh. Enough for a tiny satellite.' },
    { id: 'batt-m', emoji: '🔋', title: 'Medium', text: '300 Wh.' },
    { id: 'batt-l', emoji: '🔋', title: 'Large', text: '2 kWh, 14 kg.' },
  ] },
  { id: 'antenna', emoji: '📡', title: 'Antenna', group: 'satellite', options: [
    { id: 'uhf', emoji: '📻', title: 'Walkie-talkie', text: 'Very slow. Almost free.' },
    { id: 's-band', emoji: '📶', title: 'Antenna', text: 'A few photos per pass.' },
    { id: 'x-band', emoji: '📡', title: 'Dish', text: 'Many photos per pass, needs power.' },
  ] },
  { id: 'memory', emoji: '💾', title: 'Memory', group: 'satellite', options: [
    { id: 'm4', emoji: '💾', title: '4 photos', text: 'Cheap.' },
    { id: 'm8', emoji: '💾', title: '8 photos', text: '+$0.2M' },
    { id: 'm12', emoji: '💾', title: '12 photos', text: '+$0.5M' },
  ] },
  { id: 'shield', emoji: '🛡️', title: 'Debris shield', group: 'satellite', options: [
    { id: 'none', emoji: '➖', title: 'None', text: '' },
    { id: 'shield', emoji: '🛡️', title: 'Shield', text: '+1 ❤️, +2 kg, +$0.3M' },
  ] },
  { id: 'thruster', emoji: '💨', title: 'Thruster', group: 'satellite', options: [
    { id: 'none', emoji: '➖', title: 'None', text: '' },
    { id: 'prop-cold', emoji: '💨', title: 'Small thruster', text: 'Fights air drag - longer life in low orbit.' },
  ] },
  { id: 'computer', emoji: '🧠', title: 'Computer', group: 'satellite', options: [
    { id: 'obc-cots', emoji: '💻', title: 'Normal computer', text: 'Cheap. A solar storm can crash it.' },
    { id: 'obc-rad', emoji: '🛡️', title: 'Radiation-hardened', text: 'Survives solar storms. +$0.8M, more power.' },
  ] },
  { id: 'orbit', emoji: '🌍', title: 'Orbit', group: 'mission', options: [
    { id: 'leo-400', emoji: '🏠', title: 'Low 400 km', text: 'Sharp, cheap, but air pulls you down in ~1 year.' },
    { id: 'sso-550', emoji: '🧭', title: 'Polar 550 km', text: 'Flies over the whole Earth, lasts ~10 years.' },
    { id: 'geo', emoji: '🌕', title: 'High 36,000 km', text: 'Always sees half of Earth, but blurry.' },
  ] },
  { id: 'rocket', emoji: '🚀', title: 'Rocket', group: 'mission', options: [
    { id: 'rideshare', emoji: '🚌', title: 'Rideshare', text: 'Cheap per kg. Low orbits, max 300 kg.' },
    { id: 'medium', emoji: '🚀', title: 'Medium', text: '$30M. Up to MEO.' },
    { id: 'heavy', emoji: '🛸', title: 'Heavy', text: '$70M. Anywhere.' },
  ] },
  { id: 'stations', emoji: '🗺️', title: 'Ground stations', group: 'mission', options: [
    { id: 'st1', emoji: '1️⃣', title: 'Krasnoyarsk', text: '1 station.' },
    { id: 'st2', emoji: '2️⃣', title: '+ Svalbard', text: 'A polar station - sees polar orbits often.' },
    { id: 'st3', emoji: '3️⃣', title: '+ Alaska', text: '3 stations.' },
  ] },
];

export type Build = Record<SlotId, string>;

/** The slots of one mission: the instrument slot lists that mission's instruments; easy missions lock most slots. */
export function slotsFor(m: Mission): Slot[] {
  const sensors = m.instruments.every((id) => INSTRUMENT_INFO[id].photoMb < 1);
  return SLOTS.map((s) =>
    s.id !== 'camera' ? s : {
      ...s, emoji: sensors ? '🔬' : '📷', title: sensors ? 'Sensor' : 'Camera',
      options: m.instruments.map((id) => ({ id, emoji: INSTRUMENT_INFO[id].emoji, title: INSTRUMENT_INFO[id].title, text: INSTRUMENT_INFO[id].text })),
    },
  ).filter((s) => m.slots.includes(s.id));
}

const STATIONS: Record<string, string[]> = { st1: ['krasnoyarsk'], st2: ['krasnoyarsk', 'svalbard'], st3: ['krasnoyarsk', 'svalbard', 'alaska'] };
const MEMORY: Record<string, { slots: number; cost: number }> = { m4: { slots: 4, cost: 0 }, m8: { slots: 8, cost: 0.2 }, m12: { slots: 12, cost: 0.5 } };

/** Smallest bus that fits all parts - bigger parts make the satellite bigger, heavier and pricier. */
function fitBus(parts: string[], min: string) {
  const kg = parts.reduce((s, id) => s + (componentById.get(id)?.massKg ?? 0), 0);
  const slots = parts.reduce((s, id) => s + (componentById.get(id)?.slots ?? 0), 0);
  const from = Math.max(0, BUSES.findIndex((b) => b.id === min));
  return BUSES.slice(from).find((b) => kg <= b.maxPayloadKg && slots <= b.slots) ?? BUSES.at(-1)!;
}

export function toDesign(b: Build, m: Mission): MissionDesign {
  const parts = [b.panels, b.battery, b.antenna, b.computer, 'adcs-rw', b.camera, ...(b.thruster === 'prop-cold' ? ['prop-cold'] : [])];
  const bus = fitBus(parts, b.body === 'smallsat' ? 'smallsat' : 'cubesat-3u');
  return { scenarioId: m.scenarioId, busId: bus.id, orbitId: b.orbit, launcherId: b.rocket, components: parts, groundStationIds: STATIONS[b.stations], reservePct: 0.1 };
}

export interface FlightParams {
  orbitSec: number;
  orbits: number; // planned
  orbitsBeforeDecay: number; // how many the satellite survives (air drag or wear)
  endReason: 'decay' | 'wearout';
  reachesTargets: boolean; // the orbit flies over the target latitudes
  targetRate: number; // how often targets pass under the track
  storms: number;
  radHard: boolean;
  goal: number;
  shadowFraction: number;
  shadowDrain: number; // battery %/s in shadow
  sunCharge: number; // battery %/s in sunlight
  photosPerSec: number; // over a station
  stationsPerOrbit: number;
  alwaysInContact: boolean;
  memory: number;
  hearts: number;
  laneSpeed: number; // how fast the satellite changes lanes (mass)
  debrisRate: number;
  nightVision: boolean;
  sharp: boolean;
  massKg: number;
}

export interface Analysis {
  budgets: Budgets;
  design: MissionDesign;
  extraCostM: number;
  totalCostM: number;
  budgetM: number;
  canLaunch: boolean;
  blockers: string[];
  flight: FlightParams;
  gauges: { id: string; emoji: string; label: string; value: number; level: 'good' | 'warn' | 'bad'; detail: string; params: Record<string, string | number> }[];
}

const lvl = (r: number) => (r <= 0.85 ? 'good' : r <= 1 ? 'warn' : 'bad') as 'good' | 'warn' | 'bad';

export function analyse(build: Build, m: Mission = MISSIONS[1]): Analysis {
  const design = toDesign(build, m);
  const b = computeBudgets(design);
  const mem = MEMORY[build.memory];
  const shield = build.shield === 'shield';
  const extraCostM = mem.cost + (shield ? 0.3 : 0);
  const massKg = b.mass.totalKg + (shield ? 2 : 0);
  const withMargin = massKg * 1.2;
  const totalCostM = b.cost.totalM + extraCostM;
  const budgetM = m.budgetM;

  const blockers: string[] = [];
  if (b.mass.launcherCapacityKg <= 0) blockers.push('This rocket cannot reach that orbit.');
  else if (withMargin > b.mass.launcherCapacityKg) blockers.push('The rocket cannot lift this satellite.');
  if (totalCostM > budgetM) blockers.push('Over budget.');

  // ---- flight parameters straight from the engine
  const orbitSec = 24;
  const geo = b.orbit.kind === 'GEO';
  const shadowFraction = geo ? 0.05 : b.orbitInfo.eclipseFraction;
  const shadowSec = orbitSec * shadowFraction;
  const batteryRatio = b.power.batteryUsableWh > 0 ? b.power.eclipseNeedWh / b.power.batteryUsableWh : 9;
  const genRatio = b.power.averageLoadW > 0 ? Math.min(1.5, b.power.endOfLifeAverageW / b.power.averageLoadW) : 1;
  const comms = b.parts.filter((p) => p.category === 'comms') as { downlinkMbps: number }[];
  const linkMbps = Math.max(0, ...comms.map((c) => c.downlinkMbps)) * physics.linkDistanceFactor(b.orbit.altitudeKm);
  const info = INSTRUMENT_INFO[build.camera];
  const photoMb = info.photoMb;
  const passesPerDay = b.data.perStation.reduce((s, st) => s + st.passes, 0);
  // one game orbit stands for many real ones, so passes are scaled up (but a station the orbit never sees stays at 0)
  const realPerOrbit = passesPerDay / b.orbitInfo.orbitsPerDay;
  const stationsPerOrbit = geo || realPerOrbit === 0 ? 0 : Math.max(1, Math.min(3, Math.round(realPerOrbit * 4)));

  const flight: FlightParams = {
    orbitSec,
    orbits: m.laps ?? m.years,
    orbitsBeforeDecay: b.lifetime.expectedYears >= m.years - 0.01 ? (m.laps ?? m.years) : Math.max(1, Math.floor((b.lifetime.expectedYears / m.years) * (m.laps ?? m.years))),
    endReason: b.lifetime.orbitYears + b.lifetime.propulsionExtraYears <= b.lifetime.expectedYears + 0.01 ? 'decay' : 'wearout',
    reachesTargets: !m.farNorth || b.science.coversTarget,
    // a weather satellite in low orbit only passes over the hurricanes now and then
    targetRate: m.needsContact && !geo ? 0.35 : 1,
    storms: m.storms,
    radHard: build.computer === 'obc-rad',
    goal: m.goal,
    shadowFraction,
    shadowDrain: (100 * Math.min(batteryRatio, 4) * 1.05) / Math.max(shadowSec, 1),
    // panels weaker than the load → the battery barely recharges
    sunCharge: (100 / (orbitSec * (1 - shadowFraction) * 0.45)) * Math.max(0, Math.min(1, (genRatio - 0.5) * 2)),
    photosPerSec: (linkMbps / photoMb) * 1.6,
    stationsPerOrbit,
    alwaysInContact: geo && b.data.contactMinPerDay > 0,
    memory: mem.slots,
    hearts: 3 + (shield ? 1 : 0),
    laneSpeed: Math.max(0.6, Math.min(1.25, 1.35 - massKg / 140)),
    debrisRate: b.orbit.kind === 'LEO' ? 1.3 : geo ? 0.35 : 1,
    nightVision: info.nightVision,
    sharp: m.maxResolutionM === undefined || (b.science.bestResolutionM ?? 999) <= m.maxResolutionM,
    massKg,
  };

  const energy = Math.max(1 / Math.max(genRatio, 0.01), batteryRatio);
  const gauges: Analysis['gauges'] = [
    { id: 'weight', emoji: '⚖️', label: 'Weight', value: b.mass.launcherCapacityKg > 0 ? withMargin / b.mass.launcherCapacityKg : 9, level: lvl(b.mass.launcherCapacityKg > 0 ? withMargin / b.mass.launcherCapacityKg : 9),
      detail: '{kg} kg of {cap} kg the rocket lifts', params: { kg: Math.round(withMargin), cap: b.mass.launcherCapacityKg } },
    { id: 'energy', emoji: '⚡', label: 'Energy', value: energy, level: lvl(energy),
      detail: 'panels {g} W · uses {u} W', params: { g: Math.round(b.power.endOfLifeAverageW), u: Math.round(b.power.averageLoadW) } },
    { id: 'night', emoji: '🌑', label: 'Battery in shadow', value: batteryRatio, level: lvl(batteryRatio),
      detail: 'needs {n} Wh of {h} Wh', params: { n: Math.round(b.power.eclipseNeedWh), h: Math.round(b.power.batteryUsableWh) } },
    { id: 'money', emoji: '💰', label: 'Money', value: totalCostM / budgetM, level: lvl(totalCostM / budgetM),
      detail: '${c}M of ${b}M', params: { c: totalCostM.toFixed(1), b: budgetM } },
  ];

  return { budgets: b, design, extraCostM, totalCostM, budgetM, canLaunch: blockers.length === 0, blockers, flight, gauges };
}
