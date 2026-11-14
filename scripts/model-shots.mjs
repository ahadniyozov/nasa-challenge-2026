// 3D satellite model check in the browser: node scripts/model-shots.mjs [url] [outDir]
// For every mission and instrument it opens the 3D hangar with a small and a fully loaded satellite,
// saves a screenshot and checks the model's triangle budget (≤ 3000, TASKS-3D).
// Needs a running dev server (npm run dev -- --port 5199) and playwright.
// No bundled Chromium? Use an installed browser: PW_CHANNEL=msedge (or chrome).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2] ?? 'http://localhost:5199/?all';
const out = process.argv[3] ?? 'model-shots';
const BUDGET = 3000;
mkdirSync(out, { recursive: true });

const INSTRUMENTS = {
  first: ['cam-cubesat'],
  wildfire: ['cam-cubesat', 'cam-thermal', 'cam-hires'],
  ice: ['cam-cubesat', 'spectro', 'radiometer'],
  weather: ['cam-cubesat', 'cam-thermal', 'radiometer'],
  spaceweather: ['magnetometer', 'radiation-mon'],
  mapping: ['cam-cubesat', 'spectro', 'cam-hires'],
};
// a bare satellite and one with every big option (wings, dish, shield, thruster, hardened computer, big body)
const VARIANTS = {
  small: { body: 'auto', panels: 'solar-body', antenna: 'uhf', battery: 'batt-s', memory: 'm4', shield: 'none', thruster: 'none', computer: 'obc-cots' },
  full: { body: 'smallsat', panels: 'solar-deploy-l', antenna: 'x-band', battery: 'batt-l', memory: 'm12', shield: 'shield', thruster: 'prop-cold', computer: 'obc-rad' },
};

const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForFunction(() => window.__g2dBuild);

let worst = 0, over = 0;
for (const [mission, cams] of Object.entries(INSTRUMENTS)) {
  for (const camera of cams) {
    for (const [variant, patch] of Object.entries(VARIANTS)) {
      await page.evaluate(([m, p]) => window.__g2dBuild(m, p), [mission, { ...patch, camera }]);
      await page.waitForFunction(() => typeof window.__g3dModelTriangles === 'function' && window.__g3dModelTriangles() > 0, null, { timeout: 30000 });
      await page.waitForTimeout(700); // camera fly-in
      const tris = await page.evaluate(() => window.__g3dModelTriangles());
      const file = `${out}/${mission}-${camera}-${variant}.png`;
      await page.locator('.g3d-hangar-canvas').screenshot({ path: file });
      worst = Math.max(worst, tris);
      if (tris > BUDGET) over++;
      console.log(`${tris > BUDGET ? '❌' : '✅'} ${mission.padEnd(13)} ${camera.padEnd(14)} ${variant.padEnd(6)} ${String(tris).padStart(5)} triangles → ${file}`);
    }
  }
}
await browser.close();
console.log(`\nWorst model: ${worst} triangles (budget ${BUDGET}). Page errors: ${errors.length ? errors.join(' | ') : 'none'}`);
process.exit(over || errors.length ? 1 : 0);
