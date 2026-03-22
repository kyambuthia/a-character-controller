import { MathUtils } from "three";
import type {
  CharacterCtrlrBalanceState,
  CharacterCtrlrGaitPhase,
  CharacterCtrlrMovementMode,
  CharacterCtrlrRecoveryState,
  CharacterCtrlrSupportState,
} from "../../types";
import { getGaitConfig } from "./config";
import type { CharacterCtrlrGaitConfig, GaitState, RecoveryState, SupportSide } from "./controllerTypes";

export function deriveSupportState(
  leftContactCount: number,
  rightContactCount: number,
): CharacterCtrlrSupportState {
  if (leftContactCount > 0 && rightContactCount > 0) {
    return "double";
  }

  if (leftContactCount > 0) {
    return "left";
  }

  if (rightContactCount > 0) {
    return "right";
  }

  return "none";
}

export function deriveGaitPhaseDuration(
  gaitPhase: CharacterCtrlrGaitPhase,
  gaitEffort: number,
  gaitConfig: CharacterCtrlrGaitConfig,
) {
  switch (gaitPhase) {
    case "double-support":
      return MathUtils.lerp(
        gaitConfig.phaseDurations.doubleSupport[0],
        gaitConfig.phaseDurations.doubleSupport[1],
        gaitEffort,
      );
    case "left-stance":
    case "right-stance":
      return MathUtils.lerp(
        gaitConfig.phaseDurations.stance[0],
        gaitConfig.phaseDurations.stance[1],
        gaitEffort,
      );
    case "airborne":
      return gaitConfig.phaseDurations.airborne;
    case "idle":
    default:
      return 0;
  }
}

export function deriveBalanceState(
  grounded: boolean,
  supportState: CharacterCtrlrSupportState,
  supportLateralError: number,
  supportForwardError: number,
  supportHeightError: number,
): CharacterCtrlrBalanceState {
  if (!grounded || supportState === "none") {
    return "unsupported";
  }

  const supportError = Math.max(
    Math.abs(supportLateralError),
    Math.abs(supportForwardError),
    Math.abs(supportHeightError),
  );

  return supportError > 0.22 ? "recovering" : "balanced";
}

export function transitionGaitState(
  gaitState: GaitState,
  nextPhase: CharacterCtrlrGaitPhase,
  nextDuration: number,
  reason: GaitState["transitionReason"],
) {
  if (gaitState.phase !== nextPhase) {
    gaitState.phase = nextPhase;
    gaitState.phaseElapsed = 0;
    gaitState.transitionReason = reason;
    gaitState.transitionCount += 1;
  }

  gaitState.phaseDuration = nextDuration;

  if (nextPhase === "left-stance") {
    gaitState.lastStanceSide = "left";
  } else if (nextPhase === "right-stance") {
    gaitState.lastStanceSide = "right";
  }
}

export function transitionRecoveryState(
  recoveryState: RecoveryState,
  nextMode: CharacterCtrlrRecoveryState,
) {
  if (recoveryState.mode !== nextMode) {
    recoveryState.mode = nextMode;
    recoveryState.elapsed = 0;
    return;
  }

  recoveryState.elapsed = Math.max(0, recoveryState.elapsed);
}

export function createInitialGaitState(): GaitState {
  return {
    phase: "idle",
    phaseElapsed: 0,
    phaseDuration: 0,
    transitionReason: "initial",
    transitionCount: 0,
    lastStanceSide: "right",
  };
}

export function createInitialRecoveryState(): RecoveryState {
  return {
    mode: "stable",
    elapsed: 0,
  };
}

export function deriveActiveLocomotionMode(
  locomotionCommandActive: boolean,
  locomotionMode: CharacterCtrlrMovementMode,
) {
  return locomotionCommandActive ? locomotionMode : "idle";
}

export function deriveGaitConfigForMode(mode: CharacterCtrlrMovementMode) {
  return getGaitConfig(mode);
}

export function flipSupportSide(side: SupportSide): SupportSide {
  return side === "left" ? "right" : "left";
}
