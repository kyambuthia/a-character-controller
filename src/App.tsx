import { Canvas } from "@react-three/fiber";
import { Physics, useRapier } from "@react-three/rapier";
import { Suspense, useEffect, useRef } from "react";
import { Vector3 } from "three";
import { FlatArena } from "./components/FlatArena";
import { KeyRibbon } from "./components/KeyRibbon";
import { Lights } from "./components/Lights";
import { DemoBoxmanPlayer } from "./components/DemoBoxmanPlayer";
import { DemoPlanetBackdrop } from "./components/DemoPlanetBackdrop";
import { DemoPlanetCamera } from "./components/DemoPlanetCamera";
import { RigTestScene } from "./components/RigTestScene";
import { TerrainArena } from "./components/TerrainArena";
import { TerrainChunkManager } from "./components/TerrainChunkManager";
import {
  DEMO_PLANET_DUMMY_DIRECTION,
  DEMO_PLANET_DUMMY_SPAWN_CLEARANCE,
  DEMO_PLANET_PLAYER_SPAWN_CLEARANCE,
  DEMO_PLANET_SPAWN_DIRECTION,
  getDemoPlanetSpawnPosition,
} from "./components/demoTerrain";
import { useDemoTouchInput } from "./components/useDemoTouchInput";
import {
  DemoValidationClock,
  DemoValidationPusher,
  useDemoValidationScenario,
} from "./components/useDemoValidationScenario";
import {
  DEMO_PHYSICS_STEP,
  useDemoPhysicsDebugControls,
} from "./components/useDemoPhysicsDebugControls";
import {
  CharacterCtrlrActiveRagdollPlayer,
  CharacterCtrlrCameraRig,
  type CharacterCtrlrMixamoMotionSource,
  CharacterCtrlrProvider,
  CharacterCtrlrRagdollDummy,
} from "./lib";

const DEMO_PLAYER_MODE =
  new URLSearchParams(window.location.search).get("player") === "ragdoll"
    ? "ragdoll"
    : "boxman";
const DEMO_DEBUG =
  new URLSearchParams(window.location.search).get("debug") === "1";
const DEMO_ARENA_MODE =
  new URLSearchParams(window.location.search).get("arena") === "flat"
    ? "flat"
    : "planet";
// The ragdoll is drawn with public/assets/character.glb; ?skin=boxes shows the coloured collider boxes.
const DEMO_RAGDOLL_MODEL =
  new URLSearchParams(window.location.search).get("skin") === "boxes"
    ? undefined
    : "/assets/character.glb";
const DEMO_MOTION_MODE =
  new URLSearchParams(window.location.search).get("motion") === "mixamo"
    ? "mixamo"
    : "procedural";
const USE_PLANET_DEMO =
  DEMO_PLAYER_MODE === "boxman" && DEMO_ARENA_MODE === "planet";
const DEMO_MIXAMO_SOURCE: CharacterCtrlrMixamoMotionSource | undefined =
  DEMO_MOTION_MODE === "mixamo"
    ? {
        rigUrl: "/mixamo/character.fbx",
        clips: {
          idle: "/mixamo/idle.fbx",
          walk: "/mixamo/walk.fbx",
          run: "/mixamo/run.fbx",
          crouch: "/mixamo/crouch-walk.fbx",
          jump: "/mixamo/jump.fbx",
        },
        blend: 0.9,
      }
    : undefined;
const DEMO_PLAYER_POSITION: [number, number, number] =
  USE_PLANET_DEMO
    ? getDemoPlanetSpawnPosition(
        DEMO_PLANET_SPAWN_DIRECTION,
        DEMO_PLANET_PLAYER_SPAWN_CLEARANCE,
      )
    : [0, 2.02, 6];
const DEMO_DUMMY_POSITION: [number, number, number] =
  USE_PLANET_DEMO
    ? getDemoPlanetSpawnPosition(
        DEMO_PLANET_DUMMY_DIRECTION,
        DEMO_PLANET_DUMMY_SPAWN_CLEARANCE,
      )
    : [-4, 5.5, -6];
const SHOW_RAGDOLL_DUMMY =
  DEMO_DEBUG &&
  (new URLSearchParams(window.location.search).get("dummy") === "1" ||
    DEMO_PLAYER_MODE === "ragdoll");

function DemoPhysicsStepper({
  paused,
  stepRequest,
  timeScale,
  onStep,
}: {
  paused: boolean;
  stepRequest: number;
  timeScale: number;
  onStep: () => void;
}) {
  const { step } = useRapier();
  const handledRequest = useRef(0);

  useEffect(() => {
    if (!paused) {
      handledRequest.current = stepRequest;
      return;
    }

    if (stepRequest === handledRequest.current) {
      return;
    }

    const pendingSteps = stepRequest - handledRequest.current;

    handledRequest.current = stepRequest;

    for (let index = 0; index < pendingSteps; index += 1) {
      step(DEMO_PHYSICS_STEP * timeScale);
      onStep();
    }
  }, [onStep, paused, step, stepRequest, timeScale]);

  return null;
}

function DemoScene() {
  const touchInputRef = useDemoTouchInput();
  const physicsDebug = useDemoPhysicsDebugControls();
  const validationScenario = useDemoValidationScenario();
  const activeInputRef =
    validationScenario.scenario ? validationScenario.inputRef : touchInputRef;
  const playerPositionRef = useRef(new Vector3(...DEMO_PLAYER_POSITION));
  const playerUpRef = useRef(new Vector3(0, 1, 0));
  const cameraViewRef = useRef(new Vector3(0, 0, 1));

  return (
    <>
      {DEMO_DEBUG ? <KeyRibbon /> : null}
      <Canvas
        camera={{
          fov: 42,
          near: 0.1,
          far: 250,
          // The ragdoll is ~3.7 m tall, so it needs a longer shot than the boxman.
          position: DEMO_PLAYER_MODE === "ragdoll" ? [4, 3.2, 15] : [0, 3.5, 8],
        }}
        gl={{ antialias: true }}
        shadows
      >
        <color attach="background" args={USE_PLANET_DEMO ? ["#040812"] : ["#d9e7d2"]} />
        {USE_PLANET_DEMO ? null : (
          <fog attach="fog" args={["#d9e7d2", 45, 180]} />
        )}
        <Suspense fallback={null}>
          <Lights planetMode={USE_PLANET_DEMO} />
          {USE_PLANET_DEMO ? (
            <>
              <DemoPlanetBackdrop />
              <Physics gravity={[0, 0, 0]}>
                <DemoValidationClock validation={validationScenario} />
                <TerrainArena />
                <TerrainChunkManager positionRef={playerPositionRef} />
                <DemoBoxmanPlayer
                  inputRef={activeInputRef}
                  position={DEMO_PLAYER_POSITION}
                  positionRef={playerPositionRef}
                  upRef={playerUpRef}
                  viewVectorRef={cameraViewRef}
                />
              </Physics>
              <DemoPlanetCamera
                positionRef={playerPositionRef}
                upRef={playerUpRef}
                viewVectorRef={cameraViewRef}
              />
            </>
          ) : (
            <Physics
              gravity={[0, -9.81, 0]}
              paused={physicsDebug.paused}
              timeStep={DEMO_PHYSICS_STEP * physicsDebug.timeScale}
            >
              <DemoPhysicsStepper
                onStep={physicsDebug.acknowledgeStep}
                paused={physicsDebug.paused}
                stepRequest={physicsDebug.stepRequest}
                timeScale={physicsDebug.timeScale}
              />
              <DemoValidationClock validation={validationScenario} />
              <FlatArena />
              {DEMO_PLAYER_MODE === "ragdoll" ? (
              <CharacterCtrlrActiveRagdollPlayer
                controls="keyboard"
                characterModelUrl={DEMO_RAGDOLL_MODEL}
                debug={DEMO_DEBUG}
                inputRef={activeInputRef}
                mixamoSource={DEMO_MIXAMO_SOURCE}
                position={DEMO_PLAYER_POSITION}
              />
            ) : (
                <></>
              )}
              <DemoValidationPusher
                elapsedRef={validationScenario.elapsedRef}
                scenario={validationScenario.scenario}
              />
              {SHOW_RAGDOLL_DUMMY ? (
                <CharacterCtrlrRagdollDummy
                  debug
                  manualStepCount={physicsDebug.manualStepCount}
                  paused={physicsDebug.paused}
                  position={DEMO_DUMMY_POSITION}
                  timeScale={physicsDebug.timeScale}
                />
              ) : null}
            </Physics>
          )}
          {DEMO_PLAYER_MODE === "ragdoll" && !USE_PLANET_DEMO ? (
            // Third-person camera: click the canvas to capture the mouse, move it to orbit, Esc to
            // release. Offsets are scaled up for the ~3.7 m ragdoll.
            <CharacterCtrlrCameraRig
              collisionPadding={0.5}
              followOffset={[0, 2.6, 11]}
              minCollisionDistance={4}
            />
          ) : null}
        </Suspense>
      </Canvas>
    </>
  );
}

const DEMO_RIG_VIEW =
  new URLSearchParams(window.location.search).get("view") === "rig";

export default function App() {
  if (DEMO_RIG_VIEW) {
    return <RigTestScene />;
  }

  return (
    <CharacterCtrlrProvider initialState={{ playerPosition: DEMO_PLAYER_POSITION }}>
      <DemoScene />
    </CharacterCtrlrProvider>
  );
}
