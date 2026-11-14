// Game catalogs. Values are simplified, order-of-magnitude figures for education
// (inspired by NASA "CubeSat 101" and SmallSat state-of-the-art reports), not engineering data.
import type { Bus, Component, GroundStation, LaunchVehicle, Orbit, Scenario } from './types';

export const ORBITS: Orbit[] = [
  { id: 'leo-400', name: 'Low Earth Orbit 400 km', kind: 'LEO', altitudeKm: 400, inclinationDeg: 51.6, radiation: 1,
    blurb: 'Close to Earth: sharp images and cheap launch, but thin air slowly drags you down within ~1-2 years.' },
  { id: 'sso-550', name: 'Sun-Synchronous 550 km', kind: 'SSO', altitudeKm: 550, inclinationDeg: 97.6, radiation: 1.2,
    blurb: 'Passes over every place at the same local time - ideal for Earth observation. Covers the whole globe.' },
  { id: 'sso-800', name: 'Sun-Synchronous 800 km', kind: 'SSO', altitudeKm: 800, inclinationDeg: 98.6, radiation: 1.6,
    blurb: 'Higher SSO: wider view and decades of orbital life, but lower image resolution and more radiation.' },
  { id: 'meo-8000', name: 'Medium Earth Orbit 8,000 km', kind: 'MEO', altitudeKm: 8000, inclinationDeg: 55, radiation: 4,
    blurb: 'Long, slow passes over ground stations, but inside the Van Allen belts - electronics suffer.' },
  { id: 'geo', name: 'Geostationary 35,786 km', kind: 'GEO', altitudeKm: 35786, inclinationDeg: 0, radiation: 2,
    blurb: 'Hovers over one spot: continuous view of a hemisphere and nonstop contact, but far, costly and blurry.' },
];

export const LAUNCHERS: LaunchVehicle[] = [
  { id: 'rideshare', name: 'Rideshare slot', capacityKg: { LEO: 300, SSO: 300 }, costM: 0, costPerKgM: 0.0065, reliability: 0.97,
    blurb: 'Share a big rocket with dozens of other satellites. Cheap per kg, but you go where the main rocket goes (LEO/SSO).' },
  { id: 'small', name: 'Small launcher', capacityKg: { LEO: 300, SSO: 200 }, costM: 8, reliability: 0.93,
    blurb: 'A dedicated small rocket: your own orbit and schedule, higher price per kg.' },
  { id: 'medium', name: 'Medium launcher', capacityKg: { LEO: 3800, SSO: 1750, MEO: 600, GEO: 0 }, costM: 30, reliability: 0.96,
    blurb: 'Workhorse for small and medium satellites up to MEO.' },
  { id: 'heavy', name: 'Heavy launcher', capacityKg: { LEO: 22000, SSO: 15000, MEO: 6000, GEO: 4000 }, costM: 70, reliability: 0.98,
    blurb: 'Goes anywhere around Earth. Overkill for small missions - and priced like it.' },
];

export const BUSES: Bus[] = [
  { id: 'cubesat-3u', name: 'CubeSat 3U', dryMassKg: 2.5, maxPayloadKg: 3.5, slots: 5, baseLoadW: 2, costM: 0.15, designLifeYears: 2, reliability: 0.97,
    blurb: '10x10x34 cm. Cheap and fast to build; room for one small instrument.' },
  { id: 'cubesat-12u', name: 'CubeSat 12U', dryMassKg: 9, maxPayloadKg: 12, slots: 8, baseLoadW: 5, costM: 0.8, designLifeYears: 3, reliability: 0.98,
    blurb: 'A large CubeSat: deployable panels and a capable payload.' },
  { id: 'smallsat', name: 'SmallSat 150 kg', dryMassKg: 70, maxPayloadKg: 80, slots: 12, baseLoadW: 40, costM: 12, designLifeYears: 5, reliability: 0.995,
    blurb: 'Microwave-oven-to-fridge size. Real science platform with room for redundancy.' },
  { id: 'medium-bus', name: 'Medium bus 800 kg', dryMassKg: 450, maxPayloadKg: 350, slots: 18, baseLoadW: 250, costM: 60, designLifeYears: 10, reliability: 0.998,
    blurb: 'Flagship-class platform: large instruments, long life, big budget.' },
];

export const COMPONENTS: Component[] = [
  // Power generation
  { id: 'solar-body', category: 'solar', name: 'Body-mounted solar cells', massKg: 0.3, powerW: 0, costM: 0.05, reliability: 0.995, slots: 0, areaM2: 0.08, efficiency: 0.29,
    blurb: 'Cells glued to the sides. Light and simple, but small area.' },
  { id: 'solar-deploy-s', category: 'solar', name: 'Deployable panels (small)', massKg: 1.2, powerW: 0, costM: 0.25, reliability: 0.98, slots: 1, areaM2: 0.25, efficiency: 0.3,
    blurb: 'Fold-out wings. More power - and a mechanism that must unfold in space.' },
  { id: 'solar-deploy-l', category: 'solar', name: 'Deployable arrays (large)', massKg: 12, powerW: 0, costM: 2.5, reliability: 0.985, slots: 1, areaM2: 2.5, efficiency: 0.3,
    blurb: 'Large wings for SmallSats and bigger.' },
  { id: 'solar-xl', category: 'solar', name: 'Wing arrays (XL)', massKg: 60, powerW: 0, costM: 9, reliability: 0.99, slots: 2, areaM2: 12, efficiency: 0.3,
    blurb: 'Kilowatt-class arrays for medium buses.' },
  // Batteries
  { id: 'batt-s', category: 'battery', name: 'Li-ion pack 40 Wh', massKg: 0.3, powerW: 0, costM: 0.02, reliability: 0.99, slots: 1, capacityWh: 40,
    blurb: 'Keeps a CubeSat alive through Earth shadow.' },
  { id: 'batt-m', category: 'battery', name: 'Li-ion pack 300 Wh', massKg: 2.2, powerW: 0, costM: 0.15, reliability: 0.99, slots: 1, capacityWh: 300,
    blurb: 'For power-hungry CubeSats and SmallSats.' },
  { id: 'batt-l', category: 'battery', name: 'Li-ion pack 2 kWh', massKg: 14, powerW: 0, costM: 0.9, reliability: 0.99, slots: 1, capacityWh: 2000,
    blurb: 'SmallSat / medium bus energy storage.' },
  // Comms
  { id: 'uhf', category: 'comms', name: 'UHF radio', massKg: 0.1, powerW: 2, costM: 0.01, reliability: 0.98, slots: 1, band: 'UHF', downlinkMbps: 0.0096,
    blurb: '9.6 kbit/s. Enough for telemetry - far too slow for images.' },
  { id: 's-band', category: 'comms', name: 'S-band transmitter', massKg: 0.4, powerW: 8, costM: 0.15, reliability: 0.98, slots: 1, band: 'S', downlinkMbps: 10,
    blurb: '~10 Mbit/s. Standard choice for small science missions.' },
  { id: 'x-band', category: 'comms', name: 'X-band transmitter', massKg: 1.2, powerW: 25, costM: 0.6, reliability: 0.97, slots: 1, band: 'X', downlinkMbps: 150,
    blurb: '~150 Mbit/s. What imaging satellites use to dump big data.' },
  { id: 'ka-band', category: 'comms', name: 'Ka-band high-rate system', massKg: 8, powerW: 90, costM: 3, reliability: 0.97, slots: 2, band: 'Ka', downlinkMbps: 1200,
    blurb: 'Gigabit downlink for data-hungry missions. Heavy and power-hungry.' },
  // ADCS
  { id: 'adcs-mag', category: 'adcs', name: 'Magnetorquers', massKg: 0.2, powerW: 1, costM: 0.03, reliability: 0.99, slots: 1, pointingDeg: 10,
    blurb: 'Pushes against Earth\'s magnetic field. Rough pointing (~10 deg).' },
  { id: 'adcs-rw', category: 'adcs', name: 'Reaction wheels + star tracker', massKg: 1.5, powerW: 6, costM: 0.4, reliability: 0.95, slots: 1, pointingDeg: 0.1,
    blurb: 'Spinning wheels + star camera: precise pointing for cameras.' },
  { id: 'adcs-big', category: 'adcs', name: 'Large wheel assembly', massKg: 20, powerW: 60, costM: 4, reliability: 0.96, slots: 1, pointingDeg: 0.01,
    blurb: 'Arcsecond-class pointing for telescopes and big buses.' },
  // Computers
  { id: 'obc-cots', category: 'computer', name: 'Commercial flight computer', massKg: 0.1, powerW: 1.5, costM: 0.02, reliability: 0.96, slots: 1, radHard: false,
    blurb: 'Fast and cheap, but radiation can make it glitch.' },
  { id: 'obc-rad', category: 'computer', name: 'Radiation-hardened computer', massKg: 1, powerW: 8, costM: 0.8, reliability: 0.995, slots: 1, radHard: true,
    blurb: 'Slower, heavier, much more expensive - and almost never fails.' },
  // Propulsion
  { id: 'prop-cold', category: 'propulsion', name: 'Cold-gas thruster', massKg: 0.8, powerW: 1, costM: 0.1, reliability: 0.97, slots: 1, deltaVms: 15,
    blurb: 'Small push to dodge debris or raise the orbit a little.' },
  { id: 'prop-ep', category: 'propulsion', name: 'Electric thruster', massKg: 5, powerW: 60, costM: 0.9, reliability: 0.95, slots: 1, deltaVms: 300,
    blurb: 'Super-efficient but needs lots of power. Fights drag for years.' },
  { id: 'prop-chem', category: 'propulsion', name: 'Hydrazine system', massKg: 40, powerW: 10, costM: 3, reliability: 0.98, slots: 2, deltaVms: 400,
    blurb: 'Classic thrusters + fuel tank for big satellites.' },
  // Instruments
  { id: 'cam-cubesat', category: 'instrument', name: 'Compact RGB camera', massKg: 0.4, powerW: 4, costM: 0.1, reliability: 0.97, slots: 1,
    dataRateMbps: 20, dutyCycle: 0.005, scienceValue: 10, resolutionAt500m: 30, requiredPointingDeg: 1, tags: ['imaging'],
    blurb: 'Pocket camera for space: 30 m pixels at 500 km.' },
  { id: 'cam-thermal', category: 'instrument', name: 'Thermal infrared imager', massKg: 1.5, powerW: 10, costM: 0.6, reliability: 0.95, slots: 2,
    dataRateMbps: 30, dutyCycle: 0.1, scienceValue: 25, resolutionAt500m: 50, requiredPointingDeg: 1, tags: ['imaging', 'thermal', 'fire'],
    blurb: 'Sees heat: detects active fires day and night.' },
  { id: 'cam-hires', category: 'instrument', name: 'High-resolution telescope camera', massKg: 25, powerW: 60, costM: 6, reliability: 0.96, slots: 3,
    dataRateMbps: 600, dutyCycle: 0.04, scienceValue: 60, resolutionAt500m: 3, requiredPointingDeg: 0.1, tags: ['imaging'],
    blurb: '3 m pixels: see individual buildings. Huge data volume.' },
  { id: 'spectro', category: 'instrument', name: 'Hyperspectral imager', massKg: 12, powerW: 45, costM: 5, reliability: 0.95, slots: 2,
    dataRateMbps: 300, dutyCycle: 0.02, scienceValue: 55, resolutionAt500m: 30, requiredPointingDeg: 0.5, tags: ['imaging', 'spectral', 'fire'],
    blurb: 'Hundreds of colours per pixel: tells burnt forest from healthy forest.' },
  { id: 'radiometer', category: 'instrument', name: 'Microwave radiometer', massKg: 30, powerW: 70, costM: 7, reliability: 0.96, slots: 2,
    dataRateMbps: 2, dutyCycle: 1, scienceValue: 45, resolutionAt500m: 0, requiredPointingDeg: 1, tags: ['climate', 'moisture'],
    blurb: 'Measures soil moisture and rain through clouds.' },
  { id: 'magnetometer', category: 'instrument', name: 'Magnetometer', massKg: 0.2, powerW: 0.5, costM: 0.05, reliability: 0.99, slots: 1,
    dataRateMbps: 0.002, dutyCycle: 1, scienceValue: 4, resolutionAt500m: 0, requiredPointingDeg: 10, tags: ['space-weather'],
    blurb: 'Measures Earth\'s magnetic field. Tiny data, tiny science.' },
  { id: 'radiation-mon', category: 'instrument', name: 'Radiation monitor', massKg: 0.3, powerW: 1, costM: 0.08, reliability: 0.99, slots: 1,
    dataRateMbps: 0.01, dutyCycle: 1, scienceValue: 6, resolutionAt500m: 0, requiredPointingDeg: 10, tags: ['space-weather'],
    blurb: 'Counts energetic particles - space weather science.' },
];

export const GROUND_STATIONS: GroundStation[] = [
  { id: 'svalbard', name: 'Svalbard, Norway', lat: 78.2, lon: 15.4, costPerYearM: 0.6 },
  { id: 'alaska', name: 'Fairbanks, USA', lat: 64.8, lon: -147.7, costPerYearM: 0.5 },
  { id: 'wallops', name: 'Wallops, USA', lat: 37.9, lon: -75.5, costPerYearM: 0.3 },
  { id: 'krasnoyarsk', name: 'Krasnoyarsk, Russia', lat: 56.0, lon: 92.9, costPerYearM: 0.25 },
  { id: 'dushanbe', name: 'Dushanbe, Tajikistan', lat: 38.6, lon: 68.8, costPerYearM: 0.2 },
  { id: 'santiago', name: 'Santiago, Chile', lat: -33.4, lon: -70.7, costPerYearM: 0.3 },
  { id: 'hartebeesthoek', name: 'Hartebeesthoek, South Africa', lat: -25.9, lon: 27.7, costPerYearM: 0.3 },
  { id: 'troll', name: 'Troll, Antarctica', lat: -72.0, lon: 2.5, costPerYearM: 0.7 },
];

export const SCENARIOS: Scenario[] = [
  { id: 'first-cubesat', title: 'Your First CubeSat', difficulty: 'tutorial',
    brief: 'A university team wants its first satellite in orbit: take any pictures of Earth and send them home. Budget is tight - keep it simple.',
    budgetM: 8, durationYears: 1, allowedOrbits: ['leo-400', 'sso-550', 'geo'], allowedBuses: ['cubesat-3u', 'cubesat-12u', 'smallsat'],
    requirements: { requiredTags: ['imaging'], minScience: 5 } },
  { id: 'wildfire', title: 'Wildfire Watch', difficulty: 'normal',
    brief: 'Forest services need daily images of boreal forests to catch wildfires early. Resolution of 60 m or better, mission of 3 years.',
    budgetM: 45, durationYears: 3, allowedOrbits: ['leo-400', 'sso-550', 'sso-800', 'geo'], allowedBuses: ['cubesat-3u', 'cubesat-12u', 'smallsat', 'medium-bus'],
    requirements: { maxResolutionM: 60, targetLatDeg: 62, requiredTags: ['fire'], minScience: 120 } },
  { id: 'sandbox', title: 'Sandbox', difficulty: 'sandbox',
    brief: 'No customer, no rules. Unlimited budget - explore how every choice changes the mission.',
    budgetM: 1000, durationYears: 5, allowedOrbits: ORBITS.map((o) => o.id), allowedBuses: BUSES.map((b) => b.id),
    requirements: { minScience: 0 } },
];

/** Scenarios for the 2D game's missions (kept out of SCENARIOS so other modes don't list them). */
export const GAME_SCENARIOS: Scenario[] = [
  { id: 'g-first', title: 'First photo from space', difficulty: 'tutorial', brief: '', budgetM: 8, durationYears: 1,
    allowedOrbits: ORBITS.map((o) => o.id), allowedBuses: BUSES.map((b) => b.id), requirements: { minScience: 0 } },
  { id: 'g-ice', title: 'Polar ice', difficulty: 'normal', brief: '', budgetM: 40, durationYears: 5,
    allowedOrbits: ORBITS.map((o) => o.id), allowedBuses: BUSES.map((b) => b.id), requirements: { minScience: 0, targetLatDeg: 75 } },
  { id: 'g-weather', title: 'Hurricane watch', difficulty: 'normal', brief: '', budgetM: 250, durationYears: 5,
    allowedOrbits: ORBITS.map((o) => o.id), allowedBuses: BUSES.map((b) => b.id), requirements: { minScience: 0 } },
  { id: 'g-spaceweather', title: 'Space weather', difficulty: 'hard', brief: '', budgetM: 12, durationYears: 3,
    allowedOrbits: ORBITS.map((o) => o.id), allowedBuses: BUSES.map((b) => b.id), requirements: { minScience: 0 } },
  { id: 'g-mapping', title: 'Detailed map', difficulty: 'hard', brief: '', budgetM: 42, durationYears: 5,
    allowedOrbits: ORBITS.map((o) => o.id), allowedBuses: BUSES.map((b) => b.id), requirements: { minScience: 0 } },
];

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x] as const));
export const orbitById = byId(ORBITS);
export const launcherById = byId(LAUNCHERS);
export const busById = byId(BUSES);
export const componentById = byId(COMPONENTS);
export const stationById = byId(GROUND_STATIONS);
export const scenarioById = byId([...SCENARIOS, ...GAME_SCENARIOS]);
