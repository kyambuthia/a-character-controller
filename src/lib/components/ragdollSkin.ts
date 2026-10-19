import {
  Box3,
  Group,
  Matrix4,
  PropertyBinding,
  Quaternion,
  SkinnedMesh,
  Vector3,
  type Bone,
  type Object3D,
} from "three";
import {
  CHARACTER_CTRLR_HUMANOID_BODY_DEFINITIONS,
  type CharacterCtrlrHumanoidBodyKey,
} from "./CharacterCtrlrHumanoidData";

/**
 * Skins a rigged character model (public/assets/character.glb) onto the physics ragdoll.
 *
 * The model is a set of rigid boxes, each skinned 1:1 to a bone. Each bone's part is fitted with a
 * per-bone affine map onto the collider box (or union of boxes) of the body that drives it, then
 * moved with that body every frame:
 *
 *   boneWorld = bodyWorld * fit * boneRestWorld
 *
 * which makes every skinned vertex land at `bodyWorld * fit * restPosition`.
 */

export type RagdollSkinBinding = {
  /** Bone name in the model, e.g. "arm_upper.L". */
  bone: string;
  /** Body whose transform drives the bone. */
  primary: CharacterCtrlrHumanoidBodyKey;
  /** Further bodies the same bone's part has to cover (e.g. the hand or foot). */
  extras?: CharacterCtrlrHumanoidBodyKey[];
  /** Grow the fitted part downward (metres), e.g. to close the gap where a neck would be. */
  padBottom?: number;
};

// The model's ".L" bones are on +X and the ragdoll's "Right" bodies are on +X (both face +Z), so
// the side names are swapped between the two rigs. character.glb is generated from the ragdoll's
// own body definitions (scripts/blender/make_character.py), so every bone maps to one body and the
// fit below is the identity; it only absorbs small differences if the model is edited by hand.
export const RAGDOLL_SKIN_BINDINGS: RagdollSkinBinding[] = [
  { bone: "butt_bone", primary: "pelvis" },
  { bone: "body_upper", primary: "chest" },
  // The model's head box extends 0.05 m below the head sphere so it meets the torso.
  { bone: "head", primary: "head", padBottom: 0.05 },
  { bone: "arm_upper.L", primary: "upperArmRight" },
  { bone: "arm_lower.L", primary: "lowerArmRight" },
  { bone: "hand.L", primary: "handRight" },
  { bone: "arm_upper.R", primary: "upperArmLeft" },
  { bone: "arm_lower.R", primary: "lowerArmLeft" },
  { bone: "hand.R", primary: "handLeft" },
  { bone: "leg_upper.L", primary: "upperLegRight" },
  { bone: "leg_lower.L", primary: "lowerLegRight" },
  { bone: "foot.L", primary: "footRight" },
  { bone: "leg_upper.R", primary: "upperLegLeft" },
  { bone: "leg_lower.R", primary: "lowerLegLeft" },
  { bone: "foot.R", primary: "footLeft" },
];

export type RagdollSkinBodyTransform = {
  translation: () => { x: number; y: number; z: number };
  rotation: () => { x: number; y: number; z: number; w: number };
};

const definitionsByKey = new Map(
  CHARACTER_CTRLR_HUMANOID_BODY_DEFINITIONS.map((definition) => [definition.key, definition]),
);

/** Collider box of a body in spawn-pose world coordinates (bodies start axis-aligned). */
function deriveBodyBox(key: CharacterCtrlrHumanoidBodyKey) {
  const definition = definitionsByKey.get(key);

  if (!definition) {
    throw new Error(`Unknown humanoid body: ${key}`);
  }

  const half =
    definition.shape.kind === "sphere"
      ? new Vector3(definition.shape.radius, definition.shape.radius, definition.shape.radius)
      : new Vector3(...definition.shape.size).multiplyScalar(0.5);
  const center = new Vector3(...definition.position);

  if (definition.meshOffset) {
    center.add(new Vector3(...definition.meshOffset));
  }

  return new Box3(center.clone().sub(half), center.clone().add(half));
}

/** Union of the bodies a binding represents, in the primary body's local frame. */
export function deriveSkinTargetBox(binding: RagdollSkinBinding) {
  const box = deriveBodyBox(binding.primary);

  for (const extra of binding.extras ?? []) {
    box.union(deriveBodyBox(extra));
  }

  box.min.y -= binding.padBottom ?? 0;

  const primaryOrigin = new Vector3(...definitionsByKey.get(binding.primary)!.position);

  return box.translate(primaryOrigin.negate());
}

/** Rest-pose world-space bounds of the vertices each bone mostly drives. */
export function measureBoneRestBoxes(mesh: SkinnedMesh) {
  const boxes = new Map<string, Box3>();
  const position = mesh.geometry.getAttribute("position");
  const skinIndex = mesh.geometry.getAttribute("skinIndex");
  const skinWeight = mesh.geometry.getAttribute("skinWeight");
  const point = new Vector3();

  for (let vertex = 0; vertex < position.count; vertex += 1) {
    let dominantSlot = 0;
    let dominantWeight = -1;

    for (let slot = 0; slot < 4; slot += 1) {
      const weight = skinWeight.getComponent(vertex, slot);

      if (weight > dominantWeight) {
        dominantWeight = weight;
        dominantSlot = slot;
      }
    }

    const bone = mesh.skeleton.bones[skinIndex.getComponent(vertex, dominantSlot)];
    // At rest, a skinned vertex sits at mesh.matrixWorld * its stored position.
    point.fromBufferAttribute(position, vertex).applyMatrix4(mesh.matrixWorld);

    const box = boxes.get(bone.name) ?? new Box3();
    box.expandByPoint(point);
    boxes.set(bone.name, box);
  }

  return boxes;
}

const ONE = new Vector3(1, 1, 1);

type DrivenBone = {
  bone: Bone;
  primary: CharacterCtrlrHumanoidBodyKey;
  /** Maps model rest coordinates into the primary body's local frame. */
  fit: Matrix4;
  restWorld: Matrix4;
};

export type RagdollSkinRig = {
  root: Object3D;
  drivenBones: ReadonlyArray<{ name: string; primary: CharacterCtrlrHumanoidBodyKey }>;
  update: (getBody: (key: CharacterCtrlrHumanoidBodyKey) => RagdollSkinBodyTransform | null | undefined) => void;
};

export function createRagdollSkinRig(
  root: Object3D,
  bindings: RagdollSkinBinding[] = RAGDOLL_SKIN_BINDINGS,
): RagdollSkinRig {
  // The rig assumes the model root is the world origin, so skinned vertices land where the
  // bodies put them.
  root.position.set(0, 0, 0);
  root.quaternion.identity();
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);

  let skinnedMesh: SkinnedMesh | null = null;
  root.traverse((child) => {
    if (!skinnedMesh && (child as SkinnedMesh).isSkinnedMesh) {
      skinnedMesh = child as SkinnedMesh;
    }
  });

  if (!skinnedMesh) {
    throw new Error("Character model has no SkinnedMesh");
  }

  const mesh: SkinnedMesh = skinnedMesh;
  const modelBoxes = measureBoneRestBoxes(mesh);
  const skinRoot = new Group();
  const driven: DrivenBone[] = [];

  for (const binding of bindings) {
    const boneName = PropertyBinding.sanitizeNodeName(binding.bone);
    const bone = mesh.skeleton.bones.find((candidate) => candidate.name === boneName);
    const modelBox = modelBoxes.get(boneName);

    if (!bone || !modelBox) {
      console.warn(`[ragdollSkin] no skinned part for bone "${binding.bone}"`);
      continue;
    }

    const targetBox = deriveSkinTargetBox(binding);
    const modelSize = modelBox.getSize(new Vector3());
    const targetSize = targetBox.getSize(new Vector3());
    const scale = new Vector3(
      modelSize.x > 1e-6 ? targetSize.x / modelSize.x : 1,
      modelSize.y > 1e-6 ? targetSize.y / modelSize.y : 1,
      modelSize.z > 1e-6 ? targetSize.z / modelSize.z : 1,
    );
    const fit = new Matrix4()
      .makeTranslation(targetBox.getCenter(new Vector3()))
      .multiply(new Matrix4().makeScale(scale.x, scale.y, scale.z))
      .multiply(new Matrix4().makeTranslation(modelBox.getCenter(new Vector3()).negate()));

    driven.push({
      bone,
      primary: binding.primary,
      fit,
      restWorld: bone.matrixWorld.clone(),
    });
  }

  // Detach driven bones so each one is posed directly in world space. Keeping them parented would
  // make a child inherit its parent's non-uniform fit scale and shear.
  for (const entry of driven) {
    entry.bone.removeFromParent();
    entry.bone.matrixAutoUpdate = false;
    skinRoot.add(entry.bone);
  }
  root.add(skinRoot);

  const bodyMatrix = new Matrix4();
  const bodyPosition = new Vector3();
  const bodyRotation = new Quaternion();

  return {
    root,
    drivenBones: driven.map((entry) => ({ name: entry.bone.name, primary: entry.primary })),
    update: (getBody) => {
      for (const entry of driven) {
        const body = getBody(entry.primary);

        if (!body) {
          continue;
        }

        const translation = body.translation();
        const rotation = body.rotation();
        bodyMatrix.compose(
          bodyPosition.set(translation.x, translation.y, translation.z),
          bodyRotation.set(rotation.x, rotation.y, rotation.z, rotation.w),
          ONE,
        );
        entry.bone.matrix.copy(bodyMatrix).multiply(entry.fit).multiply(entry.restWorld);
        entry.bone.matrixWorldNeedsUpdate = true;
      }
    },
  };
}
