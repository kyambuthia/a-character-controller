# Active-Ragdoll Literature Basis

This repo is now explicitly following a production-oriented active-ragdoll path for mobile and PC. The target is not a research demo that only looks good in one scene. The target is a deterministic, inspectable, shippable controller that can walk, run, jump, absorb impacts, and recover without requiring ML inference at runtime.

The implementation decision for `a-character-controller` is:

- use a `SIMBICON`-style finite-state locomotion controller as the core runtime architecture
- add `capture point` and inverted-pendulum-inspired stepping heuristics for balance recovery and foot placement
- borrow directional locomotion, gait parameterization, and robustness ideas from `Generalized Biped Walking Control`
- treat data-driven or RL controllers as later research branches, not the default shipping path

## Why this stack was chosen

For this repo, the most important constraints are:

- predictable performance on mobile and PC
- no neural-network inference in the hot path
- explicit gait states and failure modes
- clear visual debugging of support, COM, and joint targets
- easy regression testing in `src/lib`

That makes a deterministic controller family a better fit than a DeepMimic-style runtime or a motion-matching-heavy stack.

## Core papers

## 1. SIMBICON: Simple Biped Locomotion Control

Reference:

- Yin, Loken, van de Panne, `SIMBICON: Simple Biped Locomotion Control`, SIGGRAPH 2007
- PDF: <https://people.cs.ubc.ca/~van/papers/2007-siggraph-simbicon.pdf>

Why it matters:

- This is the best direct reference for a hand-authored active-ragdoll controller that remains small enough to debug.
- It shows how to combine a locomotion state machine with target joint poses and simple feedback terms.
- It is explicitly aimed at dynamic biped locomotion rather than purely kinematic animation playback.

Main ideas to carry into `a-character-controller`:

- locomotion is a sequence of stance/swing states, not a continuous unconstrained motor soup
- each state has a target pose and a short list of feedback terms
- pelvis and torso control should be expressed partly in world space, not only local joint space
- swing leg placement should react to tracking error and COM velocity, not only phase

Practical mapping to this repo:

- `CharacterCtrlrActiveRagdollPlayer.tsx` owns the gait FSM
- state outputs are target hip, knee, ankle, shoulder, elbow, and torso goals
- transitions are driven by elapsed phase, support contact, and failure predicates
- motor gains are phase-specific and movement-mode-specific

## 2. Generalized Biped Walking Control

Reference:

- Coros, Beaudoin, van de Panne, `Generalized Biped Walking Control`, SIGGRAPH 2010
- Project page: <https://www.cs.ubc.ca/~van/papers/2010-TOG-gbwc/index.html>

Why it matters:

- This is the best follow-up once basic forward locomotion exists.
- It broadens the controller space to forward motion, turning, speed changes, starts, stops, and other motion variants without abandoning a deterministic control architecture.

Main ideas to carry into `a-character-controller`:

- locomotion should be parameterized by desired velocity and heading, not by a single hard-coded walk cycle
- the controller should expose stride length, cadence, trunk lean, and foot-placement adjustments as functions of command state
- support switching and stepping need to remain robust under perturbation

Practical mapping to this repo:

- convert `walk`, `run`, `backpedal`, and `strafe` into parameter sets over the same gait controller
- expose command-space-to-gait-space mappings in the library, not only in the demo
- make turning and braking first-class locomotion modes instead of edge cases

## 3. Capture Point: A Step toward Humanoid Push Recovery

Reference:

- Pratt, Carff, Drakunov, Goswami, `Capture Point: A Step toward Humanoid Push Recovery`, Humanoids 2006
- PDF: <https://www.cs.cmu.edu/~hgeyer/Teaching/R16-899B/Papers/Pratt%26Goswami06Humanoids.pdf>

Why it matters:

- This paper provides the most useful compact balance heuristic for an active ragdoll that must decide whether it can recover in place or must step.
- It gives a clear way to reason about recovery without needing a heavyweight whole-body optimizer.

Main ideas to carry into `a-character-controller`:

- if the projected COM dynamics imply that balance cannot be recovered over the current support polygon, initiate a step
- the simplest useful stepping target comes from the linear inverted pendulum model:

`x_cp = x_com + v_com / omega_0`

where:

- `x_cp` is the capture point
- `x_com` is the horizontal center of mass
- `v_com` is horizontal COM velocity
- `omega_0 = sqrt(g / z_com)`

Practical mapping to this repo:

- compute COM and support polygon every frame in the library runtime
- draw COM projection, capture point, and planned footfall in the debug layer
- use capture-point distance as both a debug metric and a step-trigger condition

## 4. Biped Walking Pattern Generation by using Preview Control of Zero-Moment Point

Reference:

- Kajita et al., `Biped Walking Pattern Generation by using Preview Control of Zero-Moment Point`, ICRA 2003
- IEEE Xplore entry: <https://ieeexplore.ieee.org/document/1241826>

Why it matters:

- This is more robotics-oriented than the other sources, but it is important for disciplined COM reasoning and future terrain-aware stepping.
- It is the right conceptual reference if the controller later needs explicit preview-based footstep planning or tighter landing stability.

Main ideas to carry into `a-character-controller`:

- maintain a clear distinction between commanded motion, COM motion, and support feasibility
- use preview-like reasoning when choosing future support transitions on uneven ground

Practical mapping to this repo:

- phase 1 and phase 2 do not need full ZMP preview control
- later terrain/stair/slope work can borrow the preview mindset without adopting the entire robotics stack

## 5. DeepMimic: Example-Guided Deep Reinforcement Learning of Physics-Based Character Skills

Reference:

- Peng et al., `DeepMimic: Example-Guided Deep Reinforcement Learning of Physics-Based Character Skills`, SIGGRAPH 2018
- Project page: <https://xbpeng.github.io/projects/DeepMimic/index.html>
- arXiv: <https://arxiv.org/abs/1804.02717>

Why it matters:

- This is the strongest reference for what the long-term active-ragdoll ceiling looks like.
- It is especially relevant for impact recovery, stylized action transfer, and get-up behavior.

Why it is not the default path for `a-character-controller` v1:

- training complexity is high
- the runtime stack is much harder to inspect and regression-test
- shipping on mobile becomes more complex
- the repo does not yet have the data, tooling, or evaluation harness that makes RL worthwhile

Practical mapping to this repo:

- keep as a future branch for recovery, stunt actions, or imitation-learning experiments
- do not block the deterministic locomotion controller on it

## Chosen production interpretation

The literature-backed production plan for `a-character-controller` is:

1. `Reduced DOF articulated rig`
2. `Finite-state active-ragdoll controller`
3. `World-space pelvis/torso stabilization`
4. `Capture-point-informed stepping`
5. `Parameterized gait for forward, backward, strafe, turn, run`
6. `Deterministic jump, landing, and recovery`
7. `Optional future data-driven layers`

This is intentionally conservative. It is the highest-confidence path to a controller that is:

- understandable by gameplay programmers
- tunable by hand
- performant on mobile hardware
- suitable for a published library

## Production engineering consequences

Because we are following this literature as a shipping plan instead of a toy experiment:

- all control architecture changes belong in `src/lib`
- The separate planet-walker playground may visualize the work, but it must not become the primary implementation site
- observability is part of the architecture, not an afterthought
- every locomotion phase should surface measurable diagnostics: support state, COM projection, capture point, planned footfall, joint error, and transition reason

## Reading order for implementation

1. `SIMBICON`
2. `Capture Point`
3. `Generalized Biped Walking Control`
4. `Kajita preview control`
5. `DeepMimic`

That order matches the recommended engineering sequence:

1. stable deterministic walking
2. stable stepping and recovery
3. directional locomotion expansion
4. terrain-aware planning
5. advanced learned controllers only if product scope later demands them
