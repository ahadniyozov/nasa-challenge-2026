import { create } from 'zustand';
import {
  canLaunch, computeBudgets, EXAMPLE_DESIGNS, monteCarlo, reviewDesign, scoreMission, simulateMission, STARTER_DESIGNS,
  type Budgets, type Issue, type MissionDesign, type MonteCarloResult, type Score, type SimResult,
} from '@mission/engine';

export type Phase = 'brief' | 'design' | 'launch' | 'ops' | 'report';
export type Role = 'director' | 'engineer' | 'science' | 'ops';

export const ROLES: { id: Role; name: string; short: string; color: string }[] = [
  { id: 'director', name: 'Flight Director', short: 'FD', color: '#f5c542' },
  { id: 'engineer', name: 'Spacecraft Engineer', short: 'ENG', color: '#4fc3f7' },
  { id: 'science', name: 'Science Lead', short: 'SCI', color: '#81c784' },
  { id: 'ops', name: 'Ops & Comms', short: 'OPS', color: '#ce93d8' },
];

interface Derived {
  budgets: Budgets | null;
  issues: Issue[];
  launchable: boolean;
}

function derive(design: MissionDesign): Derived {
  try {
    const budgets = computeBudgets(design);
    const issues = reviewDesign(budgets, design.reservePct);
    return { budgets, issues, launchable: canLaunch(issues) };
  } catch (e) {
    return { budgets: null, issues: [{ severity: 'error', resource: 'design', message: String(e) }], launchable: false };
  }
}

interface State extends Derived {
  phase: Phase;
  design: MissionDesign;
  role: Role;
  votes: Record<Role, boolean | null>;
  mc: MonteCarloResult | null;
  sim: SimResult | null;
  score: Score | null;
  seed: number;

  setPhase(p: Phase): void;
  startScenario(id: string): void;
  loadExample(): void;
  update(patch: Partial<MissionDesign>): void;
  addComponent(id: string): void;
  removeComponent(index: number): void;
  toggleStation(id: string): void;
  setRole(r: Role): void;
  vote(r: Role, go: boolean): void;
  runMonteCarlo(): void;
  launch(): void;
  finishOps(): void;
}

const noVotes = (): Record<Role, boolean | null> => ({ director: null, engineer: null, science: null, ops: null });

function designFromHash(): MissionDesign | null {
  try {
    const m = location.hash.match(/^#d=(.+)$/);
    return m ? (JSON.parse(atob(decodeURIComponent(m[1]))) as MissionDesign) : null;
  } catch {
    return null;
  }
}

export function shareUrl(design: MissionDesign): string {
  return `${location.origin}${location.pathname}#d=${encodeURIComponent(btoa(JSON.stringify(design)))}`;
}

const initial = designFromHash() ?? STARTER_DESIGNS['first-cubesat'];

export const useGame = create<State>((set, get) => {
  const change = (design: MissionDesign) => set({ design, ...derive(design), mc: null, votes: noVotes() });
  return {
    phase: designFromHash() ? 'design' : 'brief',
    design: initial,
    ...derive(initial),
    role: 'director',
    votes: noVotes(),
    mc: null,
    sim: null,
    score: null,
    seed: 1,

    setPhase: (phase) => set({ phase }),
    startScenario: (id) => {
      change(structuredClone(STARTER_DESIGNS[id]));
      set({ phase: 'design', sim: null, score: null });
    },
    loadExample: () => {
      const ex = EXAMPLE_DESIGNS[get().design.scenarioId];
      if (ex) change(structuredClone(ex));
    },
    update: (patch) => change({ ...get().design, ...patch }),
    addComponent: (id) => change({ ...get().design, components: [...get().design.components, id] }),
    removeComponent: (index) => change({ ...get().design, components: get().design.components.filter((_, i) => i !== index) }),
    toggleStation: (id) => {
      const s = get().design.groundStationIds;
      change({ ...get().design, groundStationIds: s.includes(id) ? s.filter((x) => x !== id) : [...s, id] });
    },
    setRole: (role) => set({ role }),
    vote: (r, go) => set({ votes: { ...get().votes, [r]: go } }),
    runMonteCarlo: () => set({ mc: monteCarlo(get().design, 400, Math.floor(Math.random() * 1e6)) }),
    launch: () => {
      const fixed = Number(new URLSearchParams(location.search).get('seed'));
      const seed = Number.isFinite(fixed) && fixed > 0 ? fixed : Math.floor(Math.random() * 1e9);
      const { design, budgets } = get();
      if (!budgets) return;
      const sim = simulateMission(design, seed, budgets);
      set({ seed, sim, score: scoreMission(budgets, sim), phase: 'launch' });
    },
    finishOps: () => set({ phase: 'report' }),
  };
});
