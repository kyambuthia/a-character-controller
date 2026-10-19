import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { Euler, PropertyBinding, Quaternion, type Object3D } from "three";
import { SkeletonUtils } from "three-stdlib";
import {
  PROCEDURAL_BONE_NAMES,
  deriveBoneAxisTest,
  deriveProceduralWalkPose,
  type BoneEulerOffsets,
  type BoneName,
} from "./proceduralBoxmanPose";

const MODEL_URL = "/assets/custom.glb";
const params = new URLSearchParams(window.location.search);
const TEST_MODE = params.get("test") === "1";
const TEST_BONE = PROCEDURAL_BONE_NAMES.find((name) => name === params.get("bone"));
const CAMERA_VIEW = params.get("cam");
const HIDE_LABEL = params.get("ui") === "0";
// The model faces +Z, so the front camera sits on the +Z side.
const CAMERA_POSITIONS: Record<string, [number, number, number]> = {
  side: [8, 1.4, 0],
  front: [0, 1.4, 6],
};
const CAMERA_POSITION = CAMERA_POSITIONS[CAMERA_VIEW ?? ""] ?? [4, 2.6, 6];
const offsetEuler = new Euler();
const offsetQuaternion = new Quaternion();

type RestBone = { bone: Object3D; rest: Quaternion };

function ProceduralBoxman({ onTestStep }: { onTestStep: (label: string) => void }) {
  const gltf = useGLTF(MODEL_URL);
  const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
  const bones = useRef<Partial<Record<BoneName, RestBone>>>({});
  const lastLabel = useRef("");

  useEffect(() => {
    const found: Partial<Record<BoneName, RestBone>> = {};
    for (const name of PROCEDURAL_BONE_NAMES) {
      // GLTFLoader strips "." from node names, so "arm_upper.L" is stored as "arm_upperL".
      const bone = scene.getObjectByName(PropertyBinding.sanitizeNodeName(name));
      if (bone) {
        found[name] = { bone, rest: bone.quaternion.clone() };
      } else {
        console.warn(`[RigTestScene] bone not found: ${name}`);
      }
    }
    bones.current = found;
    scene.traverse((child) => {
      const mesh = child as { isMesh?: boolean; castShadow?: boolean; frustumCulled?: boolean };
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.frustumCulled = false;
      }
    });
  }, [scene]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    let pose: BoneEulerOffsets;

    if (TEST_MODE) {
      const step = deriveBoneAxisTest(time, 1.6, 0.7, TEST_BONE);
      pose = step.pose;
      const label = `${step.bone}  local ${step.axis.toUpperCase()}`;
      if (label !== lastLabel.current) {
        lastLabel.current = label;
        onTestStep(label);
      }
    } else {
      pose = deriveProceduralWalkPose(time);
    }

    for (const name of PROCEDURAL_BONE_NAMES) {
      const entry = bones.current[name];
      if (!entry) continue;
      const offset = pose[name] ?? [0, 0, 0];
      offsetEuler.set(offset[0], offset[1], offset[2]);
      offsetQuaternion.setFromEuler(offsetEuler);
      entry.bone.quaternion.copy(entry.rest).multiply(offsetQuaternion);
    }
  });

  return <primitive object={scene} />;
}

export function RigTestScene() {
  const [label, setLabel] = useState("");

  return (
    <>
      {HIDE_LABEL ? null : <div
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 1,
          padding: "6px 10px",
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          font: "14px monospace",
        }}
      >
        {TEST_MODE ? `bone axis test: ${label}` : "procedural walk (add &test=1 [&bone=leg_upper.L] [&cam=side|front] [&ui=0])"}
      </div>}
      <Canvas
        camera={{ fov: 40, position: CAMERA_POSITION }}
        onCreated={({ camera }) => camera.lookAt(0, 1.2, 0)}
        shadows
      >
        <color attach="background" args={["#10151f"]} />
        <ambientLight intensity={0.8} />
        <directionalLight castShadow intensity={2} position={[4, 8, 5]} />
        <gridHelper args={[20, 20, "#5a756f", "#2c3b3b"]} />
        <ProceduralBoxman onTestStep={setLabel} />
        {/* Preset views (cam=front|side) are locked so recordings keep an exact angle. */}
        <OrbitControls enabled={!CAMERA_POSITIONS[CAMERA_VIEW ?? ""]} target={[0, 1.2, 0]} />
      </Canvas>
    </>
  );
}

useGLTF.preload(MODEL_URL);
