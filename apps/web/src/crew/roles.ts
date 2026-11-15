// Crew mode: the four mission-control roles and the parts each one decides. Shared by the web game and the server.
import type { SlotId } from '../game2d/config';

export const ROLES = ['director', 'engineer', 'scientist', 'comms'] as const;
export type Role = (typeof ROLES)[number];

/** which role decides each part */
export const OWNER: Record<SlotId, Role> = {
  rocket: 'director', orbit: 'director',
  body: 'engineer', panels: 'engineer', battery: 'engineer', shield: 'engineer', thruster: 'engineer',
  camera: 'scientist', memory: 'scientist', computer: 'scientist',
  antenna: 'comms', stations: 'comms',
};

export const ROLE_TITLE: Record<Role, string> = {
  director: 'Flight director', engineer: 'Spacecraft engineer', scientist: 'Mission scientist', comms: 'Communications',
};
/** what the role does, in one line (lobby) */
export const ROLE_JOB: Record<Role, string> = {
  director: 'Rocket, orbit and the budget. Calls the GO / NO-GO poll and flies the satellite.',
  engineer: 'Body, solar panels, battery, shield and thruster. Turns on safe mode in solar storms.',
  scientist: 'The instrument, memory and computer. Watches the data come in.',
  comms: 'The antenna and ground stations. Watches the downlink.',
};

export type Phase = 'lobby' | 'build' | 'poll' | 'launch' | 'flight' | 'report';
export interface CrewPlayer { id: string; name: string; roles: Role[]; online: boolean }
export interface CrewState {
  code: string; phase: Phase; missionId: string; build: import('../game2d/config').Build;
  votes: Partial<Record<Role, boolean>>; noGo: Role[]; seed: number; run: number; stats: unknown; test: boolean;
  players: CrewPlayer[];
}

/** what the flight director's browser streams to the crew ten times a second */
export interface Snapshot {
  t: number; battery: number; memory: number; delivered: number; hearts: number;
  shadow: boolean; contact: boolean; safe: boolean; asleep: boolean; storm: 0 | 1 | 2; laneY: number;
  /** objects ahead: [kind (t target, d debris, s station), lane, seconds ahead] */
  objs: [string, number, number][];
  log: { id: number; text: string; tone: string }[];
}

export const CALLS = ['debris-left', 'debris-centre', 'debris-right', 'target-left', 'target-right', 'storm', 'safe-on', 'safe-off'] as const;
export const CALL_TEXT: Record<string, string> = {
  'debris-left': 'Debris, left lane', 'debris-centre': 'Debris, centre lane', 'debris-right': 'Debris, right lane',
  'target-left': 'Target on the left', 'target-right': 'Target on the right',
  storm: 'Solar storm coming', 'safe-on': 'Safe mode on', 'safe-off': 'Safe mode off',
};
