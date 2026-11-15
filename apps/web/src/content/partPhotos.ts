// Real NASA photos of the hardware behind the game's parts (NASA Image and Video Library, images.nasa.gov).
// NASA images are generally not copyrighted; we credit the source and do not imply NASA endorsement.
// Photos were chosen without people in the frame (gloved hands only). Files: public/parts/*.webp (resized, cropped).
// Texts are English keys for t(); Russian is in i18n/ru-ui.ts.

export interface PartPhoto {
  file: string;
  caption: string;
  credit: string;
  nasaId: string;
}

const P = (file: string, caption: string, credit: string, nasaId: string): PartPhoto => ({ file, caption, credit, nasaId });

const CUBESAT = P('cubesat', 'Neutron-1, a 3U CubeSat, before flight (2020)', 'NASA/JSC', 'jsc2020e012430');
const BATTERY = P('batt', 'Flight battery of the Deep Impact spacecraft before installation (2004)', 'NASA/KSC', '04pd2541');
const STATION = P('stations', 'Deep Space Network antenna DSS-53 in Madrid (2022)', 'NASA/JPL-Caltech', 'PIA25136');

/** option id of a slot → photo of the real thing */
export const PART_PHOTOS: Record<string, PartPhoto> = {
  // body
  auto: CUBESAT,
  smallsat: P('smallsat', 'A GRACE-FO satellite in the clean room (2018)', 'NASA/JPL-Caltech', 'PIA22339'),
  // solar panels
  'solar-body': CUBESAT,
  'solar-deploy-s': P('solar-deploy-s', 'RainCube, a 6U CubeSat, with its panels and antenna deployed (2018)', 'NASA/JPL-Caltech', 'PIA22457'),
  'solar-deploy-l': P('solar-deploy-l', 'Solar array deployment test of the GPM satellite', 'NASA/Goddard', 'GSFC_20171208_Archive_e001330'),
  // battery
  'batt-s': BATTERY, 'batt-m': BATTERY, 'batt-l': BATTERY,
  // antenna
  'x-band': P('x-band', 'High-gain antenna of the Dawn spacecraft (2009)', 'NASA/JPL-Caltech', 'PIA12024'),
  // thruster
  'prop-cold': P('prop-cold', 'AQT-D, a CubeSat with a water thruster, leaves the Space Station (2019)', 'NASA/JSC', 'iss061e051961'),
  // instruments
  'cam-thermal': P('cam-thermal', 'TIRS thermal infrared sensor of the Landsat 8 satellite', 'NASA/Goddard', 'GSFC_20171208_Archive_e001784'),
  'radiation-mon': P('radiation-mon', 'RAD radiation detector of the Curiosity rover (2010)', 'NASA/JPL-Caltech', 'PIA13580'),
  magnetometer: P('magnetometer', 'Magnetometer on its boom, Gemini 12 experiment (1966)', 'NASA/JSC', 's66-09379'),
  // rockets
  rideshare: P('rideshare', 'Rocket Lab Electron with two NASA TROPICS CubeSats (2023)', 'NASA', 'KSC-20230507-PH-RLS01_0006'),
  medium: P('medium', 'Atlas V with the Landsat 9 satellite at the launch pad (2021)', 'NASA', 'KSC-20210927-PH-KLS01_0075'),
  heavy: P('heavy', 'SLS rocket and Orion for Artemis I at Launch Pad 39B (2022)', 'NASA', 'KSC-20220411-PH-JBS01_0004'),
  // ground stations
  st1: STATION, st2: STATION, st3: STATION,
};

export const photoUrl = (p: PartPhoto) => `${import.meta.env.BASE_URL}parts/${p.file}.webp`;
export const sourceUrl = (p: PartPhoto) => `https://images.nasa.gov/details/${encodeURIComponent(p.nasaId)}`;
