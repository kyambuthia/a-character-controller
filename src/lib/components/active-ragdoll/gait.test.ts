import { describe, expect, it } from "vitest";
import { GAIT_CONFIGS } from "./config";
import type { CharacterCtrlrSupportState } from "../../types";
import { advanceGaitState, createInitialGaitState } from "./gait";

const STEP = 1 / 60;

function stanceState() {
  const gaitState = createInitialGaitState();
  gaitState.phase = "left-stance";
  gaitState.phaseDuration = 0.4;
  return gaitState;
}

function step(gaitState: ReturnType<typeof createInitialGaitState>, support: CharacterCtrlrSupportState) {
  gaitState.phaseElapsed += STEP;
  advanceGaitState({
    gaitState,
    grounded: true,
    locomotionCommandActive: true,
    spawnSettleActive: false,
    supportStateForPhase: support,
    gaitEffort: 0.6,
    gaitConfig: GAIT_CONFIGS.walk,
    jumpTriggered: false,
  });
}

describe("advanceGaitState stance landing", () => {
  it("does not treat a swing foot that never lifted as a landing", () => {
    const gaitState = stanceState();

    for (let i = 0; i < 12; i += 1) {
      step(gaitState, "double");
    }

    expect(gaitState.phase).toBe("left-stance");
  });

  it("ends the stance on touchdown once the swing foot has lifted", () => {
    const gaitState = stanceState();

    for (let i = 0; i < 6; i += 1) {
      step(gaitState, "left");
    }
    step(gaitState, "double");

    expect(gaitState.phase).toBe("double-support");
    expect(gaitState.transitionReason).toBe("landing-support");
  });
});
