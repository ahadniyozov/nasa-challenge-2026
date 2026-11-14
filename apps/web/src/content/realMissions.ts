// "In real life" cards: the real NASA mission that does the same job as each game mission.
// Every fact was checked against the linked NASA page (checked 2026-11-14). Keep facts short and verifiable.
// Texts are English keys for t(); Russian is in i18n/ru-content.ts.

/** Which schematic to draw (no photos: just Earth and the orbit). */
export type OrbitSketch = 'low' | 'polar' | 'geo' | 'belts';

export interface RealMission {
  name: string;
  /** one line: why this mission is the real version of the game mission */
  same: string;
  facts: string[];
  sketch: OrbitSketch;
  url: string;
  /** what the link is, shown on the button */
  site: string;
}

export const REAL_MISSIONS: Record<string, RealMission> = {
  first: {
    name: 'NASA CubeSat Launch Initiative',
    same: 'Real student teams fly their first CubeSats just like you did.',
    facts: [
      'NASA offers launches to CubeSats built by U.S. schools, universities, non-profits and museums.',
      'The initiative has launched over 150 CubeSats.',
      'CubeSats ride along with bigger satellites on the same rocket - a "rideshare".',
    ],
    sketch: 'low',
    url: 'https://www.nasa.gov/kennedy/launch-services-program/cubesat-launch-initiative/',
    site: 'nasa.gov',
  },
  wildfire: {
    name: 'MODIS & VIIRS (NASA FIRMS)',
    same: 'Heat-sensing instruments on polar-orbiting satellites find fires all over the world.',
    facts: [
      'MODIS and VIIRS spot fires by their heat: each VIIRS fire dot covers a 375 m pixel, MODIS 1 km.',
      'NASA FIRMS delivers fire locations worldwide within 3 hours of the satellite passing over.',
      'FIRMS has been running since 2007 and is used by fire services around the world.',
    ],
    sketch: 'polar',
    url: 'https://www.earthdata.nasa.gov/data/tools/firms',
    site: 'earthdata.nasa.gov',
  },
  ice: {
    name: 'ICESat-2',
    same: 'A polar-orbiting satellite that measures glaciers and sea ice near the poles.',
    facts: [
      'Launched on September 15, 2018.',
      'Its laser fires 10,000 pulses a second and measures the height of ice sheets, glaciers and sea ice.',
      'It flies a polar orbit, so it passes over the Arctic and Antarctica - just like your Svalbard mission.',
    ],
    sketch: 'polar',
    url: 'https://science.nasa.gov/mission/icesat-2/',
    site: 'science.nasa.gov',
  },
  weather: {
    name: 'GOES weather satellites',
    same: 'Geostationary satellites watch hurricanes nonstop - the same orbit choice you made.',
    facts: [
      'GOES satellites orbit 22,236 miles (35,786 km) above the equator and turn with the Earth.',
      'NASA builds and launches GOES; NOAA operates them for weather forecasts.',
      'They track hurricanes over the Atlantic and Pacific oceans. GOES-16 launched in 2016.',
    ],
    sketch: 'geo',
    url: 'https://science.nasa.gov/mission/goes',
    site: 'science.nasa.gov',
  },
  spaceweather: {
    name: 'Van Allen Probes',
    same: 'Two spacecraft flew right through Earth\'s radiation belts - with radiation-hardened computers.',
    facts: [
      'Launched on August 30, 2012: two identical spacecraft, A and B.',
      'Built with radiation-hardened parts, they worked in the radiation belts for almost 7 years - planned for 2.',
      'They discovered that a temporary third radiation belt can form during strong solar activity.',
    ],
    sketch: 'belts',
    url: 'https://science.nasa.gov/mission/van-allen-probes/',
    site: 'science.nasa.gov',
  },
  mapping: {
    name: 'Landsat',
    same: 'Landsat has mapped Earth\'s land from space for over 50 years.',
    facts: [
      'The first Landsat launched on July 23, 1972. NASA and the U.S. Geological Survey run it together.',
      'Landsat 9 sees 30 m pixels (15 m in black-and-white) from 705 km up.',
      'Landsat 8 and 9 together photograph every place on Earth every 8 days.',
    ],
    sketch: 'polar',
    url: 'https://science.nasa.gov/mission/landsat-9/',
    site: 'science.nasa.gov',
  },
};
