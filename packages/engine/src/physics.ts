// Simplified orbital & spacecraft physics. Every function is pure and documented
// so the in-game "Why?" explanations can quote the same formulas.

export const EARTH_RADIUS_KM = 6371;
export const MU_EARTH = 398600.4418; // km^3/s^2
export const SOLAR_CONSTANT = 1361; // W/m^2 at 1 AU
const DEG = Math.PI / 180;

/** Orbital period of a circular orbit, minutes: T = 2*pi*sqrt(a^3/mu) */
export function periodMin(altitudeKm: number): number {
  const a = EARTH_RADIUS_KM + altitudeKm;
  return (2 * Math.PI * Math.sqrt(a ** 3 / MU_EARTH)) / 60;
}

export function orbitsPerDay(altitudeKm: number): number {
  return 1440 / periodMin(altitudeKm);
}

/** Orbital speed, km/s: v = sqrt(mu/a) */
export function orbitalSpeedKms(altitudeKm: number): number {
  return Math.sqrt(MU_EARTH / (EARTH_RADIUS_KM + altitudeKm));
}

/**
 * Worst-case fraction of each orbit spent in Earth's shadow (sun in the orbit plane, beta = 0):
 * f = asin(R / (R + h)) / pi. For GEO we use the equinox-season worst case (~72 min per day).
 */
export function eclipseFraction(altitudeKm: number): number {
  return Math.asin(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm)) / Math.PI;
}

export function eclipseMinutes(altitudeKm: number): number {
  return periodMin(altitudeKm) * eclipseFraction(altitudeKm);
}

/**
 * Earth-central half-angle (rad) of the circle on the ground from which the satellite
 * is seen above `minElevationDeg`.
 */
export function visibilityHalfAngle(altitudeKm: number, minElevationDeg = 10): number {
  const e = minElevationDeg * DEG;
  const r = EARTH_RADIUS_KM;
  return Math.acos((r * Math.cos(e)) / (r + altitudeKm)) - e;
}

/** Maximum duration of one ground-station pass (overhead), minutes. */
export function maxPassMin(altitudeKm: number): number {
  return (periodMin(altitudeKm) * visibilityHalfAngle(altitudeKm)) / Math.PI;
}

/**
 * Expected number of passes per day over a station at latitude `latDeg`.
 * Ground tracks are spaced 360/n degrees of longitude; a station sees the satellite when a
 * track falls within the visibility circle. Polar stations see polar orbits on most revolutions.
 */
export function passesPerDay(altitudeKm: number, inclinationDeg: number, latDeg: number): number {
  const lambdaDeg = visibilityHalfAngle(altitudeKm) / DEG;
  const reach = (inclinationDeg <= 90 ? inclinationDeg : 180 - inclinationDeg) + lambdaDeg;
  if (Math.abs(latDeg) > reach) return 0;
  const n = orbitsPerDay(altitudeKm);
  const cosLat = Math.max(Math.cos(latDeg * DEG), 0.05);
  const perDirection = Math.min(n, (n * 2 * lambdaDeg) / (360 * cosLat));
  return 2 * perDirection;
}

/** Contact minutes per day between a satellite and one ground station. */
export function contactMinPerDay(altitudeKm: number, inclinationDeg: number, latDeg: number): number {
  if (altitudeKm > 30000) {
    // Geostationary: continuous contact if the station sees the equator high enough.
    return Math.abs(latDeg) < 70 ? 1440 : 0;
  }
  const passes = passesPerDay(altitudeKm, inclinationDeg, latDeg);
  const avgPass = 0.65 * maxPassMin(altitudeKm); // average pass is shorter than overhead
  return Math.min(1440, passes * avgPass);
}

/** Highest |latitude| the ground track reaches, plus the instrument view half-width. */
export function maxObservedLatitude(inclinationDeg: number): number {
  return inclinationDeg <= 90 ? inclinationDeg : 180 - inclinationDeg;
}

/**
 * Link rate falls with distance squared; we soften it (radios get bigger antennas
 * for far orbits) to a linear law, referenced to 1,500 km slant range.
 */
export function linkDistanceFactor(altitudeKm: number): number {
  return Math.min(1, 1500 / Math.max(altitudeKm, 1));
}

/**
 * Natural orbital lifetime from atmospheric drag for a typical small satellite, years.
 * Log-interpolated table (strongly depends on solar activity and satellite density).
 */
const DRAG_TABLE: [number, number][] = [
  [200, 0.005], [300, 0.1], [400, 1], [500, 5], [550, 10], [600, 25], [700, 100], [800, 200], [1000, 1000],
];
export function dragLifetimeYears(altitudeKm: number): number {
  if (altitudeKm >= 1000) return 1000;
  if (altitudeKm <= DRAG_TABLE[0][0]) return DRAG_TABLE[0][1];
  for (let i = 1; i < DRAG_TABLE.length; i++) {
    const [h1, y1] = DRAG_TABLE[i];
    const [h0, y0] = DRAG_TABLE[i - 1];
    if (altitudeKm <= h1) {
      const t = (altitudeKm - h0) / (h1 - h0);
      return Math.exp(Math.log(y0) + t * (Math.log(y1) - Math.log(y0)));
    }
  }
  return 1000;
}

/** Delta-v per year needed to hold altitude against drag, m/s. */
export function dragMakeupDvPerYear(altitudeKm: number): number {
  return 25 / dragLifetimeYears(altitudeKm);
}

/** Ground pixel size scales linearly with distance. */
export function resolutionAt(resolutionAt500m: number, altitudeKm: number): number {
  return (resolutionAt500m * altitudeKm) / 500;
}

/** Convert a data rate in Mbit/s sustained for `seconds` to gigabytes. */
export function mbpsToGB(mbps: number, seconds: number): number {
  return (mbps * seconds) / 8 / 1000;
}
