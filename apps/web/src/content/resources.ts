// NASA resources and data used by the game, and where exactly they appear. Links checked 2026-11-14.
// Texts are English keys for t(); Russian is in i18n/ru-content.ts.

export interface Resource {
  emoji: string;
  title: string;
  /** where it is used in the game */
  where: string;
  url?: string;
}

export interface ResourceGroup { title: string; items: Resource[] }

export const RESOURCES: ResourceGroup[] = [
  {
    title: 'NASA data in the game',
    items: [
      {
        emoji: '🌍', title: 'NASA Blue Marble',
        where: 'The daytime Earth map you fly over in every mission.',
        url: 'https://science.nasa.gov/earth/earth-observatory/collections/blue-marble',
      },
      {
        emoji: '🌃', title: 'NASA Black Marble (Earth at Night)',
        where: 'The city lights you see when the satellite flies through Earth\'s shadow.',
        url: 'https://www.earthdata.nasa.gov/data/projects/black-marble',
      },
      {
        emoji: '☁️', title: 'Earth textures by Solar System Scope (CC BY 4.0)',
        where: 'The 8K versions of the NASA day map, night lights, clouds and ocean mask used for the globe in flight.',
        url: 'https://www.solarsystemscope.com/textures/',
      },
    ],
  },
  {
    title: 'NASA guides behind the game rules',
    items: [
      {
        emoji: '📘', title: 'NASA CubeSat 101',
        where: 'Part sizes, masses and prices of CubeSats; the rideshare rocket; mission 1.',
        url: 'https://www.nasa.gov/wp-content/uploads/2017/03/nasa_csli_cubesat_101_508.pdf',
      },
      {
        emoji: '🛰️', title: 'NASA Small Spacecraft Systems Virtual Institute',
        where: 'Typical small-satellite parts: batteries, solar panels, radios, computers.',
        url: 'https://www.nasa.gov/smallsat-institute/',
      },
      {
        emoji: '🧪', title: 'NASA: Design and Develop Science Missions',
        where: 'Mission 2: matching the instrument, orbit and data link to the customer\'s needs.',
        // NASA S3VI Systems Engineering Series, session 4 (slides)
        url: 'https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf',
      },
      {
        emoji: '🧭', title: 'NASA Mission Design Lab: orbit design, radiation and trade studies',
        where: 'Missions 3, 5 and 6: orbit tilt vs. latitude, radiation and safe mode, the tight budget.',
        url: 'https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/',
      },
      {
        emoji: '🎞️', title: 'NASA Mission Viz: orbits and timelines',
        where: 'Mission 4: why a geostationary orbit watches one place nonstop.',
        // NASA Web-based Space Mission Visualization (github.com/nasa/mission-viz)
        url: 'https://nasa.github.io/mission-viz/',
      },
    ],
  },
  {
    title: 'Real missions in the "In real life" cards',
    items: [
      { emoji: '📸', title: 'NASA CubeSat Launch Initiative', where: 'Mission 1 report.', url: 'https://www.nasa.gov/kennedy/launch-services-program/cubesat-launch-initiative/' },
      { emoji: '🔥', title: 'NASA FIRMS (MODIS & VIIRS)', where: 'Mission 2 report.', url: 'https://www.earthdata.nasa.gov/data/tools/firms' },
      { emoji: '🧊', title: 'ICESat-2', where: 'Mission 3 report.', url: 'https://science.nasa.gov/mission/icesat-2/' },
      { emoji: '🌀', title: 'GOES', where: 'Mission 4 report.', url: 'https://science.nasa.gov/mission/goes' },
      { emoji: '☀️', title: 'Van Allen Probes', where: 'Mission 5 report.', url: 'https://science.nasa.gov/mission/van-allen-probes/' },
      { emoji: '🏙️', title: 'Landsat 9', where: 'Mission 6 report.', url: 'https://science.nasa.gov/mission/landsat-9/' },
    ],
  },
  {
    title: 'The physics the game computes',
    items: [
      { emoji: '🌑', title: 'Earth\'s shadow', where: 'The dark part of each orbit comes from real orbit geometry (about 37% at 550 km, 5% at 36,000 km).' },
      { emoji: '🪂', title: 'Air drag', where: 'Low orbits slowly fall: at 400 km a satellite comes down in about a year.' },
      { emoji: '📡', title: 'Ground station passes', where: 'How often the satellite flies over the stations you chose.' },
      { emoji: '🧭', title: 'Orbit tilt (inclination)', where: 'Which latitudes an orbit can see - why the polar ice mission needs a polar orbit.' },
    ],
  },
];

export const SPACE_APPS_URL = 'https://www.spaceappschallenge.org/2026/';
