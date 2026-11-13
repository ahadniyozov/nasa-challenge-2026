import { create } from 'zustand';
import { canLaunch, computeBudgets, GROUND_STATIONS, reviewDesign, simulateMission, type Budgets, type SimResult } from '@mission/engine';
import { defaultChoices, LEVELS, STEPS, toDesign, type Choices } from './choices';
import { advise, meters, type Advice, type Meter } from './advice';

export type KidPhase = 'home' | 'build' | 'launch' | 'flight' | 'result';

export interface FlightResult {
  delivered: number;
  captured: number;
  survived: boolean;
  endText: string | null;
  lostInSpace: number;
  batteryOuts: number;
  missedFar: number;
  stormChoice: 'hide' | 'risk' | null;
}

interface Derived { budgets: Budgets; meters: Meter[]; advice: Advice[]; ready: boolean }
function derive(c: Choices): Derived {
  const budgets = computeBudgets(toDesign(c));
  const issues = reviewDesign(budgets, 0.1);
  return { budgets, meters: meters(budgets), advice: advise(budgets, bestStation(c, budgets)), ready: canLaunch(issues) };
}

/** Which extra ground station would help the most - so the crew can name it. */
export function bestStation(c: Choices, b: Budgets): { name: string; gain: number } | null {
  if (b.data.deliveredFraction >= 0.95) return null;
  let best: { name: string; gain: number } | null = null;
  for (const s of GROUND_STATIONS) {
    if (c.stations.includes(s.id)) continue;
    const f = computeBudgets(toDesign({ ...c, stations: [...c.stations, s.id] })).data.deliveredFraction;
    const gain = f - b.data.deliveredFraction;
    if (!best || gain > best.gain) best = { name: s.name, gain };
  }
  return best;
}

interface KidState extends Derived {
  phase: KidPhase;
  level: number;
  step: number;
  choices: Choices;
  sim: SimResult | null;
  result: FlightResult | null;
  unlocked: number;
  start(level: number): void;
  choose(patch: Partial<Choices>): void;
  goStep(i: number): void;
  launch(): void;
  setPhase(p: KidPhase): void;
  finish(r: FlightResult): void;
}

const first = defaultChoices(LEVELS[0].scenarioId);

export const useKid = create<KidState>((set, get) => ({
  phase: 'home',
  level: 0,
  step: 0,
  choices: first,
  ...derive(first),
  sim: null,
  result: null,
  unlocked: 0,
  start: (level) => {
    const choices = defaultChoices(LEVELS[level].scenarioId);
    set({ level, step: 0, choices, ...derive(choices), phase: 'build', sim: null, result: null });
  },
  choose: (patch) => {
    const choices = { ...get().choices, ...patch };
    set({ choices, ...derive(choices) });
  },
  goStep: (i) => set({ step: Math.max(0, Math.min(STEPS.length - 1, i)), phase: 'build' }),
  launch: () => {
    const fixed = Number(new URLSearchParams(location.search).get('seed'));
    const seed = Number.isFinite(fixed) && fixed > 0 ? fixed : Math.floor(Math.random() * 1e9);
    set({ sim: simulateMission(toDesign(get().choices), seed, get().budgets), phase: 'launch', result: null });
  },
  setPhase: (phase) => set({ phase }),
  finish: (result) => {
    const goal = LEVELS[get().level].goalPhotos;
    const unlocked = result.delivered >= goal ? Math.max(get().unlocked, get().level + 1) : get().unlocked;
    set({ result, phase: 'result', unlocked });
  },
}));

export function stars(r: FlightResult, goal: number): number {
  return (r.survived ? 1 : 0) + (r.delivered >= goal ? 1 : 0) + (r.delivered >= goal * 2 ? 1 : 0);
}

if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__kid = useKid;
