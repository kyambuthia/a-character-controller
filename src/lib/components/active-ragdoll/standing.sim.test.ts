import { describe, expect, it } from "vitest";
import {
  createHeadlessRig,
  HEADLESS_TIME_STEP,
  type HeadlessRig,
} from "./testing/headlessRig";
import { driveJointToPosition } from "./motors";
import type { CharacterCtrlrHumanoidRevoluteJointKey } from "../CharacterCtrlrHumanoidData";

// Standing motor gains in the player's tuning units ([stiffness, damping]); mirrors the
// `standingSupport` branch of CharacterCtrlrActiveRagdollPlayer.
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
const STAND_PELVIS_HEIGHT = 1.98;

type MotorMode = "force-based" | "acceleration-based";

async function simulateStand(params: {
  seconds: number;
  motorMode: MotorMode;
  /** Whole-body velocity change (m/s) applied at `pushAtSeconds`. */
  push?: [number, number, number];
  pushAtSeconds?: number;
}) {
  const rig = await createHeadlessRig();
  const calibration = Object.fromEntries(
    JOINT_KEYS.map((key) => [key, rig.sampleJointAngle(key)]),
  ) as Record<CharacterCtrlrHumanoidRevoluteJointKey, number>;
  const pushStep = Math.round((params.pushAtSeconds ?? 2) / HEADLESS_TIME_STEP);
  let minPelvisHeight = Infinity;
  let maxTilt = 0;

  for (let step = 0; step < Math.round(params.seconds / HEADLESS_TIME_STEP); step += 1) {
    for (const key of JOINT_KEYS) {
      const [stiffness, damping] = STAND_GAINS[key];

      if (params.motorMode === "force-based") {
        driveJointToPosition(
          rig.joints[key],
          calibration[key],
          stiffness,
          damping,
          rig.rapier.MotorModel.ForceBased,
        );
      } else {
        rig.joints[key].configureMotorPosition(calibration[key], stiffness, damping);
      }
    }

    if (params.push && step === pushStep) {
      pushWholeBody(rig, params.push);
    }

    rig.step();
    if (step * HEADLESS_TIME_STEP > 1) {
      minPelvisHeight = Math.min(minPelvisHeight, rig.pelvisHeight());
    }
    maxTilt = Math.max(maxTilt, rig.tilt());
  }

  return { rig, minPelvisHeight, maxTilt };
}

function pushWholeBody(rig: HeadlessRig, velocityChange: [number, number, number]) {
  for (const body of Object.values(rig.bodies)) {
    const mass = body.mass();
    body.applyImpulse(
      {
        x: velocityChange[0] * mass,
        y: velocityChange[1] * mass,
        z: velocityChange[2] * mass,
      },
      true,
    );
  }
}

describe("headless active ragdoll standing", () => {
  it("holds a stand on force-based joint motors alone", async () => {
    const { rig, minPelvisHeight } = await simulateStand({
      seconds: 12,
      motorMode: "force-based",
    });

    expect(minPelvisHeight).toBeGreaterThan(STAND_PELVIS_HEIGHT - 0.04);
    expect(rig.pelvisHeight()).toBeCloseTo(STAND_PELVIS_HEIGHT, 1);
    expect(rig.footOnGround("left")).toBe(true);
    expect(rig.footOnGround("right")).toBe(true);
  });

  it("buckles at the knees on Rapier's default acceleration-based motors", async () => {
    // Documents why MOTOR_TORQUE_SCALE / the force-based model exist: with the same gains the
    // default model slowly folds the knees under the torso's weight.
    const { rig } = await simulateStand({ seconds: 8, motorMode: "acceleration-based" });

    expect(rig.pelvisHeight()).toBeLessThan(STAND_PELVIS_HEIGHT - 0.4);
  });

  it.each([
    ["forward", [0, 0, 1.5]],
    ["backward", [0, 0, -1.5]],
    ["sideways", [1.5, 0, 0]],
  ] as const)("stays standing after a 1.5 m/s %s push", async (_label, push) => {
    const { rig, minPelvisHeight } = await simulateStand({
      seconds: 8,
      motorMode: "force-based",
      push: [...push],
    });

    expect(minPelvisHeight).toBeGreaterThan(STAND_PELVIS_HEIGHT - 0.1);
    expect(rig.pelvisHeight()).toBeCloseTo(STAND_PELVIS_HEIGHT, 1);
    expect(rig.footOnGround("left")).toBe(true);
    expect(rig.footOnGround("right")).toBe(true);
  });
});
