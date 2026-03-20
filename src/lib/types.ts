export type CharacterCtrlrMovementMode =
  | "idle"
  | "walk"
  | "run"
  | "crouch"
  | "jump"
  | "fall";

export type CharacterCtrlrSupportState = "none" | "left" | "right" | "double";

export type CharacterCtrlrGaitPhase =
  | "idle"
  | "double-support"
  | "left-stance"
  | "right-stance"
  | "airborne";

export type CharacterCtrlrBalanceState =
  | "balanced"
  | "recovering"
  | "unsupported";

export type CharacterCtrlrGaitTransitionReason =
  | "initial"
  | "movement-start"
  | "idle-no-input"
  | "jump"
  | "support-lost"
  | "landing-support"
  | "left-foot-support"
  | "right-foot-support"
  | "double-support-timeout"
  | "stance-timeout";

export type CharacterCtrlrVec3 = [number, number, number];

export type CharacterCtrlrInputState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
  crouch: boolean;
  jump: boolean;
};

export type CharacterCtrlrPlayerSnapshot = {
  position: CharacterCtrlrVec3;
  focusPosition?: CharacterCtrlrVec3;
  facing: number;
  movementMode: CharacterCtrlrMovementMode;
  grounded: boolean;
  supportState: CharacterCtrlrSupportState;
  velocity: CharacterCtrlrVec3;
};

export type CharacterCtrlrLocomotionDebugState = {
  movementMode: CharacterCtrlrMovementMode;
  gaitPhase: CharacterCtrlrGaitPhase;
  gaitTransitionReason: CharacterCtrlrGaitTransitionReason;
  balanceState: CharacterCtrlrBalanceState;
  supportState: CharacterCtrlrSupportState;
  plannedSupportSide: "left" | "right" | null;
  swingSide: "left" | "right" | null;
  grounded: boolean;
  hasMovementInput: boolean;
  gaitPhaseValue: number;
  gaitPhaseElapsed: number;
  gaitPhaseDuration: number;
  gaitTransitionCount: number;
  gaitEffort: number;
  commandEffort: number;
  speedRatio: number;
  horizontalSpeed: number;
  leftSupportContacts: number;
  rightSupportContacts: number;
  supportLateralError: number;
  supportForwardError: number;
  supportHeightError: number;
};

export const DEFAULT_CHARACTER_CTRLR_INPUT: CharacterCtrlrInputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  run: false,
  crouch: false,
  jump: false,
};

export function mergeCharacterCtrlrInput(
  ...inputs: Array<Partial<CharacterCtrlrInputState> | null | undefined>
): CharacterCtrlrInputState {
  return inputs.reduce<CharacterCtrlrInputState>(
    (accumulator, input) => ({
      forward: accumulator.forward || Boolean(input?.forward),
      backward: accumulator.backward || Boolean(input?.backward),
      left: accumulator.left || Boolean(input?.left),
      right: accumulator.right || Boolean(input?.right),
      run: accumulator.run || Boolean(input?.run),
      crouch: accumulator.crouch || Boolean(input?.crouch),
      jump: accumulator.jump || Boolean(input?.jump),
    }),
    { ...DEFAULT_CHARACTER_CTRLR_INPUT },
  );
}
