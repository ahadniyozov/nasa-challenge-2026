// Simple mode (apps/web/src/kid) must agree with the engine: a kid sees "must fix" exactly when the engine blocks launch.
import { describe, expect, it } from 'vitest';
import { canLaunch, computeBudgets, reviewDesign } from '../src';
import { defaultChoices, LEVELS, STEPS, toDesign } from '../../../apps/web/src/kid/choices';
import { advise } from '../../../apps/web/src/kid/advice';

const opt = (id: string) => STEPS.find((s) => s.id === id)!.options.map((o) => o.id);

describe('simple mode', () => {
  for (const L of LEVELS) {
    it(`${L.scenarioId}: advice matches engine errors and the level is winnable`, () => {
      let ready = 0;
      for (const orbit of opt('orbit')) for (const size of opt('size')) for (const camera of opt('camera')) for (const energy of opt('energy'))
        for (const antenna of opt('antenna')) for (const rocket of opt('rocket')) for (const stations of [['krasnoyarsk'], ['svalbard', 'alaska']]) {
          const b = computeBudgets(toDesign({ ...defaultChoices(L.scenarioId), orbit, size, camera, energy, antenna, rocket, stations }));
          const ok = canLaunch(reviewDesign(b, 0.1));
          expect(advise(b).some((a) => a.level === 'bad')).toBe(!ok);
          if (ok) ready++;
        }
      expect(ready).toBeGreaterThan(5);
    });
  }
  it('tutorial default needs only one fix', () => {
    const b = computeBudgets(toDesign(defaultChoices('first-cubesat')));
    expect(advise(b).filter((a) => a.level === 'bad')).toHaveLength(1);
  });
});
