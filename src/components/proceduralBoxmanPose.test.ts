import { describe, expect, it } from "vitest";
import {
  PROCEDURAL_BONE_NAMES,
  deriveBoneAxisTest,
  deriveProceduralWalkPose,
} from "./proceduralBoxmanPose";

describe("procedural boxman pose", () => {
  it("swings the legs in antiphase", () => {
    const pose = deriveProceduralWalkPose(0.2);

    expect(pose["leg_upper.L"]![0]).toBeCloseTo(-pose["leg_upper.R"]![0], 6);
  });

  it("repeats every stride", () => {
    const stridesPerSecond = 0.9;
    const a = deriveProceduralWalkPose(0.37, stridesPerSecond);
    const b = deriveProceduralWalkPose(0.37 + 1 / stridesPerSecond, stridesPerSecond);

    expect(b["leg_upper.L"]![0]).toBeCloseTo(a["leg_upper.L"]![0], 6);
    expect(b["leg_lower.R"]![0]).toBeCloseTo(a["leg_lower.R"]![0], 6);
  });

  it("only flexes the knees so the shin swings backward", () => {
    for (let time = 0; time < 3; time += 0.05) {
      const pose = deriveProceduralWalkPose(time);

      // Positive rotation about local X swings a hanging limb backward (toward -Z) in this rig.
      expect(pose["leg_lower.L"]![0]).toBeGreaterThanOrEqual(0);
      expect(pose["leg_lower.R"]![0]).toBeGreaterThanOrEqual(0);
    }
  });

  it("axis test moves one bone on one axis and visits every bone", () => {
    const visited = new Set<string>();

    for (let time = 0; time < 80; time += 0.4) {
      const step = deriveBoneAxisTest(time);
      const moved = Object.entries(step.pose).filter(([, offset]) =>
        offset!.some((value) => value !== 0),
      );

      expect(moved.length).toBeLessThanOrEqual(1);
      visited.add(step.bone);
    }

    expect(visited.size).toBe(PROCEDURAL_BONE_NAMES.length);
  });
});
