import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { CharacterCtrlrHumanoidBodyRefs } from "./CharacterCtrlrHumanoidData";
import { createRagdollSkinRig } from "./ragdollSkin";

/** Renders a rigged character model driven by the ragdoll's physics bodies. */
export function CharacterCtrlrRagdollSkin({
  bodyRefs,
  url,
  ignoreCameraOcclusion = false,
}: {
  bodyRefs: CharacterCtrlrHumanoidBodyRefs;
  url: string;
  ignoreCameraOcclusion?: boolean;
}) {
  const gltf = useGLTF(url);
  const rig = useMemo(() => createRagdollSkinRig(cloneSkinned(gltf.scene)), [gltf.scene]);

  useEffect(() => {
    rig.root.traverse((child) => {
      const mesh = child as {
        isMesh?: boolean;
        castShadow?: boolean;
        receiveShadow?: boolean;
        frustumCulled?: boolean;
        userData: Record<string, unknown>;
      };

      if (!mesh.isMesh) {
        return;
      }

      mesh.castShadow = true;
      // Self-shadowing on the stretched flat box faces shows up as speckled acne.
      mesh.receiveShadow = false;
      // The skinned bounds are computed from the bind pose, not where the bodies actually are.
      mesh.frustumCulled = false;

      if (ignoreCameraOcclusion) {
        mesh.userData.characterCtrlrIgnoreCameraOcclusion = true;
      }
    });
  }, [ignoreCameraOcclusion, rig]);

  useFrame(() => {
    rig.update((key) => bodyRefs[key].current);
  });

  return <primitive object={rig.root} />;
}
