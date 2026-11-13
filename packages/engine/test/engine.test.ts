import { describe, expect, it } from 'vitest';
import { canLaunch, computeBudgets, monteCarlo, physics as P, reviewDesign, scoreMission, simulateMission, STARTER_DESIGNS, WILDFIRE_REFERENCE } from '../src';

describe('physics', () => {
  it('ISS-like orbit has ~92 min period', () => {
    expect(P.periodMin(400)).toBeGreaterThan(91);
    expect(P.periodMin(400)).toBeLessThan(93.5);
  });
  it('GEO period is one sidereal day', () => {
    expect(P.periodMin(35786)).toBeCloseTo(1436, 0);
  });
  it('LEO eclipse is ~35 min', () => {
    expect(P.eclipseMinutes(400)).toBeGreaterThan(33);
    expect(P.eclipseMinutes(400)).toBeLessThan(38);
  });
  it('polar station sees a polar orbit more often than an equatorial one', () => {
    expect(P.passesPerDay(550, 97.6, 78)).toBeGreaterThan(P.passesPerDay(550, 97.6, 38));
  });
  it('ISS inclination never reaches Svalbard', () => {
    expect(P.passesPerDay(400, 51.6, 78.2)).toBe(0);
  });
  it('drag lifetime grows with altitude', () => {
    expect(P.dragLifetimeYears(400)).toBeLessThan(P.dragLifetimeYears(550));
  });
});

describe('design review', () => {
  it('reference wildfire design is launchable', () => {
    const b = computeBudgets(WILDFIRE_REFERENCE);
    const issues = reviewDesign(b, WILDFIRE_REFERENCE.reservePct);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(canLaunch(issues)).toBe(true);
  });
  it('wildfire starter design has problems to fix', () => {
    const d = STARTER_DESIGNS.wildfire;
    const issues = reviewDesign(computeBudgets(d), d.reservePct);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => i.resource === 'science' || i.resource === 'data')).toBe(true);
  });
  it('detects missing essentials', () => {
    const issues = reviewDesign(computeBudgets({ ...WILDFIRE_REFERENCE, components: ['spectro'] }), 0.2);
    expect(issues.filter((i) => i.severity === 'error').length).toBeGreaterThanOrEqual(4);
  });
});

describe('simulation', () => {
  it('is deterministic for a seed', () => {
    const a = simulateMission(WILDFIRE_REFERENCE, 42);
    const b = simulateMission(WILDFIRE_REFERENCE, 42);
    expect(a).toEqual(b);
  });
  it('reference design usually succeeds; starter design is worse', () => {
    const good = monteCarlo(WILDFIRE_REFERENCE, 200);
    const bad = monteCarlo(STARTER_DESIGNS.wildfire, 200);
    expect(good.successProbability).toBeGreaterThan(0.6);
    expect(good.meanScience).toBeGreaterThan(bad.meanScience);
  });
  it('scores and explains', () => {
    const b = computeBudgets(WILDFIRE_REFERENCE);
    const s = scoreMission(b, simulateMission(WILDFIRE_REFERENCE, 7, b));
    expect(s.lessons.length).toBeGreaterThan(0);
    expect(['S', 'A', 'B', 'C', 'D', 'F']).toContain(s.grade);
  });
});
