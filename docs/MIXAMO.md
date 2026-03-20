# Mixamo Integration

`CharacterCtrlrActiveRagdollPlayer` now supports an optional Mixamo motion-target path through the `mixamoSource` prop.

This is not animation playback replacing the controller. The Mixamo rig is loaded as a hidden target skeleton, sampled every frame, and blended into the active ragdoll's joint motor targets.

## What To Download

Download these files from Mixamo in `FBX` format:

- one character rig with skin:
  - `character.fbx`
- animation-only clips:
  - `idle.fbx`
  - `walk.fbx`
  - `run.fbx`
  - `crouch-walk.fbx`
  - `jump.fbx`

The current retargeting assumes the standard Mixamo bone naming convention:

- `mixamorigHips`
- `mixamorigSpine`
- `mixamorigSpine2`
- `mixamorigHead`
- `mixamorigLeftUpLeg`
- `mixamorigLeftLeg`
- `mixamorigLeftFoot`
- `mixamorigLeftArm`
- `mixamorigLeftForeArm`
- `mixamorigLeftHand`
- `mixamorigRightUpLeg`
- `mixamorigRightLeg`
- `mixamorigRightFoot`
- `mixamorigRightArm`
- `mixamorigRightForeArm`
- `mixamorigRightHand`

## Demo File Layout

Place the downloads in:

```text
public/mixamo/character.fbx
public/mixamo/idle.fbx
public/mixamo/walk.fbx
public/mixamo/run.fbx
public/mixamo/crouch-walk.fbx
public/mixamo/jump.fbx
```

Then run the demo with:

```text
?player=ragdoll&motion=mixamo
```

Example:

```text
http://localhost:5173/?player=ragdoll&motion=mixamo
```

## Library Usage

```tsx
import { CharacterCtrlrActiveRagdollPlayer } from "a-character-ctrlr";

<CharacterCtrlrActiveRagdollPlayer
  controls="keyboard"
  mixamoSource={{
    rigUrl: "/mixamo/character.fbx",
    clips: {
      idle: "/mixamo/idle.fbx",
      walk: "/mixamo/walk.fbx",
      run: "/mixamo/run.fbx",
      crouch: "/mixamo/crouch-walk.fbx",
      jump: "/mixamo/jump.fbx",
    },
    blend: 0.9,
  }}
/>;
```

## Current Scope

- the sampled Mixamo target currently drives pelvis, chest, hips, knees, ankles, shoulders, elbows, and wrists
- the active ragdoll balance/recovery logic still runs
- this is intended to get us to stable standing and a first clean step faster than pure procedural gait tuning

## Expected Next Tuning

Once the files are in and the demo is running, the likely tuning points are:

- per-joint sign and axis correction for the Mixamo retarget
- stronger idle stand matching
- step timing and foot-plant blending during walk startup
