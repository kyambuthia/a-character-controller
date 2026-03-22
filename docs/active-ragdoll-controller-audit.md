# Active Ragdoll Controller Audit

This note audits the current `src/lib/components/CharacterCtrlrActiveRagdollPlayer.tsx` implementation before the larger stabilization refactor.

## Primary failure modes

### Why the player kneels immediately

The current controller enters the world with a poor standing boundary condition and then tries to solve standing, gait startup, and recovery in the same frame loop.

Concrete causes in code:

- Spawn/load-in is controlled by the same runtime loop that later handles gait and recovery. The frame loop in `CharacterCtrlrActiveRagdollPlayer.tsx` samples calibration, support, standing, gait, recovery, and motor targets all together, so there is no clean "neutral preload then locomotion" phase.
- Standing is driven by a mixture of:
  - pelvis/chest world-space impulses
  - foot planting impulses
  - segment torque nudges
  - joint motor targets
  These all act at once, and they are not organized around a single explicit standing controller state.
- Pelvis height regulation is computed relative to an averaged support center, not a support region or stance-conditioned support model. That makes it easy for the rig to chase a height target while the knees are already folding.
- Before the recent calibration fix, sampled joint calibration was collected but not applied to motor targets. That meant the motors could fight the assembled bind pose on the first frame. Even with that fix, standing is still spread across unrelated local logic instead of one coherent subsystem.
- There is still no explicit preload phase that first establishes:
  - support confirmation
  - neutral articulated pose
  - pelvis height equilibrium
  - torso pitch/roll stability
  before gait logic is allowed to influence the rig.

### Why the gait is erratic

The gait is currently unstable because nominal walking, balance recovery, and standing share the same control surface without a sufficiently strict separation of responsibilities.

Concrete causes in code:

- Gait phase transitions are still too tightly coupled to noisy support state. The controller uses contact callbacks, ground probes, phase timers, and support overrides together, but the separation between "support observed" and "phase transition confirmed" is still too weak.
- The controller computes `supportStateForPhase`, `supportStateForControl`, `standingSupport`, `spawnSettleActive`, `recoveryState`, and `locomotionCommandActive` separately in the same loop. This creates cases where gait wants to step while recovery wants to suppress it and standing wants to flatten the pose.
- Recovery modifies the same pose target output that gait uses, via `applyRecoveryPoseTargets`, then standing can overwrite that again with `applyStandingPoseTargets`. This makes it hard to reason about which subsystem currently owns the lower body.
- Step planning uses capture-point-informed heuristics, but the planner is still embedded in the main loop and coupled directly to the current support-center approximation. There is no bounded planner object or structured landing-target clamp surface.
- Turn-in-place is not a first-class controller mode. Yaw target selection is still derived mainly from movement direction, so the controller does not yet have a dedicated "stand and rotate" behavior with explicit translation suppression.
- Motor gains and torque clamps are scattered through the frame loop. This makes it easy for new logic to add another force path without reconciling existing authority or saturation.

## Existing debug surfaces that must be preserved

The repo already has useful observability. The refactor must preserve these and keep them originating in `src/lib`.

Currently published from `CharacterCtrlrActiveRagdollPlayer.tsx`:

- movement mode
- gait phase
- gait transition reason
- balance state
- recovery state
- support state
- planned support side / swing side
- grounded
- movement input flag
- phase value / elapsed / duration / transition count
- gait effort / command effort / speed ratio / horizontal speed
- left/right support contact counts
- support lateral / forward / height errors
- center of mass and COM velocity
- support center
- capture point and capture timing / errors
- planned footfall
- step length / width / height targets
- lower-body measured joint angles and joint targets
- footfall forward / lateral error
- recent transition history

Currently rendered in `src/lib/components/CharacterCtrlrRagdollDebug.tsx`:

- floating debug board
- COM marker
- joint overlays
- contact normals
- joint target/error textual display
- transition history
- support / capture / footfall diagnostics

These must stay available after extraction. Debug state should be assembled from structured subsystem outputs, not by scraping miscellaneous local variables from the main loop.

## What should stay in `CharacterCtrlrActiveRagdollPlayer`

Keep in the component:

- prop handling
- React refs and lifecycle wiring
- Rapier body/joint ref ownership
- callback publication:
  - snapshots
  - movement-mode changes
  - grounded changes
  - jump / land
- final per-frame orchestration across subsystems
- debug publication handoff to `CharacterCtrlrHumanoidRagdoll` / `CharacterCtrlrRagdollDebug`

## What should be extracted

Extract from the component into internal modules:

- contact tracking and support-state hysteresis
- COM / pelvis / chest measurement
- standing controller
- gait FSM
- step planner
- recovery-state transition logic
- pose-target synthesis
- motor target resolution and gain scheduling
- debug-state assembly

These are currently implemented as intermixed local variables, refs, and helper functions inside one `useFrame` body. That is the main structural reason the controller is hard to stabilize.

## Short migration plan

1. Extract controller constants, neutral pose, and tuning groups into internal config modules so gains and clamps stop being scattered through the frame loop.
2. Extract contact tracking and support derivation into a stateful helper with explicit:
   - contact counts
   - contact lifetimes
   - grounded hysteresis
   - support-state confirmation
3. Extract world-space measurement into a subsystem that computes:
   - COM
   - support reference
   - pelvis/chest orientation
   - capture point
   - support-region errors
4. Replace the current loosely coupled gait logic with a compact deterministic FSM whose transitions require both phase timing and confirmed support conditions.
5. Make standing the zero-velocity boundary condition:
   - explicit standing pose vector
   - explicit pelvis/chest stabilization
   - explicit pelvis height controller
   - explicit ankle/hip balance assistance
6. Keep recovery explicit and bounded so it cannot silently fight nominal gait output.
7. Publish debug state from the structured subsystem outputs, then keep the existing debug rendering surface intact.

## Summary

The current failures are not mainly because the rig is "not in a T-pose". The real problems are:

- the controller still lacks a clean standing-first control boundary
- support, gait, and recovery ownership are too entangled
- state transitions are still too permissive under noisy support
- motor authority and gain schedules are distributed instead of centralized

The refactor should make standing authoritative first, then let gait and step planning extend that stable baseline.
