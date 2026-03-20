import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Euler,
  Group,
  LoopRepeat,
  MathUtils,
  Quaternion,
} from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type {
  CharacterCtrlrMixamoBoneMap,
  CharacterCtrlrMixamoClipUrls,
  CharacterCtrlrMixamoMotionSource,
  CharacterCtrlrMovementMode,
} from "../types";

const mixamoDeltaQuaternion = new Quaternion();
const mixamoEuler = new Euler(0, 0, 0, "XYZ");

const DEFAULT_MIXAMO_BONE_MAP: CharacterCtrlrMixamoBoneMap = {
  hips: "Hips",
  spine: "Spine",
  chest: "Spine2",
  head: "Head",
  upperLegLeft: "LeftUpLeg",
  lowerLegLeft: "LeftLeg",
  footLeft: "LeftFoot",
  upperArmLeft: "LeftArm",
  lowerArmLeft: "LeftForeArm",
  handLeft: "LeftHand",
  upperLegRight: "RightUpLeg",
  lowerLegRight: "RightLeg",
  footRight: "RightFoot",
  upperArmRight: "RightArm",
  lowerArmRight: "RightForeArm",
  handRight: "RightHand",
};

export type CharacterCtrlrMixamoPoseTargets = {
  pelvisPitch: number;
  pelvisRoll: number;
  chestPitch: number;
  chestRoll: number;
  left: {
    hip: number;
    knee: number;
    ankle: number;
    shoulder: number;
    elbow: number;
    wrist: number;
  };
  right: {
    hip: number;
    knee: number;
    ankle: number;
    shoulder: number;
    elbow: number;
    wrist: number;
  };
};

type CharacterCtrlrMixamoMotionDriverProps = {
  source: CharacterCtrlrMixamoMotionSource;
  movementModeRef: MutableRefObject<CharacterCtrlrMovementMode>;
  groundedRef: MutableRefObject<boolean>;
  hasMovementInputRef: MutableRefObject<boolean>;
  poseRef: MutableRefObject<CharacterCtrlrMixamoPoseTargets | null>;
};

type LoadedMixamoBoneMap = Record<keyof CharacterCtrlrMixamoBoneMap, Group | null>;

function canonicalizeMixamoName(name: string) {
  const namespaceStripped = name.includes(":")
    ? name.slice(name.lastIndexOf(":") + 1)
    : name;

  return namespaceStripped.replace(/^mixamorig\d*/, "");
}

function getNodeNameFromTrack(trackName: string) {
  const propertyIndex = trackName.indexOf(".");
  return propertyIndex === -1 ? trackName : trackName.slice(0, propertyIndex);
}

function replaceNodeNameInTrack(trackName: string, nextNodeName: string) {
  const propertyIndex = trackName.indexOf(".");
  return propertyIndex === -1
    ? nextNodeName
    : `${nextNodeName}${trackName.slice(propertyIndex)}`;
}

function buildCanonicalNodeMap(root: Group) {
  const canonicalNodeMap = new Map<string, string>();

  root.traverse((object) => {
    canonicalNodeMap.set(canonicalizeMixamoName(object.name), object.name);
  });

  return canonicalNodeMap;
}

function normalizeMixamoRigNames(root: Group) {
  root.traverse((object) => {
    const canonicalName = canonicalizeMixamoName(object.name);

    if (!canonicalName) {
      return;
    }

    object.name = `mixamorig${canonicalName}`;
  });

  return root;
}

function retargetClipToRoot(
  clip: AnimationClip,
  canonicalNodeMap: Map<string, string>,
) {
  const retargetedClip = clip.clone();

  retargetedClip.tracks = retargetedClip.tracks
    .map((track) => {
      const canonicalNodeName = canonicalizeMixamoName(
        getNodeNameFromTrack(track.name),
      );
      const targetNodeName = canonicalNodeMap.get(canonicalNodeName);

      if (!targetNodeName) {
        return null;
      }

      const nextTrack = track.clone();
      nextTrack.name = replaceNodeNameInTrack(track.name, targetNodeName);
      return nextTrack;
    })
    .filter((track): track is typeof retargetedClip.tracks[number] => track !== null);

  return retargetedClip;
}

function findBone(root: Group, boneName: string) {
  const canonicalBoneName = canonicalizeMixamoName(boneName);
  let matchedBone: Group | null = null;

  root.traverse((object) => {
    if (matchedBone) {
      return;
    }

    if (canonicalizeMixamoName(object.name) === canonicalBoneName) {
      matchedBone = object as Group;
    }
  });

  return matchedBone;
}

function pickMixamoClipKey(
  clips: CharacterCtrlrMixamoClipUrls,
  movementMode: CharacterCtrlrMovementMode,
  grounded: boolean,
  hasMovementInput: boolean,
): keyof CharacterCtrlrMixamoClipUrls {
  if (!grounded) {
    return clips.jump ? "jump" : hasMovementInput ? "walk" : "idle";
  }

  if (movementMode === "run") {
    return clips.run ? "run" : "walk";
  }

  if (movementMode === "crouch") {
    return clips.crouch ? "crouch" : "walk";
  }

  if (movementMode === "walk") {
    return "walk";
  }

  return "idle";
}

function sampleBoneAngle(
  bone: Group | null,
  restQuaternion: Quaternion | null,
  axis: "x" | "y" | "z",
  sign: number,
) {
  if (!bone || !restQuaternion) {
    return 0;
  }

  mixamoDeltaQuaternion.copy(restQuaternion).invert().multiply(bone.quaternion);
  mixamoEuler.setFromQuaternion(mixamoDeltaQuaternion, "XYZ");

  const value =
    axis === "x"
      ? mixamoEuler.x
      : axis === "y"
        ? mixamoEuler.y
        : mixamoEuler.z;

  return value * sign;
}

function sampleMixamoPose(
  bones: LoadedMixamoBoneMap,
  restQuaternions: Record<keyof CharacterCtrlrMixamoBoneMap, Quaternion | null>,
): CharacterCtrlrMixamoPoseTargets {
  return {
    pelvisPitch: MathUtils.clamp(
      sampleBoneAngle(bones.hips, restQuaternions.hips, "x", -1),
      -0.5,
      0.5,
    ),
    pelvisRoll: MathUtils.clamp(
      sampleBoneAngle(bones.hips, restQuaternions.hips, "z", 1),
      -0.35,
      0.35,
    ),
    chestPitch: MathUtils.clamp(
      sampleBoneAngle(bones.chest, restQuaternions.chest, "x", -1),
      -0.5,
      0.5,
    ),
    chestRoll: MathUtils.clamp(
      sampleBoneAngle(bones.chest, restQuaternions.chest, "z", 1),
      -0.35,
      0.35,
    ),
    left: {
      hip: MathUtils.clamp(
        sampleBoneAngle(bones.upperLegLeft, restQuaternions.upperLegLeft, "x", -1),
        -0.9,
        0.7,
      ),
      knee: MathUtils.clamp(
        sampleBoneAngle(bones.lowerLegLeft, restQuaternions.lowerLegLeft, "x", -1),
        -2.2,
        0.12,
      ),
      ankle: MathUtils.clamp(
        sampleBoneAngle(bones.footLeft, restQuaternions.footLeft, "x", 1),
        -0.55,
        0.45,
      ),
      shoulder: MathUtils.clamp(
        sampleBoneAngle(bones.upperArmLeft, restQuaternions.upperArmLeft, "x", 1),
        -1.1,
        0.9,
      ),
      elbow: MathUtils.clamp(
        sampleBoneAngle(bones.lowerArmLeft, restQuaternions.lowerArmLeft, "x", -1),
        -2.1,
        0.1,
      ),
      wrist: MathUtils.clamp(
        sampleBoneAngle(bones.handLeft, restQuaternions.handLeft, "x", 1),
        -0.65,
        0.65,
      ),
    },
    right: {
      hip: MathUtils.clamp(
        sampleBoneAngle(bones.upperLegRight, restQuaternions.upperLegRight, "x", -1),
        -0.9,
        0.7,
      ),
      knee: MathUtils.clamp(
        sampleBoneAngle(bones.lowerLegRight, restQuaternions.lowerLegRight, "x", -1),
        -2.2,
        0.12,
      ),
      ankle: MathUtils.clamp(
        sampleBoneAngle(bones.footRight, restQuaternions.footRight, "x", 1),
        -0.55,
        0.45,
      ),
      shoulder: MathUtils.clamp(
        sampleBoneAngle(bones.upperArmRight, restQuaternions.upperArmRight, "x", 1),
        -1.1,
        0.9,
      ),
      elbow: MathUtils.clamp(
        sampleBoneAngle(bones.lowerArmRight, restQuaternions.lowerArmRight, "x", -1),
        -2.1,
        0.1,
      ),
      wrist: MathUtils.clamp(
        sampleBoneAngle(bones.handRight, restQuaternions.handRight, "x", 1),
        -0.65,
        0.65,
      ),
    },
  };
}

export function CharacterCtrlrMixamoMotionDriver({
  source,
  movementModeRef,
  groundedRef,
  hasMovementInputRef,
  poseRef,
}: CharacterCtrlrMixamoMotionDriverProps) {
  const clipEntries = useMemo(
    () =>
      Object.entries(source.clips).filter((entry): entry is [keyof CharacterCtrlrMixamoClipUrls, string] =>
        Boolean(entry[1]),
      ),
    [source.clips],
  );
  const loadedAssets = useLoader(FBXLoader, [
    source.rigUrl,
    ...clipEntries.map(([, url]) => url),
  ]);
  const rigAsset = loadedAssets[0] as Group;
  const clipAssets = loadedAssets.slice(1) as Group[];
  const targetRoot = useMemo(
    () => normalizeMixamoRigNames(clone(rigAsset) as Group),
    [rigAsset],
  );
  const mixer = useMemo(() => new AnimationMixer(targetRoot), [targetRoot]);
  const activeClipKeyRef = useRef<keyof CharacterCtrlrMixamoClipUrls | null>(null);
  const boneMap = useMemo(
    () => ({ ...DEFAULT_MIXAMO_BONE_MAP, ...source.boneMap }),
    [source.boneMap],
  );
  const canonicalNodeMap = useMemo(
    () => buildCanonicalNodeMap(targetRoot),
    [targetRoot],
  );
  const bones = useMemo<LoadedMixamoBoneMap>(() => ({
    hips: findBone(targetRoot, boneMap.hips),
    spine: findBone(targetRoot, boneMap.spine),
    chest: findBone(targetRoot, boneMap.chest),
    head: findBone(targetRoot, boneMap.head),
    upperLegLeft: findBone(targetRoot, boneMap.upperLegLeft),
    lowerLegLeft: findBone(targetRoot, boneMap.lowerLegLeft),
    footLeft: findBone(targetRoot, boneMap.footLeft),
    upperArmLeft: findBone(targetRoot, boneMap.upperArmLeft),
    lowerArmLeft: findBone(targetRoot, boneMap.lowerArmLeft),
    handLeft: findBone(targetRoot, boneMap.handLeft),
    upperLegRight: findBone(targetRoot, boneMap.upperLegRight),
    lowerLegRight: findBone(targetRoot, boneMap.lowerLegRight),
    footRight: findBone(targetRoot, boneMap.footRight),
    upperArmRight: findBone(targetRoot, boneMap.upperArmRight),
    lowerArmRight: findBone(targetRoot, boneMap.lowerArmRight),
    handRight: findBone(targetRoot, boneMap.handRight),
  }), [boneMap, targetRoot]);
  const retargetedClips = useMemo(
    () =>
      clipEntries.map(([, _url], index) => {
        const clip = clipAssets[index]?.animations[0];
        return clip ? retargetClipToRoot(clip, canonicalNodeMap) : null;
      }),
    [canonicalNodeMap, clipAssets, clipEntries],
  );
  const restQuaternions = useMemo(
    () => ({
      hips: bones.hips?.quaternion.clone() ?? null,
      spine: bones.spine?.quaternion.clone() ?? null,
      chest: bones.chest?.quaternion.clone() ?? null,
      head: bones.head?.quaternion.clone() ?? null,
      upperLegLeft: bones.upperLegLeft?.quaternion.clone() ?? null,
      lowerLegLeft: bones.lowerLegLeft?.quaternion.clone() ?? null,
      footLeft: bones.footLeft?.quaternion.clone() ?? null,
      upperArmLeft: bones.upperArmLeft?.quaternion.clone() ?? null,
      lowerArmLeft: bones.lowerArmLeft?.quaternion.clone() ?? null,
      handLeft: bones.handLeft?.quaternion.clone() ?? null,
      upperLegRight: bones.upperLegRight?.quaternion.clone() ?? null,
      lowerLegRight: bones.lowerLegRight?.quaternion.clone() ?? null,
      footRight: bones.footRight?.quaternion.clone() ?? null,
      upperArmRight: bones.upperArmRight?.quaternion.clone() ?? null,
      lowerArmRight: bones.lowerArmRight?.quaternion.clone() ?? null,
      handRight: bones.handRight?.quaternion.clone() ?? null,
    }),
    [bones],
  );
  const actions = useMemo(() => {
    const nextActions: Partial<Record<keyof CharacterCtrlrMixamoClipUrls, AnimationAction>> = {};

    clipEntries.forEach(([key], index) => {
      const clip = retargetedClips[index];

      if (!clip) {
        return;
      }

      const action = mixer.clipAction(clip);
      action.enabled = true;
      action.clampWhenFinished = false;
      action.setLoop(LoopRepeat, Infinity);
      action.play();
      action.setEffectiveWeight(0);
      nextActions[key] = action;
    });

    return nextActions;
  }, [clipEntries, mixer, retargetedClips]);

  useEffect(
    () => () => {
      mixer.stopAllAction();
      poseRef.current = null;
    },
    [mixer, poseRef],
  );

  useFrame((_, delta) => {
    const movementMode = movementModeRef.current;
    const grounded = groundedRef.current;
    const hasMovementInput = hasMovementInputRef.current;
    const clipKey = pickMixamoClipKey(
      source.clips,
      movementMode,
      grounded,
      hasMovementInput,
    );
    const playbackRate = source.playbackRate?.[movementMode] ?? 1;

    if (clipKey !== activeClipKeyRef.current) {
      const activeAction = actions[clipKey];
      activeAction?.reset();
      activeAction?.play();
      activeClipKeyRef.current = clipKey;
    }

    mixer.timeScale = playbackRate;

    for (const [key, action] of Object.entries(actions) as Array<
      [keyof CharacterCtrlrMixamoClipUrls, AnimationAction | undefined]
    >) {
      if (!action) {
        continue;
      }

      const targetWeight = key === clipKey ? 1 : 0;
      const nextWeight = MathUtils.damp(
        action.getEffectiveWeight(),
        targetWeight,
        10,
        delta,
      );
      action.setEffectiveWeight(nextWeight);
    }

    mixer.update(delta);
    targetRoot.updateMatrixWorld(true);
    poseRef.current = sampleMixamoPose(bones, restQuaternions);
  });

  return null;
}
