import { describe, expect, it } from "vitest";
import type { CharacterCtrlrHumanoidRevoluteJointKey } from "../CharacterCtrlrHumanoidData";
import { SWING_HIP_GAINS, SWING_KNEE_GAINS } from "./config";
import { driveJointToPosition } from "./motors";
import { createHeadlessRig, HEADLESS_TIME_STEP } from "./testing/headlessRig";

// Standing gains, as in standing.sim.test.ts.
const STAND_GAINS: Record<CharacterCtrlrHumanoidRevoluteJointKey, [number, number]> = {
  hipLeft: [34, 7.8],
  hipRight: [34, 7.8],
  kneeLeft: [44, 9.5],
  kneeRight: [44, 9.5],
  ankleLeft: [28, 6.8],
  ankleRight: [28, 6.8],
  shoulderLeft: [9.2, 2.8],
  shoulderRight: [9.2, 2.8],
  elbowLeft: [5.8, 2.2],
  elbowRight: [5.8, 2.2],
  wristLeft: [3.8, 1.4],
  wristRight: [3.8, 1.4],
};
const JOINT_KEYS = Object.keys(STAND_GAINS) as CharacterCtrlrHumanoidRevoluteJointKey[];

/** Stand for 2 s, then bend the right knee by 0.5 rad and report how high the foot gets. */
async function liftRightFoot(swingGains: { hip: [number, number]; knee: [number, number] }) {
  const rig = await createHeadlessRig();
  const calibration = Object.fromEntries(JOINT_KEYS.map((key) => [key, rig.sampleJointAngle(key)])) as Record<
    CharacterCtrlrHumanoidRevoluteJointKey,
    number
  >;
  const swingStart = 2;
  let restHeight = 0;
  let liftAfterQuarterSecond = 0;

  for (let step = 0; step < Math.round(2.6 / HEADLESS_TIME_STEP); step += 1) {
    const t = step * HEADLESS_TIME_STEP;
    const swinging = t >= swingStart;

    for (const key of JOINT_KEYS) {
      let gains = STAND_GAINS[key];
      let target = calibration[key];
      if (swinging && key === "kneeRight") {
        gains = swingGains.knee;
        target -= 0.5;
      } else if (swinging && key === "hipRight") {
        gains = swingGains.hip;
      }
      driveJointToPosition(rig.joints[key], target, gains[0], gains[1], rig.rapier.MotorModel.ForceBased);
    }
    rig.step();

    const footY = rig.bodies.footRight.translation().y;
    if (!swinging) {
      restHeight = footY;
    } else if (t <= swingStart + 0.25) {
      liftAfterQuarterSecond = footY - restHeight;
    }
  }

  return { liftAfterQuarterSecond, pelvisHeight: rig.pelvisHeight() };
}

describe("headless swing leg", () => {
  it("clears the ground within a quarter second on the swing gains", async () => {
    const result = await liftRightFoot({ hip: SWING_HIP_GAINS, knee: SWING_KNEE_GAINS });

    expect(result.liftAfterQuarterSecond).toBeGreaterThan(0.09);
    // The stance leg keeps the body up while the other foot is in the air.
    expect(result.pelvisHeight).toBeGreaterThan(1.9);
  });

  it("documents that the old overdamped walking gains are too slow for a swing", async () => {
    const result = await liftRightFoot({ hip: [20, 4.4], knee: [22, 4.2] });

    expect(result.liftAfterQuarterSecond).toBeLessThan(0.06);
  });
});
