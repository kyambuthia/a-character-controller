import { describe, expect, it } from "vitest";
import { GAIT_CONFIGS, STAND_PELVIS_HEIGHT } from "./config";
import { deriveWarnings } from "./debugState";

describe("gait pelvis height targets", () => {
  // The legs can only reach so far: targets above the stand height pull the feet off the ground,
  // and targets far below it fold the legs. Absolute targets once fell 0.6 m behind the rig.
  it.each(["idle", "walk", "run"] as const)("%s keeps the pelvis near standing height", (gait) => {
    for (const height of GAIT_CONFIGS[gait].step.pelvisHeight) {
      expect(height).toBeLessThanOrEqual(STAND_PELVIS_HEIGHT);
      expect(height).toBeGreaterThanOrEqual(STAND_PELVIS_HEIGHT - 0.25);
    }
  });

  it("crouches lower than it walks, without folding the legs", () => {
    const [shallow, deep] = GAIT_CONFIGS.crouch.step.pelvisHeight;
    expect(shallow).toBeLessThan(GAIT_CONFIGS.walk.step.pelvisHeight[1]);
    expect(deep).toBeGreaterThan(STAND_PELVIS_HEIGHT * 0.65);
  });
});

describe("locomotion warnings", () => {
  const base = {
    groundedAfterControl: true,
    supportState: "double" as const,
    yawError: 0,
    captureUrgency: 0,
  };

  it("reports a sagging pelvis as too low", () => {
    // Error is target minus measured: target above the pelvis means it sags.
    expect(deriveWarnings({ ...base, supportHeightError: 0.3 })).toEqual(["pelvis_too_low"]);
  });

  it("reports a pelvis above its target as too high", () => {
    expect(deriveWarnings({ ...base, supportHeightError: -0.3 })).toEqual(["pelvis_too_high"]);
  });

  it("stays quiet near the target", () => {
    expect(deriveWarnings({ ...base, supportHeightError: 0.05 })).toEqual([]);
  });
});
