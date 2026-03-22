import type { CharacterCtrlrMovementMode } from "../../types";
import type { CharacterCtrlrHumanoidRevoluteJointKey } from "../CharacterCtrlrHumanoidData";
import { CHARACTER_CTRLR_HUMANOID_REVOLUTE_JOINT_DEFINITIONS } from "../CharacterCtrlrHumanoidData";
import type { CharacterCtrlrGaitConfig, RevoluteJointPoseMap } from "./controllerTypes";

export const GRAVITY = 9.81;
export const FOOT_SUPPORT_OFFSET = 0.08;
export const STAND_PELVIS_HEIGHT = 1.9;
export const STAND_ASSIST_MAX_SPEED = 0.42;
export const STAND_FOOT_LATERAL_OFFSET = 0.18;
export const STAND_FOOT_FORWARD_OFFSET = 0.12;
export const STAND_SEGMENT_MAX_TORQUE = 0.6;
export const STAND_HIP_TARGET = -0.08;
export const STAND_KNEE_TARGET = -0.22;
export const STAND_ANKLE_TARGET = 0.08;
export const NEUTRAL_SHOULDER_TARGET = 0.1;
export const NEUTRAL_ELBOW_TARGET = -0.34;
export const NEUTRAL_WRIST_TARGET = 0;
export const GROUNDED_GRACE_PERIOD = 0.08;
export const GROUNDING_MIN_DURATION = 0.03;
export const GROUND_PROBE_ORIGIN_OFFSET = 0.06;
export const GROUND_PROBE_MAX_DISTANCE = 0.26;
export const GROUND_PROBE_NORMAL_MIN_Y = 0.35;
export const STAND_BOOTSTRAP_SETTLE_DURATION = 0.25;
export const MIXAMO_CONTROL_ENABLED = false;
export const MIN_GAIT_PHASE_HOLD = 0.05;

export const REVOLUTE_JOINT_LIMITS = Object.fromEntries(
  CHARACTER_CTRLR_HUMANOID_REVOLUTE_JOINT_DEFINITIONS.map((definition) => [
    definition.key,
    definition.limits,
  ]),
) as Record<CharacterCtrlrHumanoidRevoluteJointKey, [number, number]>;

export const NEUTRAL_ARTICULATED_POSE: RevoluteJointPoseMap = {
  shoulderLeft: NEUTRAL_SHOULDER_TARGET,
  shoulderRight: NEUTRAL_SHOULDER_TARGET,
  hipLeft: STAND_HIP_TARGET,
  hipRight: STAND_HIP_TARGET,
  elbowLeft: NEUTRAL_ELBOW_TARGET,
  wristLeft: NEUTRAL_WRIST_TARGET,
  elbowRight: NEUTRAL_ELBOW_TARGET,
  wristRight: NEUTRAL_WRIST_TARGET,
  kneeLeft: STAND_KNEE_TARGET,
  ankleLeft: STAND_ANKLE_TARGET,
  kneeRight: STAND_KNEE_TARGET,
  ankleRight: STAND_ANKLE_TARGET,
};

export const GAIT_CONFIGS: Record<
  "idle" | "walk" | "run" | "crouch",
  CharacterCtrlrGaitConfig
> = {
  idle: {
    commandEffort: 0,
    postureAmount: 0,
    cadenceRange: [0, 0],
    phaseDurations: {
      doubleSupport: [0.22, 0.22],
      stance: [0.46, 0.46],
      airborne: 0.12,
    },
    step: {
      length: [0, 0],
      width: [0.2, 0.2],
      height: [0.02, 0.02],
      pelvisLeadScale: [0, 0],
      pelvisHeight: [1.72, 1.72],
    },
    support: {
      centering: { double: 3.2, single: 5.4 },
      forwarding: {
        double: [1.6, 1.6],
        single: [3.1, 3.1],
      },
      captureFeedback: {
        lateral: [0.45, 0.45],
        forward: [0.5, 0.5],
        swingLateral: [0.22, 0.22],
        swingForward: [0.35, 0.35],
      },
      phaseCompression: 0.72,
    },
    swing: {
      placement: {
        double: [4.8, 4.8],
        single: [3.8, 3.8],
      },
      drive: [0.38, 0.38],
      heightDrive: [12, 12],
    },
    pose: {
      baseHip: [0, 0],
      baseKnee: [0, 0],
      baseAnkle: [0.02, 0.02],
      baseShoulder: [0.1, 0.1],
      baseElbow: [-0.34, -0.34],
      pelvisPitch: [0, 0],
      chestPitch: [0.02, 0.02],
      doubleSupportCompression: [0.01, 0.01],
      doubleSupportArmCounter: [0.04, 0.04],
      swingReach: [-0.04, 0.08],
      stanceDrive: [0.02, 0.02],
      pelvisLean: [0.01, 0.01],
      pelvisRoll: [0.01, 0.01],
      shoulderDrive: [0.16, 0.16],
      elbowDrive: [0.04, 0.04],
      swingKnee: [0.06, 0.06],
      swingAnkle: [0.02, 0.02],
    },
  },
  walk: {
    commandEffort: 0.6,
    postureAmount: 0,
    cadenceRange: [2.8, 5.2],
    phaseDurations: {
      doubleSupport: [0.22, 0.12],
      stance: [0.46, 0.28],
      airborne: 0.12,
    },
    step: {
      length: [0.22, 0.54],
      width: [0.2, 0.24],
      height: [0.08, 0.2],
      pelvisLeadScale: [0.32, 0.44],
      pelvisHeight: [1.34, 1.08],
    },
    support: {
      centering: { double: 3.2, single: 5.4 },
      forwarding: {
        double: [1.6, 2.6],
        single: [3.1, 4.4],
      },
      captureFeedback: {
        lateral: [0.45, 0.8],
        forward: [0.5, 0.92],
        swingLateral: [0.22, 0.42],
        swingForward: [0.35, 0.65],
      },
      phaseCompression: 0.72,
    },
    swing: {
      placement: {
        double: [4.8, 7.4],
        single: [3.8, 5.8],
      },
      drive: [0.38, 0.62],
      heightDrive: [12, 18],
    },
    pose: {
      baseHip: [0.02, -0.22],
      baseKnee: [-0.08, -0.68],
      baseAnkle: [0.08, -0.08],
      baseShoulder: [0.1, 0.2],
      baseElbow: [-0.34, -0.48],
      pelvisPitch: [-0.01, -0.08],
      chestPitch: [0.03, 0.14],
      doubleSupportCompression: [0.04, 0.14],
      doubleSupportArmCounter: [0.04, 0.12],
      swingReach: [-0.12, 0.34],
      stanceDrive: [0.08, 0.18],
      pelvisLean: [0.03, 0.11],
      pelvisRoll: [0.03, 0.09],
      shoulderDrive: [0.16, 0.4],
      elbowDrive: [0.04, 0.18],
      swingKnee: [0.18, 0.48],
      swingAnkle: [0.08, 0.22],
    },
  },
  run: {
    commandEffort: 0.94,
    postureAmount: 0.12,
    cadenceRange: [4.6, 6.8],
    phaseDurations: {
      doubleSupport: [0.16, 0.08],
      stance: [0.34, 0.2],
      airborne: 0.14,
    },
    step: {
      length: [0.34, 0.72],
      width: [0.16, 0.18],
      height: [0.12, 0.26],
      pelvisLeadScale: [0.38, 0.52],
      pelvisHeight: [1.32, 1.06],
    },
    support: {
      centering: { double: 3.5, single: 5.8 },
      forwarding: {
        double: [2.1, 3.2],
        single: [3.8, 5.1],
      },
      captureFeedback: {
        lateral: [0.55, 0.95],
        forward: [0.62, 1.1],
        swingLateral: [0.28, 0.48],
        swingForward: [0.45, 0.82],
      },
      phaseCompression: 0.66,
    },
    swing: {
      placement: {
        double: [5.8, 8.8],
        single: [4.4, 6.8],
      },
      drive: [0.52, 0.82],
      heightDrive: [14, 22],
    },
    pose: {
      baseHip: [0, -0.18],
      baseKnee: [-0.12, -0.42],
      baseAnkle: [0.04, -0.06],
      baseShoulder: [0.12, 0.18],
      baseElbow: [-0.32, -0.46],
      pelvisPitch: [-0.03, -0.1],
      chestPitch: [0.04, 0.16],
      doubleSupportCompression: [0.06, 0.12],
      doubleSupportArmCounter: [0.08, 0.18],
      swingReach: [-0.08, 0.48],
      stanceDrive: [0.12, 0.24],
      pelvisLean: [0.06, 0.14],
      pelvisRoll: [0.04, 0.1],
      shoulderDrive: [0.28, 0.56],
      elbowDrive: [0.08, 0.22],
      swingKnee: [0.28, 0.58],
      swingAnkle: [0.14, 0.26],
    },
  },
  crouch: {
    commandEffort: 0.32,
    postureAmount: 1,
    cadenceRange: [2.1, 4],
    phaseDurations: {
      doubleSupport: [0.26, 0.16],
      stance: [0.52, 0.34],
      airborne: 0.12,
    },
    step: {
      length: [0.12, 0.28],
      width: [0.24, 0.28],
      height: [0.06, 0.14],
      pelvisLeadScale: [0.24, 0.34],
      pelvisHeight: [1.16, 1.02],
    },
    support: {
      centering: { double: 3.6, single: 5.9 },
      forwarding: {
        double: [1.4, 2.1],
        single: [2.6, 3.6],
      },
      captureFeedback: {
        lateral: [0.38, 0.66],
        forward: [0.42, 0.74],
        swingLateral: [0.18, 0.3],
        swingForward: [0.24, 0.46],
      },
      phaseCompression: 0.78,
    },
    swing: {
      placement: {
        double: [4.4, 6.2],
        single: [3.4, 4.8],
      },
      drive: [0.28, 0.5],
      heightDrive: [10, 14],
    },
    pose: {
      baseHip: [0.02, -0.22],
      baseKnee: [-0.08, -0.68],
      baseAnkle: [0.08, -0.08],
      baseShoulder: [0.1, 0.2],
      baseElbow: [-0.34, -0.48],
      pelvisPitch: [-0.01, -0.08],
      chestPitch: [0.03, 0.14],
      doubleSupportCompression: [0.06, 0.18],
      doubleSupportArmCounter: [0.02, 0.08],
      swingReach: [-0.08, 0.18],
      stanceDrive: [0.12, 0.22],
      pelvisLean: [0.02, 0.08],
      pelvisRoll: [0.02, 0.06],
      shoulderDrive: [0.08, 0.22],
      elbowDrive: [0.03, 0.12],
      swingKnee: [0.24, 0.54],
      swingAnkle: [0.1, 0.18],
    },
  },
};

export function getGaitConfig(
  locomotionMode: CharacterCtrlrMovementMode,
): CharacterCtrlrGaitConfig {
  switch (locomotionMode) {
    case "run":
      return GAIT_CONFIGS.run;
    case "walk":
      return GAIT_CONFIGS.walk;
    case "crouch":
      return GAIT_CONFIGS.crouch;
    case "idle":
    case "jump":
    case "fall":
    default:
      return GAIT_CONFIGS.idle;
  }
}
