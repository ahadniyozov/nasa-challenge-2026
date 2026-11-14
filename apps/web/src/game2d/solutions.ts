// Reference designs that solve each mission (used by missions.check.ts, sim.test.ts and the bot).
import type { Build } from './config';

export const SOLUTIONS: Record<string, Partial<Build>> = {
  first: { antenna: 's-band' },
  wildfire: { camera: 'cam-thermal', orbit: 'sso-550', panels: 'solar-deploy-s', battery: 'batt-m', memory: 'm12', stations: 'st2', antenna: 'x-band' },
  ice: { orbit: 'sso-550', stations: 'st2', camera: 'radiometer', panels: 'solar-deploy-l', battery: 'batt-l' },
  weather: { orbit: 'geo', rocket: 'heavy', body: 'smallsat', camera: 'cam-thermal', antenna: 'x-band', panels: 'solar-deploy-l', battery: 'batt-l' },
  spaceweather: { computer: 'obc-rad', panels: 'solar-deploy-s', battery: 'batt-m', stations: 'st2' },
  mapping: { camera: 'cam-hires', antenna: 'x-band', body: 'smallsat', panels: 'solar-deploy-l', battery: 'batt-l', memory: 'm12', stations: 'st2' },
};
