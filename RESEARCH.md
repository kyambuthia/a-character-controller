# Relevant Technical Studies

These are the most relevant references for the kind of character you described: a third-person playable character with walking, running, crouching, shooting, vehicle interaction, and sports actions.

## 1. Motion Matching and The Road to Next-Gen Animation

Link: <https://media.gdcvault.com/gdc2016/Presentations/Clavet_Simon_MotionMatching.pdf>

Why it matters:

- Best practical starting point when you expect a large library of locomotion and action clips.
- Excellent for responsive starts, stops, pivots, and traversal without hand-authoring giant transition trees.
- Still highly relevant if you later decide to move beyond blend trees in a production game setup.

Best use in this repo:

- Future replacement for the manual locomotion graph once clip count gets large.

## 2. Phase-Functioned Neural Networks for Character Control

Link: <https://theorangeduck.com/page/phase-functioned-neural-networks-character-control>

Why it matters:

- Strong reference for terrain-aware locomotion, crouching under obstacles, and user-driven movement over varied geometry.
- Shows how phase-aware control improves continuous locomotion quality compared with naive autoregressive methods.

Best use in this repo:

- Design inspiration for trajectory features, terrain sampling, and state decomposition even if we do not train a neural model immediately.

## 3. DeepMimic: Example-Guided Deep Reinforcement Learning of Physics-Based Character Skills

Link: <https://xbpeng.github.io/projects/DeepMimic/index.html>

Why it matters:

- The clearest reference for physics-driven characters that can take impacts, recover, and perform stylized skills.
- Directly relevant to ragdoll blending, recovery logic, and eventually sports actions or reactive stunts.

Best use in this repo:

- Long-term reference for active ragdoll, recovery, and physically grounded special actions.

## 4. Neural State Machine for Character-Scene Interactions

Link: <https://github.com/sebastianstarke/AI4Animation>

Why it matters:

- One of the strongest references for door opening, sitting, carrying, and obstacle-aware interactions from simple controls.
- Especially relevant because your end goal includes opening car doors and other environment-dependent actions.

Best use in this repo:

- Blueprint for an interaction layer that reasons about object geometry and approach alignment.

## 5. Local Motion Phases for Learning Multi-Contact Character Movements

Link: <https://github.com/sebastianstarke/AI4Animation>

Why it matters:

- Relevant when a single global phase variable is not enough, which happens quickly with sports, shooting, ball handling, and complex interactions.
- Strong fit for golf-like actions, door interaction, and multi-contact tasks where hands and feet have different rhythms.

Best use in this repo:

- Upgrade path for complex action synthesis after the locomotion/controller baseline is stable.

## 6. Neural Animation Layering for Synthesizing Martial Arts Movements

Link: <https://www.sebastianxstarke.com/assets/portfolio/14/page.html>

Why it matters:

- Useful for combining locomotion with upper-body intent, which is exactly the problem space for moving while aiming or shooting.
- Valuable conceptually even if the final implementation uses authored layers rather than learned layers.

Best use in this repo:

- Reference for decoupling lower-body locomotion from upper-body action overlays.

## 7. DeepPhase: Periodic Autoencoders for Learning Motion Phase Manifolds

Link: <https://i.cs.hku.hk/~taku/deepphase.pdf>

Why it matters:

- Helps with organizing and matching large unstructured motion datasets.
- Especially useful once you collect many locomotion, sports, and interaction clips and need better retrieval or synthesis features.

Best use in this repo:

- Future data pipeline improvement for motion search, clustering, and transition quality.

## 8. Animation Warping for Responsiveness in FIFA Soccer

Link: <https://www.gdcvault.com/play/1012342/Animation-Warping-for-Responsiveness-in>

Why it matters:

- Practical production reference for making captured animation respond to gameplay constraints.
- Very relevant for foot placement, turn correction, reaching targets, and time-to-hit adjustments in sports-like actions.

Best use in this repo:

- Immediate reference for stride warping, alignment warping, and gameplay-driven pose correction before moving to heavier ML approaches.

## Recommended implementation reading order

1. Motion Matching
2. PFNN
3. Neural State Machine
4. Local Motion Phases
5. DeepPhase
6. DeepMimic

That order matches the likely shipping path for this project: deterministic controller first, interaction-aware animation second, physics-heavy or learned controllers later.
