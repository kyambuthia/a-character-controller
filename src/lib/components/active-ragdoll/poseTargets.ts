import { MathUtils } from "three";
import type { CharacterCtrlrMixamoPoseTargets } from "../CharacterCtrlrMixamoMotionDriver";
import { NEUTRAL_ARTICULATED_POSE } from "./config";
import type { CharacterCtrlrGaitConfig, PhasePoseTargets, SupportSide } from "./controllerTypes";

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

export function derivePhasePoseTargets(params: {
  gaitPhase: "idle" | "double-support" | "left-stance" | "right-stance" | "airborne";
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
    ) * Math.sin(gaitPhaseValue * Math.PI);
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

export function applyRecoveryPoseTargets(
  targets: PhasePoseTargets,
  recoveryState: "stable" | "stumbling" | "fallen" | "recovering" | "jumping" | "landing",
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

export function applyStandingPoseTargets(targets: PhasePoseTargets) {
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

export function blendPhasePoseTargets(
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
