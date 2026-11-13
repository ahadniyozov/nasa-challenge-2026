// Core domain types for the mission engine.
// Units: mass kg, power W, energy Wh, money $M, data Mbps / GB, time years/minutes.

export type OrbitKind = 'LEO' | 'SSO' | 'MEO' | 'GEO';

export interface Orbit {
  id: string;
  name: string;
  kind: OrbitKind;
  altitudeKm: number;
  inclinationDeg: number;
  /** relative radiation dose (1 = typical LEO) */
  radiation: number;
  blurb: string;
}

export interface LaunchVehicle {
  id: string;
  name: string;
  /** payload capacity per orbit kind, kg (0 = cannot reach) */
  capacityKg: Partial<Record<OrbitKind, number>>;
  costM: number;
  /** rideshare: cost is per kg instead of a full vehicle */
  costPerKgM?: number;
  reliability: number;
  blurb: string;
}

export interface Bus {
  id: string;
  name: string;
  dryMassKg: number;
  maxPayloadKg: number;
  slots: number;
  baseLoadW: number;
  costM: number;
  designLifeYears: number;
  reliability: number; // per year survival probability of the structure + harness
  blurb: string;
}

export type Category = 'solar' | 'battery' | 'comms' | 'adcs' | 'computer' | 'propulsion' | 'instrument';

export interface ComponentBase {
  id: string;
  name: string;
  category: Category;
  massKg: number;
  /** continuous power draw in W (instruments: while operating) */
  powerW: number;
  costM: number;
  /** probability to survive one year */
  reliability: number;
  slots: number;
  blurb: string;
}

export interface SolarArray extends ComponentBase { category: 'solar'; areaM2: number; efficiency: number }
export interface Battery extends ComponentBase { category: 'battery'; capacityWh: number }
export interface Comms extends ComponentBase { category: 'comms'; band: 'UHF' | 'S' | 'X' | 'Ka'; downlinkMbps: number }
export interface Adcs extends ComponentBase { category: 'adcs'; pointingDeg: number }
export interface Computer extends ComponentBase { category: 'computer'; radHard: boolean }
export interface Propulsion extends ComponentBase { category: 'propulsion'; deltaVms: number }
export interface Instrument extends ComponentBase {
  category: 'instrument';
  /** data rate while observing */
  dataRateMbps: number;
  /** fraction of time the instrument observes */
  dutyCycle: number;
  /** abstract science points per year at full data return */
  scienceValue: number;
  /** ground resolution at 500 km altitude, metres (0 = not imaging) */
  resolutionAt500m: number;
  requiredPointingDeg: number;
  tags: string[];
}

export type Component = SolarArray | Battery | Comms | Adcs | Computer | Propulsion | Instrument;

export interface GroundStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  costPerYearM: number;
}

export interface Scenario {
  id: string;
  title: string;
  difficulty: 'tutorial' | 'normal' | 'hard' | 'sandbox';
  brief: string;
  budgetM: number;
  durationYears: number;
  allowedOrbits: string[];
  allowedBuses: string[];
  requirements: {
    maxResolutionM?: number;
    /** latitude the mission must observe (abs value, deg) */
    targetLatDeg?: number;
    requiredTags?: string[];
    minScience: number;
  };
}

export interface MissionDesign {
  scenarioId: string;
  busId: string;
  orbitId: string;
  launcherId: string;
  /** component ids; duplicates = redundancy */
  components: string[];
  groundStationIds: string[];
  /** cash reserve as fraction of budget kept for operations/anomalies */
  reservePct: number;
}

export type Severity = 'error' | 'warning' | 'info';
export type Resource = 'mass' | 'power' | 'budget' | 'data' | 'comms' | 'lifetime' | 'science' | 'launch' | 'design';

export interface Issue {
  severity: Severity;
  resource: Resource;
  message: string;
  hint?: string;
}
