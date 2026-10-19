import { MathUtils } from "three";
import type { MotorModel, RevoluteImpulseJoint } from "@dimforge/rapier3d-compat";
import { REVOLUTE_JOINT_LIMITS } from "./config";
import type { RevoluteJointPoseMap } from "./controllerTypes";

/**
 * Rapier's default motor model is acceleration-based: a joint's strength is scaled by the inertia
 * of the two bodies it links, so a light shin cannot hold up the torso above it and the knees
 * slowly buckle (reproduced headlessly in scripts/sim-standing.mts). Force-based motors take real
 * torques, so strength no longer depends on how light a joint's own segments are.
 *
 * The gains passed to `driveJointToPosition` keep their old tuning units and are multiplied by
 * this scale to become N*m/rad (stiffness) and N*m*s/rad (damping).
 */
export const MOTOR_TORQUE_SCALE = 10;

export function driveJointToPosition(
  joint: RevoluteImpulseJoint | null,
  targetPosition: number,
  stiffness: number,
  damping: number,
  forceBasedModel: MotorModel,
) {
  if (!joint?.isValid()) {
    return;
  }

  joint.configureMotorModel(forceBasedModel);
  joint.configureMotorPosition(
    targetPosition,
    stiffness * MOTOR_TORQUE_SCALE,
    damping * MOTOR_TORQUE_SCALE,
  );
}

export function resolveJointTarget(
  key: keyof RevoluteJointPoseMap,
  targetPosition: number,
  calibrationOffsets: Partial<RevoluteJointPoseMap>,
) {
  const [min, max] = REVOLUTE_JOINT_LIMITS[key];
  const calibrationOffset = calibrationOffsets[key] ?? 0;

  return MathUtils.clamp(targetPosition + calibrationOffset, min, max);
}
