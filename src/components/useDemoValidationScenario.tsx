import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
  type RigidBodyProps,
  useBeforePhysicsStep,
} from "@react-three/rapier";
import { useRef, type MutableRefObject } from "react";
import {
  DEFAULT_CHARACTER_CTRLR_INPUT,
  type CharacterCtrlrInputState,
  useCharacterCtrlrStore,
} from "../lib";

const DEMO_VALIDATION_SCENARIO =
  new URLSearchParams(window.location.search).get("scenario");

function deriveScenarioInput(
  scenario: string | null,
  elapsedSeconds: number,
): CharacterCtrlrInputState {
  if (!scenario) {
    return { ...DEFAULT_CHARACTER_CTRLR_INPUT };
  }

  switch (scenario) {
    case "turn_in_place_stability":
      return elapsedSeconds >= 2 && elapsedSeconds < 6
        ? { ...DEFAULT_CHARACTER_CTRLR_INPUT, right: true }
        : { ...DEFAULT_CHARACTER_CTRLR_INPUT };
    case "walk_start_from_rest":
      return elapsedSeconds >= 2 && elapsedSeconds < 5
        ? { ...DEFAULT_CHARACTER_CTRLR_INPUT, forward: true }
        : { ...DEFAULT_CHARACTER_CTRLR_INPUT };
    case "steady_forward_walk":
    case "no_persistent_leg_scissoring":
      return elapsedSeconds >= 2 && elapsedSeconds < 10
        ? { ...DEFAULT_CHARACTER_CTRLR_INPUT, forward: true }
        : { ...DEFAULT_CHARACTER_CTRLR_INPUT };
    case "walk_run_walk_transition":
      if (elapsedSeconds >= 2 && elapsedSeconds < 5) {
        return { ...DEFAULT_CHARACTER_CTRLR_INPUT, forward: true };
      }
      if (elapsedSeconds >= 5 && elapsedSeconds < 8) {
        return { ...DEFAULT_CHARACTER_CTRLR_INPUT, forward: true, run: true };
      }
      if (elapsedSeconds >= 8 && elapsedSeconds < 11) {
        return { ...DEFAULT_CHARACTER_CTRLR_INPUT, forward: true };
      }
      return { ...DEFAULT_CHARACTER_CTRLR_INPUT };
    case "mild_push_recovery":
    case "spawn_idle_stability":
      return { ...DEFAULT_CHARACTER_CTRLR_INPUT };
    case "no_persistent_foot_chatter":
      if (elapsedSeconds >= 2 && elapsedSeconds < 7) {
        return { ...DEFAULT_CHARACTER_CTRLR_INPUT, forward: true };
      }
      return { ...DEFAULT_CHARACTER_CTRLR_INPUT };
    default:
      return { ...DEFAULT_CHARACTER_CTRLR_INPUT };
  }
}

export type DemoValidationScenario = {
  scenario: string | null;
  inputRef: MutableRefObject<CharacterCtrlrInputState | null>;
  /** Simulated seconds since the scenario started (advanced by DemoValidationClock). */
  elapsedRef: MutableRefObject<number>;
};

export function useDemoValidationScenario(): DemoValidationScenario {
  const inputRef = useRef<CharacterCtrlrInputState | null>(
    DEMO_VALIDATION_SCENARIO ? deriveScenarioInput(DEMO_VALIDATION_SCENARIO, 0) : null,
  );
  const elapsedRef = useRef(0);

  return {
    scenario: DEMO_VALIDATION_SCENARIO,
    inputRef,
    elapsedRef,
  };
}

/**
 * Advances the validation scenario once per physics step, inside <Physics>. The scenario runs on
 * simulated time rather than wall time so a slow render loop (e.g. headless Chrome on a software
 * renderer, which can fall to under a third of real time) cannot shorten its input windows.
 */
export function DemoValidationClock({ validation }: { validation: DemoValidationScenario }) {
  const { scenario, inputRef, elapsedRef } = validation;

  useBeforePhysicsStep((world) => {
    if (!scenario) {
      return;
    }

    elapsedRef.current += world.timestep;
    inputRef.current = deriveScenarioInput(scenario, elapsedRef.current);

    (
      window as typeof window & {
        __characterCtrlrValidation?: unknown;
      }
    ).__characterCtrlrValidation = {
      scenario,
      elapsed: elapsedRef.current,
      input: inputRef.current,
    };
  });

  return null;
}

export function DemoValidationPusher(props: {
  scenario: string | null;
  elapsedRef: MutableRefObject<number>;
}) {
  const { scenario, elapsedRef } = props;
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const playerPosition = useCharacterCtrlrStore((state) => state.playerPosition);
  const launchedRef = useRef(false);

  useBeforePhysicsStep(() => {
    if (scenario !== "mild_push_recovery" || launchedRef.current || elapsedRef.current < 3.2) {
      return;
    }

    const body = bodyRef.current;
    if (!body) {
      return;
    }

    launchedRef.current = true;
    body.setTranslation(
      {
        x: playerPosition[0] + 1.6,
        y: playerPosition[1] + 0.8,
        z: playerPosition[2] - 3.6,
      },
      true,
    );
    body.setLinvel({ x: -1.2, y: 0.2, z: 4.8 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  });

  if (scenario !== "mild_push_recovery") {
    return null;
  }

  return (
    <RigidBody
      canSleep={false}
      colliders={false}
      linearDamping={0.1}
      ref={bodyRef}
      restitution={0}
      type={"dynamic" satisfies RigidBodyProps["type"]}
    >
      {/* Default density made this box weigh ~0.09 kg, which never moved the 13.7 kg ragdoll.
          3 kg at 4.8 m/s is ~14 N*s. */}
      <CuboidCollider args={[0.22, 0.22, 0.22]} mass={3} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.44, 0.44, 0.44]} />
        <meshStandardMaterial color="#d34e36" roughness={0.5} />
      </mesh>
    </RigidBody>
  );
}
