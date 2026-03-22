import { MathUtils } from "three";
import type { CharacterCtrlrVec3 } from "../../types";
import type { CharacterCtrlrGaitConfig, SupportSide } from "./controllerTypes";

export function deriveSwingStepPlan(params: {
  swingSide: SupportSide;
  supportCenter: CharacterCtrlrVec3;
  rootPosition: CharacterCtrlrVec3;
  stanceFootPosition: CharacterCtrlrVec3;
  facingForward: CharacterCtrlrVec3;
  facingRight: CharacterCtrlrVec3;
  stepLengthTarget: number;
  stepWidthTarget: number;
  stepHeightTarget: number;
  gaitEffort: number;
  gaitConfig: CharacterCtrlrGaitConfig;
  swingProgress: number;
  supportState: "none" | "left" | "right" | "double";
  captureUrgency: number;
  captureForwardError: number;
  captureLateralError: number;
  yawError: number;
}) {
  const {
    swingSide,
    supportCenter,
    rootPosition,
    stanceFootPosition,
    facingForward,
    facingRight,
    stepLengthTarget,
    stepWidthTarget,
    stepHeightTarget,
    gaitEffort,
    gaitConfig,
    swingProgress,
    supportState,
    captureUrgency,
    captureForwardError,
    captureLateralError,
    yawError,
  } = params;
  const clearanceProfile = Math.sin(
    Math.PI * MathUtils.clamp(swingProgress, 0, 1),
  );
  const baseSwingForwardOffset =
    MathUtils.lerp(-stepLengthTarget * 0.28, stepLengthTarget * 0.76, swingProgress)
    * (supportState === "double" ? 0.92 : 1);
  const minWidth = Math.max(0.14, stepWidthTarget * 0.74);
  const maxWidth = Math.max(minWidth + 0.04, stepWidthTarget * 1.32 + captureUrgency * 0.08);
  const baseSwingLateralOffset = (swingSide === "left" ? -1 : 1) * minWidth;
  const headingBias = yawError * (swingSide === "left" ? -0.06 : 0.06);
  const rawForwardOffset =
    baseSwingForwardOffset
    + MathUtils.clamp(
      captureForwardError * MathUtils.lerp(
        gaitConfig.support.captureFeedback.swingForward[0],
        gaitConfig.support.captureFeedback.swingForward[1],
        gaitEffort,
      ),
      -0.1,
      0.22,
    );
  const rawLateralOffset =
    baseSwingLateralOffset
    + headingBias
    + MathUtils.clamp(
      captureLateralError * MathUtils.lerp(
        gaitConfig.support.captureFeedback.swingLateral[0],
        gaitConfig.support.captureFeedback.swingLateral[1],
        gaitEffort,
      ),
      -0.1,
      0.1,
    );
  const stanceForwardOffset =
    (stanceFootPosition[0] - rootPosition[0]) * facingForward[0]
    + (stanceFootPosition[2] - rootPosition[2]) * facingForward[2];
  const stanceLateralOffset =
    (stanceFootPosition[0] - rootPosition[0]) * facingRight[0]
    + (stanceFootPosition[2] - rootPosition[2]) * facingRight[2];
  const desiredSwingForwardOffset =
    stanceForwardOffset
    + MathUtils.clamp(
      rawForwardOffset - stanceForwardOffset,
      -0.18,
      Math.max(0.26, stepLengthTarget * 1.08 + captureUrgency * 0.16),
    );
  const desiredSwingLateralOffset = swingSide === "left"
    ? MathUtils.clamp(
        stanceLateralOffset + MathUtils.clamp(rawLateralOffset - stanceLateralOffset, -maxWidth, -minWidth * 0.45),
        -maxWidth,
        -minWidth,
      )
    : MathUtils.clamp(
        stanceLateralOffset + MathUtils.clamp(rawLateralOffset - stanceLateralOffset, minWidth * 0.45, maxWidth),
        minWidth,
        maxWidth,
      );

  return {
    swingPlacementStrength:
      supportState === "double"
        ? MathUtils.lerp(
            gaitConfig.swing.placement.double[0],
            gaitConfig.swing.placement.double[1],
            gaitEffort,
          )
        : MathUtils.lerp(
            gaitConfig.swing.placement.single[0],
            gaitConfig.swing.placement.single[1],
            gaitEffort,
          ) + captureUrgency * 1.2,
    swingDrive: MathUtils.lerp(
      gaitConfig.swing.drive[0],
      gaitConfig.swing.drive[1],
      gaitEffort,
    ),
    swingHeightDriveGain: MathUtils.lerp(
      gaitConfig.swing.heightDrive[0],
      gaitConfig.swing.heightDrive[1],
      gaitEffort,
    ),
    desiredSwingForwardOffset,
    desiredSwingLateralOffset,
    desiredSwingHeight: supportCenter[1] + stepHeightTarget * clearanceProfile,
    plannedFootfall: [
      supportCenter[0]
        + facingForward[0] * desiredSwingForwardOffset
        + facingRight[0] * desiredSwingLateralOffset,
      supportCenter[1],
      supportCenter[2]
        + facingForward[2] * desiredSwingForwardOffset
        + facingRight[2] * desiredSwingLateralOffset,
    ] satisfies CharacterCtrlrVec3,
  };
}
