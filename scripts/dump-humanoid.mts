// Dumps the ragdoll's body and joint definitions to JSON for scripts/blender/make_character.py.
// Usage: npx vite-node scripts/dump-humanoid.mts <out.json>
import { writeFileSync } from "node:fs";
import {
  CHARACTER_CTRLR_HUMANOID_BODY_DEFINITIONS,
  CHARACTER_CTRLR_HUMANOID_JOINT_DEFINITIONS,
} from "../src/lib/components/CharacterCtrlrHumanoidData";

writeFileSync(
  process.argv[2],
  JSON.stringify({
    bodies: CHARACTER_CTRLR_HUMANOID_BODY_DEFINITIONS,
    joints: CHARACTER_CTRLR_HUMANOID_JOINT_DEFINITIONS,
  }),
);
