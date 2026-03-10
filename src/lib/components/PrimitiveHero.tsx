import type { RefObject } from "react";
import type { Group } from "three";
import type { MwendoMovementMode } from "../types";

type PrimitiveHeroRig = {
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

function BlockPart(props: {
  color: string;
  size: [number, number, number];
  position?: [number, number, number];
  rotation?: [number, number, number];
  roughness?: number;
}) {
  return (
    <mesh castShadow receiveShadow position={props.position} rotation={props.rotation}>
      <boxGeometry args={props.size} />
      <meshStandardMaterial
        color={props.color}
        roughness={props.roughness ?? 0.82}
      />
    </mesh>
  );
}

function HeadPart(props: {
  position?: [number, number, number];
}) {
  return (
    <mesh castShadow receiveShadow position={props.position}>
      <sphereGeometry args={[0.32, 24, 24]} />
      <meshStandardMaterial color="#f1d7b8" roughness={0.9} />
    </mesh>
  );
}

function FacePlate(props: {
  position?: [number, number, number];
}) {
  return (
    <mesh castShadow receiveShadow position={props.position}>
      <boxGeometry args={[0.2, 0.08, 0.05]} />
      <meshStandardMaterial color="#1f2937" roughness={0.6} />
    </mesh>
  );
}

export function PrimitiveHero(props: {
  movementMode: MwendoMovementMode;
  rig: PrimitiveHeroRig;
}) {
  void props.movementMode;

  return (
    <group
      ref={props.rig.rootRef}
      position={[0, -0.12, 0]}
      scale={0.43}
      userData={{ mwendoIgnoreCameraOcclusion: true }}
    >
      <group ref={props.rig.pelvisRef} position={[0, 0.9, 0]}>
        <group ref={props.rig.spineRef} position={[0, 0.02, 0]}>
          <BlockPart
            color="#cc6f5a"
            position={[0, 0.34, 0]}
            roughness={0.8}
            size={[0.9, 1.5, 0.45]}
          />

          <group ref={props.rig.headRef} position={[0, 1.2, 0]}>
            <BlockPart
              color="#dcb690"
              position={[0, -0.38, 0]}
              roughness={0.88}
              size={[0.12, 0.16, 0.12]}
            />
            <HeadPart />
            <FacePlate position={[0, 0.02, 0.22]} />
          </group>

          <group ref={props.rig.leftUpperArmRef} position={[-0.5, 0.55, 0]}>
            <BlockPart
              color="#4a88c7"
              position={[0, -0.28, 0]}
              size={[0.28, 0.7, 0.28]}
            />
            <group ref={props.rig.leftLowerArmRef} position={[0, -0.62, 0]}>
              <BlockPart
                color="#3d6b9b"
                position={[0, -0.34, 0]}
                size={[0.24, 0.68, 0.24]}
              />
              <BlockPart
                color="#f1d7b8"
                position={[0, -0.72, 0.02]}
                roughness={0.86}
                size={[0.18, 0.14, 0.18]}
              />
            </group>
          </group>

          <group ref={props.rig.rightUpperArmRef} position={[0.5, 0.55, 0]}>
            <BlockPart
              color="#4a88c7"
              position={[0, -0.28, 0]}
              size={[0.28, 0.7, 0.28]}
            />
            <group ref={props.rig.rightLowerArmRef} position={[0, -0.62, 0]}>
              <BlockPart
                color="#3d6b9b"
                position={[0, -0.34, 0]}
                size={[0.24, 0.68, 0.24]}
              />
              <BlockPart
                color="#f1d7b8"
                position={[0, -0.72, 0.02]}
                roughness={0.86}
                size={[0.18, 0.14, 0.18]}
              />
            </group>
          </group>
        </group>

        <group ref={props.rig.leftUpperLegRef} position={[-0.22, -0.7, 0]}>
          <BlockPart
            color="#203244"
            position={[0, -0.46, 0]}
            size={[0.32, 0.92, 0.32]}
          />
          <group ref={props.rig.leftLowerLegRef} position={[0, -0.9, 0]}>
            <BlockPart
              color="#162434"
              position={[0, -0.44, 0]}
              size={[0.28, 0.88, 0.28]}
            />
            <BlockPart
              color="#162434"
              position={[0, -0.96, 0.08]}
              size={[0.3, 0.16, 0.42]}
            />
          </group>
        </group>

        <group ref={props.rig.rightUpperLegRef} position={[0.22, -0.7, 0]}>
          <BlockPart
            color="#203244"
            position={[0, -0.46, 0]}
            size={[0.32, 0.92, 0.32]}
          />
          <group ref={props.rig.rightLowerLegRef} position={[0, -0.9, 0]}>
            <BlockPart
              color="#162434"
              position={[0, -0.44, 0]}
              size={[0.28, 0.88, 0.28]}
            />
            <BlockPart
              color="#162434"
              position={[0, -0.96, 0.08]}
              size={[0.3, 0.16, 0.42]}
            />
          </group>
        </group>
      </group>
    </group>
  );
}
