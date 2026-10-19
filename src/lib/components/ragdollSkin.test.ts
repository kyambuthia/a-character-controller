import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Box3, Quaternion, SkinnedMesh, Vector3, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  CHARACTER_CTRLR_HUMANOID_BODY_DEFINITIONS,
  type CharacterCtrlrHumanoidBodyKey,
} from "./CharacterCtrlrHumanoidData";
import {
  RAGDOLL_SKIN_BINDINGS,
  createRagdollSkinRig,
  deriveSkinTargetBox,
  type RagdollSkinBodyTransform,
} from "./ragdollSkin";

const MODEL_PATH = new URL("../../../public/assets/character.glb", import.meta.url);

async function loadCharacter() {
  const bytes = readFileSync(MODEL_PATH);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

  return new Promise<Object3D>((resolve, reject) => {
    new GLTFLoader().parse(arrayBuffer as ArrayBuffer, "", (gltf) => resolve(gltf.scene), reject);
  });
}

type BodyPose = { position: Vector3; rotation: Quaternion };

/** Bodies in their spawn pose, lifted by `lift`; mirrors how the React ragdoll spawns them. */
function spawnPoses(lift = new Vector3(0, 2.02, 0)) {
  return new Map<CharacterCtrlrHumanoidBodyKey, BodyPose>(
    CHARACTER_CTRLR_HUMANOID_BODY_DEFINITIONS.map((definition) => [
      definition.key,
      {
        position: new Vector3(...definition.position).add(lift),
        rotation: new Quaternion(),
      },
    ]),
  );
}

function asBody(pose: BodyPose | undefined): RagdollSkinBodyTransform | null {
  return pose
    ? {
        translation: () => ({ x: pose.position.x, y: pose.position.y, z: pose.position.z }),
        rotation: () => ({
          x: pose.rotation.x,
          y: pose.rotation.y,
          z: pose.rotation.z,
          w: pose.rotation.w,
        }),
      }
    : null;
}

/** World-space bounds of the vertices skinned to `boneName`, after the bones have been posed. */
function skinnedBoundsOfBone(root: Object3D, boneName: string) {
  root.updateMatrixWorld(true);
  let mesh: SkinnedMesh | null = null;
  root.traverse((child) => {
    if (!mesh && (child as SkinnedMesh).isSkinnedMesh) mesh = child as SkinnedMesh;
  });
  const skinned = mesh as SkinnedMesh | null;
  if (!skinned) throw new Error("no skinned mesh");

  const boneIndex = skinned.skeleton.bones.findIndex((bone) => bone.name === boneName);
  const skinIndex = skinned.geometry.getAttribute("skinIndex");
  const box = new Box3();
  const point = new Vector3();

  for (let vertex = 0; vertex < skinIndex.count; vertex += 1) {
    if (skinIndex.getX(vertex) !== boneIndex) continue;
    skinned.getVertexPosition(vertex, point);
    box.expandByPoint(point.applyMatrix4(skinned.matrixWorld));
  }

  return box;
}

async function poseRig(poses: Map<CharacterCtrlrHumanoidBodyKey, BodyPose>) {
  const root = await loadCharacter();
  const rig = createRagdollSkinRig(root);
  rig.update((key) => asBody(poses.get(key)));

  return { root, rig };
}

describe("ragdoll skin", () => {
  it("drives every bound bone of character.glb", async () => {
    const { rig } = await poseRig(spawnPoses());

    expect(rig.drivenBones.map((bone) => bone.name).sort()).toEqual(
      RAGDOLL_SKIN_BINDINGS.map((binding) => binding.bone.replace(".", "")).sort(),
    );
  });

  it("fits each skinned part onto the collider boxes its body covers at spawn", async () => {
    const lift = new Vector3(0, 2.02, 0);
    const { root } = await poseRig(spawnPoses(lift));

    for (const binding of RAGDOLL_SKIN_BINDINGS) {
      const target = deriveSkinTargetBox(binding);
      const primaryOrigin = new Vector3(
        ...CHARACTER_CTRLR_HUMANOID_BODY_DEFINITIONS.find(
          (definition) => definition.key === binding.primary,
        )!.position,
      ).add(lift);
      const expected = target.clone().translate(primaryOrigin);
      const actual = skinnedBoundsOfBone(root, binding.bone.replace(".", ""));

      for (const axis of ["x", "y", "z"] as const) {
        expect(actual.min[axis], `${binding.bone} min.${axis}`).toBeCloseTo(expected.min[axis], 2);
        expect(actual.max[axis], `${binding.bone} max.${axis}`).toBeCloseTo(expected.max[axis], 2);
      }
    }
  });

  it("follows a body that moves and rotates", async () => {
    const poses = spawnPoses();
    const { root, rig } = await poseRig(poses);
    const before = skinnedBoundsOfBone(root, "leg_lowerL");
    const beforeCenter = before.getCenter(new Vector3());

    // Move the physics body for the model's .L shin (the ragdoll's right shin) and swing it 90 deg.
    // (The shin is 0.78 tall and 0.26 deep, so the part's height and depth swap.)
    const shin = poses.get("lowerLegRight")!;
    shin.position.add(new Vector3(0.5, 0, 0.25));
    shin.rotation.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
    rig.update((key) => asBody(poses.get(key)));

    const after = skinnedBoundsOfBone(root, "leg_lowerL");
    const afterCenter = after.getCenter(new Vector3());

    // The part moved with its body, and a 90 degree pitch swaps the shin's height and depth.
    expect(afterCenter.x - beforeCenter.x).toBeCloseTo(0.5, 2);
    expect(after.getSize(new Vector3()).y).toBeCloseTo(before.getSize(new Vector3()).z, 2);
    expect(after.getSize(new Vector3()).z).toBeCloseTo(before.getSize(new Vector3()).y, 2);

    // Other parts stay where they were.
    const otherShin = skinnedBoundsOfBone(root, "leg_lowerR");
    const otherExpected = deriveSkinTargetBox(
      RAGDOLL_SKIN_BINDINGS.find((binding) => binding.bone === "leg_lower.R")!,
    );
    expect(otherShin.getSize(new Vector3()).y).toBeCloseTo(otherExpected.getSize(new Vector3()).y, 2);
  });
});
