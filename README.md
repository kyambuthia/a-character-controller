# a-character-controller

`a-character-controller` is a hybrid `library + demo` project for a React Three Fiber third-person controller stack. It ships a reusable primitive player, a follow camera with camera-occlusion handling, scoped controller state, a humanoid ragdoll dummy, and an in-world ragdoll debug lab.

## WIP

The active ragdoll **stands and walks** in the demo, but slowly, and only on a rotation-locked rig. Turning, fast running and recovery stepping are still unsolved.

Measured in the browser with `scripts/probe-active-ragdoll.mjs` (see below):

| Scenario | Result |
| --- | --- |
| `spawn_idle_stability` | stands indefinitely; absorbs a 1.5 m/s whole-body push and settles |
| `steady_forward_walk` | 0.63 m/s, ~25 cm foot clearance, no falls; stops and stands when the key is released |
| `steady_forward_run` | 0.77 m/s, no falls (not yet a real run) |
| `steady_crouch_walk` | 0.15 m/s at a 1.42 m crouch, no falls |
| `turn_in_place_stability` | no falls, but reports `unstable_yaw` while turning |

What got it there, in order:

- **Motors.** Rapier's default acceleration-based joint motors cannot hold weight through light limbs, so joints use force-based torque motors (`MOTOR_TORQUE_SCALE` in `active-ragdoll/motors.ts`), and the controller runs on the fixed physics step instead of the render loop.
- **Masses.** `@react-three/rapier` ignores a `RigidBody`'s `mass` prop when it builds auto-colliders, so the browser ragdoll weighed ~0.9 kg while the headless tests simulated ~14 kg. Bodies now get a density derived from their mass (`deriveCharacterCtrlrHumanoidBodyDensity`). The light rig made the solver blow up as soon as a foot lifted.
- **Foot contacts.** The collision handler rejected every foot-ground contact (wrong normal sign), so grounding relied on one ray from each foot's centre. It now measures the contact with the foot first (`measureContactSupport`).
- **Gait.** A stance phase ended as a "landing" before the swing foot had lifted; gait pelvis heights were tuned for an older, shorter rig; and the swing leg was too weak and too slow (overdamped) and bent too little to clear the ground.

Caveat: the rig's torso and legs are rotation-locked (pelvis/chest yaw only, legs pitch only), so it cannot tip over sideways or shift its weight onto one foot. This is sagittal walking, not full 3D balance. Unlocking those axes is the next hard step.

Active ragdoll WIP:

![Active ragdoll WIP](./docs/media/active-ragdoll-wip.png)

Older walk attempt (captured before the fixes above):

![Active ragdoll walk attempt](./docs/media/active-ragdoll-walk-attempt.gif)

Package name:

```bash
npm install a-character-controller
```

## Production active-ragdoll direction

The repo is now explicitly being pushed toward a production-capable active ragdoll for mobile and PC.

Important boundaries:

- `src/lib` is the shipping codepath
- `src/components` is demo-only support code
- the demo is used to inspect and reproduce behavior, not to host one-off controller logic
- visual debugging is treated as part of the runtime engineering surface, not as optional polish

The chosen controller family is:

- deterministic `SIMBICON`-style gait control
- `capture-point` stepping heuristics for balance recovery
- later directional locomotion expansion informed by `Generalized Biped Walking Control`

See:

- [RESEARCH.md](./RESEARCH.md)
- [ROADMAP.md](./ROADMAP.md)

## Production baseline

The library is now in a solid packageable baseline for:

- third-person movement with `idle`, `walk`, `run`, `crouch`, `jump`, and `fall`
- external or keyboard-driven input
- follow-camera control with pointer lock and scene-occlusion avoidance
- state snapshots and movement lifecycle callbacks
- a separate humanoid ragdoll test dummy with in-world debug visualization

What is not finished yet:

- step-up and slope-specialized controller handling
- tuned production active-ragdoll walking, running, and recovery behavior
- authored interaction systems for doors, vehicles, weapons, and golf
- skinned-character animation or motion-matching backends

## Current issues

Standing and slow walking work (see WIP above). Still open:

- walking is slow (0.63 m/s against a 2.7 m/s command) and running is barely faster than walking
- turning in place reports `unstable_yaw`; turning while walking has not been tuned
- the rig is rotation-locked, so lateral balance and torso tilt are not actually being controlled
- locomotion still leans on world-space impulse assists (pelvis height/centring, foot planting, swing-foot placement) on top of the joint motors
- the Mixamo-driven target path is useful for motion reference, but it does not yet guarantee stable physical walking
- the capsule controller remains the more reliable baseline; the active ragdoll is the current research path

How it is measured:

- `node scripts/probe-active-ragdoll.mjs --scenario <name>` runs the real React player in headless Chrome and prints sampled controller state, a gait summary (distance, speed, foot clearance, support) and a verdict. Scenario input and `--duration` run on simulated time, so a slow software renderer cannot distort them. Useful options: `--shove x,y,z` (whole-body push in m/s) with `--shoveAt t`, `--trace from,to` with `--traceStride n` and `--traceJoints 1` (per-physics-step trace), `--dumpAt t` (full debug state), `--shots t1,t2 --shotDir dir` (screenshots), `--query skin=boxes` (extra URL parameters)
- scenarios: `spawn_idle_stability`, `mild_push_recovery`, `turn_in_place_stability`, `walk_start_from_rest`, `steady_forward_walk`, `steady_forward_run`, `steady_crouch_walk`, `walk_run_walk_transition`, `no_persistent_foot_chatter`, `no_persistent_leg_scissoring`
- `scripts/sim-standing.mts` runs the humanoid headlessly on plain Rapier (no browser); `--force` switches to force-based motors, `--pushz`/`--pushx` shove the pelvis
- headless Rapier tests: `standing.sim.test.ts` (12 s stand, pushes, default motors buckle), `swing.sim.test.ts` (the swing gains lift a foot), `contactTracking.test.ts` (foot contact direction), `CharacterCtrlrHumanoidData.test.ts` (every body gets its defined mass)

Important engineering note:

- high COM plus small feet creates inverted-pendulum instability in any engine, but the standing and walking failures so far were not that: they were the motor model, the body masses, the contact sign and the gait timing
- the gait FSM, balance strategy, support switching, and step-placement logic are the primary controller-side responsibilities still under active work

## Install

```bash
npm install a-character-controller react react-dom three @react-three/fiber @react-three/rapier @react-three/drei
```

## Quick start

```tsx
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { CharacterCtrlrCameraRig, CharacterCtrlrPlayer, CharacterCtrlrProvider } from "a-character-controller";

export function Scene() {
  return (
    <CharacterCtrlrProvider initialState={{ playerPosition: [0, 2.5, 6] }}>
      <Canvas shadows camera={{ fov: 42, near: 0.1, far: 250, position: [0, 3.5, 8] }}>
        <Physics gravity={[0, -9.81, 0]}>
          <CharacterCtrlrPlayer controls="keyboard" position={[0, 2.5, 6]} />
        </Physics>
        <CharacterCtrlrCameraRig />
      </Canvas>
    </CharacterCtrlrProvider>
  );
}
```

## Controlled input example

Use `controls="none"` when you want to drive the player from your own touch, gamepad, AI, or network state.

```tsx
import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import {
  CharacterCtrlrCameraRig,
  CharacterCtrlrPlayer,
  CharacterCtrlrProvider,
  useCharacterCtrlrInputController,
} from "a-character-controller";

function BotDriver() {
  const controller = useCharacterCtrlrInputController();

  useEffect(() => {
    controller.replaceInput({ forward: true, run: true });
    return () => controller.resetInput();
  }, [controller]);

  return (
    <>
      <CharacterCtrlrPlayer
        controls="none"
        inputRef={controller.inputRef}
        onGroundedChange={(grounded) => {
          if (!grounded) {
            controller.pressInput("jump", false);
          }
        }}
      />
      <CharacterCtrlrCameraRig />
    </>
  );
}

export function Scene() {
  return (
    <CharacterCtrlrProvider>
      <Canvas>
        <Physics>
          <BotDriver />
        </Physics>
      </Canvas>
    </CharacterCtrlrProvider>
  );
}
```

## Exported API

- `CharacterCtrlrProvider`
- `createCharacterCtrlrStore`
- `useCharacterCtrlrStore`
- `useCharacterCtrlrStoreApi`
- `useCharacterCtrlrKeyboardInput`
- `useCharacterCtrlrInputController`
- `CharacterCtrlrActiveRagdollPlayer` experimental
- `CharacterCtrlrPlayer`
- `CharacterCtrlrCameraRig`
- `CharacterCtrlrRagdollDummy`
- `DEFAULT_CHARACTER_CTRLR_INPUT`
- `mergeCharacterCtrlrInput`

Useful exported types:

- `CharacterCtrlrControllerState`
- `CharacterCtrlrStoreApi`
- `CharacterCtrlrStoreInit`
- `CharacterCtrlrInputState`
- `CharacterCtrlrMovementMode`
- `CharacterCtrlrPlayerSnapshot`
- `CharacterCtrlrSupportState`
- `CharacterCtrlrVec3`

## Key component props

`CharacterCtrlrPlayer` supports:

- `controls="keyboard" | "none"`
- `input` and `inputRef` for additive external input
- tunables for `walkSpeed`, `runSpeed`, `crouchSpeed`, `jumpVelocity`, `acceleration`, `deceleration`, and `airControl`
- `onSnapshotChange`, `onMovementModeChange`, `onGroundedChange`, `onJump`, and `onLand`
- `debug` for the in-world player debug overlay
- emitted snapshots currently report `supportState` as a simple `"double"` or `"none"` fallback for the capsule baseline

`CharacterCtrlrActiveRagdollPlayer` supports:

- the same input and lifecycle callback shape as `CharacterCtrlrPlayer`
- optional `mixamoSource` loading for hidden animation-target retargeting into the active ragdoll joint motors
- experimental tunables for `jumpImpulse`, `uprightTorque`, `turnTorque`, and `balanceDamping`
- experimental camera-target tuning with `cameraFocusSmoothing`, `cameraFocusHeight`, and `cameraFocusLead`
- `debug` to view the articulated rig through the ragdoll debug overlay
- emitted snapshots report articulated foot support as `"none"`, `"left"`, `"right"`, or `"double"`

Production note:

- active-ragdoll work is still marked experimental, but the implementation now has the intended long-term control architecture in place:
  - explicit gait FSM
  - phase-based pose targets
  - COM and capture-point feedback
  - step length, width, and clearance targets
  - locomotion family configs
  - recovery and deterministic gait re-entry
- grounded-state recovery now uses:
  - contact hysteresis for grounded/airborne transitions
  - delayed jump-contact clearing
  - downward Rapier ground probes under the feet as a fallback when foot contact callbacks are unreliable
- standing is now handled as a dedicated support problem rather than just an idle gait:
  - pelvis support is solved relative to the foot sole plane
  - idle and low-speed double-support use a stand-assist path
  - feet are planted and leveled while standing so the rig can hold posture before stepping
- the active-ragdoll controller internals are now split into explicit library subsystems for:
  - contact tracking and support confirmation
  - gait progression
  - standing control
  - COM / capture-point measurement
  - step planning
  - recovery classification
  - debug-state publication
- demo validation scenarios can be run with `?scenario=` query params such as:
  - `spawn_idle_stability`
  - `turn_in_place_stability`
  - `walk_start_from_rest`
  - `steady_forward_walk`
  - `walk_run_walk_transition`
  - `mild_push_recovery`
  - `no_persistent_foot_chatter`
  - `no_persistent_leg_scissoring`
- those scenarios are currently a debugging harness, not a success suite:
  - they exist to reproduce controller failures consistently
  - they should not be read as evidence that standing or walking is solved
- new locomotion, balance, and recovery work should land in the library runtime first and only then be exposed through the demo

`CharacterCtrlrCameraRig` supports:

- `followOffset`, `focusHeight`, and `smoothing`
- `pointerLock`, `yawSensitivity`, and `pitchSensitivity`
- `collisionEnabled`, `collisionPadding`, and `minCollisionDistance`

`CharacterCtrlrRagdollDummy` supports:

- `position`
- `debug`
- paused/manual-step demo debugging props for the in-repo sandbox

## Repo layout

- `src/lib`: publishable library source
- `src/components`: demo-only scene pieces
- `dist`: library build output
- `demo-dist`: demo build output
- `RESEARCH.md`: academic basis for the active-ragdoll architecture
- `ROADMAP.md`: production implementation plan and phase breakdown

## Scripts

- `npm run dev`: run the demo locally
- `npm run dev:lan`: run the demo on your LAN
- `npm run test`: run the library smoke tests
- `npm run build:lib`: build the package into `dist`
- `npm run build:demo`: build the demo into `demo-dist`
- `npm run build`: typecheck, test, and build both library and demo
- `npm run preview:lan`: preview the demo build on your LAN

Demo tip:

- the demo now defaults to the active ragdoll player
- add `?player=capsule` to the dev URL to load the capsule baseline instead
- add `?motion=mixamo` to enable the optional Mixamo target path in the ragdoll demo once the FBX files are placed in `public/mixamo`
- the current ragdoll debugging/tuning path is `http://localhost:5173/?player=ragdoll&motion=mixamo`

Mixamo tip:

- see [docs/MIXAMO.md](./docs/MIXAMO.md) for the expected FBX downloads, file layout, and `mixamoSource` usage

## Design direction

The current shipping strategy is deliberate: keep control, camera, state, and interaction logic deterministic first, then add more sophisticated animation systems later. For the active ragdoll specifically, that now means a production-focused finite-state controller with explicit support, foot planting, COM, capture-point, and balance diagnostics before any learned or mocap-heavy runtime is considered.

See also:

- [ROADMAP.md](./ROADMAP.md)
- [RESEARCH.md](./RESEARCH.md)
