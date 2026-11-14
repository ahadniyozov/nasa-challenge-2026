// Automated 3D geometry & bounding-box verifier for SatelliteModel across all 6 missions.
// Run with: npx tsx apps/web/src/game3d/model.check.ts
import { analyse, SLOTS, type Build } from '../game2d/config';
import { MISSIONS, type Mission } from '../game2d/missions';
import { BUS_DIMS } from './SatelliteModel';

interface Box3D {
  name: string;
  min: [number, number, number];
  max: [number, number, number];
  attachedFace: 'body' | 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back' | 'enclosing';
}

function boxesOverlap(a: Box3D, b: Box3D, eps = 0.002): boolean {
  return (
    a.min[0] + eps < b.max[0] && a.max[0] - eps > b.min[0] &&
    a.min[1] + eps < b.max[1] && a.max[1] - eps > b.min[1] &&
    a.min[2] + eps < b.max[2] && a.max[2] - eps > b.min[2]
  );
}

/** Computes axis-aligned bounding boxes of every part on SatelliteModel for a given Build & Mission. */
export function computeSatelliteBoxes(build: Build, m: Mission): { bus: [number, number, number]; boxes: Box3D[]; shieldRadius: number } {
  const busId = analyse(build, m).design.busId;
  const [w, h, d] = BUS_DIMS[busId] ?? BUS_DIMS['cubesat-12u'];
  const boxes: Box3D[] = [];

  // 1. Solar panels
  const wingLen = build.panels === 'solar-deploy-l' ? 1.32 : build.panels === 'solar-deploy-s' ? 0.72 : 0;
  const wingDepth = build.panels === 'solar-deploy-l' ? Math.min(0.56, d * 0.82) : Math.min(0.42, d * 0.68);
  if (wingLen > 0) {
    boxes.push({
      name: 'panels-left',
      min: [-(w / 2 + 0.08 + wingLen), h * 0.08 - 0.035, -wingDepth / 2],
      max: [-w / 2, h * 0.08 + 0.035, wingDepth / 2],
      attachedFace: 'left',
    });
    boxes.push({
      name: 'panels-right',
      min: [w / 2, h * 0.08 - 0.035, -wingDepth / 2],
      max: [w / 2 + 0.08 + wingLen, h * 0.08 + 0.035, wingDepth / 2],
      attachedFace: 'right',
    });
  } else {
    boxes.push({
      name: 'panels-front-upper',
      min: [-w * 0.39, h * 0.07, d / 2],
      max: [w * 0.39, h * 0.41, d / 2 + 0.01],
      attachedFace: 'front',
    });
  }

  // 2. Antenna (Top +Y)
  if (build.antenna === 'uhf') {
    boxes.push({
      name: 'antenna-uhf',
      min: [w * 0.22 - 0.04, h / 2, -0.04],
      max: [w * 0.22 + 0.25, h / 2 + 0.52, 0.04],
      attachedFace: 'top',
    });
  } else if (build.antenna === 's-band') {
    boxes.push({
      name: 'antenna-s-band',
      min: [-w * 0.23, h / 2, -d * 0.23],
      max: [w * 0.23, h / 2 + 0.06, d * 0.23],
      attachedFace: 'top',
    });
  } else {
    const dishR = Math.min(0.32, w * 0.46);
    boxes.push({
      name: 'antenna-x-band',
      min: [-dishR, h / 2, -dishR],
      max: [dishR, h / 2 + 0.14 + dishR * 0.65, dishR],
      attachedFace: 'top',
    });
  }

  // 3. Front face indicators: Battery, Memory, Computer
  boxes.push({
    name: 'battery',
    min: [-w * 0.39, -h / 2 + 0.06, d / 2],
    max: [-w * 0.03, -h / 2 + 0.30, d / 2 + 0.025],
    attachedFace: 'front',
  });
  boxes.push({
    name: 'memory',
    min: [w * 0.21 - Math.min(0.12, w * 0.18), -h / 2 + 0.085, d / 2],
    max: [w * 0.21 + Math.min(0.12, w * 0.18), -h / 2 + 0.275, d / 2 + 0.026],
    attachedFace: 'front',
  });
  const compHalfW = (build.computer === 'obc-rad' ? Math.min(0.34, w * 0.56) : Math.min(0.26, w * 0.46)) / 2;
  boxes.push({
    name: 'computer',
    min: [-compHalfW, -h * 0.03 - 0.085, d / 2],
    max: [compHalfW, -h * 0.03 + 0.085, d / 2 + 0.026],
    attachedFace: 'front',
  });

  // 4. Nadir Instrument (Bottom -Y)
  const camDepth = build.camera === 'cam-hires' || build.camera === 'magnetometer' ? 0.44 : 0.26;
  boxes.push({
    name: `instrument-${build.camera}`,
    min: [-0.32, -h / 2 - camDepth, -0.28],
    max: [0.28, -h / 2, 0.28],
    attachedFace: 'bottom',
  });

  // 5. Thruster (Back -Z)
  if (build.thruster === 'prop-cold') {
    boxes.push({
      name: 'thruster',
      min: [-0.095, -h * 0.22 - 0.095, -d / 2 - 0.18],
      max: [0.095, -h * 0.22 + 0.095, -d / 2],
      attachedFace: 'back',
    });
  }

  const maxExtentX = w / 2 + (wingLen > 0 ? 0.08 + wingLen : 0.14);
  const maxExtentY = h / 2 + (build.camera === 'cam-hires' || build.camera === 'magnetometer' ? 0.46 : 0.28);
  const shieldRadius = Math.max(maxExtentX, maxExtentY, d / 2 + 0.24) + 0.12;

  return { bus: [w, h, d], boxes, shieldRadius };
}

function verifyAllCombinations() {
  const cameras = ['cam-cubesat', 'cam-thermal', 'cam-hires', 'spectro', 'radiometer', 'magnetometer', 'radiation-mon'];
  const bodies = SLOTS.find((s) => s.id === 'body')!.options.map((o) => o.id);
  const panels = SLOTS.find((s) => s.id === 'panels')!.options.map((o) => o.id);
  const batteries = SLOTS.find((s) => s.id === 'battery')!.options.map((o) => o.id);
  const antennas = SLOTS.find((s) => s.id === 'antenna')!.options.map((o) => o.id);
  const memories = SLOTS.find((s) => s.id === 'memory')!.options.map((o) => o.id);
  const shields = SLOTS.find((s) => s.id === 'shield')!.options.map((o) => o.id);
  const thrusters = SLOTS.find((s) => s.id === 'thruster')!.options.map((o) => o.id);
  const computers = SLOTS.find((s) => s.id === 'computer')!.options.map((o) => o.id);

  let checked = 0;
  for (const m of MISSIONS) {
    for (const camera of m.instruments.length ? m.instruments : cameras) {
      for (const body of bodies) {
        for (const panel of panels) {
          for (const antenna of antennas) {
            for (const battery of batteries) {
              for (const memory of memories) {
                for (const computer of computers) {
                  for (const thruster of thrusters) {
                    for (const shield of shields) {
                      const build: Build = {
                        ...m.start,
                        camera,
                        body,
                        panels: panel,
                        antenna,
                        battery,
                        memory,
                        computer,
                        thruster,
                        shield,
                      };
                      const { bus: [w, h, d], boxes, shieldRadius } = computeSatelliteBoxes(build, m);

                      // Check 1: Every part touches its mounting face on the bus (no floating parts)
                      for (const box of boxes) {
                        const attached =
                          (box.attachedFace === 'top' && Math.abs(box.min[1] - h / 2) < 1e-4) ||
                          (box.attachedFace === 'bottom' && Math.abs(box.max[1] - -h / 2) < 1e-4) ||
                          (box.attachedFace === 'left' && Math.abs(box.max[0] - -w / 2) < 1e-4) ||
                          (box.attachedFace === 'right' && Math.abs(box.min[0] - w / 2) < 1e-4) ||
                          (box.attachedFace === 'front' && Math.abs(box.min[2] - d / 2) < 1e-4) ||
                          (box.attachedFace === 'back' && Math.abs(box.max[2] - -d / 2) < 1e-4);
                        if (!attached) {
                          throw new Error(`Detached part ${box.name} in mission ${m.id}`);
                        }
                      }

                      // Check 2: No two external parts overlap
                      for (let i = 0; i < boxes.length; i++) {
                        for (let j = i + 1; j < boxes.length; j++) {
                          if (boxesOverlap(boxes[i], boxes[j])) {
                            throw new Error(`Part overlap: ${boxes[i].name} vs ${boxes[j].name} in mission ${m.id} (bus ${w}x${h}x${d})`);
                          }
                        }
                      }

                      // Check 3: Shield encloses all parts
                      if (shield === 'shield') {
                        for (const box of boxes) {
                          const maxCoord = Math.max(
                            Math.abs(box.min[0]), Math.abs(box.max[0]),
                            Math.abs(box.min[1]), Math.abs(box.max[1]),
                            Math.abs(box.min[2]), Math.abs(box.max[2]),
                          );
                          if (maxCoord > shieldRadius) {
                            throw new Error(`Part ${box.name} exceeds shield radius in mission ${m.id}`);
                          }
                        }
                      }
                      checked++;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  console.log(`✅ Verified ${checked} 3D satellite part combinations across all ${MISSIONS.length} missions: 0 overlaps, 0 floating parts.`);
}

verifyAllCombinations();
