import type { MissionDesign } from './types';

/** Starting designs: one per scenario, deliberately imperfect so players have something to fix. */
export const STARTER_DESIGNS: Record<string, MissionDesign> = {
  'first-cubesat': {
    scenarioId: 'first-cubesat', busId: 'cubesat-3u', orbitId: 'leo-400', launcherId: 'rideshare',
    components: ['solar-body', 'batt-s', 'uhf', 'adcs-mag', 'obc-cots', 'cam-cubesat'],
    groundStationIds: ['krasnoyarsk'], reservePct: 0.1,
  },
  wildfire: {
    scenarioId: 'wildfire', busId: 'smallsat', orbitId: 'leo-400', launcherId: 'medium',
    components: ['solar-deploy-l', 'batt-l', 's-band', 'adcs-rw', 'obc-cots', 'cam-thermal', 'spectro'],
    groundStationIds: ['wallops'], reservePct: 0.05,
  },
  sandbox: {
    scenarioId: 'sandbox', busId: 'smallsat', orbitId: 'sso-550', launcherId: 'rideshare',
    components: ['solar-deploy-l', 'batt-l', 'batt-l', 'ka-band', 'x-band', 'adcs-rw', 'obc-rad', 'cam-hires'],
    groundStationIds: ['svalbard', 'troll'], reservePct: 0.2,
  },
};

/** A reference "good" design for the wildfire scenario - used in tests and as a hint. */
export const WILDFIRE_REFERENCE: MissionDesign = {
  scenarioId: 'wildfire', busId: 'smallsat', orbitId: 'sso-550', launcherId: 'rideshare',
  components: ['solar-deploy-l', 'batt-l', 'x-band', 's-band', 'adcs-rw', 'obc-rad', 'cam-thermal', 'spectro', 'prop-cold'],
  groundStationIds: ['svalbard', 'alaska', 'krasnoyarsk'], reservePct: 0.15,
};

/** Working example per scenario, offered by the "Show a working example" button. */
export const EXAMPLE_DESIGNS: Record<string, MissionDesign> = {
  'first-cubesat': {
    scenarioId: 'first-cubesat', busId: 'cubesat-3u', orbitId: 'sso-550', launcherId: 'rideshare',
    components: ['solar-body', 'batt-s', 's-band', 'adcs-rw', 'obc-cots', 'cam-cubesat'],
    groundStationIds: ['krasnoyarsk', 'svalbard'], reservePct: 0.15,
  },
  wildfire: WILDFIRE_REFERENCE,
  sandbox: STARTER_DESIGNS.sandbox,
};
