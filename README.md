# a-character-controller

Reusable third-person character controller components for React Three Fiber and Rapier. This repository contains the controller library; the globe traversal playground is maintained separately in [planet-walker](https://github.com/kyambuthia/planet-walker).

## Install from GitHub

The package is not published to the npm registry yet. Install from this public repository:

<pre>
pnpm add github:kyambuthia/a-character-controller
</pre>

The GitHub package builds itself when installed. The consuming project also needs React, Three.js, React Three Fiber, and React Three Rapier as peer dependencies.

## Included

- A reusable primitive player and character input controller
- A follow camera rig with camera-occlusion handling
- Scoped controller state and player snapshots
- Humanoid ragdoll and active-ragdoll research components
- Optional Mixamo motion driving; see the [planet-walker playground guide](https://github.com/kyambuthia/planet-walker/blob/main/docs/MIXAMO.md)
- Debug state for gait phases, support, balance, and recovery

## Development

<pre>
pnpm install
pnpm build
</pre>

The build runs type checking, the controller unit and simulation tests, and the library bundle. The production entry point is src/lib/index.ts; package output is written to dist/.

See ROADMAP.md, RESEARCH.md, and docs/TASKLIST.md for the active-ragdoll design and current work.

## License

MIT
