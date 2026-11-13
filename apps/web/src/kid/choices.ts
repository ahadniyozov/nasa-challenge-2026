// Simple mode: every step offers 3 big choices that map onto real engine components.
import type { MissionDesign } from '@mission/engine';

export type StepId = 'orbit' | 'size' | 'camera' | 'energy' | 'antenna' | 'stations' | 'rocket' | 'check';

export interface Option {
  id: string;
  emoji: string;
  title: string;
  /** one short line a 10-year-old understands */
  text: string;
  good: string;
  bad: string;
  /** engine component ids this choice adds */
  parts?: string[];
}

export interface Step {
  id: StepId;
  emoji: string;
  title: string;
  question: string;
  guide: string;
  options: Option[];
}

export const STEPS: Step[] = [
  {
    id: 'orbit', emoji: '🌍', title: 'Orbit', question: 'Where will your satellite fly?',
    guide: 'An orbit is the path around Earth. Low = sharp photos. High = sees more, but blurry.',
    options: [
      { id: 'leo-400', emoji: '🏠', title: 'Low orbit', text: '400 km up, like the space station.', good: 'Sharp photos, cheap to reach', bad: 'Air slowly pulls it down (~1 year)' },
      { id: 'sso-550', emoji: '🧭', title: 'Polar orbit', text: '550 km up, flies over the North and South poles.', good: 'Sees the whole planet, lasts ~10 years', bad: 'A bit less sharp' },
      { id: 'geo', emoji: '🌕', title: 'Very high orbit', text: '36,000 km up, hangs over one spot.', good: 'Always sees half of Earth', bad: 'Blurry photos, needs a huge rocket' },
    ],
  },
  {
    id: 'size', emoji: '📦', title: 'Size', question: 'How big is your satellite?',
    guide: 'Bigger satellites carry more parts, but cost more and are heavier.',
    options: [
      { id: 'cubesat-3u', emoji: '🥛', title: 'Tiny', text: 'Size of a milk carton. 3.5 kg of parts max.', good: 'Very cheap', bad: 'Only small parts fit' },
      { id: 'cubesat-12u', emoji: '👟', title: 'Medium', text: 'Size of a shoebox. 12 kg of parts.', good: 'Room for good parts', bad: 'Costs more' },
      { id: 'smallsat', emoji: '🧊', title: 'Large', text: 'Size of a fridge. 80 kg of parts.', good: 'Anything fits', bad: 'Expensive and heavy' },
    ],
  },
  {
    id: 'camera', emoji: '📷', title: 'Camera', question: 'Which camera takes the pictures?',
    guide: 'The camera is why we fly! Better cameras make bigger files to send home.',
    options: [
      { id: 'cam-cubesat', emoji: '📷', title: 'Simple camera', text: 'Takes normal colour photos.', good: 'Tiny and cheap', bad: 'Cannot see heat', parts: ['cam-cubesat'] },
      { id: 'cam-thermal', emoji: '🌡️', title: 'Heat camera', text: 'Sees warm things - even fires through smoke.', good: 'Finds fires day and night', bad: 'Needs more power' },
      { id: 'cam-hires', emoji: '🔭', title: 'Super telescope', text: 'So sharp it can see single houses.', good: 'Amazing detail', bad: 'Heavy (25 kg), huge files, expensive' },
    ],
  },
  {
    id: 'energy', emoji: '⚡', title: 'Energy', question: 'How does it get power?',
    guide: 'Solar panels charge in sunlight. In Earth\'s shadow the battery must keep everything alive.',
    options: [
      { id: 'e1', emoji: '🔋', title: 'Small panels', text: 'Solar cells on the sides + small battery.', good: 'Light and cheap', bad: 'Little power', parts: ['solar-body', 'batt-s'] },
      { id: 'e2', emoji: '🪁', title: 'Fold-out wings', text: 'Panels unfold in space + medium battery.', good: 'Good power', bad: 'Heavier', parts: ['solar-deploy-s', 'batt-m'] },
      { id: 'e3', emoji: '🦅', title: 'Big wings', text: 'Huge solar wings + big battery.', good: 'Lots of power', bad: 'Heavy (26 kg) and pricey', parts: ['solar-deploy-l', 'batt-l'] },
    ],
  },
  {
    id: 'antenna', emoji: '📡', title: 'Antenna', question: 'How will photos get back to Earth?',
    guide: 'Photos are only useful if they reach Earth. A faster antenna sends more photos per pass.',
    options: [
      { id: 'uhf', emoji: '📻', title: 'Walkie-talkie', text: 'Very slow, like old dial-up internet.', good: 'Almost free', bad: 'Too slow for photos' },
      { id: 's-band', emoji: '📶', title: 'Antenna', text: 'Sends a few photos every pass.', good: 'Good for small cameras', bad: 'Not enough for big cameras' },
      { id: 'x-band', emoji: '📡', title: 'Dish', text: 'Super fast, like home Wi-Fi.', good: 'Sends tons of photos', bad: 'Needs more power' },
    ],
  },
  {
    id: 'stations', emoji: '🗺️', title: 'Stations', question: 'Which ground stations will listen?',
    guide: 'Your satellite can only send photos while it flies over a station. Pick 1 to 3. Stations near the poles see polar orbits most often!',
    options: [],
  },
  {
    id: 'rocket', emoji: '🚀', title: 'Rocket', question: 'Which rocket takes you to space?',
    guide: 'Big rockets go higher and carry more, but cost a lot more.',
    options: [
      { id: 'rideshare', emoji: '🚌', title: 'Rideshare', text: 'Share a rocket with other satellites, like a bus.', good: 'Super cheap', bad: 'Only to low orbits, max 300 kg' },
      { id: 'medium', emoji: '🚀', title: 'Medium rocket', text: 'Your own rocket.', good: 'Carries a lot', bad: '$30M' },
      { id: 'heavy', emoji: '🛸', title: 'Heavy rocket', text: 'One of the biggest rockets on Earth.', good: 'Reaches any orbit', bad: '$70M' },
    ],
  },
  {
    id: 'check', emoji: '✅', title: 'Launch', question: 'Ready for launch?',
    guide: 'Check the meters. Green = good, red = must fix.',
    options: [],
  },
];

export const STATION_FLAGS: Record<string, string> = {
  svalbard: '🇳🇴', alaska: '🇺🇸', wallops: '🇺🇸', krasnoyarsk: '🇷🇺', dushanbe: '🇹🇯', santiago: '🇨🇱', hartebeesthoek: '🇿🇦', troll: '🇦🇶',
};

export const EXTRAS: Option[] = [
  { id: 'prop-cold', emoji: '💨', title: 'Dodge thruster', text: 'Small engine to dodge space junk.', good: 'Avoids crashes', bad: '+0.8 kg', parts: ['prop-cold'] },
  { id: 'obc-cots', emoji: '🧠', title: 'Spare brain', text: 'A backup computer in case the first breaks.', good: 'Mission survives a failure', bad: '+$0.02M', parts: ['obc-cots'] },
];

export interface Choices {
  scenarioId: string;
  orbit: string;
  size: string;
  camera: string;
  energy: string;
  antenna: string;
  stations: string[];
  rocket: string;
  extras: string[];
}

export function defaultChoices(scenarioId: string): Choices {
  return { scenarioId, orbit: 'leo-400', size: 'cubesat-3u', camera: 'cam-cubesat', energy: 'e1', antenna: 'uhf', stations: ['krasnoyarsk'], rocket: 'rideshare', extras: [] };
}

/** Every satellite gets a computer and reaction wheels automatically - kids don't pick those. */
export function toDesign(c: Choices): MissionDesign {
  const energy = STEPS.find((s) => s.id === 'energy')!.options.find((o) => o.id === c.energy)!.parts!;
  return {
    scenarioId: c.scenarioId,
    busId: c.size,
    orbitId: c.orbit,
    launcherId: c.rocket,
    components: [...energy, c.antenna, 'obc-cots', 'adcs-rw', c.camera, ...c.extras],
    groundStationIds: c.stations,
    reservePct: 0.1,
  };
}

export const LEVELS = [
  { scenarioId: 'first-cubesat', emoji: '📸', title: 'Mission 1: First photo from space', goal: 'Send home {n} photos of Earth', goalPhotos: 5, targetKind: 'sight' as const },
  { scenarioId: 'wildfire', emoji: '🔥', title: 'Mission 2: Wildfire watch', goal: 'Send firefighters {n} photos of forest fires in the north', goalPhotos: 10, targetKind: 'fire' as const },
];
