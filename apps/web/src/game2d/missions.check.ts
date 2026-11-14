// Static balance check for the 6 missions: every mission has a launchable design that meets all
// requirements, and the starting / test satellite does not. Run: npm run check:missions
import assert from 'node:assert/strict';
import { analyse, type Build } from './config';
import { MISSIONS } from './missions';

const SOLUTIONS: Record<string, Partial<Build>> = {
  first: { antenna: 's-band' },
  wildfire: { camera: 'cam-thermal', orbit: 'sso-550', panels: 'solar-deploy-s', battery: 'batt-m', memory: 'm12', stations: 'st2', antenna: 'x-band' },
  ice: { orbit: 'sso-550', stations: 'st2', camera: 'radiometer', panels: 'solar-deploy-l', battery: 'batt-l' },
  weather: { orbit: 'geo', rocket: 'heavy', body: 'smallsat', camera: 'cam-thermal', antenna: 'x-band', panels: 'solar-deploy-l', battery: 'batt-l' },
  spaceweather: { computer: 'obc-rad', panels: 'solar-deploy-s', battery: 'batt-m', stations: 'st2' },
  mapping: { camera: 'cam-hires', antenna: 'x-band', body: 'smallsat', panels: 'solar-deploy-l', battery: 'batt-l', memory: 'm12', stations: 'st2' },
};

const meets = (m: (typeof MISSIONS)[number], b: Build) => {
  const a = analyse(b, m), f = a.flight;
  return { a, ok: a.canLaunch && f.sharp && f.reachesTargets && (!m.needsContact || f.alwaysInContact) && f.orbitsBeforeDecay === f.orbits && f.photosPerSec > 0.5 };
};

for (const m of MISSIONS) {
  const sol = { ...m.start, ...SOLUTIONS[m.id] } as Build;
  for (const k of Object.keys(SOLUTIONS[m.id]) as (keyof Build)[]) assert.ok(m.slots.includes(k), `${m.id}: solution changes locked slot ${k}`);
  const good = meets(m, sol);
  assert.ok(good.ok, `${m.id}: the reference design should meet every requirement (${good.a.blockers.join(', ')})`);
  const bad = meets(m, m.test ?? m.start);
  // on storm missions a plain computer only survives if the player uses safe mode (checked by the bot)
  assert.ok(!bad.ok || (m.storms > 0 && !bad.a.flight.radHard), `${m.id}: the starting satellite should not already solve the mission`);
  console.log(`✓ ${m.num}. ${m.id.padEnd(13)} solution $${good.a.totalCostM.toFixed(1)}M of $${m.budgetM}M`);
}
