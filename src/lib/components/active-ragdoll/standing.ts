import { MathUtils } from "three";
import type { CharacterCtrlrVec3 } from "../../types";
import {
  FOOT_SUPPORT_OFFSET,
  STAND_FOOT_FORWARD_OFFSET,
  STAND_FOOT_LATERAL_OFFSET,
} from "./config";
import type { PhasePoseTargets, StandingFootPlant } from "./controllerTypes";
import { applyStandingPoseTargets } from "./poseTargets";

const STAND_TURN_RATE = 1.9;

export function deriveStandingTargetFacing(params: {
  playerFacing: number;
  movementHeading: number;
  hasMovementInput: boolean;
  pureTurnRequested: boolean;
  turnInput: number;
  grounded: boolean;
  delta: number;
}) {
  const {
    playerFacing,
    movementHeading,
    hasMovementInput,
    pureTurnRequested,
    turnInput,
    grounded,
    delta,
  } = params;

  if (pureTurnRequested) {
    return playerFacing + turnInput * STAND_TURN_RATE * delta * (grounded ? 1 : 0.35);
  }

  return hasMovementInput ? movementHeading : playerFacing;
}

export function deriveStandingPoseTargets(params: {
  baseTargets: PhasePoseTargets;
  supportLateralError: number;
  supportForwardError: number;
  captureLateralError: number;
  captureForwardError: number;
  yawError: number;
  turnInPlaceRequested: boolean;
}) {
  const {
    baseTargets,
    supportLateralError,
    supportForwardError,
    captureLateralError,
    captureForwardError,
    yawError,
    turnInPlaceRequested,
  } = params;
  const standingTargets = applyStandingPoseTargets(baseTargets);
  const forwardAssist = MathUtils.clamp(
    supportForwardError * 0.18 + captureForwardError * 0.12,
    -0.16,
    0.16,
  );
  const lateralAssist = MathUtils.clamp(
    supportLateralError * 0.32 + captureLateralError * 0.2,
    -0.18,
    0.18,
  );
  const turnBrace = turnInPlaceRequested
    ? MathUtils.clamp(Math.abs(yawError) * 0.16, 0, 0.08)
    : 0;
  const kneeBrace = MathUtils.clamp(
    Math.abs(forwardAssist) * 0.35 + Math.abs(lateralAssist) * 0.25 + turnBrace,
    0,
    0.1,
  );
  const hipAssist = MathUtils.clamp(forwardAssist * 0.55, -0.08, 0.08);
  const ankleAssist = MathUtils.clamp(forwardAssist * 0.7, -0.1, 0.1);

  standingTargets.pelvisPitch -= forwardAssist;
  standingTargets.chestPitch += forwardAssist * 0.58;
  standingTargets.pelvisRoll += lateralAssist;
  standingTargets.chestRoll -= lateralAssist * 0.7;

  standingTargets.left.hip -= hipAssist + turnBrace * 0.4;
  standingTargets.right.hip -= hipAssist + turnBrace * 0.4;
  standingTargets.left.knee -= kneeBrace;
  standingTargets.right.knee -= kneeBrace;
  standingTargets.left.ankle += ankleAssist + turnBrace * 0.18;
  standingTargets.right.ankle += ankleAssist + turnBrace * 0.18;
  standingTargets.left.shoulder = MathUtils.lerp(standingTargets.left.shoulder, 0.08, 0.7);
  standingTargets.right.shoulder = MathUtils.lerp(standingTargets.right.shoulder, 0.08, 0.7);
  standingTargets.left.elbow = MathUtils.lerp(standingTargets.left.elbow, -0.4, 0.55);
  standingTargets.right.elbow = MathUtils.lerp(standingTargets.right.elbow, -0.4, 0.55);

  return standingTargets;
}

export function advanceStandingFootPlant(params: {
  currentPlant: StandingFootPlant | null;
  supportCenter: CharacterCtrlrVec3;
  supportPlaneY: number;
  facing: number;
  delta: number;
  turnInPlaceRequested: boolean;
}) {
  const {
    currentPlant,
    supportCenter,
    supportPlaneY,
    facing,
    delta,
    turnInPlaceRequested,
  } = params;
  const targetY = supportPlaneY + FOOT_SUPPORT_OFFSET;
  // The stance is planted around an anchor captured once. Re-deriving targets from the feet's own
  // current centre made them chase themselves forward by the forward offset every step.
  const anchor: [number, number] = currentPlant?.anchor ?? [supportCenter[0], supportCenter[2]];
  const lateralX = Math.cos(facing) * STAND_FOOT_LATERAL_OFFSET;
  const lateralZ = -Math.sin(facing) * STAND_FOOT_LATERAL_OFFSET;
  const forwardX = Math.sin(facing) * STAND_FOOT_FORWARD_OFFSET;
  const forwardZ = Math.cos(facing) * STAND_FOOT_FORWARD_OFFSET;
  const targetLeft: CharacterCtrlrVec3 = [
    anchor[0] - lateralX + forwardX,
    targetY,
    anchor[1] - lateralZ + forwardZ,
  ];
  const targetRight: CharacterCtrlrVec3 = [
    anchor[0] + lateralX + forwardX,
    targetY,
    anchor[1] + lateralZ + forwardZ,
  ];

  if (!currentPlant) {
    return {
      left: targetLeft,
      right: targetRight,
      anchor,
    } satisfies StandingFootPlant;
  }

  const positionBlend = Math.min(1, delta * (turnInPlaceRequested ? 5.2 : 8.8));

  return {
    left: [
      MathUtils.lerp(currentPlant.left[0], targetLeft[0], positionBlend),
      targetY,
      MathUtils.lerp(currentPlant.left[2], targetLeft[2], positionBlend),
    ],
    right: [
      MathUtils.lerp(currentPlant.right[0], targetRight[0], positionBlend),
      targetY,
      MathUtils.lerp(currentPlant.right[2], targetRight[2], positionBlend),
    ],
    anchor,
  } satisfies StandingFootPlant;
}
