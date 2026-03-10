# Implementation Roadmap

## Guiding principle

Keep gameplay control deterministic and debuggable first, then layer animation sophistication on top. That makes interactions like aiming, opening doors, entering vehicles, and golfing easier to ship without letting the animation system own all gameplay logic.

## Milestone 0: Playground baseline

Status: complete

- Flatspace traversal scene
- Third-person chase camera
- Physics-backed player capsule
- Ragdoll target for impact and future recovery tests

Exit criteria:

- Character can move around the arena reliably
- Camera remains readable behind the player
- Collisions with props and ragdoll are stable enough for iteration

## Milestone 1: Character controller quality

- Add acceleration curves, deceleration, slope handling, step-up logic, and camera collision avoidance
- Improve grounded detection and add jump, landing, and fall states
- Add aim-space rotation rules so locomotion and facing can diverge cleanly

Exit criteria:

- Controller feels stable at 60+ FPS under camera rotation and collision pressure
- Movement state is explicit and testable from input plus physics

## Milestone 2: Locomotion animation graph

- Import a biped rig with walk, run, crouch, idle, turn, stop, and start clips
- Build a lower-body locomotion graph with inertialized transitions
- Add foot IK, stride warping, slope adaptation, and root-motion policy decisions

Exit criteria:

- No obvious foot sliding on flat ground
- Walk, run, crouch, stop, and turn transitions are responsive and readable

## Milestone 3: Upper-body and combat layering

- Add aim offsets, additive recoil, and upper-body masking
- Separate locomotion state from action state so moving and shooting can coexist
- Add hand targets and pose constraints for prop alignment

Exit criteria:

- Shooting does not break locomotion balance
- Upper-body overlays can be swapped without rewriting the locomotion graph

## Milestone 4: Context interactions

- Add interaction anchors for doors, seats, golf clubs, balls, and pickup points
- Implement approach, align, enter, use, and exit states for each interaction family
- Introduce hand IK and local pose correction around authored targets

Exit criteria:

- Car door and seat interactions can be entered from more than one approach angle
- Golf setup and swing can be driven by a controlled state instead of a cutscene-style lock

## Milestone 5: Physics blending and recovery

- Add hit reactions and partial ragdoll blending
- Support full ragdoll fallback with recovery get-up logic
- Define which gameplay events are purely kinematic, partially physical, or fully simulated

Exit criteria:

- Character can enter and leave ragdoll without exploding or teleporting
- Recovery paths are deterministic enough for gameplay use

## Milestone 6: Data-driven upgrade path

- Evaluate motion matching once the clip library is large enough
- Evaluate DeepPhase or Local Motion Phases when interactions and sports actions become too numerous for manual graph maintenance
- Keep feature extraction, query generation, and interaction metadata independent from render code

Exit criteria:

- Replacing the locomotion backend does not require rewriting controller, camera, or interaction code
