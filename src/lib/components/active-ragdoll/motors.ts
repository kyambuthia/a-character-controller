import { MathUtils } from "three";
import type { RevoluteImpulseJoint } from "@dimforge/rapier3d-compat";
import { REVOLUTE_JOINT_LIMITS } from "./config";
import type { RevoluteJointPoseMap } from "./controllerTypes";

export function driveJointToPosition(
  joint: RevoluteImpulseJoint | null,
  targetPosition: number,
  stiffness: number,
  damping: number,
) {
  if (!joint?.isValid()) {
    return;
  }

  joint.configureMotorPosition(targetPosition, stiffness, damping);
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
