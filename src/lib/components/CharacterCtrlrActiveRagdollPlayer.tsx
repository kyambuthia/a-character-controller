import { useFrame } from "@react-three/fiber";
import {
  type CollisionEnterPayload,
  type CollisionExitPayload,
  type RapierRigidBody,
  useRapier,
} from "@react-three/rapier";
import {
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import type { RevoluteImpulseJoint } from "@dimforge/rapier3d-compat";
import { Euler, MathUtils, Quaternion, Vector3 } from "three";
import { useCharacterCtrlrStore, useCharacterCtrlrStoreApi } from "../CharacterCtrlrProvider";
import { useCharacterCtrlrKeyboardInput } from "../useCharacterCtrlrKeyboardInput";
import {
  DEFAULT_CHARACTER_CTRLR_INPUT,
  type CharacterCtrlrBalanceState,
  type CharacterCtrlrGaitPhase,
  type CharacterCtrlrGaitTransitionReason,
  type CharacterCtrlrMixamoMotionSource,
  mergeCharacterCtrlrInput,
  type CharacterCtrlrInputState,
  type CharacterCtrlrLocomotionDebugState,
  type CharacterCtrlrMovementMode,
  type CharacterCtrlrPlayerSnapshot,
  type CharacterCtrlrRecoveryState,
  type CharacterCtrlrSupportState,
  type CharacterCtrlrVec3,
} from "../types";
import {
  CHARACTER_CTRLR_HUMANOID_REVOLUTE_JOINT_DEFINITIONS,
  createCharacterCtrlrHumanoidBodyRefs,
  createCharacterCtrlrHumanoidRevoluteJointRefs,
  type CharacterCtrlrHumanoidBodyKey,
  type CharacterCtrlrHumanoidRevoluteJointKey,
  type CharacterCtrlrHumanoidRevoluteJointRefs,
} from "./CharacterCtrlrHumanoidData";
import { CharacterCtrlrHumanoidRagdoll } from "./CharacterCtrlrHumanoidRagdoll";
import {
  CharacterCtrlrMixamoMotionDriver,
  type CharacterCtrlrMixamoPoseTargets,
} from "./CharacterCtrlrMixamoMotionDriver";

const forward = new Vector3();
const right = new Vector3();
const movement = new Vector3();
const pelvisQuaternion = new Quaternion();
const chestQuaternion = new Quaternion();
const pelvisEuler = new Euler(0, 0, 0, "YXZ");
const chestEuler = new Euler(0, 0, 0, "YXZ");
const rawFocus = new Vector3();
const smoothedFocus = new Vector3();
const supportCenter = new Vector3();
const supportCorrection = new Vector3();
const supportForward = new Vector3();
const facingRight = new Vector3();
const facingForward = new Vector3();
const swingCorrection = new Vector3();
const swingLateral = new Vector3();
const tempFootPosition = new Vector3();
const standFootTarget = new Vector3();
const standFootImpulse = new Vector3();
const centerOfMassPosition = new Vector3();
const centerOfMassVelocity = new Vector3();
const capturePointPosition = new Vector3();
const plannedFootfallPosition = new Vector3();
const tempMassPosition = new Vector3();
const tempMassVelocity = new Vector3();
const footQuaternion = new Quaternion();
const footEuler = new Euler(0, 0, 0, "YXZ");
const segmentQuaternion = new Quaternion();
const segmentEuler = new Euler(0, 0, 0, "YXZ");
const jointParentQuaternion = new Quaternion();
const jointChildQuaternion = new Quaternion();
const jointRelativeQuaternion = new Quaternion();
const jointRelativeEuler = new Euler(0, 0, 0, "XYZ");

const GRAVITY = 9.81;
const FOOT_SUPPORT_OFFSET = 0.08;
const STAND_PELVIS_HEIGHT = 1.9;
const STAND_ASSIST_MAX_SPEED = 0.42;
const STAND_FOOT_LATERAL_OFFSET = 0.18;
const STAND_FOOT_FORWARD_OFFSET = 0.12;
const STAND_SEGMENT_MAX_TORQUE = 0.6;
const STAND_HIP_TARGET = -0.08;
const STAND_KNEE_TARGET = -0.22;
const STAND_ANKLE_TARGET = 0.08;
const NEUTRAL_SHOULDER_TARGET = 0.1;
const NEUTRAL_ELBOW_TARGET = -0.34;
const NEUTRAL_WRIST_TARGET = 0;
const GROUNDED_GRACE_PERIOD = 0.08;
const GROUNDING_MIN_DURATION = 0.03;
const GROUND_PROBE_ORIGIN_OFFSET = 0.06;
const GROUND_PROBE_MAX_DISTANCE = 0.26;
const GROUND_PROBE_NORMAL_MIN_Y = 0.35;
const STAND_BOOTSTRAP_SETTLE_DURATION = 0.25;
const MIXAMO_CONTROL_ENABLED = false;
const REVOLUTE_JOINT_LIMITS = Object.fromEntries(
  CHARACTER_CTRLR_HUMANOID_REVOLUTE_JOINT_DEFINITIONS.map((definition) => [
    definition.key,
    definition.limits,
  ]),
) as Record<CharacterCtrlrHumanoidRevoluteJointKey, [number, number]>;
const NEUTRAL_ARTICULATED_POSE: Record<
  CharacterCtrlrHumanoidRevoluteJointKey,
  number
> = {
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

type SupportSide = "left" | "right";

type StandingFootPlant = {
  left: CharacterCtrlrVec3;
  right: CharacterCtrlrVec3;
};

type PhaseLimbPoseTargets = {
  hip: number;
  knee: number;
  ankle: number;
  shoulder: number;
  elbow: number;
  wrist: number;
};

type PhasePoseTargets = {
  pelvisPitch: number;
  pelvisRoll: number;
  chestPitch: number;
  chestRoll: number;
  left: PhaseLimbPoseTargets;
  right: PhaseLimbPoseTargets;
};

type CharacterCtrlrGaitConfig = {
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

const GAIT_CONFIGS: Record<
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

export type CharacterCtrlrActiveRagdollPlayerProps = {
  position?: CharacterCtrlrVec3;
  controls?: "keyboard" | "none";
  input?: Partial<CharacterCtrlrInputState>;
  inputRef?: RefObject<CharacterCtrlrInputState | null>;
  mixamoSource?: CharacterCtrlrMixamoMotionSource;
  walkSpeed?: number;
  runSpeed?: number;
  crouchSpeed?: number;
  acceleration?: number;
  airControl?: number;
  jumpImpulse?: number;
  uprightTorque?: number;
  turnTorque?: number;
  balanceDamping?: number;
  cameraFocusSmoothing?: number;
  cameraFocusHeight?: number;
  cameraFocusLead?: number;
  debug?: boolean;
  onSnapshotChange?: (snapshot: CharacterCtrlrPlayerSnapshot) => void;
  onMovementModeChange?: (
    movementMode: CharacterCtrlrMovementMode,
    previousMovementMode: CharacterCtrlrMovementMode,
  ) => void;
  onGroundedChange?: (grounded: boolean) => void;
  onJump?: (snapshot: CharacterCtrlrPlayerSnapshot) => void;
  onLand?: (snapshot: CharacterCtrlrPlayerSnapshot) => void;
};

function angleDifference(current: number, target: number) {
  return Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
}

function deriveSupportState(
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

function driveJointToPosition(
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

function sampleRevoluteJointAngle(
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

function getGaitConfig(
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

function deriveGaitPhaseDuration(
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

function deriveBalanceState(
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

function buildBaseLimbPoseTargets(
  grounded: boolean,
  gaitConfig: CharacterCtrlrGaitConfig,
) {
  const postureAmount = gaitConfig.postureAmount;
  const hip = grounded
    ? MathUtils.lerp(gaitConfig.pose.baseHip[0], gaitConfig.pose.baseHip[1], postureAmount)
    : -0.08;
  const knee = MathUtils.lerp(
    gaitConfig.pose.baseKnee[0],
    gaitConfig.pose.baseKnee[1],
    postureAmount,
  );
  const ankle = MathUtils.lerp(
    gaitConfig.pose.baseAnkle[0],
    gaitConfig.pose.baseAnkle[1],
    postureAmount,
  );
  const shoulder = grounded
    ? MathUtils.lerp(
        gaitConfig.pose.baseShoulder[0],
        gaitConfig.pose.baseShoulder[1],
        postureAmount,
      )
    : 0.16;
  const elbow = grounded
    ? MathUtils.lerp(
        gaitConfig.pose.baseElbow[0],
        gaitConfig.pose.baseElbow[1],
        postureAmount,
      )
    : -0.42;
  const wrist = grounded ? 0 : -0.05;

  return { hip, knee, ankle, shoulder, elbow, wrist };
}

function derivePhasePoseTargets(params: {
  gaitPhase: CharacterCtrlrGaitPhase;
  gaitPhaseValue: number;
  gaitEffort: number;
  gaitConfig: CharacterCtrlrGaitConfig;
  grounded: boolean;
}): PhasePoseTargets {
  const {
    gaitPhase,
    gaitPhaseValue,
    gaitEffort,
    gaitConfig,
    grounded,
  } = params;
  const base = buildBaseLimbPoseTargets(grounded, gaitConfig);
  const targets: PhasePoseTargets = {
    pelvisPitch: grounded
      ? MathUtils.lerp(
          gaitConfig.pose.pelvisPitch[0],
          gaitConfig.pose.pelvisPitch[1],
          gaitConfig.postureAmount,
        )
      : -0.06,
    pelvisRoll: 0,
    chestPitch: grounded
      ? MathUtils.lerp(
          gaitConfig.pose.chestPitch[0],
          gaitConfig.pose.chestPitch[1],
          gaitConfig.postureAmount,
        )
      : 0.08,
    chestRoll: 0,
    left: { ...base },
    right: { ...base },
  };

  if (!grounded || gaitPhase === "airborne") {
    targets.left.hip = -0.12;
    targets.right.hip = -0.12;
    targets.left.knee = -0.52;
    targets.right.knee = -0.52;
    targets.left.ankle = -0.12;
    targets.right.ankle = -0.12;
    targets.left.shoulder = 0.22;
    targets.right.shoulder = 0.22;
    return targets;
  }

  if (gaitPhase === "idle") {
    return targets;
  }

  if (gaitPhase === "double-support") {
    const supportCompression = MathUtils.lerp(
      gaitConfig.pose.doubleSupportCompression[0],
      gaitConfig.pose.doubleSupportCompression[1],
      gaitEffort,
    );
    const armCounter = MathUtils.lerp(
      gaitConfig.pose.doubleSupportArmCounter[0],
      gaitConfig.pose.doubleSupportArmCounter[1],
      gaitEffort,
    )
      * Math.sin(gaitPhaseValue * Math.PI);
    targets.pelvisPitch -= supportCompression * 0.45;
    targets.chestPitch += supportCompression * 0.3;
    targets.left.hip -= supportCompression;
    targets.right.hip -= supportCompression;
    targets.left.knee -= supportCompression * 0.55;
    targets.right.knee -= supportCompression * 0.55;
    targets.left.ankle += supportCompression * 0.4;
    targets.right.ankle += supportCompression * 0.4;
    targets.left.shoulder += armCounter;
    targets.right.shoulder -= armCounter;
    targets.left.elbow += armCounter * 0.35;
    targets.right.elbow -= armCounter * 0.35;
    return targets;
  }

  const stanceSide: SupportSide =
    gaitPhase === "left-stance" ? "left" : "right";
  const swingSide: SupportSide = stanceSide === "left" ? "right" : "left";
  const swingLift = Math.sin(gaitPhaseValue * Math.PI);
  const swingReach = MathUtils.lerp(
    gaitConfig.pose.swingReach[0],
    gaitConfig.pose.swingReach[1],
    gaitPhaseValue,
  ) * gaitEffort;
  const stanceDrive = MathUtils.lerp(
    gaitConfig.pose.stanceDrive[0],
    gaitConfig.pose.stanceDrive[1],
    gaitEffort,
  );
  const pelvisLean = MathUtils.lerp(
    gaitConfig.pose.pelvisLean[0],
    gaitConfig.pose.pelvisLean[1],
    gaitEffort,
  );
  const pelvisRoll = (stanceSide === "left" ? -1 : 1)
    * MathUtils.lerp(
      gaitConfig.pose.pelvisRoll[0],
      gaitConfig.pose.pelvisRoll[1],
      gaitEffort,
    );
  const shoulderDrive = MathUtils.lerp(
    gaitConfig.pose.shoulderDrive[0],
    gaitConfig.pose.shoulderDrive[1],
    gaitEffort,
  );
  const elbowDrive = MathUtils.lerp(
    gaitConfig.pose.elbowDrive[0],
    gaitConfig.pose.elbowDrive[1],
    gaitEffort,
  ) * swingLift;

  targets.pelvisPitch -= pelvisLean;
  targets.pelvisRoll = pelvisRoll;
  targets.chestPitch += pelvisLean * 0.7;
  targets.chestRoll = -pelvisRoll * 0.6;

  targets[stanceSide].hip -= stanceDrive;
  targets[stanceSide].knee -= stanceDrive * 0.5;
  targets[stanceSide].ankle += stanceDrive * 0.42;

  targets[swingSide].hip += swingReach;
  targets[swingSide].knee -= MathUtils.lerp(
    gaitConfig.pose.swingKnee[0],
    gaitConfig.pose.swingKnee[1],
    gaitEffort,
  ) * swingLift;
  targets[swingSide].ankle -= MathUtils.lerp(
    gaitConfig.pose.swingAnkle[0],
    gaitConfig.pose.swingAnkle[1],
    gaitEffort,
  ) * swingLift;

  targets[stanceSide].shoulder += shoulderDrive;
  targets[swingSide].shoulder -= shoulderDrive;
  targets[stanceSide].elbow += elbowDrive * 0.7;
  targets[swingSide].elbow -= elbowDrive;

  return targets;
}

type GaitState = {
  phase: CharacterCtrlrGaitPhase;
  phaseElapsed: number;
  phaseDuration: number;
  transitionReason: CharacterCtrlrGaitTransitionReason;
  transitionCount: number;
  lastStanceSide: SupportSide;
};

type RecoveryState = {
  mode: CharacterCtrlrRecoveryState;
  elapsed: number;
};

function transitionGaitState(
  gaitState: GaitState,
  nextPhase: CharacterCtrlrGaitPhase,
  nextDuration: number,
  reason: CharacterCtrlrGaitTransitionReason,
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

function transitionRecoveryState(
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

function applyRecoveryPoseTargets(
  targets: PhasePoseTargets,
  recoveryState: CharacterCtrlrRecoveryState,
  recoveryProgress: number,
) {
  if (recoveryState === "stable" || recoveryState === "jumping") {
    return targets;
  }

  const adjustedTargets: PhasePoseTargets = {
    pelvisPitch: targets.pelvisPitch,
    pelvisRoll: targets.pelvisRoll,
    chestPitch: targets.chestPitch,
    chestRoll: targets.chestRoll,
    left: { ...targets.left },
    right: { ...targets.right },
  };

  switch (recoveryState) {
    case "stumbling": {
      const stumbleAmount = MathUtils.lerp(0.08, 0.18, recoveryProgress);
      adjustedTargets.pelvisPitch -= stumbleAmount;
      adjustedTargets.chestPitch += stumbleAmount * 0.6;
      adjustedTargets.left.knee -= stumbleAmount * 0.9;
      adjustedTargets.right.knee -= stumbleAmount * 0.9;
      adjustedTargets.left.ankle += stumbleAmount * 0.35;
      adjustedTargets.right.ankle += stumbleAmount * 0.35;
      adjustedTargets.left.shoulder += stumbleAmount * 0.8;
      adjustedTargets.right.shoulder += stumbleAmount * 0.8;
      adjustedTargets.left.elbow -= stumbleAmount * 0.7;
      adjustedTargets.right.elbow -= stumbleAmount * 0.7;
      break;
    }
    case "landing": {
      const landingCompression = MathUtils.lerp(0.12, 0.02, recoveryProgress);
      adjustedTargets.pelvisPitch -= landingCompression * 0.18;
      adjustedTargets.chestPitch += landingCompression * 0.12;
      adjustedTargets.left.hip -= landingCompression * 0.12;
      adjustedTargets.right.hip -= landingCompression * 0.12;
      adjustedTargets.left.knee -= landingCompression * 0.35;
      adjustedTargets.right.knee -= landingCompression * 0.35;
      adjustedTargets.left.ankle += landingCompression * 0.08;
      adjustedTargets.right.ankle += landingCompression * 0.08;
      break;
    }
    case "fallen": {
      adjustedTargets.pelvisPitch = -0.24;
      adjustedTargets.pelvisRoll = 0;
      adjustedTargets.chestPitch = 0.28;
      adjustedTargets.chestRoll = 0;
      adjustedTargets.left.hip = -0.34;
      adjustedTargets.right.hip = -0.34;
      adjustedTargets.left.knee = -1.02;
      adjustedTargets.right.knee = -1.02;
      adjustedTargets.left.ankle = -0.18;
      adjustedTargets.right.ankle = -0.18;
      adjustedTargets.left.shoulder = 0.26;
      adjustedTargets.right.shoulder = 0.26;
      adjustedTargets.left.elbow = -0.72;
      adjustedTargets.right.elbow = -0.72;
      adjustedTargets.left.wrist = -0.12;
      adjustedTargets.right.wrist = -0.12;
      break;
    }
    case "recovering": {
      const standBlend = MathUtils.clamp(recoveryProgress, 0, 1);
      adjustedTargets.pelvisPitch = MathUtils.lerp(-0.2, -0.08, standBlend);
      adjustedTargets.pelvisRoll *= 0.4;
      adjustedTargets.chestPitch = MathUtils.lerp(0.26, 0.12, standBlend);
      adjustedTargets.chestRoll *= 0.4;
      adjustedTargets.left.hip = MathUtils.lerp(-0.28, adjustedTargets.left.hip, standBlend);
      adjustedTargets.right.hip = MathUtils.lerp(-0.28, adjustedTargets.right.hip, standBlend);
      adjustedTargets.left.knee = MathUtils.lerp(-0.9, adjustedTargets.left.knee, standBlend);
      adjustedTargets.right.knee = MathUtils.lerp(-0.9, adjustedTargets.right.knee, standBlend);
      adjustedTargets.left.ankle = MathUtils.lerp(0.12, adjustedTargets.left.ankle, standBlend);
      adjustedTargets.right.ankle = MathUtils.lerp(0.12, adjustedTargets.right.ankle, standBlend);
      adjustedTargets.left.shoulder = MathUtils.lerp(0.18, adjustedTargets.left.shoulder, standBlend);
      adjustedTargets.right.shoulder = MathUtils.lerp(0.18, adjustedTargets.right.shoulder, standBlend);
      adjustedTargets.left.elbow = MathUtils.lerp(-0.46, adjustedTargets.left.elbow, standBlend);
      adjustedTargets.right.elbow = MathUtils.lerp(-0.46, adjustedTargets.right.elbow, standBlend);
      break;
    }
    default:
      break;
  }

  return adjustedTargets;
}

function applyStandingPoseTargets(targets: PhasePoseTargets) {
  return {
    pelvisPitch: 0.01,
    pelvisRoll: 0,
    chestPitch: 0.02,
    chestRoll: 0,
    left: {
      ...targets.left,
      hip: NEUTRAL_ARTICULATED_POSE.hipLeft,
      knee: NEUTRAL_ARTICULATED_POSE.kneeLeft,
      ankle: NEUTRAL_ARTICULATED_POSE.ankleLeft,
      shoulder: NEUTRAL_ARTICULATED_POSE.shoulderLeft,
      elbow: NEUTRAL_ARTICULATED_POSE.elbowLeft,
      wrist: NEUTRAL_ARTICULATED_POSE.wristLeft,
    },
    right: {
      ...targets.right,
      hip: NEUTRAL_ARTICULATED_POSE.hipRight,
      knee: NEUTRAL_ARTICULATED_POSE.kneeRight,
      ankle: NEUTRAL_ARTICULATED_POSE.ankleRight,
      shoulder: NEUTRAL_ARTICULATED_POSE.shoulderRight,
      elbow: NEUTRAL_ARTICULATED_POSE.elbowRight,
      wrist: NEUTRAL_ARTICULATED_POSE.wristRight,
    },
  } satisfies PhasePoseTargets;
}

function blendPhasePoseTargets(
  baseTargets: PhasePoseTargets,
  targetTargets: CharacterCtrlrMixamoPoseTargets,
  blend: number,
) {
  const weight = MathUtils.clamp(blend, 0, 1);

  return {
    pelvisPitch: MathUtils.lerp(baseTargets.pelvisPitch, targetTargets.pelvisPitch, weight),
    pelvisRoll: MathUtils.lerp(baseTargets.pelvisRoll, targetTargets.pelvisRoll, weight),
    chestPitch: MathUtils.lerp(baseTargets.chestPitch, targetTargets.chestPitch, weight),
    chestRoll: MathUtils.lerp(baseTargets.chestRoll, targetTargets.chestRoll, weight),
    left: {
      hip: MathUtils.lerp(baseTargets.left.hip, targetTargets.left.hip, weight),
      knee: MathUtils.lerp(baseTargets.left.knee, targetTargets.left.knee, weight),
      ankle: MathUtils.lerp(baseTargets.left.ankle, targetTargets.left.ankle, weight),
      shoulder: MathUtils.lerp(baseTargets.left.shoulder, targetTargets.left.shoulder, weight),
      elbow: MathUtils.lerp(baseTargets.left.elbow, targetTargets.left.elbow, weight),
      wrist: MathUtils.lerp(baseTargets.left.wrist, targetTargets.left.wrist, weight),
    },
    right: {
      hip: MathUtils.lerp(baseTargets.right.hip, targetTargets.right.hip, weight),
      knee: MathUtils.lerp(baseTargets.right.knee, targetTargets.right.knee, weight),
      ankle: MathUtils.lerp(baseTargets.right.ankle, targetTargets.right.ankle, weight),
      shoulder: MathUtils.lerp(baseTargets.right.shoulder, targetTargets.right.shoulder, weight),
      elbow: MathUtils.lerp(baseTargets.right.elbow, targetTargets.right.elbow, weight),
      wrist: MathUtils.lerp(baseTargets.right.wrist, targetTargets.right.wrist, weight),
    },
  } satisfies PhasePoseTargets;
}

export function CharacterCtrlrActiveRagdollPlayer({
  position = [0, 2.02, 6],
  controls = "keyboard",
  input,
  inputRef,
  mixamoSource,
  walkSpeed = 2.7,
  runSpeed = 4.7,
  crouchSpeed = 1.7,
  acceleration = 6.2,
  airControl = 0.26,
  jumpImpulse = 5.2,
  uprightTorque = 14,
  turnTorque = 5.6,
  balanceDamping = 6.8,
  cameraFocusSmoothing = 12,
  cameraFocusHeight = 0.28,
  cameraFocusLead = 0.16,
  debug = false,
  onSnapshotChange,
  onMovementModeChange,
  onGroundedChange,
  onJump,
  onLand,
}: CharacterCtrlrActiveRagdollPlayerProps) {
  const { rapier, world } = useRapier();
  const storeApi = useCharacterCtrlrStoreApi();
  const setPlayerSnapshot = useCharacterCtrlrStore((state) => state.setPlayerSnapshot);
  const bodyRefs = useMemo(() => createCharacterCtrlrHumanoidBodyRefs(), []);
  const bodyRefList = useMemo(() => Object.values(bodyRefs), [bodyRefs]);
  const jointRefs = useMemo(() => createCharacterCtrlrHumanoidRevoluteJointRefs(), []);
  const keyboardInputRef = useCharacterCtrlrKeyboardInput(controls === "keyboard");
  const idleInputRef = useRef<CharacterCtrlrInputState | null>({ ...DEFAULT_CHARACTER_CTRLR_INPUT });
  const groundedRef = useRef(false);
  const leftSupportContactsRef = useRef<Map<number, number>>(new Map());
  const rightSupportContactsRef = useRef<Map<number, number>>(new Map());
  const supportStateRef = useRef<CharacterCtrlrSupportState>("none");
  const movementModeRef = useRef<CharacterCtrlrMovementMode>("idle");
  const hasMovementInputRef = useRef(false);
  const jumpHeldRef = useRef(false);
  const gaitPhaseRef = useRef(0);
  const gaitStateRef = useRef<GaitState>({
    phase: "idle",
    phaseElapsed: 0,
    phaseDuration: 0,
    transitionReason: "initial",
    transitionCount: 0,
    lastStanceSide: "right",
  });
  const recoveryStateRef = useRef<RecoveryState>({
    mode: "stable",
    elapsed: 0,
  });
  const lastSnapshotRef = useRef<CharacterCtrlrPlayerSnapshot | null>(null);
  const lastTransitionCountRef = useRef(0);
  const transitionHistoryRef = useRef<string[]>([]);
  const focusPositionRef = useRef<CharacterCtrlrVec3 | null>(null);
  const locomotionDebugRef = useRef<CharacterCtrlrLocomotionDebugState | null>(null);
  const initialPositionRef = useRef(position);
  const standingFootPlantRef = useRef<StandingFootPlant | null>(null);
  const mixamoPoseRef = useRef<CharacterCtrlrMixamoPoseTargets | null>(null);
  const jointCalibrationRef = useRef<Partial<Record<CharacterCtrlrHumanoidRevoluteJointKey, number>>>({});
  const jointCalibrationReadyRef = useRef(false);
  const debugLogCooldownRef = useRef(0);
  const groundedGraceTimerRef = useRef(0);
  const groundingConfirmTimerRef = useRef(0);
  const rawContactsGroundedRef = useRef(false);
  const jumpContactClearPendingRef = useRef(false);
  const contactTimestampsRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  const smoothedGaitEffortRef = useRef(0);
  const standBootstrapTimerRef = useRef(0);

  const commitGrounded = (nextGrounded: boolean) => {
    if (groundedRef.current === nextGrounded) {
      return;
    }

    groundedRef.current = nextGrounded;
    onGroundedChange?.(nextGrounded);
  };

  const syncSupportState = () => {
    const nextSupportState = deriveSupportState(
      leftSupportContactsRef.current.size,
      rightSupportContactsRef.current.size,
    );

    supportStateRef.current = nextSupportState;
    const hasContacts = nextSupportState !== "none";
    rawContactsGroundedRef.current = hasContacts;

    if (hasContacts) {
      groundedGraceTimerRef.current = 0;

      if (groundedRef.current) {
        groundingConfirmTimerRef.current = GROUNDING_MIN_DURATION;
      }
    }

    return nextSupportState;
  };

  const addSupportContact = (side: SupportSide, colliderHandle: number) => {
    if (jumpContactClearPendingRef.current) {
      return;
    }

    const supportContacts =
      side === "left"
        ? leftSupportContactsRef.current
        : rightSupportContactsRef.current;
    const count = supportContacts.get(colliderHandle) ?? 0;
    supportContacts.set(colliderHandle, count + 1);

    if (count === 0) {
      contactTimestampsRef.current[side] = performance.now();
    }

    syncSupportState();
  };

  const removeSupportContact = (side: SupportSide, colliderHandle: number) => {
    const supportContacts =
      side === "left"
        ? leftSupportContactsRef.current
        : rightSupportContactsRef.current;
    const count = supportContacts.get(colliderHandle);

    if (!count) {
      return;
    }

    if (count === 1) {
      supportContacts.delete(colliderHandle);
    } else {
      supportContacts.set(colliderHandle, count - 1);
    }
  };

  const createGroundContactEnterHandler =
    (side: SupportSide) => (payload: CollisionEnterPayload) => {
      const normal = payload.manifold.normal();
      const supportY = payload.flipped ? normal.y : -normal.y;

      if (supportY < 0.2) {
        return;
      }

      addSupportContact(side, payload.other.collider.handle);
    };

  const createGroundContactExitHandler =
    (side: SupportSide) => (payload: CollisionExitPayload) => {
      removeSupportContact(side, payload.other.collider.handle);
      syncSupportState();
    };

  useEffect(() => {
    const initialSnapshot: CharacterCtrlrPlayerSnapshot = {
      position: initialPositionRef.current,
      focusPosition: [
        initialPositionRef.current[0],
        initialPositionRef.current[1] + 1.2,
        initialPositionRef.current[2],
      ],
      facing: storeApi.getState().playerFacing,
      movementMode: "idle",
      grounded: false,
      supportState: "none",
      velocity: [0, 0, 0],
    };

    setPlayerSnapshot(initialSnapshot);
    lastSnapshotRef.current = initialSnapshot;
    onSnapshotChange?.(initialSnapshot);
  }, [onSnapshotChange, setPlayerSnapshot, storeApi]);

  useFrame((_, delta) => {
    const pelvis = bodyRefs.pelvis.current;
    const chest = bodyRefs.chest.current;
    const upperLegLeft = bodyRefs.upperLegLeft.current;
    const lowerLegLeft = bodyRefs.lowerLegLeft.current;
    const leftFoot = bodyRefs.footLeft.current;
    const upperLegRight = bodyRefs.upperLegRight.current;
    const lowerLegRight = bodyRefs.lowerLegRight.current;
    const rightFoot = bodyRefs.footRight.current;

    if (
      !pelvis
      || !chest
      || !upperLegLeft
      || !lowerLegLeft
      || !leftFoot
      || !upperLegRight
      || !lowerLegRight
      || !rightFoot
    ) {
      return;
    }

    if (!jointCalibrationReadyRef.current) {
      const nextCalibration: Partial<Record<CharacterCtrlrHumanoidRevoluteJointKey, number>> = {};
      let calibrationReady = true;

      for (const definition of CHARACTER_CTRLR_HUMANOID_REVOLUTE_JOINT_DEFINITIONS) {
        const bodyA = bodyRefs[definition.bodyA].current;
        const bodyB = bodyRefs[definition.bodyB].current;

        if (!bodyA || !bodyB) {
          calibrationReady = false;
          break;
        }

        const sampledAngle = sampleRevoluteJointAngle(bodyA, bodyB);
        nextCalibration[definition.key] =
          sampledAngle - NEUTRAL_ARTICULATED_POSE[definition.key];
      }

      if (calibrationReady) {
        jointCalibrationRef.current = nextCalibration;
        jointCalibrationReadyRef.current = true;
      }
    }

    const internalInput =
      controls === "keyboard"
        ? keyboardInputRef.current ?? DEFAULT_CHARACTER_CTRLR_INPUT
        : idleInputRef.current ?? DEFAULT_CHARACTER_CTRLR_INPUT;
    const keys = mergeCharacterCtrlrInput(input, inputRef?.current, internalInput);
    const { cameraYaw, playerFacing } = storeApi.getState();

    forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    right.set(-forward.z, 0, forward.x);
    movement.set(0, 0, 0);

    if (keys.forward) movement.add(forward);
    if (keys.backward) movement.sub(forward);
    if (keys.right) movement.add(right);
    if (keys.left) movement.sub(right);

    const hasMovementInput = movement.lengthSq() > 0;
    hasMovementInputRef.current = hasMovementInput;
    if (hasMovementInput) {
      movement.normalize();
    }

    const locomotionMode: CharacterCtrlrMovementMode = keys.crouch
      ? "crouch"
      : hasMovementInput && keys.run
        ? "run"
        : hasMovementInput
          ? "walk"
          : "idle";

    const leftFootPos = leftFoot.translation();
    const rightFootPos = rightFoot.translation();
    const ownBodyHandles = new Set<number>();

    for (const bodyRef of bodyRefList) {
      const body = bodyRef.current;

      if (!body) {
        continue;
      }

      ownBodyHandles.add(body.handle);
    }

    const groundProbePredicate = (collider: { parent: () => { handle: number } | null }) => {
      const parentBody = collider.parent();
      return !parentBody || !ownBodyHandles.has(parentBody.handle);
    };
    const castGroundProbe = (origin: { x: number; y: number; z: number }) => {
      const hit = world.castRayAndGetNormal(
        new rapier.Ray(
          {
            x: origin.x,
            y: origin.y + GROUND_PROBE_ORIGIN_OFFSET,
            z: origin.z,
          },
          { x: 0, y: -1, z: 0 },
        ),
        GROUND_PROBE_MAX_DISTANCE,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        groundProbePredicate,
      );

      return hit && hit.normal.y >= GROUND_PROBE_NORMAL_MIN_Y ? hit : null;
    };
    const leftGroundProbeHit = castGroundProbe(leftFootPos);
    const rightGroundProbeHit = castGroundProbe(rightFootPos);
    const probedSupportState: CharacterCtrlrSupportState =
      leftGroundProbeHit && rightGroundProbeHit
        ? "double"
        : leftGroundProbeHit
          ? "left"
          : rightGroundProbeHit
            ? "right"
            : "none";
    const effectiveGroundedSignal =
      rawContactsGroundedRef.current
      || (
        probedSupportState !== "none"
        && !jumpContactClearPendingRef.current
        && Math.abs(pelvis.linvel().y) < 2.0
      );

    if (effectiveGroundedSignal) {
      groundedGraceTimerRef.current = 0;
      groundingConfirmTimerRef.current += delta;

      if (!groundedRef.current && groundingConfirmTimerRef.current >= GROUNDING_MIN_DURATION) {
        commitGrounded(true);
      }

      if (!rawContactsGroundedRef.current && probedSupportState !== "none") {
        supportStateRef.current = probedSupportState;
      }
    } else {
      groundingConfirmTimerRef.current = 0;

      if (groundedRef.current) {
        groundedGraceTimerRef.current += delta;

        if (groundedGraceTimerRef.current >= GROUNDED_GRACE_PERIOD) {
          commitGrounded(false);

          if (!rawContactsGroundedRef.current) {
            supportStateRef.current = "none";
          }
        }
      } else if (!rawContactsGroundedRef.current) {
        supportStateRef.current = "none";
      }
    }

    const actualSupportState = supportStateRef.current;
    const grounded = groundedRef.current;
    const currentVelocity = pelvis.linvel();
    const pelvisMass = pelvis.mass();
    const horizontalSpeed = Math.hypot(currentVelocity.x, currentVelocity.z);
    const standingAssistRequested =
      grounded
      && (
        !hasMovementInput
        || horizontalSpeed < STAND_ASSIST_MAX_SPEED
      );
    const standBootstrapActive =
      standingAssistRequested
      && standBootstrapTimerRef.current < STAND_BOOTSTRAP_SETTLE_DURATION;
    const spawnSettleActive = standBootstrapActive || !jointCalibrationReadyRef.current;
    const locomotionCommandActive = hasMovementInput && !spawnSettleActive;
    const activeLocomotionMode: CharacterCtrlrMovementMode =
      locomotionCommandActive ? locomotionMode : "idle";
    const activeLocomotionSpeed =
      activeLocomotionMode === "run"
        ? runSpeed
        : activeLocomotionMode === "walk"
          ? walkSpeed
          : activeLocomotionMode === "crouch"
            ? crouchSpeed
            : 0;
    const gaitConfig = getGaitConfig(activeLocomotionMode);
    const locomotionBlend = Math.min(
      1,
      acceleration
      * delta
      * (
        actualSupportState === "double"
          ? 1
          : actualSupportState === "none"
            ? airControl
            : 0.82
      ),
    );
    const commandedVelocityX = locomotionCommandActive ? movement.x * activeLocomotionSpeed : 0;
    const commandedVelocityZ = locomotionCommandActive ? movement.z * activeLocomotionSpeed : 0;
    const deltaVelocityX = (commandedVelocityX - currentVelocity.x) * locomotionBlend;
    const deltaVelocityZ = (commandedVelocityZ - currentVelocity.z) * locomotionBlend;

    pelvis.applyImpulse(
      {
        x: deltaVelocityX * pelvisMass,
        y: 0,
        z: deltaVelocityZ * pelvisMass,
      },
      true,
    );
    chest.applyImpulse(
      {
        x: deltaVelocityX * pelvisMass * 0.18,
        y: 0,
        z: deltaVelocityZ * pelvisMass * 0.18,
      },
      true,
    );

    const jumpPressed = keys.jump;
    const jumpTriggered = grounded && jumpPressed && !jumpHeldRef.current;
    jumpHeldRef.current = jumpPressed;

    if (jumpTriggered) {
      jumpContactClearPendingRef.current = true;
      commitGrounded(false);
      groundedGraceTimerRef.current = 0;
      groundingConfirmTimerRef.current = 0;
      rawContactsGroundedRef.current = false;
      pelvis.applyImpulse(
        { x: 0, y: jumpImpulse * pelvisMass, z: 0 },
        true,
      );
      chest.applyImpulse(
        { x: 0, y: jumpImpulse * chest.mass() * 0.35, z: 0 },
        true,
      );
    }

    if (jumpContactClearPendingRef.current && currentVelocity.y > 0.5) {
      leftSupportContactsRef.current.clear();
      rightSupportContactsRef.current.clear();
      supportStateRef.current = "none";
      jumpContactClearPendingRef.current = false;
    } else if (jumpContactClearPendingRef.current && !jumpTriggered && currentVelocity.y <= 0) {
      jumpContactClearPendingRef.current = false;
    }

    const supportStateAfterJump = jumpTriggered ? "none" : supportStateRef.current;
    const targetFacing = hasMovementInput
      ? Math.atan2(movement.x, movement.z)
      : playerFacing;
    const pelvisRotation = pelvis.rotation();
    const pelvisAngularVelocity = pelvis.angvel();

    pelvisQuaternion.set(
      pelvisRotation.x,
      pelvisRotation.y,
      pelvisRotation.z,
      pelvisRotation.w,
    );
    pelvisEuler.setFromQuaternion(pelvisQuaternion, "YXZ");

    const pelvisTorqueScale = grounded ? 1 : airControl;
    const yawError = angleDifference(pelvisEuler.y, targetFacing);
    const speedRatio = Math.min(1, horizontalSpeed / Math.max(0.001, runSpeed));
    const commandEffort = locomotionCommandActive ? gaitConfig.commandEffort : 0;
    const rawGaitEffort =
      grounded && locomotionCommandActive ? Math.max(speedRatio, commandEffort) : speedRatio;
    smoothedGaitEffortRef.current = MathUtils.damp(
      smoothedGaitEffortRef.current,
      rawGaitEffort,
      8.0,
      delta,
    );
    const gaitEffort = smoothedGaitEffortRef.current;
    const postureAmount = gaitConfig.postureAmount;
    const airborneAmount = grounded ? 0 : 1;
    const gaitState = gaitStateRef.current;
    gaitState.phaseElapsed += delta;
    const cadence = MathUtils.lerp(
      gaitConfig.cadenceRange[0],
      gaitConfig.cadenceRange[1],
      gaitEffort,
    );
    if (grounded && locomotionCommandActive) {
      gaitPhaseRef.current += delta * cadence;
    }

    const supportStateForPhase =
      spawnSettleActive && supportStateAfterJump !== "none"
        ? "double"
        : supportStateAfterJump;
    
    const MIN_PHASE_HOLD = 0.05;
    const canTransition = gaitState.phaseElapsed >= MIN_PHASE_HOLD;

    if (!grounded || supportStateForPhase === "none") {
      transitionGaitState(
        gaitState,
        "airborne",
        deriveGaitPhaseDuration("airborne", gaitEffort, gaitConfig),
        jumpTriggered ? "jump" : "support-lost",
      );
    } else if (spawnSettleActive) {
      transitionGaitState(
        gaitState,
        locomotionCommandActive ? "double-support" : "idle",
        locomotionCommandActive
          ? deriveGaitPhaseDuration("double-support", gaitEffort, gaitConfig)
          : 0,
        locomotionCommandActive ? "movement-start" : "idle-no-input",
      );
    } else if (!locomotionCommandActive && gaitState.phase !== "idle" && canTransition) {
      transitionGaitState(gaitState, "idle", 0, "idle-no-input");
    } else if (supportStateForPhase === "left" && gaitState.phase !== "left-stance" && canTransition) {
      transitionGaitState(
        gaitState,
        "left-stance",
        deriveGaitPhaseDuration("left-stance", gaitEffort, gaitConfig),
        "left-foot-support",
      );
    } else if (supportStateForPhase === "right" && gaitState.phase !== "right-stance" && canTransition) {
      transitionGaitState(
        gaitState,
        "right-stance",
        deriveGaitPhaseDuration("right-stance", gaitEffort, gaitConfig),
        "right-foot-support",
      );
    } else if (gaitState.phase === "airborne") {
      transitionGaitState(
        gaitState,
        "double-support",
        deriveGaitPhaseDuration("double-support", gaitEffort, gaitConfig),
        "landing-support",
      );
    } else if (gaitState.phase === "idle") {
      transitionGaitState(
        gaitState,
        "double-support",
        deriveGaitPhaseDuration("double-support", gaitEffort, gaitConfig),
        "movement-start",
      );
    } else if (
      gaitState.phase === "double-support"
      && gaitState.phaseDuration > 0
      && gaitState.phaseElapsed >= gaitState.phaseDuration
    ) {
      const nextStanceSide: SupportSide =
        gaitState.lastStanceSide === "left" ? "right" : "left";
      transitionGaitState(
        gaitState,
        nextStanceSide === "left" ? "left-stance" : "right-stance",
        deriveGaitPhaseDuration(
          nextStanceSide === "left" ? "left-stance" : "right-stance",
          gaitEffort,
          gaitConfig,
        ),
        "double-support-timeout",
      );
    } else if (
      (gaitState.phase === "left-stance" || gaitState.phase === "right-stance")
      && gaitState.phaseDuration > 0
      && gaitState.phaseElapsed >= gaitState.phaseDuration
      && supportStateForPhase === "double"
    ) {
      transitionGaitState(
        gaitState,
        "double-support",
        deriveGaitPhaseDuration("double-support", gaitEffort, gaitConfig),
        "stance-timeout",
      );
    } else {
      gaitState.phaseDuration = deriveGaitPhaseDuration(
        gaitState.phase,
        gaitEffort,
        gaitConfig,
      );
    }
    const gaitPhaseValue = gaitState.phaseDuration > 0
      ? Math.min(1, gaitState.phaseElapsed / gaitState.phaseDuration)
      : 0;
    if (gaitState.transitionCount !== lastTransitionCountRef.current) {
      lastTransitionCountRef.current = gaitState.transitionCount;
      transitionHistoryRef.current = [
        `${gaitState.phase}:${gaitState.transitionReason}`,
        ...transitionHistoryRef.current,
      ].slice(0, 4);
    }
    const rootPosition = pelvis.translation();
    const chestPosition = chest.translation();
    const predictedVelocityY = jumpTriggered
      ? currentVelocity.y + jumpImpulse
      : currentVelocity.y;
    const groundedAfterControl = groundedRef.current;
    const nextMovementMode: CharacterCtrlrMovementMode = groundedAfterControl
      ? activeLocomotionMode
      : predictedVelocityY > 0.35
        ? "jump"
        : "fall";
    const facing = MathUtils.damp(
      playerFacing,
      targetFacing,
      groundedAfterControl ? 10 : 4,
      delta,
    );
    let phasePoseTargets = derivePhasePoseTargets({
      gaitPhase: gaitState.phase,
      gaitPhaseValue,
      gaitEffort,
      gaitConfig,
      grounded: groundedAfterControl,
    });
    const chestRotation = chest.rotation();
    const chestAngularVelocity = chest.angvel();
    const chestMass = chest.mass();

    chestQuaternion.set(
      chestRotation.x,
      chestRotation.y,
      chestRotation.z,
      chestRotation.w,
    );
    chestEuler.setFromQuaternion(chestQuaternion, "YXZ");
    const previousSnapshot = lastSnapshotRef.current;

    const plannedSupportSide: SupportSide | null =
      gaitState.phase === "left-stance"
        ? "left"
        : gaitState.phase === "right-stance"
          ? "right"
          : supportStateForPhase === "left"
            ? "left"
            : supportStateForPhase === "right"
              ? "right"
              : null;
    const swingSide: SupportSide | null =
      plannedSupportSide === "left"
        ? "right"
        : plannedSupportSide === "right"
          ? "left"
          : null;

    facingRight.set(Math.cos(facing), 0, -Math.sin(facing));
    facingForward.set(Math.sin(facing), 0, Math.cos(facing));

    let supportLateralError = 0;
    let supportForwardError = 0;
    let supportHeightError = 0;
    let captureLateralError = 0;
    let captureForwardError = 0;
    let captureTime = 0;
    let captureUrgency = 0;
    let footfallForwardError = 0;
    let footfallLateralError = 0;
    const standingSupport =
      groundedAfterControl
      && (
        standingAssistRequested
        || gaitState.phase === "idle"
        || gaitState.phase === "double-support"
      );
    const supportStateForControl =
      standingSupport && supportStateAfterJump !== "none"
        ? "double"
        : supportStateAfterJump;
    const stepLengthTarget =
      groundedAfterControl && locomotionCommandActive
        ? MathUtils.lerp(gaitConfig.step.length[0], gaitConfig.step.length[1], gaitEffort)
        : 0;
    const stepWidthTarget = groundedAfterControl
      ? MathUtils.lerp(gaitConfig.step.width[0], gaitConfig.step.width[1], postureAmount)
      : 0.2;
    const stepHeightTarget =
      groundedAfterControl && locomotionCommandActive
        ? MathUtils.lerp(gaitConfig.step.height[0], gaitConfig.step.height[1], gaitEffort)
        : 0.02;

    centerOfMassPosition.set(0, 0, 0);
    centerOfMassVelocity.set(0, 0, 0);
    let totalTrackedMass = 0;
    for (const bodyRef of bodyRefList) {
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
      centerOfMassPosition.add(
        tempMassPosition.set(
          bodyPosition.x,
          bodyPosition.y,
          bodyPosition.z,
        ).multiplyScalar(bodyMass),
      );
      centerOfMassVelocity.add(
        tempMassVelocity.set(
          bodyVelocity.x,
          bodyVelocity.y,
          bodyVelocity.z,
        ).multiplyScalar(bodyMass),
      );
      totalTrackedMass += bodyMass;
    }

    if (totalTrackedMass > 0) {
      centerOfMassPosition.divideScalar(totalTrackedMass);
      centerOfMassVelocity.divideScalar(totalTrackedMass);
    } else {
      centerOfMassPosition.set(rootPosition.x, rootPosition.y, rootPosition.z);
      centerOfMassVelocity.set(
        currentVelocity.x,
        currentVelocity.y,
        currentVelocity.z,
      );
    }
    const supportMass = Math.max(
      pelvisMass + chestMass,
      totalTrackedMass * (standingSupport ? 0.9 : 0.78),
    );
    const pelvisSupportShare = standingSupport ? 0.74 : 0.78;
    const chestSupportShare = 1 - pelvisSupportShare;

    capturePointPosition.set(
      centerOfMassPosition.x,
      rootPosition.y,
      centerOfMassPosition.z,
    );
    supportCenter.set(rootPosition.x, rootPosition.y, rootPosition.z);
    plannedFootfallPosition.set(rootPosition.x, rootPosition.y, rootPosition.z);

    if (groundedAfterControl) {
      supportCenter.set(0, 0, 0);
      let supportPointCount = 0;

      if (supportStateForControl === "left" || supportStateForControl === "double") {
        const leftFootPosition = leftFoot.translation();
        supportCenter.add(
          tempFootPosition.set(
            leftFootPosition.x,
            leftFootPosition.y - FOOT_SUPPORT_OFFSET,
            leftFootPosition.z,
          ),
        );
        supportPointCount += 1;
      }

      if (supportStateForControl === "right" || supportStateForControl === "double") {
        const rightFootPosition = rightFoot.translation();
        supportCenter.add(
          tempFootPosition.set(
            rightFootPosition.x,
            rightFootPosition.y - FOOT_SUPPORT_OFFSET,
            rightFootPosition.z,
          ),
        );
        supportPointCount += 1;
      }

      if (supportPointCount > 0) {
        supportCenter.divideScalar(supportPointCount);

        const lateralError =
          (supportCenter.x - rootPosition.x) * facingRight.x
          + (supportCenter.z - rootPosition.z) * facingRight.z;
        const desiredPelvisLead =
          groundedAfterControl && locomotionCommandActive
            ? stepLengthTarget
              * MathUtils.lerp(
                gaitConfig.step.pelvisLeadScale[0],
                gaitConfig.step.pelvisLeadScale[1],
                gaitEffort,
              )
              * (supportStateForControl === "double" ? 0.82 : 1.05)
            : 0;
        const captureHeight = Math.max(0.2, centerOfMassPosition.y - supportCenter.y);
        captureTime = Math.sqrt(captureHeight / GRAVITY);
        capturePointPosition.set(
          centerOfMassPosition.x + centerOfMassVelocity.x * captureTime,
          supportCenter.y,
          centerOfMassPosition.z + centerOfMassVelocity.z * captureTime,
        );
        captureLateralError =
          (capturePointPosition.x - supportCenter.x) * facingRight.x
          + (capturePointPosition.z - supportCenter.z) * facingRight.z;
        captureForwardError =
          (capturePointPosition.x - supportCenter.x) * facingForward.x
          + (capturePointPosition.z - supportCenter.z) * facingForward.z;
        const forwardError =
          (supportCenter.x - rootPosition.x) * facingForward.x
          + (supportCenter.z - rootPosition.z) * facingForward.z
          + desiredPelvisLead;
        const captureLateralFeedback = MathUtils.clamp(
          captureLateralError * MathUtils.lerp(
            gaitConfig.support.captureFeedback.lateral[0],
            gaitConfig.support.captureFeedback.lateral[1],
            gaitEffort,
          ),
          -0.18,
          0.18,
        );
        const captureForwardFeedback = MathUtils.clamp(
          captureForwardError * MathUtils.lerp(
            gaitConfig.support.captureFeedback.forward[0],
            gaitConfig.support.captureFeedback.forward[1],
            gaitEffort,
          ),
          -0.14,
          0.26,
        );
        const correctedLateralError = lateralError + captureLateralFeedback;
        const correctedForwardError = forwardError + captureForwardFeedback;
        const supportCentering =
          supportStateForControl === "double"
            ? gaitConfig.support.centering.double
            : gaitConfig.support.centering.single;
        const supportForwarding =
          supportStateForControl === "double"
            ? MathUtils.lerp(
                gaitConfig.support.forwarding.double[0],
                gaitConfig.support.forwarding.double[1],
                gaitEffort,
              )
            : MathUtils.lerp(
                gaitConfig.support.forwarding.single[0],
                gaitConfig.support.forwarding.single[1],
                gaitEffort,
              );
        captureUrgency = MathUtils.clamp(
          Math.max(
            Math.abs(captureLateralError) * 2.2,
            Math.abs(captureForwardError) * 1.8,
          ),
          0,
          1,
        );
        const desiredPelvisHeight =
          supportCenter.y
          + (
            standingSupport
              ? STAND_PELVIS_HEIGHT
              : MathUtils.lerp(
                  gaitConfig.step.pelvisHeight[0],
                  gaitConfig.step.pelvisHeight[1],
                  postureAmount,
                )
          );
        const heightError = desiredPelvisHeight - rootPosition.y;
        supportLateralError = lateralError;
        supportForwardError = forwardError;
        supportHeightError = heightError;
        const supportImpulseCeiling = MathUtils.lerp(0.62, 0.88, gaitEffort);
        const supportImpulseY = MathUtils.clamp(
          (
            heightError * (standingSupport ? 12.5 : 9.5)
            - currentVelocity.y * (standingSupport ? 2.2 : 1.8)
          ) * supportMass * delta,
          standingSupport ? -0.22 : -0.14,
          standingSupport ? 1.08 : supportImpulseCeiling,
        );
        const supportCorrectionBoost = MathUtils.lerp(1.0, 1.4, gaitEffort);
        supportCorrection
          .copy(facingRight)
          .multiplyScalar(
            correctedLateralError * supportMass * supportCentering * supportCorrectionBoost * delta,
          );
        supportForward
          .copy(facingForward)
          .multiplyScalar(
            correctedForwardError * supportMass * supportForwarding * supportCorrectionBoost * delta,
          );
        supportCorrection.add(supportForward);
        const heightImpulse = MathUtils.clamp(
          supportImpulseY * pelvisSupportShare,
          standingSupport ? -0.18 : -0.12,
          standingSupport ? 0.82 : MathUtils.lerp(0.44, 0.68, gaitEffort),
        );
        pelvis.applyImpulse(
          {
            x: supportCorrection.x * pelvisSupportShare,
            y: heightImpulse,
            z: supportCorrection.z * pelvisSupportShare,
          },
          true,
        );
        chest.applyImpulse(
          {
            x: supportCorrection.x * chestSupportShare,
            y: supportImpulseY * chestSupportShare * 0.9,
            z: supportCorrection.z * chestSupportShare,
          },
          true,
        );
      }
    }

    if (supportStateForControl === "none") {
      const desiredFootCenterY =
        rootPosition.y - STAND_PELVIS_HEIGHT + FOOT_SUPPORT_OFFSET;
      const applyUnsupportedFootReach = (
        foot: typeof leftFoot,
        lateralDirection: 1 | -1,
      ) => {
        const footPosition = foot.translation();
        const footVelocity = foot.linvel();
        const footMass = foot.mass();
        const footAngularVelocity = foot.angvel();
        const footRotation = foot.rotation();

        standFootTarget
          .copy(facingRight)
          .multiplyScalar(lateralDirection * STAND_FOOT_LATERAL_OFFSET)
          .addScaledVector(facingForward, STAND_FOOT_FORWARD_OFFSET)
          .add(tempFootPosition.set(rootPosition.x, desiredFootCenterY, rootPosition.z));

        standFootImpulse.set(
          MathUtils.clamp(
            (standFootTarget.x - footPosition.x) * 18 - footVelocity.x * 4.6,
            -2.2,
            2.2,
          ) * footMass * delta,
          MathUtils.clamp(
            (standFootTarget.y - footPosition.y) * 14 - footVelocity.y * 3,
            -0.9,
            0.45,
          ) * footMass * delta,
          MathUtils.clamp(
            (standFootTarget.z - footPosition.z) * 18 - footVelocity.z * 4.6,
            -2.2,
            2.2,
          ) * footMass * delta,
        );
        foot.applyImpulse(
          {
            x: standFootImpulse.x,
            y: standFootImpulse.y,
            z: standFootImpulse.z,
          },
          true,
        );

        footQuaternion.set(
          footRotation.x,
          footRotation.y,
          footRotation.z,
          footRotation.w,
        );
        footEuler.setFromQuaternion(footQuaternion, "YXZ");
        foot.applyTorqueImpulse(
          {
            x: MathUtils.clamp(
              ((0.04 - footEuler.x) * 4.8 - footAngularVelocity.x * 1.8) * footMass * delta,
              -0.18,
              0.18,
            ),
            y: MathUtils.clamp(
              (
                angleDifference(footEuler.y, facing) * 1.1
                - footAngularVelocity.y * 0.7
              ) * footMass * delta,
              -0.1,
              0.1,
            ),
            z: MathUtils.clamp(
              ((0 - footEuler.z) * 5.2 - footAngularVelocity.z * 1.8) * footMass * delta,
              -0.18,
              0.18,
            ),
          },
          true,
        );
      };

      applyUnsupportedFootReach(leftFoot, -1);
      applyUnsupportedFootReach(rightFoot, 1);
    }

    if (standingSupport && groundedAfterControl && supportStateForControl !== "none") {
      const leftFootPosition = leftFoot.translation();
      const rightFootPosition = rightFoot.translation();
      const supportPlaneY =
        supportStateForControl === "double"
          ? (
              (leftFootPosition.y - FOOT_SUPPORT_OFFSET)
              + (rightFootPosition.y - FOOT_SUPPORT_OFFSET)
            ) * 0.5
          : supportStateForControl === "left"
            ? leftFootPosition.y - FOOT_SUPPORT_OFFSET
            : rightFootPosition.y - FOOT_SUPPORT_OFFSET;

      if (!standingFootPlantRef.current) {
        standingFootPlantRef.current = {
          left: [
            leftFootPosition.x,
            supportPlaneY + FOOT_SUPPORT_OFFSET,
            leftFootPosition.z,
          ],
          right: [
            rightFootPosition.x,
            supportPlaneY + FOOT_SUPPORT_OFFSET,
            rightFootPosition.z,
          ],
        };
      }

      const standingFootPlant = standingFootPlantRef.current;
      if (standingFootPlant) {
        standingFootPlant.left[1] = supportPlaneY + FOOT_SUPPORT_OFFSET;
        standingFootPlant.right[1] = supportPlaneY + FOOT_SUPPORT_OFFSET;

        const applyStandingFootPlant = (
          foot: typeof leftFoot,
          target: CharacterCtrlrVec3,
        ) => {
          const footPosition = foot.translation();
          const footVelocity = foot.linvel();
          const footMass = foot.mass();
          const footAngularVelocity = foot.angvel();
          const footRotation = foot.rotation();

          standFootTarget.set(target[0], target[1], target[2]);
          standFootImpulse.set(
            MathUtils.clamp(
              (standFootTarget.x - footPosition.x) * 28 - footVelocity.x * 6.8,
              -2.6,
              2.6,
            ) * footMass * delta,
            MathUtils.clamp(
              Math.max(0, standFootTarget.y - footPosition.y) * 18 - footVelocity.y * 3.4,
              -0.24,
              1.3,
            ) * footMass * delta,
            MathUtils.clamp(
              (standFootTarget.z - footPosition.z) * 28 - footVelocity.z * 6.8,
              -2.6,
              2.6,
            ) * footMass * delta,
          );
          foot.applyImpulse(
            {
              x: standFootImpulse.x,
              y: standFootImpulse.y,
              z: standFootImpulse.z,
            },
            true,
          );

          footQuaternion.set(
            footRotation.x,
            footRotation.y,
            footRotation.z,
            footRotation.w,
          );
          footEuler.setFromQuaternion(footQuaternion, "YXZ");

          foot.applyTorqueImpulse(
            {
              x: MathUtils.clamp(
                ((0.04 - footEuler.x) * 6.4 - footAngularVelocity.x * 2.4) * footMass * delta,
                -0.3,
                0.3,
              ),
              y: MathUtils.clamp(
                (
                  angleDifference(footEuler.y, facing) * 1.4
                  - footAngularVelocity.y * 0.8
                ) * footMass * delta,
                -0.12,
                0.12,
              ),
              z: MathUtils.clamp(
                ((0 - footEuler.z) * 6.8 - footAngularVelocity.z * 2.4) * footMass * delta,
                -0.3,
                0.3,
              ),
            },
            true,
          );
        };

        applyStandingFootPlant(leftFoot, standingFootPlant.left);
        applyStandingFootPlant(rightFoot, standingFootPlant.right);
      }
    } else {
      standingFootPlantRef.current = null;
    }

    if (standingSupport && groundedAfterControl) {
      const applyStandingSegmentTorque = (
        body: typeof upperLegLeft,
        targetPitch: number,
        stiffness: number,
        damping: number,
      ) => {
        const bodyRotation = body.rotation();
        const bodyAngularVelocity = body.angvel();
        const bodyMass = body.mass();

        segmentQuaternion.set(
          bodyRotation.x,
          bodyRotation.y,
          bodyRotation.z,
          bodyRotation.w,
        );
        segmentEuler.setFromQuaternion(segmentQuaternion, "YXZ");

        body.applyTorqueImpulse(
          {
            x: MathUtils.clamp(
              (
                (targetPitch - segmentEuler.x) * stiffness
                - bodyAngularVelocity.x * damping
              ) * bodyMass * delta,
              -STAND_SEGMENT_MAX_TORQUE,
              STAND_SEGMENT_MAX_TORQUE,
            ),
            y: 0,
            z: 0,
          },
          true,
        );
      };

      applyStandingSegmentTorque(upperLegLeft, 0.02, 9.5, 3.8);
      applyStandingSegmentTorque(lowerLegLeft, 0.01, 11.5, 4.6);
      applyStandingSegmentTorque(leftFoot, 0.04, 8.4, 3.4);
      applyStandingSegmentTorque(upperLegRight, 0.02, 9.5, 3.8);
      applyStandingSegmentTorque(lowerLegRight, 0.01, 11.5, 4.6);
      applyStandingSegmentTorque(rightFoot, 0.04, 8.4, 3.4);
    }

    const recoveryState = recoveryStateRef.current;
    recoveryState.elapsed += delta;
    const pelvisTilt = Math.max(
      Math.abs(pelvisEuler.x),
      Math.abs(pelvisEuler.z),
    );
    const chestTilt = Math.max(
      Math.abs(chestEuler.x),
      Math.abs(chestEuler.z),
    );
    const supportHeight = rootPosition.y - supportCenter.y;
    const severeInstability =
      groundedAfterControl
      && (
        pelvisTilt > 1.05
        || chestTilt > 1.18
        || (
          supportHeight < 0.5
          && (pelvisTilt > 0.35 || chestTilt > 0.42)
        )
      );
    const moderateInstability =
      groundedAfterControl
      && !severeInstability
      && (
        captureUrgency > 0.58
        || pelvisTilt > 0.44
        || chestTilt > 0.58
        || (standingSupport && supportHeight < 0.92)
        || Math.abs(supportLateralError) > 0.18
        || Math.abs(supportForwardError) > 0.24
      );
    const recoveryReady =
      groundedAfterControl
      && supportStateAfterJump !== "none"
      && supportHeight > 0.84
      && pelvisTilt < 0.34
      && chestTilt < 0.42
      && Math.abs(supportLateralError) < 0.18
      && Math.abs(supportForwardError) < 0.24
      && Math.abs(captureForwardError) < 0.24
      && Math.abs(captureLateralError) < 0.18;
    const standBootstrapStable =
      groundedAfterControl
      && supportStateForControl === "double"
      && supportHeight > 0.94
      && pelvisTilt < 0.24
      && chestTilt < 0.32
      && Math.abs(supportLateralError) < 0.12
      && Math.abs(supportForwardError) < 0.16
      && Math.abs(captureForwardError) < 0.16
      && Math.abs(captureLateralError) < 0.12;

    if (standingAssistRequested) {
      standBootstrapTimerRef.current = standBootstrapStable
        ? standBootstrapTimerRef.current + delta
        : 0;
    } else {
      standBootstrapTimerRef.current = 0;
    }

    if (jumpTriggered || (!groundedAfterControl && predictedVelocityY > 0.35)) {
      transitionRecoveryState(recoveryState, "jumping");
    } else if (previousSnapshot && !previousSnapshot.grounded && groundedAfterControl) {
      transitionRecoveryState(recoveryState, "landing");
    } else if (recoveryState.mode === "jumping" && !groundedAfterControl) {
      transitionRecoveryState(recoveryState, "jumping");
    } else if (spawnSettleActive && groundedAfterControl) {
      transitionRecoveryState(
        recoveryState,
        standBootstrapStable ? "stable" : "landing",
      );
    } else if (severeInstability) {
      transitionRecoveryState(recoveryState, "fallen");
    } else if (recoveryState.mode === "fallen") {
      transitionRecoveryState(
        recoveryState,
        recoveryReady ? "recovering" : "fallen",
      );
    } else if (recoveryState.mode === "recovering") {
      if (recoveryReady && recoveryState.elapsed > 0.42) {
        transitionRecoveryState(recoveryState, "stable");
      } else {
        transitionRecoveryState(recoveryState, "recovering");
      }
    } else if (recoveryState.mode === "landing") {
      transitionRecoveryState(
        recoveryState,
        recoveryState.elapsed < 0.2 ? "landing" : moderateInstability ? "stumbling" : "stable",
      );
    } else if (moderateInstability) {
      transitionRecoveryState(recoveryState, "stumbling");
    } else {
      transitionRecoveryState(recoveryState, "stable");
    }

    const recoveryProgress = MathUtils.clamp(
      recoveryState.mode === "recovering"
        ? recoveryState.elapsed / 0.85
        : recoveryState.mode === "landing"
          ? recoveryState.elapsed / 0.2
          : recoveryState.mode === "stumbling"
            ? recoveryState.elapsed / 0.3
            : 1,
      0,
      1,
    );
    phasePoseTargets = applyRecoveryPoseTargets(
      phasePoseTargets,
      recoveryState.mode,
      recoveryProgress,
    );
    if (standingSupport) {
      phasePoseTargets = applyStandingPoseTargets(phasePoseTargets);
    }
    if (MIXAMO_CONTROL_ENABLED && mixamoSource && mixamoPoseRef.current && !spawnSettleActive) {
      phasePoseTargets = blendPhasePoseTargets(
        phasePoseTargets,
        mixamoPoseRef.current,
        mixamoSource.blend ?? 0.88,
      );
    }

    const recoveryTorqueBoost =
      recoveryState.mode === "fallen"
        ? 1.35
        : recoveryState.mode === "recovering"
          ? 1.2
          : recoveryState.mode === "landing"
            ? 1.08
            : 1;

    const pelvisTorqueClamp = MathUtils.lerp(0.55, 0.82, gaitEffort);
    const chestTorqueClamp = MathUtils.lerp(0.38, 0.58, gaitEffort);

    const forwardLeanCompPitch =
      groundedAfterControl && activeLocomotionMode === "run"
        ? MathUtils.clamp(captureForwardError * horizontalSpeed * 0.15, -0.2, 0.4)
        : 0;

    pelvis.applyTorqueImpulse(
      {
        x: MathUtils.clamp(
          (
            (phasePoseTargets.pelvisPitch - forwardLeanCompPitch - pelvisEuler.x) * uprightTorque
            - pelvisAngularVelocity.x * balanceDamping
          ) * pelvisTorqueScale * recoveryTorqueBoost * delta,
          -pelvisTorqueClamp,
          pelvisTorqueClamp,
        ),
        y: MathUtils.clamp(
          (
            yawError * turnTorque
            - pelvisAngularVelocity.y * (balanceDamping * 0.65)
          ) * pelvisTorqueScale * delta,
          -(pelvisTorqueClamp * 0.5),
          pelvisTorqueClamp * 0.5,
        ),
        z: MathUtils.clamp(
          (
            (phasePoseTargets.pelvisRoll - pelvisEuler.z) * uprightTorque
            - pelvisAngularVelocity.z * balanceDamping
          ) * pelvisTorqueScale * recoveryTorqueBoost * delta,
          -pelvisTorqueClamp,
          pelvisTorqueClamp,
        ),
      },
      true,
    );

    chest.applyTorqueImpulse(
      {
        x: MathUtils.clamp(
          (
            (phasePoseTargets.chestPitch - forwardLeanCompPitch * 0.5 - chestEuler.x) * uprightTorque * 0.84
            - chestAngularVelocity.x * balanceDamping
          ) * pelvisTorqueScale * recoveryTorqueBoost * delta,
          -chestTorqueClamp,
          chestTorqueClamp,
        ),
        y: MathUtils.clamp(
          (
            yawError * turnTorque * 0.35
            - chestAngularVelocity.y * (balanceDamping * 0.5)
          ) * pelvisTorqueScale * delta,
          -(chestTorqueClamp * 0.42),
          chestTorqueClamp * 0.42,
        ),
        z: MathUtils.clamp(
          (
            (phasePoseTargets.chestRoll - chestEuler.z) * uprightTorque * 0.84
            - chestAngularVelocity.z * balanceDamping
          ) * pelvisTorqueScale * recoveryTorqueBoost * delta,
          -chestTorqueClamp,
          chestTorqueClamp,
        ),
      },
      true,
    );

    if (
      groundedAfterControl
      && (recoveryState.mode === "fallen" || recoveryState.mode === "recovering")
    ) {
      const recoveryDamping = recoveryState.mode === "fallen" ? 2.2 : 1.4;
      pelvis.applyImpulse(
        {
          x: -currentVelocity.x * pelvisMass * recoveryDamping * delta,
          y: 0,
          z: -currentVelocity.z * pelvisMass * recoveryDamping * delta,
        },
        true,
      );
      chest.applyImpulse(
        {
          x: -currentVelocity.x * pelvisMass * recoveryDamping * 0.22 * delta,
          y: 0,
          z: -currentVelocity.z * pelvisMass * recoveryDamping * 0.22 * delta,
        },
        true,
      );
    }

    const allowGaitStepping =
      recoveryState.mode === "stable" || recoveryState.mode === "stumbling";

    if (
      allowGaitStepping
      && groundedAfterControl
      && locomotionCommandActive
      && (gaitState.phase === "left-stance" || gaitState.phase === "right-stance")
      && gaitState.phaseDuration > 0
    ) {
      const basePhaseDuration = deriveGaitPhaseDuration(
        gaitState.phase,
        gaitEffort,
        gaitConfig,
      );
      gaitState.phaseDuration = Math.max(
        0.16,
        MathUtils.lerp(
          basePhaseDuration,
          basePhaseDuration * gaitConfig.support.phaseCompression,
          captureUrgency,
        ),
      );
    }

    if (allowGaitStepping && groundedAfterControl && swingSide && locomotionCommandActive) {
      const swingFoot = swingSide === "left" ? leftFoot : rightFoot;
      const swingFootPosition = swingFoot.translation();
      const swingVelocity = swingFoot.linvel();
      const swingMass = swingFoot.mass();
      const swingProgress =
        gaitState.phase === "left-stance" || gaitState.phase === "right-stance"
          ? gaitPhaseValue
          : 0.5;
      const clearanceProfile = Math.sin(
        Math.PI * MathUtils.clamp(swingProgress, 0, 1),
      );
      const swingBlend =
        Math.min(1, delta * 5.4)
        * (supportStateAfterJump === "double" ? 1 : 0.68);
      const swingForwardOffset =
        (swingFootPosition.x - rootPosition.x) * facingForward.x
        + (swingFootPosition.z - rootPosition.z) * facingForward.z;
      const swingLateralOffset =
        (swingFootPosition.x - rootPosition.x) * facingRight.x
        + (swingFootPosition.z - rootPosition.z) * facingRight.z;
      const baseSwingForwardOffset =
        MathUtils.lerp(-stepLengthTarget * 0.36, stepLengthTarget * 0.72, swingProgress)
        * (supportStateAfterJump === "double" ? 1.05 : 0.9);
      const baseSwingLateralOffset =
        (swingSide === "left" ? -1 : 1) * stepWidthTarget;
      const desiredSwingForwardOffset =
        baseSwingForwardOffset
        + MathUtils.clamp(
          captureForwardError * MathUtils.lerp(
            gaitConfig.support.captureFeedback.swingForward[0],
            gaitConfig.support.captureFeedback.swingForward[1],
            gaitEffort,
          ),
          -0.12,
          0.26,
        );
      const desiredSwingLateralOffset =
        baseSwingLateralOffset
        + MathUtils.clamp(
          captureLateralError * MathUtils.lerp(
            gaitConfig.support.captureFeedback.swingLateral[0],
            gaitConfig.support.captureFeedback.swingLateral[1],
            gaitEffort,
          ),
          -0.12,
          0.12,
        );
      const desiredSwingHeight =
        supportCenter.y + stepHeightTarget * clearanceProfile;
      footfallForwardError = desiredSwingForwardOffset - swingForwardOffset;
      footfallLateralError = desiredSwingLateralOffset - swingLateralOffset;
      const swingPlacementStrength =
        supportStateAfterJump === "double"
          ? MathUtils.lerp(
              gaitConfig.swing.placement.double[0],
              gaitConfig.swing.placement.double[1],
              gaitEffort,
            )
          : MathUtils.lerp(
              gaitConfig.swing.placement.single[0],
              gaitConfig.swing.placement.single[1],
              gaitEffort,
            )
            + captureUrgency * 1.2;
      const swingDrive = MathUtils.lerp(
        gaitConfig.swing.drive[0],
        gaitConfig.swing.drive[1],
        gaitEffort,
      );
      const swingHeightError = desiredSwingHeight - swingFootPosition.y;
      const swingHeightDrive = MathUtils.clamp(
        (
          swingHeightError * MathUtils.lerp(
            gaitConfig.swing.heightDrive[0],
            gaitConfig.swing.heightDrive[1],
            gaitEffort,
          )
          - swingVelocity.y * 1.9
        ) * swingMass * swingBlend,
        0,
        swingMass * (0.45 + stepHeightTarget * 2.6 + captureUrgency * 0.18),
      );

      plannedFootfallPosition.copy(supportCenter);
      plannedFootfallPosition.addScaledVector(facingForward, desiredSwingForwardOffset);
      plannedFootfallPosition.addScaledVector(facingRight, desiredSwingLateralOffset);

      swingCorrection
        .copy(facingForward)
        .multiplyScalar(
          (desiredSwingForwardOffset - swingForwardOffset)
          * swingMass
          * swingPlacementStrength
          * delta,
        );
      swingLateral
        .copy(facingRight)
        .multiplyScalar(
          (desiredSwingLateralOffset - swingLateralOffset)
          * swingMass
          * swingPlacementStrength
          * 0.72
          * delta,
        );
      swingCorrection.add(swingLateral);

      swingFoot.applyImpulse(
        {
          x:
            (commandedVelocityX * swingDrive - swingVelocity.x) * swingMass * swingBlend
            + swingCorrection.x,
          y: swingHeightDrive,
          z:
            (commandedVelocityZ * swingDrive - swingVelocity.z) * swingMass * swingBlend
            + swingCorrection.z,
        },
        true,
      );
    }

    const resolveJointTarget = (
      key: CharacterCtrlrHumanoidRevoluteJointKey,
      targetPosition: number,
    ) => {
      const [min, max] = REVOLUTE_JOINT_LIMITS[key];
      const calibrationOffset = jointCalibrationRef.current[key] ?? 0;

      return MathUtils.clamp(targetPosition + calibrationOffset, min, max);
    };

    const hipLeftTarget = resolveJointTarget(
      "hipLeft",
      MathUtils.clamp(phasePoseTargets.left.hip - airborneAmount * 0.04, -0.9, 0.7),
    );
    const hipRightTarget = resolveJointTarget(
      "hipRight",
      MathUtils.clamp(phasePoseTargets.right.hip - airborneAmount * 0.04, -0.9, 0.7),
    );
    const shoulderLeftTarget = resolveJointTarget(
      "shoulderLeft",
      MathUtils.clamp(phasePoseTargets.left.shoulder, -1.1, 0.9),
    );
    const shoulderRightTarget = resolveJointTarget(
      "shoulderRight",
      MathUtils.clamp(phasePoseTargets.right.shoulder, -1.1, 0.9),
    );
    const kneeLeftTarget = resolveJointTarget("kneeLeft", phasePoseTargets.left.knee);
    const kneeRightTarget = resolveJointTarget("kneeRight", phasePoseTargets.right.knee);
    const ankleLeftTarget = resolveJointTarget("ankleLeft", phasePoseTargets.left.ankle);
    const ankleRightTarget = resolveJointTarget("ankleRight", phasePoseTargets.right.ankle);
    const elbowLeftTarget = resolveJointTarget("elbowLeft", phasePoseTargets.left.elbow);
    const elbowRightTarget = resolveJointTarget("elbowRight", phasePoseTargets.right.elbow);
    const wristLeftTarget = resolveJointTarget("wristLeft", phasePoseTargets.left.wrist);
    const wristRightTarget = resolveJointTarget("wristRight", phasePoseTargets.right.wrist);
    const liveLegJointAngles = {
      hipLeft: sampleRevoluteJointAngle(pelvis, upperLegLeft),
      hipRight: sampleRevoluteJointAngle(pelvis, upperLegRight),
      kneeLeft: sampleRevoluteJointAngle(upperLegLeft, lowerLegLeft),
      kneeRight: sampleRevoluteJointAngle(upperLegRight, lowerLegRight),
      ankleLeft: sampleRevoluteJointAngle(lowerLegLeft, leftFoot),
      ankleRight: sampleRevoluteJointAngle(lowerLegRight, rightFoot),
    };

    driveJointToPosition(
      jointRefs.hipLeft.current,
      hipLeftTarget,
      groundedAfterControl ? (standingSupport ? 34 : 20) : 11,
      groundedAfterControl ? (standingSupport ? 7.8 : 4.4) : 2.8,
    );
    driveJointToPosition(
      jointRefs.hipRight.current,
      hipRightTarget,
      groundedAfterControl ? (standingSupport ? 34 : 20) : 11,
      groundedAfterControl ? (standingSupport ? 7.8 : 4.4) : 2.8,
    );
    driveJointToPosition(
      jointRefs.shoulderLeft.current,
      shoulderLeftTarget,
      8.4,
      2.2,
    );
    driveJointToPosition(
      jointRefs.shoulderRight.current,
      shoulderRightTarget,
      8.4,
      2.2,
    );
    driveJointToPosition(
      jointRefs.kneeLeft.current,
      kneeLeftTarget,
      groundedAfterControl ? (standingSupport ? 44 : 22) : 14,
      groundedAfterControl ? (standingSupport ? 9.5 : 4.2) : 3,
    );
    driveJointToPosition(
      jointRefs.kneeRight.current,
      kneeRightTarget,
      groundedAfterControl ? (standingSupport ? 44 : 22) : 14,
      groundedAfterControl ? (standingSupport ? 9.5 : 4.2) : 3,
    );
    driveJointToPosition(
      jointRefs.ankleLeft.current,
      ankleLeftTarget,
      groundedAfterControl ? (standingSupport ? 28 : 15) : 9,
      groundedAfterControl ? (standingSupport ? 6.8 : 3.1) : 2.3,
    );
    driveJointToPosition(
      jointRefs.ankleRight.current,
      ankleRightTarget,
      groundedAfterControl ? (standingSupport ? 28 : 15) : 9,
      groundedAfterControl ? (standingSupport ? 6.8 : 3.1) : 2.3,
    );
    driveJointToPosition(
      jointRefs.elbowLeft.current,
      elbowLeftTarget,
      5.2,
      1.8,
    );
    driveJointToPosition(
      jointRefs.elbowRight.current,
      elbowRightTarget,
      5.2,
      1.8,
    );
    driveJointToPosition(
      jointRefs.wristLeft.current,
      wristLeftTarget,
      3.8,
      1.4,
    );
    driveJointToPosition(
      jointRefs.wristRight.current,
      wristRightTarget,
      3.8,
      1.4,
    );

    rawFocus.set(
      MathUtils.lerp(rootPosition.x, chestPosition.x, 0.72),
      MathUtils.lerp(rootPosition.y, chestPosition.y, 0.72) + cameraFocusHeight,
      MathUtils.lerp(rootPosition.z, chestPosition.z, 0.72),
    );
    rawFocus.x += Math.sin(facing) * cameraFocusLead;
    rawFocus.z += Math.cos(facing) * cameraFocusLead;

    const previousFocus = focusPositionRef.current;
    if (previousFocus) {
      smoothedFocus.set(previousFocus[0], previousFocus[1], previousFocus[2]);
      smoothedFocus.set(
        MathUtils.damp(
          smoothedFocus.x,
          rawFocus.x,
          cameraFocusSmoothing,
          delta,
        ),
        MathUtils.damp(
          smoothedFocus.y,
          rawFocus.y,
          cameraFocusSmoothing,
          delta,
        ),
        MathUtils.damp(
          smoothedFocus.z,
          rawFocus.z,
          cameraFocusSmoothing,
          delta,
        ),
      );
      focusPositionRef.current = [
        smoothedFocus.x,
        smoothedFocus.y,
        smoothedFocus.z,
      ];
    } else {
      focusPositionRef.current = [rawFocus.x, rawFocus.y, rawFocus.z];
    }

    if (movementModeRef.current !== nextMovementMode) {
      const previousMovementMode = movementModeRef.current;
      movementModeRef.current = nextMovementMode;
      onMovementModeChange?.(nextMovementMode, previousMovementMode);
    }

    const snapshot: CharacterCtrlrPlayerSnapshot = {
      position: [rootPosition.x, rootPosition.y, rootPosition.z],
      focusPosition: focusPositionRef.current ?? undefined,
      velocity: [
        currentVelocity.x + deltaVelocityX,
        predictedVelocityY,
        currentVelocity.z + deltaVelocityZ,
      ],
      facing,
      movementMode: nextMovementMode,
      grounded: groundedAfterControl,
      supportState: supportStateAfterJump,
    };
    setPlayerSnapshot(snapshot);
    onSnapshotChange?.(snapshot);
    if (jumpTriggered) {
      onJump?.(snapshot);
    }
    if (previousSnapshot && !previousSnapshot.grounded && groundedAfterControl) {
      onLand?.(snapshot);
    }
    lastSnapshotRef.current = snapshot;
    const nextBalanceState =
      recoveryState.mode === "stable"
        ? deriveBalanceState(
            groundedAfterControl,
            supportStateAfterJump,
            supportLateralError,
            supportForwardError,
            supportHeightError,
          )
        : recoveryState.mode === "jumping"
          ? "unsupported"
          : "recovering";
    locomotionDebugRef.current = {
      movementMode: nextMovementMode,
      gaitPhase: gaitState.phase,
      gaitTransitionReason: gaitState.transitionReason,
      balanceState: nextBalanceState,
      recoveryState: recoveryState.mode,
      jointCalibrationReady: jointCalibrationReadyRef.current,
      supportState: supportStateAfterJump,
      plannedSupportSide,
      swingSide,
      grounded: groundedAfterControl,
      hasMovementInput,
      gaitPhaseValue,
      gaitPhaseElapsed: gaitState.phaseElapsed,
      gaitPhaseDuration: gaitState.phaseDuration,
      gaitTransitionCount: gaitState.transitionCount,
      gaitEffort,
      commandEffort,
      speedRatio,
      horizontalSpeed,
      leftSupportContacts: leftSupportContactsRef.current.size,
      rightSupportContacts: rightSupportContactsRef.current.size,
      supportLateralError,
      supportForwardError,
      supportHeightError,
      centerOfMass: [
        centerOfMassPosition.x,
        centerOfMassPosition.y,
        centerOfMassPosition.z,
      ],
      centerOfMassVelocity: [
        centerOfMassVelocity.x,
        centerOfMassVelocity.y,
        centerOfMassVelocity.z,
      ],
      supportCenter: [supportCenter.x, supportCenter.y, supportCenter.z],
      capturePoint: [
        capturePointPosition.x,
        capturePointPosition.y,
        capturePointPosition.z,
      ],
      captureTime,
      captureLateralError,
      captureForwardError,
      plannedFootfall: [
        plannedFootfallPosition.x,
        plannedFootfallPosition.y,
        plannedFootfallPosition.z,
      ],
      stepLengthTarget,
      stepWidthTarget,
      stepHeightTarget,
      legJointAngles: liveLegJointAngles,
      legJointTargets: {
        hipLeft: hipLeftTarget,
        hipRight: hipRightTarget,
        kneeLeft: kneeLeftTarget,
        kneeRight: kneeRightTarget,
        ankleLeft: ankleLeftTarget,
        ankleRight: ankleRightTarget,
      },
      footfallForwardError,
      footfallLateralError,
      recentTransitions: transitionHistoryRef.current,
    };

    if (debug) {
      if (typeof window !== "undefined") {
        (
          window as typeof window & {
            __characterCtrlrActiveRagdollDebug?: unknown;
          }
        ).__characterCtrlrActiveRagdollDebug = {
          movementMode: nextMovementMode,
          grounded: groundedAfterControl,
          standingSupport,
          supportState: supportStateAfterJump,
          gaitPhase: gaitState.phase,
          recoveryState: recoveryState.mode,
          jointCalibrationReady: jointCalibrationReadyRef.current,
          jointCalibration: jointCalibrationRef.current,
          legJointAngles: liveLegJointAngles,
          legJointTargets: {
            hipLeft: hipLeftTarget,
            hipRight: hipRightTarget,
            kneeLeft: kneeLeftTarget,
            kneeRight: kneeRightTarget,
            ankleLeft: ankleLeftTarget,
            ankleRight: ankleRightTarget,
          },
          supportErrors: {
            lateral: supportLateralError,
            forward: supportForwardError,
            height: supportHeightError,
          },
          captureErrors: {
            lateral: captureLateralError,
            forward: captureForwardError,
            urgency: captureUrgency,
          },
          centerOfMass: {
            x: centerOfMassPosition.x,
            y: centerOfMassPosition.y,
            z: centerOfMassPosition.z,
          },
          supportCenter: {
            x: supportCenter.x,
            y: supportCenter.y,
            z: supportCenter.z,
          },
        };
      }

      debugLogCooldownRef.current -= delta;

      if (debugLogCooldownRef.current <= 0) {
        debugLogCooldownRef.current = 0.4;
        console.log("[CharacterCtrlrActiveRagdollPlayer]", {
          movementMode: nextMovementMode,
          grounded: groundedAfterControl,
          standingSupport,
          supportState: supportStateAfterJump,
          gaitPhase: gaitState.phase,
          recoveryState: recoveryState.mode,
          jointCalibrationReady: jointCalibrationReadyRef.current,
          jointCalibration: jointCalibrationRef.current,
          legJointAngles: liveLegJointAngles,
          legJointTargets: {
            hipLeft: hipLeftTarget,
            hipRight: hipRightTarget,
            kneeLeft: kneeLeftTarget,
            kneeRight: kneeRightTarget,
            ankleLeft: ankleLeftTarget,
            ankleRight: ankleRightTarget,
          },
          supportErrors: {
            lateral: supportLateralError,
            forward: supportForwardError,
            height: supportHeightError,
          },
          captureErrors: {
            lateral: captureLateralError,
            forward: captureForwardError,
            urgency: captureUrgency,
          },
          centerOfMass: {
            x: centerOfMassPosition.x,
            y: centerOfMassPosition.y,
            z: centerOfMassPosition.z,
          },
          supportCenter: {
            x: supportCenter.x,
            y: supportCenter.y,
            z: supportCenter.z,
          },
        });
      }
    }
  });

  const articulatedBodyProps: Partial<
    Record<
      CharacterCtrlrHumanoidBodyKey,
      {
        additionalSolverIterations?: number;
        angularDamping?: number;
        enabledRotations?: [boolean, boolean, boolean];
        linearDamping?: number;
        onCollisionEnter?: (payload: CollisionEnterPayload) => void;
        onCollisionExit?: (payload: CollisionExitPayload) => void;
      }
    >
  > = {
    pelvis: {
      additionalSolverIterations: 24,
      angularDamping: 7.2,
      enabledRotations: [false, true, false],
      linearDamping: 3.1,
    },
    chest: {
      additionalSolverIterations: 22,
      angularDamping: 7,
      enabledRotations: [false, true, false],
      linearDamping: 2.8,
    },
    head: {
      additionalSolverIterations: 18,
      angularDamping: 9.2,
      linearDamping: 2.6,
    },
    upperArmLeft: {
      angularDamping: 6.8,
      linearDamping: 2.1,
    },
    lowerArmLeft: {
      angularDamping: 6.6,
      linearDamping: 1.8,
    },
    handLeft: {
      angularDamping: 7.2,
      linearDamping: 2,
    },
    upperArmRight: {
      angularDamping: 6.8,
      linearDamping: 2.1,
    },
    lowerArmRight: {
      angularDamping: 6.6,
      linearDamping: 1.8,
    },
    handRight: {
      angularDamping: 7.2,
      linearDamping: 2,
    },
    upperLegLeft: {
      angularDamping: 6.2,
      enabledRotations: [true, false, false],
    },
    lowerLegLeft: {
      angularDamping: 6.4,
      enabledRotations: [true, false, false],
    },
    footLeft: {
      angularDamping: 6.8,
      enabledRotations: [true, false, false],
      onCollisionEnter: createGroundContactEnterHandler("left"),
      onCollisionExit: createGroundContactExitHandler("left"),
    },
    upperLegRight: {
      angularDamping: 6.2,
      enabledRotations: [true, false, false],
    },
    lowerLegRight: {
      angularDamping: 6.4,
      enabledRotations: [true, false, false],
    },
    footRight: {
      angularDamping: 6.8,
      enabledRotations: [true, false, false],
      onCollisionEnter: createGroundContactEnterHandler("right"),
      onCollisionExit: createGroundContactExitHandler("right"),
    },
  };

  return (
    <>
      {MIXAMO_CONTROL_ENABLED && mixamoSource ? (
        <CharacterCtrlrMixamoMotionDriver
          groundedRef={groundedRef}
          hasMovementInputRef={hasMovementInputRef}
          movementModeRef={movementModeRef}
          poseRef={mixamoPoseRef}
          source={mixamoSource}
        />
      ) : null}
      <CharacterCtrlrHumanoidRagdoll
        bodyProps={articulatedBodyProps}
        bodyRefs={bodyRefs}
        debug={debug}
        ignoreCameraOcclusion
        locomotionDebugRef={locomotionDebugRef}
        position={position}
        revoluteJointRefs={jointRefs}
        sharedBodyProps={{
          additionalSolverIterations: 16,
          angularDamping: 5.2,
          canSleep: false,
          ccd: true,
          linearDamping: 2.4,
          softCcdPrediction: 0.25,
        }}
      />
    </>
  );
}
