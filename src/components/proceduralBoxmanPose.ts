export type BoneName =
  | "butt_bone"
  | "body_lower"
  | "body_upper"
  | "head"
  | "arm_upper.L"
  | "arm_lower.L"
  | "arm_upper.R"
  | "arm_lower.R"
  | "leg_upper.L"
  | "leg_lower.L"
  | "leg_upper.R"
  | "leg_lower.R";

export type BoneEulerOffsets = Partial<Record<BoneName, [number, number, number]>>;

export const PROCEDURAL_BONE_NAMES: BoneName[] = [
  "butt_bone",
  "body_lower",
  "body_upper",
  "head",
  "arm_upper.L",
  "arm_lower.L",
  "arm_upper.R",
  "arm_lower.R",
  "leg_upper.L",
  "leg_lower.L",
  "leg_upper.R",
  "leg_lower.R",
];

/**
 * Per-bone rotation about the bone's own local axes, in radians, added on top of the rest pose.
 * In custom.glb the limb bones' local X is the world X (sideways) axis, so it is the forward/back
 * swing axis. A positive rotation about +X swings a hanging limb toward -Z, i.e. backward when the
 * model faces +Z, so a forward swing is negative.
 */
const PITCH_SIGN = -1;

export function deriveProceduralWalkPose(timeSeconds: number, stridesPerSecond = 0.9): BoneEulerOffsets {
  const phase = timeSeconds * stridesPerSecond * Math.PI * 2;
  const swing = Math.sin(phase);
  const swingOpposite = -swing;
  // Knee flexes while the leg swings forward, stays near straight through stance.
  const kneeLeft = Math.max(0, Math.cos(phase)) * 0.9;
  const kneeRight = Math.max(0, -Math.cos(phase)) * 0.9;

  return {
    "leg_upper.L": [PITCH_SIGN * swing * 0.55, 0, 0],
    "leg_upper.R": [PITCH_SIGN * swingOpposite * 0.55, 0, 0],
    "leg_lower.L": [-PITCH_SIGN * kneeLeft, 0, 0],
    "leg_lower.R": [-PITCH_SIGN * kneeRight, 0, 0],
    "arm_upper.L": [PITCH_SIGN * swingOpposite * 0.5, 0, 0],
    "arm_upper.R": [PITCH_SIGN * swing * 0.5, 0, 0],
    "arm_lower.L": [PITCH_SIGN * (0.25 + Math.max(0, swing) * 0.2), 0, 0],
    "arm_lower.R": [PITCH_SIGN * (0.25 + Math.max(0, swingOpposite) * 0.2), 0, 0],
    body_upper: [0, swing * 0.12, 0],
    body_lower: [0, swingOpposite * 0.08, 0],
  };
}

/** One bone, one local axis at a time, so the export's axis convention can be read off by eye. */
export function deriveBoneAxisTest(
  timeSeconds: number,
  secondsPerStep = 1.6,
  amplitude = 0.7,
  onlyBone?: BoneName,
) {
  const axes = ["x", "y", "z"] as const;
  const bonesUnderTest = onlyBone ? [onlyBone] : PROCEDURAL_BONE_NAMES;
  const stepCount = bonesUnderTest.length * axes.length;
  const step = Math.floor(timeSeconds / secondsPerStep) % stepCount;
  const bone = bonesUnderTest[Math.floor(step / axes.length)];
  const axis = axes[step % axes.length];
  const local = (timeSeconds % secondsPerStep) / secondsPerStep;
  const angle = Math.sin(local * Math.PI * 2) * amplitude;
  const offsets: [number, number, number] = [0, 0, 0];
  offsets[axes.indexOf(axis)] = angle;

  return { bone, axis, pose: { [bone]: offsets } as BoneEulerOffsets };
}
