import {
  RigidBody,
  useRevoluteJoint,
  useSphericalJoint,
  type RapierRigidBody,
} from "@react-three/rapier";
import { useRef } from "react";

type RagdollDummyProps = {
  position?: [number, number, number];
};

function LimbBox(props: { color: string; scale: [number, number, number] }) {
  return (
    <mesh castShadow receiveShadow scale={props.scale}>
      <boxGeometry />
      <meshStandardMaterial color={props.color} roughness={0.82} />
    </mesh>
  );
}

export function RagdollDummy({ position = [0, 4.5, 0] }: RagdollDummyProps) {
  const torso = useRef<RapierRigidBody>(null!);
  const head = useRef<RapierRigidBody>(null!);
  const upperArmLeft = useRef<RapierRigidBody>(null!);
  const lowerArmLeft = useRef<RapierRigidBody>(null!);
  const upperArmRight = useRef<RapierRigidBody>(null!);
  const lowerArmRight = useRef<RapierRigidBody>(null!);
  const upperLegLeft = useRef<RapierRigidBody>(null!);
  const lowerLegLeft = useRef<RapierRigidBody>(null!);
  const upperLegRight = useRef<RapierRigidBody>(null!);
  const lowerLegRight = useRef<RapierRigidBody>(null!);

  useSphericalJoint(torso, head, [[0, 0.8, 0], [0, -0.28, 0]]);
  useSphericalJoint(torso, upperArmLeft, [[-0.5, 0.55, 0], [0, 0.28, 0]]);
  useSphericalJoint(torso, upperArmRight, [[0.5, 0.55, 0], [0, 0.28, 0]]);
  useSphericalJoint(torso, upperLegLeft, [[-0.22, -0.72, 0], [0, 0.44, 0]]);
  useSphericalJoint(torso, upperLegRight, [[0.22, -0.72, 0], [0, 0.44, 0]]);

  useRevoluteJoint(upperArmLeft, lowerArmLeft, [[0, -0.34, 0], [0, 0.34, 0], [1, 0, 0]]);
  useRevoluteJoint(upperArmRight, lowerArmRight, [[0, -0.34, 0], [0, 0.34, 0], [1, 0, 0]]);
  useRevoluteJoint(upperLegLeft, lowerLegLeft, [[0, -0.44, 0], [0, 0.44, 0], [1, 0, 0]]);
  useRevoluteJoint(upperLegRight, lowerLegRight, [[0, -0.44, 0], [0, 0.44, 0], [1, 0, 0]]);

  return (
    <group position={position}>
      <RigidBody ref={torso} colliders="cuboid" mass={4.5} position={[0, 0, 0]}>
        <LimbBox color="#cc6f5a" scale={[0.9, 1.5, 0.45]} />
      </RigidBody>

      <RigidBody ref={head} colliders="ball" mass={1.1} position={[0, 1.2, 0]}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.32, 24, 24]} />
          <meshStandardMaterial color="#f1d7b8" roughness={0.9} />
        </mesh>
      </RigidBody>

      <RigidBody ref={upperArmLeft} colliders="cuboid" mass={0.9} position={[-0.92, 0.4, 0]}>
        <LimbBox color="#4a88c7" scale={[0.28, 0.7, 0.28]} />
      </RigidBody>
      <RigidBody ref={lowerArmLeft} colliders="cuboid" mass={0.8} position={[-0.92, -0.34, 0]}>
        <LimbBox color="#3d6b9b" scale={[0.24, 0.68, 0.24]} />
      </RigidBody>

      <RigidBody ref={upperArmRight} colliders="cuboid" mass={0.9} position={[0.92, 0.4, 0]}>
        <LimbBox color="#4a88c7" scale={[0.28, 0.7, 0.28]} />
      </RigidBody>
      <RigidBody ref={lowerArmRight} colliders="cuboid" mass={0.8} position={[0.92, -0.34, 0]}>
        <LimbBox color="#3d6b9b" scale={[0.24, 0.68, 0.24]} />
      </RigidBody>

      <RigidBody ref={upperLegLeft} colliders="cuboid" mass={1.4} position={[-0.24, -1.55, 0]}>
        <LimbBox color="#203244" scale={[0.32, 0.92, 0.32]} />
      </RigidBody>
      <RigidBody ref={lowerLegLeft} colliders="cuboid" mass={1.1} position={[-0.24, -2.44, 0]}>
        <LimbBox color="#162434" scale={[0.28, 0.88, 0.28]} />
      </RigidBody>

      <RigidBody ref={upperLegRight} colliders="cuboid" mass={1.4} position={[0.24, -1.55, 0]}>
        <LimbBox color="#203244" scale={[0.32, 0.92, 0.32]} />
      </RigidBody>
      <RigidBody ref={lowerLegRight} colliders="cuboid" mass={1.1} position={[0.24, -2.44, 0]}>
        <LimbBox color="#162434" scale={[0.28, 0.88, 0.28]} />
      </RigidBody>
    </group>
  );
}
