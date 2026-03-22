import type { CharacterCtrlrSupportState } from "../../types";
import { GROUNDED_GRACE_PERIOD, GROUNDING_MIN_DURATION } from "./config";
import type { ContactTrackingState, SupportSide } from "./controllerTypes";
import { deriveSupportState } from "./gait";

export function createInitialContactTrackingState(): ContactTrackingState {
  return {
    grounded: false,
    supportState: "none",
    leftSupportContacts: new Map(),
    rightSupportContacts: new Map(),
    groundedGraceTimer: 0,
    groundingConfirmTimer: 0,
    rawContactsGrounded: false,
    jumpContactClearPending: false,
    contactTimestamps: { left: 0, right: 0 },
  };
}

export function syncSupportState(state: ContactTrackingState) {
  const nextSupportState = deriveSupportState(
    state.leftSupportContacts.size,
    state.rightSupportContacts.size,
  );

  state.supportState = nextSupportState;
  const hasContacts = nextSupportState !== "none";
  state.rawContactsGrounded = hasContacts;

  if (hasContacts) {
    state.groundedGraceTimer = 0;

    if (state.grounded) {
      state.groundingConfirmTimer = GROUNDING_MIN_DURATION;
    }
  }

  return nextSupportState;
}

export function addSupportContact(
  state: ContactTrackingState,
  side: SupportSide,
  colliderHandle: number,
  now: number,
) {
  if (state.jumpContactClearPending) {
    return;
  }

  const supportContacts =
    side === "left"
      ? state.leftSupportContacts
      : state.rightSupportContacts;
  const count = supportContacts.get(colliderHandle) ?? 0;
  supportContacts.set(colliderHandle, count + 1);

  if (count === 0) {
    state.contactTimestamps[side] = now;
  }

  syncSupportState(state);
}

export function removeSupportContact(
  state: ContactTrackingState,
  side: SupportSide,
  colliderHandle: number,
) {
  const supportContacts =
    side === "left"
      ? state.leftSupportContacts
      : state.rightSupportContacts;
  const count = supportContacts.get(colliderHandle);

  if (!count) {
    return;
  }

  if (count === 1) {
    supportContacts.delete(colliderHandle);
  } else {
    supportContacts.set(colliderHandle, count - 1);
  }
}

export function updateGroundingFromSignal(params: {
  state: ContactTrackingState;
  delta: number;
  effectiveGroundedSignal: boolean;
  probedSupportState: CharacterCtrlrSupportState;
  onGroundedChange?: (grounded: boolean) => void;
}) {
  const {
    state,
    delta,
    effectiveGroundedSignal,
    probedSupportState,
    onGroundedChange,
  } = params;

  const commitGrounded = (nextGrounded: boolean) => {
    if (state.grounded === nextGrounded) {
      return;
    }

    state.grounded = nextGrounded;
    onGroundedChange?.(nextGrounded);
  };

  if (effectiveGroundedSignal) {
    state.groundedGraceTimer = 0;
    state.groundingConfirmTimer += delta;

    if (!state.grounded && state.groundingConfirmTimer >= GROUNDING_MIN_DURATION) {
      commitGrounded(true);
    }

    if (!state.rawContactsGrounded && probedSupportState !== "none") {
      state.supportState = probedSupportState;
    }

    return;
  }

  state.groundingConfirmTimer = 0;

  if (state.grounded) {
    state.groundedGraceTimer += delta;

    if (state.groundedGraceTimer >= GROUNDED_GRACE_PERIOD) {
      commitGrounded(false);

      if (!state.rawContactsGrounded) {
        state.supportState = "none";
      }
    }

    return;
  }

  if (!state.rawContactsGrounded) {
    state.supportState = "none";
  }
}
