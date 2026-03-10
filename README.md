# Mwendo

`Mwendo` is a React Three Fiber prototype for building a production-grade third-person character stack in phases, starting with flatspace traversal and a visible ragdoll test target.

## Current prototype

- Third-person chase camera with mouse-look via pointer lock
- Physics-backed capsule controller with walk, run, and crouch states
- Flat test arena with crates and a ramp for collision checks
- Jointed ragdoll dummy to validate impacts and future recovery work

## Why this stack

- `@react-three/fiber` keeps scene orchestration in React while leaving room for a bespoke gameplay architecture.
- `@react-three/rapier` gives us performant rigid-body physics for the controller, ragdolls, props, and later vehicle interaction volumes.
- `zustand` provides a small shared state layer for controller intent, camera parameters, and animation state without forcing a heavy ECS too early.

## Roadmap

### Phase 1: Sandbox feel

1. Tighten controller tuning: acceleration, deceleration, slopes, step offset, grounded detection, and jump buffering.
2. Replace the placeholder capsule avatar with a skinned biped and a clean locomotion animation graph.
3. Add debug overlays for contact normals, movement state, and animation blend weights.

### Phase 2: Locomotion quality

1. Add stride warping, foot IK, turn-in-place, stop transitions, and slope-aware pose correction.
2. Introduce motion matching or phase-aware locomotion once the move set grows past simple blend-tree coverage.
3. Support contextual crouch locomotion, aiming offsets, upper-body masking, and camera-aware strafing.

### Phase 3: Interaction layer

1. Build an interaction system with authored targets and hand-placement constraints.
2. Add car entry and door interaction states with reach targets, seat alignment, and stateful camera transitions.
3. Add golf interactions as a controlled mini-game state with object pickup, alignment, swing timing, and ball physics.

### Phase 4: Animation robustness

1. Blend animation with physics for hit reactions, stumble recovery, and ragdoll handoff.
2. Add network-safe input prediction boundaries if multiplayer is ever required.
3. Introduce telemetry-driven tuning for traversal friction, camera comfort, and animation response times.

## Research notes

These are the main technical references shaping the architecture:

- Motion Matching and The Road to Next-Gen Animation Data Selection, SIGGRAPH 2016 course, Ubisoft.
- Phase-Functioned Neural Networks for Character Control, SIGGRAPH 2018.
- DeepMimic: Example-Guided Deep Reinforcement Learning of Physics-Based Character Skills, SIGGRAPH 2018.
- Neural State Machine for Character-Scene Interactions, SIGGRAPH 2019.
- DeepPhase: Periodic Autoencoders for Learning Motion Phase Manifolds, SIGGRAPH 2022.

For this repo, the practical conclusion is to start with a deterministic gameplay controller and layer animation sophistication afterward. That keeps interactions like shooting, opening doors, and golf swings debuggable while still leaving the door open to motion matching or learned controllers once the move library becomes large enough.

See also:

- [ROADMAP.md](./ROADMAP.md) for milestone planning
- [RESEARCH.md](./RESEARCH.md) for the animation research shortlist
