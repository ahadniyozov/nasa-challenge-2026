// Automated 3D geometry & bounding-box verifier for SatelliteModel across all 6 missions.
// Run with: npm run check:model   (part boxes come from SatelliteModel itself: computeSatelliteBoxes)
// Checks every combination of parts a mission allows:
//   1. every part touches its mounting face on the body (nothing floating);
//   2. no two parts overlap;
//   3. the debris shield sphere encloses the body and the farthest corner of every part.
// The triangle budget (≤ 3000) is measured in the browser: scripts/model-shots.mjs.
import { SLOTS, type Build } from '../game2d/config';
import { MISSIONS } from '../game2d/missions';
import { computeSatelliteBoxes, type Box3D } from './SatelliteModel';

function boxesOverlap(a: Box3D, b: Box3D, eps = 0.002): boolean {
  return (
    a.min[0] + eps < b.max[0] && a.max[0] - eps > b.min[0] &&
    a.min[1] + eps < b.max[1] && a.max[1] - eps > b.min[1] &&
    a.min[2] + eps < b.max[2] && a.max[2] - eps > b.min[2]
  );
}

/** distance from the body centre to the farthest corner of a box */
const farCorner = (b: { min: number[]; max: number[] }) => Math.hypot(
  Math.max(Math.abs(b.min[0]), Math.abs(b.max[0])),
  Math.max(Math.abs(b.min[1]), Math.abs(b.max[1])),
  Math.max(Math.abs(b.min[2]), Math.abs(b.max[2])),
);

const optionsOf = (id: string) => SLOTS.find((s) => s.id === id)!.options.map((o) => o.id);

function verifyAllCombinations() {
  const bodies = optionsOf('body');
  const panels = optionsOf('panels');
  const batteries = optionsOf('battery');
  const antennas = optionsOf('antenna');
  const memories = optionsOf('memory');
  const shields = optionsOf('shield');
  const thrusters = optionsOf('thruster');
  const computers = optionsOf('computer');

  let checked = 0;
  const fail = (msg: string) => { throw new Error(msg); };
  for (const m of MISSIONS) {
    for (const camera of m.instruments) {
      for (const body of bodies) {
        for (const panel of panels) {
          for (const antenna of antennas) {
            for (const battery of batteries) {
              for (const memory of memories) {
                for (const computer of computers) {
                  for (const thruster of thrusters) {
                    for (const shield of shields) {
                      const build: Build = { ...m.start, camera, body, panels: panel, antenna, battery, memory, computer, thruster, shield };
                      const { bus: [w, h, d], boxes, shieldRadius } = computeSatelliteBoxes(build, m);
                      const where = `mission ${m.id}, ${JSON.stringify({ camera, body, panel, antenna, thruster })}`;

                      // 1. every part touches its mounting face on the body
                      for (const box of boxes) {
                        const attached =
                          (box.attachedFace === 'top' && Math.abs(box.min[1] - h / 2) < 1e-4) ||
                          (box.attachedFace === 'bottom' && Math.abs(box.max[1] - -h / 2) < 1e-4) ||
                          (box.attachedFace === 'left' && Math.abs(box.max[0] - -w / 2) < 1e-4) ||
                          (box.attachedFace === 'right' && Math.abs(box.min[0] - w / 2) < 1e-4) ||
                          (box.attachedFace === 'front' && Math.abs(box.min[2] - d / 2) < 1e-4) ||
                          (box.attachedFace === 'back' && Math.abs(box.max[2] - -d / 2) < 1e-4);
                        if (!attached) fail(`Detached part ${box.name} in ${where}`);
                      }

                      // 2. no two parts overlap
                      for (let i = 0; i < boxes.length; i++) {
                        for (let j = i + 1; j < boxes.length; j++) {
                          if (boxesOverlap(boxes[i], boxes[j])) fail(`Part overlap: ${boxes[i].name} vs ${boxes[j].name} in ${where} (bus ${w}x${h}x${d})`);
                        }
                      }

                      // 3. the shield encloses the body and every part (farthest corner, not one axis)
                      if (shield === 'shield') {
                        const bodyFar = farCorner({ min: [-w / 2, -h / 2, -d / 2], max: [w / 2, h / 2, d / 2] });
                        if (bodyFar > shieldRadius) fail(`Body sticks out of the shield in ${where}`);
                        for (const box of boxes) {
                          if (farCorner(box) > shieldRadius) fail(`Part ${box.name} sticks out of the shield (${farCorner(box).toFixed(2)} > ${shieldRadius.toFixed(2)}) in ${where}`);
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
  console.log(`✅ Verified ${checked} 3D satellite part combinations across all ${MISSIONS.length} missions: 0 overlaps, 0 floating parts, shield encloses every part.`);
}

verifyAllCombinations();
