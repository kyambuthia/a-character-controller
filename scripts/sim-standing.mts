// Headless standing experiments for the active ragdoll (plain Rapier, no browser).
//
// Usage: npx vite-node scripts/sim-standing.mts [--seconds 8] [--unlocked] [--k 1] [--every 0.5]
//
// Runs the humanoid with joint motors only (no impulse assist) and prints pelvis height, tilt,
// foot contact and leg joint angles so standing can be judged from numbers.
import {
  createHeadlessRig,
  HEADLESS_TIME_STEP,
} from "../src/lib/components/active-ragdoll/testing/headlessRig";
import type { CharacterCtrlrHumanoidRevoluteJointKey } from "../src/lib/components/CharacterCtrlrHumanoidData";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg, index, all) => [arg.replace(/^--/, ""), all[index + 1] ?? true]),
);
const seconds = Number(args.seconds ?? 8);
const every = Number(args.every ?? 0.5);
const gainScale = Number(args.k ?? 1);
// --force switches joints to Rapier's force-based motor model, where gains are real torques
// (N*m/rad, N*m*s/rad) instead of being scaled by the connected bodies' inertia.
const forceBased = Boolean(args.force);
const forceKp = Number(args.kp ?? 400);
const forceKd = Number(args.kd ?? 40);
// Optional shove on the pelvis at t = 2 s, in N*s (z is forward, x is sideways).
const pushZ = Number(args.pushz ?? 0);
const pushX = Number(args.pushx ?? 0);

const rig = await createHeadlessRig({ lockRotations: !args.unlocked });
const calibration: Partial<Record<CharacterCtrlrHumanoidRevoluteJointKey, number>> = {};

// Motor gains copied from the React player's standing branch: [stiffness, damping].
const GAINS: Record<CharacterCtrlrHumanoidRevoluteJointKey, [number, number]> = {
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

for (const key of Object.keys(GAINS) as CharacterCtrlrHumanoidRevoluteJointKey[]) {
  calibration[key] = rig.sampleJointAngle(key);
  if (forceBased) {
    rig.joints[key].configureMotorModel(rig.rapier.MotorModel.ForceBased);
  }
}

const fmt = (value: number, digits = 2) => value.toFixed(digits).padStart(6);
console.log(
  "t     pelvisY  tilt  footL footR  hipL  kneeL ankleL | comZ-footZ  comX",
);

const steps = Math.round(seconds / HEADLESS_TIME_STEP);
const printEvery = Math.round(every / HEADLESS_TIME_STEP);

for (let step = 0; step <= steps; step += 1) {
  for (const key of Object.keys(GAINS) as CharacterCtrlrHumanoidRevoluteJointKey[]) {
    const [stiffness, damping] = GAINS[key];
    const limb = /hip|knee|ankle/.test(key);
    rig.joints[key].configureMotorPosition(
      calibration[key]!,
      forceBased ? (limb ? forceKp : forceKp * 0.1) : stiffness * gainScale,
      forceBased ? (limb ? forceKd : forceKd * 0.1) : damping * gainScale,
    );
  }

  if (step === Math.round(2 / HEADLESS_TIME_STEP) && (pushZ !== 0 || pushX !== 0)) {
    rig.bodies.pelvis.applyImpulse({ x: pushX, y: 0, z: pushZ }, true);
    console.log(`-- push: ${pushX} Ns sideways, ${pushZ} Ns forward --`);
  }

  rig.step();

  if (step % printEvery === 0) {
    const com = rig.centerOfMass().position;
    const footZ =
      (rig.bodies.footLeft.translation().z + rig.bodies.footRight.translation().z) / 2;
    console.log(
      `${(step * HEADLESS_TIME_STEP).toFixed(1).padStart(4)} ${fmt(rig.pelvisHeight())} ${fmt(rig.tilt())}  ` +
        `${rig.footOnGround("left") ? "Y" : "n"}     ${rig.footOnGround("right") ? "Y" : "n"}   ` +
        `${fmt(rig.sampleJointAngle("hipLeft"))} ${fmt(rig.sampleJointAngle("kneeLeft"))} ${fmt(rig.sampleJointAngle("ankleLeft"))} | ` +
        `${fmt(com[2] - footZ)}  ${fmt(com[0])}`,
    );
  }
}
