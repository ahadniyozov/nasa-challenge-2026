// Bot playthroughs of the 2D missions: node scripts/bot-2d.mjs [url]
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
const browser = await chromium.launch();
async function run([id, patch, test = false, mode = 'safe']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(url);
  await page.waitForFunction(() => window.__g2dPlay);
  await page.evaluate(([id, patch, test]) => window.__g2dPlay(id, patch, test), [id, patch, test]);
  const res = await page.evaluate(async (mode) => {
    let lane = 1;
    return await new Promise((done) => {
      const tick = () => {
        const s = window.__g2d;
        if (!s) return setTimeout(tick, 50);
        if (s.ended) return setTimeout(() => done({ ...s.st, delivered: Math.floor(s.delivered) }), 50);
        const W = innerWidth, satX = W * 0.2;
        const ahead = s.objs.filter((o) => !o.done && o.x > satX - 5).sort((a, b) => a.x - b.x);
        const tgt = ahead.find((o) => o.kind === 'target' && o.lane >= 0 && o.x < satX + W * 0.7);
        let want = tgt ? tgt.lane : 1;
        const danger = (l) => ahead.some((o) => o.kind === 'debris' && o.lane === l && o.x - satX < 160);
        if (danger(want)) want = [0, 1, 2].filter((l) => !danger(l)).sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0] ?? want;
        while (lane < want) { window.__g2dMove(1); lane++; }
        while (lane > want) { window.__g2dMove(-1); lane--; }
        if (mode === 'safe') window.__g2dSafe?.(s.storm >= 1);
        setTimeout(tick, 40);
      };
      tick();
    });
  }, mode);
  await page.close();
  const short = Object.fromEntries(Object.entries(res).filter(([, v]) => v !== 0 && v !== false));
  console.log(id.padEnd(13), (test ? 'TEST ' : '') + mode.padEnd(6), JSON.stringify(patch), '→', JSON.stringify(short));
}
const only = process.argv[3];
await Promise.all(RUNS.filter((r) => !only || r[0] === only).map(run));
await browser.close();
