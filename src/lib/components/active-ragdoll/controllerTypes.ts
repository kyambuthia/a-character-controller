import type { CharacterCtrlrGaitPhase, CharacterCtrlrRecoveryState } from "../../types";
import type { CharacterCtrlrGaitTransitionReason } from "../../types";
import type { CharacterCtrlrHumanoidRevoluteJointKey } from "../CharacterCtrlrHumanoidData";

export type SupportSide = "left" | "right";

export type StandingFootPlant = {
  left: [number, number, number];
  right: [number, number, number];
};

export type PhaseLimbPoseTargets = {
  hip: number;
  knee: number;
  ankle: number;
  shoulder: number;
  elbow: number;
  wrist: number;
};

export type PhasePoseTargets = {
  pelvisPitch: number;
  pelvisRoll: number;
  chestPitch: number;
  chestRoll: number;
  left: PhaseLimbPoseTargets;
  right: PhaseLimbPoseTargets;
};

export type CharacterCtrlrGaitConfig = {
  commandEffort: number;
  postureAmount: number;
  cadenceRange: [number, number];
  phaseDurations: {
    doubleSupport: [number, number];
    stance: [number, number];
    airborne: number;
  };
  step: {
    length: [number, number];
    width: [number, number];
    height: [number, number];
    pelvisLeadScale: [number, number];
    pelvisHeight: [number, number];
  };
  support: {
    centering: {
      double: number;
      single: number;
    };
    forwarding: {
      double: [number, number];
      single: [number, number];
    };
    captureFeedback: {
      lateral: [number, number];
      forward: [number, number];
      swingLateral: [number, number];
      swingForward: [number, number];
    };
    phaseCompression: number;
  };
  swing: {
    placement: {
      double: [number, number];
      single: [number, number];
    };
    drive: [number, number];
    heightDrive: [number, number];
  };
  pose: {
    baseHip: [number, number];
    baseKnee: [number, number];
    baseAnkle: [number, number];
    baseShoulder: [number, number];
    baseElbow: [number, number];
    pelvisPitch: [number, number];
    chestPitch: [number, number];
    doubleSupportCompression: [number, number];
    doubleSupportArmCounter: [number, number];
    swingReach: [number, number];
    stanceDrive: [number, number];
    pelvisLean: [number, number];
    pelvisRoll: [number, number];
    shoulderDrive: [number, number];
    elbowDrive: [number, number];
    swingKnee: [number, number];
    swingAnkle: [number, number];
  };
};

export type GaitState = {
  phase: CharacterCtrlrGaitPhase;
  phaseElapsed: number;
  phaseDuration: number;
  transitionReason: CharacterCtrlrGaitTransitionReason;
  transitionCount: number;
  lastStanceSide: SupportSide;
};

export type RecoveryState = {
  mode: CharacterCtrlrRecoveryState;
  elapsed: number;
};

export type ContactTrackingState = {
  grounded: boolean;
  supportState: "none" | "left" | "right" | "double";
  leftSupportContacts: Map<number, number>;
  rightSupportContacts: Map<number, number>;
  groundedGraceTimer: number;
  groundingConfirmTimer: number;
  rawContactsGrounded: boolean;
  jumpContactClearPending: boolean;
  contactTimestamps: { left: number; right: number };
};

export type RevoluteJointPoseMap = Record<CharacterCtrlrHumanoidRevoluteJointKey, number>;
