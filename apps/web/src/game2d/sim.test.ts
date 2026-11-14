import { describe, expect, it } from 'vitest';
import { analyse, type Build } from './config';
import { missionById, MISSIONS } from './missions';
import { botInput, createSim, runSim, stepSim, type SimInput } from './sim';
import { SOLUTIONS } from './solutions';

const SEEDS = [1, 2, 3, 4, 5];
const flight = (id: string, patch: Partial<Build> = {}, test = false) => {
  const m = missionById.get(id)!;
  return { m, p: analyse({ ...(test ? m.test ?? m.start : m.start), ...patch } as Build, m).flight };
};

describe('sim', () => {
  it('the starting satellite of mission 1 delivers no photos (the radio is too slow)', () => {
    const { m, p } = flight('first', {}, true);
    for (const seed of SEEDS) expect(runSim(p, m, seed, (s) => botInput(s, true)).stats.delivered).toBe(0);
  });

  for (const m of MISSIONS) {
    it(`the reference design solves "${m.id}" with good flying`, () => {
      const { p } = flight(m.id, SOLUTIONS[m.id]);
      for (const seed of SEEDS) {
        const st = runSim(p, m, seed, (s) => botInput(s, true)).stats;
        expect(st.survived, `seed ${seed}`).toBe(true);
        expect(st.delivered, `seed ${seed}`).toBeGreaterThanOrEqual(m.goal);
      }
    });
  }

  it('mission 3 in a 400 km orbit never reaches the glaciers', () => {
    const { m, p } = flight('ice', { orbit: 'leo-400' });
    const st = runSim(p, m, 1, (s) => botInput(s, true)).stats;
    expect(st.outOfReach).toBeGreaterThan(0);
    expect(st.captured).toBe(0);
  });

  it('solar storms crash a normal computer unless safe mode is on', () => {
    const { m, p } = flight('spaceweather');
    expect(runSim(p, m, 1, (s) => botInput(s, false)).stats.stormHits).toBe(m.storms);
    const safe = runSim(p, m, 1, (s) => botInput(s, true)).stats;
    expect(safe.stormHits).toBe(0);
    expect(safe.stormsSafe).toBe(m.storms);
  });

  it('the same seed and input give the same flight at any frame rate', () => {
    const { m, p } = flight('wildfire', SOLUTIONS.wildfire);
    const a = runSim(p, m, 42, (s) => botInput(s, true), 60).stats;
    expect(runSim(p, m, 42, (s) => botInput(s, true), 60).stats).toEqual(a);
    // a fixed simulation step: uneven frames do not change the rules
    const s = createSim(p, m, 7), u = createSim(p, m, 7);
    const input: SimInput = { lane: 1, safe: false };
    for (let i = 0; i < 2000; i++) { stepSim(s, 1 / 30, input); stepSim(u, 1 / 60, input); stepSim(u, 1 / 60, input); }
    expect(u.stats).toEqual(s.stats);
    expect(u.objects.map((o) => o.id)).toEqual(s.objects.map((o) => o.id));
  });

  it('events report what happened this frame only', () => {
    const { m, p } = flight('first', SOLUTIONS.first);
    const s = createSim(p, m, 3);
    let photos = 0;
    while (!s.ended) { stepSim(s, 1 / 60, botInput(s, true)); photos += s.events.filter((e) => e.type === 'photo').length; }
    expect(photos).toBe(s.stats.captured);
    expect(s.events.some((e) => e.type === 'end')).toBe(true);
  });
});
