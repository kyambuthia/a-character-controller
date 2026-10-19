import type { CharacterCtrlrLocomotionDebugState } from "../../types";
import { REVOLUTE_JOINT_LIMITS } from "./config";

export function deriveWarnings(params: {
  groundedAfterControl: boolean;
  supportState: CharacterCtrlrLocomotionDebugState["supportState"];
  supportHeightError: number;
  yawError: number;
  captureUrgency: number;
}) {
  const warnings: string[] = [];
  const {
    groundedAfterControl,
    supportState,
    supportHeightError,
    yawError,
    captureUrgency,
  } = params;

  if (!groundedAfterControl || supportState === "none") {
    warnings.push("lost_support");
  }

  // supportHeightError is target minus measured pelvis height: positive means the pelvis sags
  // below its target, negative means it rides above it.
  if (supportHeightError > 0.18) {
    warnings.push("pelvis_too_low");
  } else if (supportHeightError < -0.18) {
    warnings.push("pelvis_too_high");
  }

  if (Math.abs(yawError) > 0.48) {
    warnings.push("unstable_yaw");
  }

  if (captureUrgency > 0.82) {
    warnings.push("capture_overreach");
  }

  return warnings;
}

export function buildLocomotionDebugState(
  params: Omit<CharacterCtrlrLocomotionDebugState, "legTargetRanges" | "warnings"> & {
    yawError: number;
    captureUrgency: number;
  },
): CharacterCtrlrLocomotionDebugState {
  const {
    grounded,
    supportState,
    supportHeightError,
    yawError,
    captureUrgency,
    ...rest
  } = params;

  return {
    ...rest,
    grounded,
    supportState,
    supportHeightError,
    legTargetRanges: {
      hipLeft: REVOLUTE_JOINT_LIMITS.hipLeft,
      hipRight: REVOLUTE_JOINT_LIMITS.hipRight,
      kneeLeft: REVOLUTE_JOINT_LIMITS.kneeLeft,
      kneeRight: REVOLUTE_JOINT_LIMITS.kneeRight,
      ankleLeft: REVOLUTE_JOINT_LIMITS.ankleLeft,
      ankleRight: REVOLUTE_JOINT_LIMITS.ankleRight,
    },
    warnings: deriveWarnings({
      groundedAfterControl: grounded,
      supportState,
      supportHeightError,
      yawError,
      captureUrgency,
    }),
  };
}
