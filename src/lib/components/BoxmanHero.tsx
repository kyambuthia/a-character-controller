import { useAnimations, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { Group } from "three";
import { LoopOnce, LoopRepeat } from "three";
import { SkeletonUtils } from "three-stdlib";
import type { CharacterCtrlrMovementMode } from "../types";

type BoxmanHeroRig = {
  rootRef: RefObject<Group | null>;
  pelvisRef: RefObject<Group | null>;
  spineRef: RefObject<Group | null>;
  headRef: RefObject<Group | null>;
  leftUpperArmRef: RefObject<Group | null>;
  leftLowerArmRef: RefObject<Group | null>;
  rightUpperArmRef: RefObject<Group | null>;
  rightLowerArmRef: RefObject<Group | null>;
  leftUpperLegRef: RefObject<Group | null>;
  leftLowerLegRef: RefObject<Group | null>;
  rightUpperLegRef: RefObject<Group | null>;
  rightLowerLegRef: RefObject<Group | null>;
};

function isLoopingClip(clipName: string) {
  return (
    clipName === "idle" ||
    clipName === "run" ||
    clipName === "sprint" ||
    clipName === "jump_idle" ||
    clipName === "jump_running" ||
    clipName === "falling"
  );
}

function clipCandidatesForMode(movementMode: CharacterCtrlrMovementMode) {
  switch (movementMode) {
    case "idle":
      return ["idle"];
    case "walk":
      return ["run", "idle"];
    case "run":
      return ["sprint", "run", "idle"];
    case "jump":
      return ["jump_running", "jump_idle", "jump", "falling"];
    case "fall":
      return ["falling", "jump_idle", "idle"];
    case "crouch":
      return ["idle"];
    default:
      return ["idle"];
  }
}

export function BoxmanHero(props: {
  movementMode: CharacterCtrlrMovementMode;
  rig: BoxmanHeroRig;
}) {
  const gltf = useGLTF("/assets/boxman.glb");
  const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
  const { actions } = useAnimations(gltf.animations, scene);
  const activeClipRef = useRef<string | null>(null);

  useEffect(() => {
    scene.traverse((child) => {
      const mesh = child as {
        isMesh?: boolean;
        castShadow?: boolean;
        receiveShadow?: boolean;
        frustumCulled?: boolean;
      };

      if (!mesh.isMesh) {
        return;
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    });
  }, [scene]);

  useEffect(() => {
    const nextClipName = clipCandidatesForMode(props.movementMode).find(
      (clipName) => Boolean(actions[clipName]),
    );

    if (!nextClipName || activeClipRef.current === nextClipName) {
      return;
    }

    const nextAction = actions[nextClipName];
    if (!nextAction) {
      return;
    }

    nextAction.reset();
    nextAction.enabled = true;
    nextAction.clampWhenFinished = !isLoopingClip(nextClipName);
    nextAction.setLoop(
      isLoopingClip(nextClipName) ? LoopRepeat : LoopOnce,
      isLoopingClip(nextClipName) ? Infinity : 1,
    );
    nextAction.fadeIn(0.18);

    if (nextClipName === "run") {
      nextAction.timeScale = 0.8;
    } else if (nextClipName === "sprint") {
      nextAction.timeScale = 1.05;
    } else {
      nextAction.timeScale = 1;
    }

    nextAction.play();

    const previousClipName = activeClipRef.current;
    if (previousClipName && previousClipName !== nextClipName) {
      actions[previousClipName]?.fadeOut(0.18);
    }

    activeClipRef.current = nextClipName;
  }, [actions, props.movementMode]);

  useEffect(() => {
    return () => {
      Object.values(actions).forEach((action) => {
        action?.stop();
      });
    };
  }, [actions]);

  return (
    <group
      ref={props.rig.rootRef}
      position={[0, 0, 0]}
      scale={1}
      userData={{ characterCtrlrIgnoreCameraOcclusion: true }}
    >
      <group ref={props.rig.pelvisRef} position={[0, 0.9, 0]}>
        <group ref={props.rig.spineRef} position={[0, 0.02, 0]}>
          <group ref={props.rig.headRef} position={[0, 1.2, 0]} />
          <group ref={props.rig.leftUpperArmRef} position={[-0.5, 0.55, 0]}>
            <group ref={props.rig.leftLowerArmRef} position={[0, -0.62, 0]} />
          </group>
          <group ref={props.rig.rightUpperArmRef} position={[0.5, 0.55, 0]}>
            <group ref={props.rig.rightLowerArmRef} position={[0, -0.62, 0]} />
          </group>
        </group>

        <group ref={props.rig.leftUpperLegRef} position={[-0.22, -0.7, 0]}>
          <group ref={props.rig.leftLowerLegRef} position={[0, -0.9, 0]} />
        </group>
        <group ref={props.rig.rightUpperLegRef} position={[0.22, -0.7, 0]}>
          <group ref={props.rig.rightLowerLegRef} position={[0, -0.9, 0]} />
        </group>
      </group>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.56, 0]}
        receiveShadow
      >
        <circleGeometry args={[0.35, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} />
      </mesh>

      <group position-y={-0.57}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

useGLTF.preload("/assets/boxman.glb");
