import type { RapierRigidBody } from "@react-three/rapier";
import type { RefObject } from "react";
import type { CharacterCtrlrSupportState, CharacterCtrlrVec3 } from "../../types";
import { FOOT_SUPPORT_OFFSET, GRAVITY } from "./config";

export function measureCenterOfMass(params: {
  bodyRefs: Array<RefObject<RapierRigidBody | null>>;
  fallbackPosition: CharacterCtrlrVec3;
  fallbackVelocity: CharacterCtrlrVec3;
}) {
  const {
    bodyRefs,
    fallbackPosition,
    fallbackVelocity,
  } = params;
  let totalTrackedMass = 0;
  let positionX = 0;
  let positionY = 0;
  let positionZ = 0;
  let velocityX = 0;
  let velocityY = 0;
  let velocityZ = 0;

  for (const bodyRef of bodyRefs) {
    const body = bodyRef.current;

    if (!body) {
      continue;
    }

    const bodyMass = body.mass();
    if (!Number.isFinite(bodyMass) || bodyMass <= 0) {
      continue;
    }

    const bodyPosition = body.translation();
    const bodyVelocity = body.linvel();
    positionX += bodyPosition.x * bodyMass;
    positionY += bodyPosition.y * bodyMass;
    positionZ += bodyPosition.z * bodyMass;
    velocityX += bodyVelocity.x * bodyMass;
    velocityY += bodyVelocity.y * bodyMass;
    velocityZ += bodyVelocity.z * bodyMass;
    totalTrackedMass += bodyMass;
  }

  if (totalTrackedMass <= 0) {
    return {
      totalTrackedMass: 0,
      position: fallbackPosition,
      velocity: fallbackVelocity,
    };
  }

  return {
    totalTrackedMass,
    position: [
      positionX / totalTrackedMass,
      positionY / totalTrackedMass,
      positionZ / totalTrackedMass,
    ] satisfies CharacterCtrlrVec3,
    velocity: [
      velocityX / totalTrackedMass,
      velocityY / totalTrackedMass,
      velocityZ / totalTrackedMass,
    ] satisfies CharacterCtrlrVec3,
  };
}

export function deriveSupportMeasurement(params: {
  rootPosition: CharacterCtrlrVec3;
  supportState: CharacterCtrlrSupportState;
  leftFootPosition: CharacterCtrlrVec3;
  rightFootPosition: CharacterCtrlrVec3;
}) {
  const {
    rootPosition,
    supportState,
    leftFootPosition,
    rightFootPosition,
  } = params;
  let supportPointCount = 0;
  let supportX = 0;
  let supportY = 0;
  let supportZ = 0;

  if (supportState === "left" || supportState === "double") {
    supportX += leftFootPosition[0];
    supportY += leftFootPosition[1] - FOOT_SUPPORT_OFFSET;
    supportZ += leftFootPosition[2];
    supportPointCount += 1;
  }

  if (supportState === "right" || supportState === "double") {
    supportX += rightFootPosition[0];
    supportY += rightFootPosition[1] - FOOT_SUPPORT_OFFSET;
    supportZ += rightFootPosition[2];
    supportPointCount += 1;
  }

  if (supportPointCount === 0) {
    return {
      pointCount: 0,
      center: rootPosition,
      supportPlaneY: rootPosition[1] - FOOT_SUPPORT_OFFSET,
    };
  }

  return {
    pointCount: supportPointCount,
    center: [
      supportX / supportPointCount,
      supportY / supportPointCount,
      supportZ / supportPointCount,
    ] satisfies CharacterCtrlrVec3,
    supportPlaneY: supportY / supportPointCount,
  };
}

export function deriveCapturePoint(params: {
  centerOfMass: CharacterCtrlrVec3;
  centerOfMassVelocity: CharacterCtrlrVec3;
  supportPlaneY: number;
  gravity?: number;
}) {
  const {
    centerOfMass,
    centerOfMassVelocity,
    supportPlaneY,
    gravity = GRAVITY,
  } = params;
  const zCom = Math.max(0.2, centerOfMass[1] - supportPlaneY);
  const omega0 = Math.sqrt(gravity / zCom);
  const captureTime = 1 / omega0;

  return {
    omega0,
    captureTime,
    point: [
      centerOfMass[0] + centerOfMassVelocity[0] / omega0,
      supportPlaneY,
      centerOfMass[2] + centerOfMassVelocity[2] / omega0,
    ] satisfies CharacterCtrlrVec3,
  };
}
