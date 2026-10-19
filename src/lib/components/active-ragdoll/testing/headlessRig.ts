import RAPIER, {
  type ImpulseJoint,
  type RevoluteImpulseJoint,
  type RigidBody,
  type World,
} from "@dimforge/rapier3d-compat";
import { Euler, Quaternion } from "three";
import {
  CHARACTER_CTRLR_HUMANOID_BODY_DEFINITIONS,
  CHARACTER_CTRLR_HUMANOID_FIXED_JOINT_DEFINITIONS,
  CHARACTER_CTRLR_HUMANOID_REVOLUTE_JOINT_DEFINITIONS,
  CHARACTER_CTRLR_HUMANOID_SPHERICAL_JOINT_DEFINITIONS,
  type CharacterCtrlrHumanoidBodyKey,
  type CharacterCtrlrHumanoidRevoluteJointKey,
} from "../../CharacterCtrlrHumanoidData";

/**
 * Plain-Rapier replica of the humanoid built by `CharacterCtrlrHumanoidRagdoll` (same bodies,
 * joints, damping and collision groups) so controllers can be simulated and measured headlessly,
 * thousands of steps per second, with no browser.
 */

// interactionGroups([1], [0]) from the React ragdoll: member of group 1, collides with group 0.
const RAGDOLL_COLLISION_GROUPS = (1 << (1 + 16)) | (1 << 0);
export const HEADLESS_TIME_STEP = 1 / 60;

export type HeadlessRigOptions = {
  spawn?: [number, number, number];
  /** Mirrors the React player's `enabledRotations` overrides (pelvis/chest yaw-only, legs pitch-only). */
  lockRotations?: boolean;
  gravity?: number;
};

type BodyTuning = {
  additionalSolverIterations: number;
  angularDamping: number;
  linearDamping: number;
  enabledRotations: [boolean, boolean, boolean];
};

const SHARED_TUNING: BodyTuning = {
  additionalSolverIterations: 16,
  angularDamping: 5.2,
  linearDamping: 2.4,
  enabledRotations: [true, true, true],
};

const BODY_TUNING_OVERRIDES: Partial<Record<CharacterCtrlrHumanoidBodyKey, Partial<BodyTuning>>> = {
  pelvis: { additionalSolverIterations: 24, angularDamping: 7.2, linearDamping: 3.1 },
  chest: { additionalSolverIterations: 22, angularDamping: 7, linearDamping: 2.8 },
  head: { additionalSolverIterations: 18, angularDamping: 9.2, linearDamping: 2.6 },
  upperArmLeft: { angularDamping: 6.8, linearDamping: 2.1 },
  lowerArmLeft: { angularDamping: 6.6, linearDamping: 1.8 },
  handLeft: { angularDamping: 7.2, linearDamping: 2 },
  upperArmRight: { angularDamping: 6.8, linearDamping: 2.1 },
  lowerArmRight: { angularDamping: 6.6, linearDamping: 1.8 },
  handRight: { angularDamping: 7.2, linearDamping: 2 },
  upperLegLeft: { angularDamping: 6.2 },
  lowerLegLeft: { angularDamping: 6.4 },
  footLeft: { angularDamping: 6.8 },
  upperLegRight: { angularDamping: 6.2 },
  lowerLegRight: { angularDamping: 6.4 },
  footRight: { angularDamping: 6.8 },
};

const LOCKED_ROTATIONS: Partial<Record<CharacterCtrlrHumanoidBodyKey, [boolean, boolean, boolean]>> = {
  pelvis: [false, true, false],
  chest: [false, true, false],
  upperLegLeft: [true, false, false],
  lowerLegLeft: [true, false, false],
  footLeft: [true, false, false],
  upperLegRight: [true, false, false],
  lowerLegRight: [true, false, false],
  footRight: [true, false, false],
};

let rapierReady: Promise<void> | null = null;

export function initHeadlessRapier() {
  rapierReady ??= RAPIER.init();
  return rapierReady;
}

export type HeadlessRig = {
  rapier: typeof RAPIER;
  world: World;
  bodies: Record<CharacterCtrlrHumanoidBodyKey, RigidBody>;
  joints: Record<CharacterCtrlrHumanoidRevoluteJointKey, RevoluteImpulseJoint>;
  groundHandle: number;
  ownBodyHandles: Set<number>;
  step: () => void;
  /** Relative rotation angle (about X) of `child` in `parent`'s frame, matching the React sampler. */
  sampleJointAngle: (key: CharacterCtrlrHumanoidRevoluteJointKey) => number;
  massTotal: number;
  centerOfMass: () => { position: [number, number, number]; velocity: [number, number, number] };
  /** Pelvis height above the ground plane at y = 0. */
  pelvisHeight: () => number;
  /** Largest of pelvis/chest tilt away from upright, radians. */
  tilt: () => number;
  /** Raycast from the foot straight down; true when the sole is within `reach` of the ground. */
  footOnGround: (side: "left" | "right", reach?: number) => boolean;
};

export async function createHeadlessRig(options: HeadlessRigOptions = {}): Promise<HeadlessRig> {
  await initHeadlessRapier();

  const spawn = options.spawn ?? [0, 2.02, 0];
  const lockRotations = options.lockRotations ?? true;
  const world = new RAPIER.World({ x: 0, y: -(options.gravity ?? 9.81), z: 0 });
  world.timestep = HEADLESS_TIME_STEP;

  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const groundCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(90, 0.15, 90).setTranslation(0, -0.15, 0),
    groundBody,
  );

  const bodies = {} as Record<CharacterCtrlrHumanoidBodyKey, RigidBody>;
  const ownBodyHandles = new Set<number>();
  let massTotal = 0;

  for (const definition of CHARACTER_CTRLR_HUMANOID_BODY_DEFINITIONS) {
    const tuning: BodyTuning = {
      ...SHARED_TUNING,
      ...BODY_TUNING_OVERRIDES[definition.key],
      enabledRotations:
        (lockRotations ? LOCKED_ROTATIONS[definition.key] : undefined) ?? SHARED_TUNING.enabledRotations,
    };
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(
          spawn[0] + definition.position[0],
          spawn[1] + definition.position[1],
          spawn[2] + definition.position[2],
        )
        .setLinearDamping(tuning.linearDamping)
        .setAngularDamping(tuning.angularDamping)
        .enabledRotations(...tuning.enabledRotations)
        .setCcdEnabled(true)
        .setSoftCcdPrediction(0.25)
        .setCanSleep(false)
        .setAdditionalSolverIterations(tuning.additionalSolverIterations),
    );
    const colliderDesc =
      definition.shape.kind === "sphere"
        ? RAPIER.ColliderDesc.ball(definition.shape.radius)
        : RAPIER.ColliderDesc.cuboid(
            definition.shape.size[0] / 2,
            definition.shape.size[1] / 2,
            definition.shape.size[2] / 2,
          );

    colliderDesc
      .setMass(definition.mass)
      .setFriction(1.2)
      .setRestitution(0.02)
      .setContactSkin(0.008)
      .setCollisionGroups(RAGDOLL_COLLISION_GROUPS)
      .setSolverGroups(RAGDOLL_COLLISION_GROUPS);

    if (definition.meshOffset) {
      colliderDesc.setTranslation(...definition.meshOffset);
    }

    world.createCollider(colliderDesc, body);
    bodies[definition.key] = body;
    ownBodyHandles.add(body.handle);
    massTotal += definition.mass;
  }

  const vec = (value: [number, number, number]) => ({ x: value[0], y: value[1], z: value[2] });
  const quat = (value: [number, number, number, number]) => ({
    x: value[0],
    y: value[1],
    z: value[2],
    w: value[3],
  });

  for (const definition of CHARACTER_CTRLR_HUMANOID_FIXED_JOINT_DEFINITIONS) {
    world.createImpulseJoint(
      RAPIER.JointData.fixed(
        vec(definition.anchorA),
        quat(definition.frameA),
        vec(definition.anchorB),
        quat(definition.frameB),
      ),
      bodies[definition.bodyA],
      bodies[definition.bodyB],
      true,
    );
  }

  for (const definition of CHARACTER_CTRLR_HUMANOID_SPHERICAL_JOINT_DEFINITIONS) {
    world.createImpulseJoint(
      RAPIER.JointData.spherical(vec(definition.anchorA), vec(definition.anchorB)),
      bodies[definition.bodyA],
      bodies[definition.bodyB],
      true,
    );
  }

  const joints = {} as Record<CharacterCtrlrHumanoidRevoluteJointKey, RevoluteImpulseJoint>;
  for (const definition of CHARACTER_CTRLR_HUMANOID_REVOLUTE_JOINT_DEFINITIONS) {
    const data = RAPIER.JointData.revolute(
      vec(definition.anchorA),
      vec(definition.anchorB),
      vec(definition.axis),
    );
    data.limitsEnabled = true;
    data.limits = definition.limits;
    joints[definition.key] = world.createImpulseJoint(
      data,
      bodies[definition.bodyA],
      bodies[definition.bodyB],
      true,
    ) as RevoluteImpulseJoint;
  }

  const parentQuaternion = new Quaternion();
  const childQuaternion = new Quaternion();
  const relativeEuler = new Euler(0, 0, 0, "XYZ");
  const jointBodies = new Map(
    CHARACTER_CTRLR_HUMANOID_REVOLUTE_JOINT_DEFINITIONS.map((definition) => [
      definition.key,
      [definition.bodyA, definition.bodyB] as const,
    ]),
  );

  const sampleJointAngle = (key: CharacterCtrlrHumanoidRevoluteJointKey) => {
    const [parentKey, childKey] = jointBodies.get(key)!;
    const parent = bodies[parentKey].rotation();
    const child = bodies[childKey].rotation();
    parentQuaternion.set(parent.x, parent.y, parent.z, parent.w);
    childQuaternion.set(child.x, child.y, child.z, child.w);
    relativeEuler.setFromQuaternion(parentQuaternion.invert().multiply(childQuaternion), "XYZ");
    return relativeEuler.x;
  };

  const tiltOf = (body: RigidBody) => {
    const rotation = body.rotation();
    // Upright axis (local +Y) expressed in world space; tilt is its angle from world +Y.
    const upY =
      1 - 2 * (rotation.x * rotation.x + rotation.z * rotation.z);
    return Math.acos(Math.max(-1, Math.min(1, upY)));
  };

  const footOnGround = (side: "left" | "right", reach = 0.12) => {
    const foot = bodies[side === "left" ? "footLeft" : "footRight"];
    const origin = foot.translation();
    // Foot box is 0.16 tall; the sole is 0.08 below the body origin.
    const hit = world.castRay(
      new RAPIER.Ray({ x: origin.x, y: origin.y, z: origin.z }, { x: 0, y: -1, z: 0 }),
      0.08 + reach,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      (collider) => collider.handle === groundCollider.handle,
    );
    return hit !== null;
  };

  return {
    rapier: RAPIER,
    world,
    bodies,
    joints,
    groundHandle: groundCollider.handle,
    ownBodyHandles,
    step: () => world.step(),
    sampleJointAngle,
    massTotal,
    centerOfMass: () => {
      let x = 0;
      let y = 0;
      let z = 0;
      let vx = 0;
      let vy = 0;
      let vz = 0;
      for (const body of Object.values(bodies)) {
        const mass = body.mass();
        const position = body.translation();
        const velocity = body.linvel();
        x += position.x * mass;
        y += position.y * mass;
        z += position.z * mass;
        vx += velocity.x * mass;
        vy += velocity.y * mass;
        vz += velocity.z * mass;
      }
      const total = Object.values(bodies).reduce((sum, body) => sum + body.mass(), 0);
      return {
        position: [x / total, y / total, z / total],
        velocity: [vx / total, vy / total, vz / total],
      };
    },
    pelvisHeight: () => bodies.pelvis.translation().y,
    tilt: () => Math.max(tiltOf(bodies.pelvis), tiltOf(bodies.chest)),
    footOnGround,
  };
}

export type { ImpulseJoint };
