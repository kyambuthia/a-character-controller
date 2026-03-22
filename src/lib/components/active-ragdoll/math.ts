import type { RapierRigidBody } from "@react-three/rapier";
import { Euler, Quaternion } from "three";

const jointParentQuaternion = new Quaternion();
const jointChildQuaternion = new Quaternion();
const jointRelativeQuaternion = new Quaternion();
const jointRelativeEuler = new Euler(0, 0, 0, "XYZ");

export function angleDifference(current: number, target: number) {
  return Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
}

export function sampleRevoluteJointAngle(
  bodyA: RapierRigidBody,
  bodyB: RapierRigidBody,
) {
  const parentRotation = bodyA.rotation();
  const childRotation = bodyB.rotation();

  jointParentQuaternion.set(
    parentRotation.x,
    parentRotation.y,
    parentRotation.z,
    parentRotation.w,
  );
  jointChildQuaternion.set(
    childRotation.x,
    childRotation.y,
    childRotation.z,
    childRotation.w,
  );
  jointRelativeQuaternion.copy(jointParentQuaternion).invert().multiply(jointChildQuaternion);
  jointRelativeEuler.setFromQuaternion(jointRelativeQuaternion, "XYZ");

  return jointRelativeEuler.x;
}
