// Bot playthroughs of the missions: node scripts/bot-2d.mjs [url] [missionId]
// Plays the 3D flight by default; add 2d to the url (http://localhost:5199/?all&2d) for the 2D flight.
// Plays each mission with a "bad" (test/start) build and a "good" build and prints the result.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2] ?? 'http://localhost:5199/?all';
const RUNS = [
  ['first', {}, true], ['first', { antenna: 's-band' }],
  ['wildfire', {}, true], ['wildfire', { camera: 'cam-thermal', orbit: 'sso-550', panels: 'solar-deploy-s', battery: 'batt-m', memory: 'm12', stations: 'st2', antenna: 'x-band' }],
  ['ice', {}], ['ice', { orbit: 'sso-550', stations: 'st2', camera: 'radiometer', panels: 'solar-deploy-l', battery: 'batt-l' }],
  ['weather', {}], ['weather', { orbit: 'geo', rocket: 'heavy', body: 'smallsat', camera: 'cam-thermal', antenna: 'x-band', panels: 'solar-deploy-l', battery: 'batt-l' }],
  ['spaceweather', {}, false, 'nosafe'], ['spaceweather', {}, false, 'safe'], ['spaceweather', { computer: 'obc-rad', panels: 'solar-deploy-s', battery: 'batt-m', stations: 'st2' }, false, 'nosafe'],
  ['mapping', {}], ['mapping', { camera: 'cam-hires', antenna: 'x-band', body: 'smallsat', panels: 'solar-deploy-l', battery: 'batt-l', memory: 'm12', stations: 'st2' }, false, 'safe'],
];
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
async function run([id, patch, test = false, mode = 'safe']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(url);
  await page.waitForFunction(() => window.__g2dPlay);
  await page.evaluate(([id, patch, test]) => window.__g2dPlay(id, patch, test), [id, patch, test]);
  const res = await page.evaluate(async (mode) => {
    // the same bot as the sim tests (sim.ts botInput): nearest reachable target, dodge debris
    return await new Promise((done) => {
      const tick = () => {
        const s = window.__g3d ?? window.__g2d;
        const P = window.__g3d ? 'g3d' : 'g2d';
        if (!s || !window.__simBot) return setTimeout(tick, 50);
        if (s.ended) return setTimeout(() => done({ ...s.stats }), 50);
        const input = window.__simBot(s, mode === 'safe');
        for (let d = input.lane - s.lane; d !== 0; d -= Math.sign(d)) window[`__${P}Move`](Math.sign(d));
        window[`__${P}Safe`]?.(input.safe);
        setTimeout(tick, 40);
      };
      tick();
    });
  }, mode);
  await page.close();
  const short = Object.fromEntries(Object.entries(res).filter(([, v]) => v !== 0 && v !== false));
  console.log(url.includes('2d') ? '2D' : '3D', id.padEnd(13), (test ? 'TEST ' : '') + mode.padEnd(6), JSON.stringify(patch), '→', JSON.stringify(short));
}
const only = process.argv[3];
await Promise.all(RUNS.filter((r) => !only || r[0] === only).map(run));
await browser.close();
