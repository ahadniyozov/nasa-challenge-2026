// Career of 6 missions, easy → hard. Each one adds a new trade-off from the challenge:
// data must reach Earth → darkness & orbit decay → inclination & lifetime → orbit choice for the job
// → radiation & safe mode → a tight multi-constraint optimisation.
import type { Build, SlotId } from './config';

export type TargetKind = 'star' | 'fire' | 'ice' | 'storm' | 'particle' | 'city';
export type Level = 'Cadet' | 'Engineer' | 'Flight Director';

export interface Mission {
  id: string;
  num: number;
  emoji: string;
  title: string;
  level: Level;
  scenarioId: string; // engine scenario (years, target latitude)
  customer: { emoji: string; who: string; text: string };
  learn: string; // what this mission teaches
  source: string; // which challenge resource it draws on
  targets: { kind: TargetKind; label: string; band: [number, number] };
  goal: number;
  years: number;
  budgetM: number;
  maxResolutionM?: number;
  needsContact?: boolean; // weather: must watch continuously
  farNorth?: boolean; // targets only a polar orbit can reach
  laps?: number; // game orbits when the mission is shorter than 2 years
  storms: number;
  instruments: string[]; // options for the instrument slot
  slots: SlotId[]; // what the player may change (fewer for easy missions)
  start: Build;
  test?: Build; // play-first: fly a ready-made satellite before designing
}

const BASE: Build = {
  camera: 'cam-cubesat', body: 'auto', panels: 'solar-body', battery: 'batt-s', antenna: 's-band', memory: 'm8',
  shield: 'none', thruster: 'none', computer: 'obc-cots', orbit: 'leo-400', rocket: 'rideshare', stations: 'st1',
};
const ALL: SlotId[] = ['camera', 'body', 'panels', 'battery', 'antenna', 'memory', 'shield', 'thruster', 'orbit', 'rocket', 'stations'];
const WITH_COMPUTER: SlotId[] = [...ALL.slice(0, 7), 'computer', ...ALL.slice(7)];

export const MISSIONS: Mission[] = [
  {
    id: 'first', num: 1, emoji: '📸', title: 'First photo from space', level: 'Cadet', scenarioId: 'g-first',
    customer: { emoji: '🧑‍🎓', who: 'University space club', text: 'We built our first tiny CubeSat! We just want a few photos of Earth to reach our club.' },
    learn: 'A photo only counts when it reaches Earth: the radio matters as much as the camera.',
    source: 'NASA CubeSat 101',
    targets: { kind: 'star', label: 'photos of Earth', band: [60, -20] },
    goal: 3, years: 1, laps: 4, budgetM: 8, storms: 0,
    instruments: ['cam-cubesat'],
    slots: ['antenna', 'orbit', 'stations'],
    start: { ...BASE, antenna: 'uhf' },
    test: { ...BASE, antenna: 'uhf' },
  },
  {
    id: 'wildfire', num: 2, emoji: '🔥', title: 'Wildfire watch', level: 'Engineer', scenarioId: 'wildfire',
    customer: { emoji: '👩‍🚒', who: 'Forest Fire Service', text: 'Every summer fires burn the northern forests. We need a satellite that finds them and sends us photos - for 3 years.' },
    learn: 'Earth\'s shadow, full memory and a decaying low orbit can each ruin a mission.',
    source: 'NASA: Design and Develop Science Missions',
    targets: { kind: 'fire', label: 'fire photos', band: [75, 20] },
    goal: 10, years: 3, budgetM: 45, maxResolutionM: 60, storms: 0,
    instruments: ['cam-cubesat', 'cam-thermal', 'cam-hires'],
    slots: ALL,
    start: { ...BASE, memory: 'm4' },
    test: { ...BASE, memory: 'm4' },
  },
  {
    id: 'ice', num: 3, emoji: '🧊', title: 'Polar ice', level: 'Engineer', scenarioId: 'g-ice',
    customer: { emoji: '👨‍🔬', who: 'Climate scientists', text: 'Glaciers near the North Pole are melting. Watch them for 5 years - and they are very far north.' },
    learn: 'An orbit\'s tilt decides which latitudes it can see. Long missions need a high orbit.',
    source: 'NASA Mission Design Lab: orbit design',
    targets: { kind: 'ice', label: 'glacier photos', band: [88, 55] },
    goal: 10, years: 5, budgetM: 40, storms: 0, farNorth: true,
    instruments: ['cam-cubesat', 'spectro', 'radiometer'],
    slots: ALL,
    start: { ...BASE, panels: 'solar-deploy-s', battery: 'batt-m' },
  },
  {
    id: 'weather', num: 4, emoji: '🌀', title: 'Hurricane watch', level: 'Engineer', scenarioId: 'g-weather',
    customer: { emoji: '🧑‍✈️', who: 'Weather service', text: 'We must watch hurricanes over the ocean all the time - not just once in a while.' },
    learn: 'Different jobs need different orbits: a high orbit sees one place nonstop, but needs a huge rocket.',
    source: 'NASA Mission Viz: orbits and timelines',
    targets: { kind: 'storm', label: 'hurricane images', band: [35, -10] },
    goal: 12, years: 5, budgetM: 250, maxResolutionM: 5000, needsContact: true, storms: 0,
    instruments: ['cam-cubesat', 'cam-thermal', 'radiometer'],
    slots: ALL,
    start: { ...BASE, panels: 'solar-deploy-s', battery: 'batt-m', orbit: 'sso-550' },
  },
  {
    id: 'spaceweather', num: 5, emoji: '☀️', title: 'Space weather', level: 'Flight Director', scenarioId: 'g-spaceweather',
    customer: { emoji: '👩‍🚀', who: 'Space weather center', text: 'Measure the particle clouds the Sun throws at Earth. The best data comes during solar storms - if you survive them.' },
    learn: 'Radiation breaks electronics: safe mode protects you but stops the science; a radiation-hardened computer costs more.',
    source: 'NASA Mission Design Lab: radiation environment',
    targets: { kind: 'particle', label: 'particle measurements', band: [70, -70] },
    goal: 14, years: 3, budgetM: 12, storms: 3,
    instruments: ['magnetometer', 'radiation-mon'],
    slots: WITH_COMPUTER,
    start: { ...BASE, camera: 'magnetometer', orbit: 'sso-550' },
  },
  {
    id: 'mapping', num: 6, emoji: '🏙️', title: 'Detailed city map', level: 'Flight Director', scenarioId: 'g-mapping',
    customer: { emoji: '👷', who: 'City planners', text: 'We need photos sharp enough to see single buildings (5 m or better), for 5 years, on a tight budget.' },
    learn: 'Everything at once: a sharp telescope is heavy, its files are huge, and the budget is tight.',
    source: 'NASA Mission Design Lab: trade studies',
    targets: { kind: 'city', label: 'sharp city photos', band: [55, 20] },
    goal: 12, years: 5, budgetM: 42, maxResolutionM: 5, storms: 1,
    instruments: ['cam-cubesat', 'spectro', 'cam-hires'],
    slots: WITH_COMPUTER,
    start: { ...BASE, orbit: 'sso-550', panels: 'solar-deploy-s', battery: 'batt-m' },
  },
];

export const INSTRUMENT_INFO: Record<string, { emoji: string; title: string; text: string; nightVision: boolean; photoMb: number }> = {
  'cam-cubesat': { emoji: '📷', title: 'Simple camera', text: 'Colour photos, only in daylight. Tiny.', nightVision: false, photoMb: 5 },
  'cam-thermal': { emoji: '🌡️', title: 'Heat camera', text: 'Sees heat day and night. Needs more power.', nightVision: true, photoMb: 8 },
  'cam-hires': { emoji: '🔭', title: 'Telescope', text: 'Super sharp, 25 kg, huge files.', nightVision: false, photoMb: 60 },
  spectro: { emoji: '🌈', title: 'Hyperspectral camera', text: 'Hundreds of colours per pixel. 12 kg, big files, daylight only.', nightVision: false, photoMb: 40 },
  radiometer: { emoji: '📻', title: 'Microwave radiometer', text: 'Sees through clouds and darkness. 30 kg, blurry.', nightVision: true, photoMb: 4 },
  magnetometer: { emoji: '🧲', title: 'Magnetometer', text: 'Measures magnetic fields. Tiny and cheap.', nightVision: true, photoMb: 0.5 },
  'radiation-mon': { emoji: '☢️', title: 'Radiation monitor', text: 'Counts energetic particles. Tiny.', nightVision: true, photoMb: 0.5 },
};

export const missionById = new Map(MISSIONS.map((m) => [m.id, m] as const));
