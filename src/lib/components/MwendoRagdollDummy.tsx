import {
  RigidBody,
  interactionGroups,
  useRevoluteJoint,
  useSphericalJoint,
  type RapierRigidBody,
} from "@react-three/rapier";
import { useRef, type ComponentProps, type ReactNode } from "react";
import type { MwendoVec3 } from "../types";
import {
  MwendoRagdollDebug,
  type MwendoRagdollBodyDescriptor,
  type MwendoRagdollJointDescriptor,
} from "./MwendoRagdollDebug";

export type MwendoRagdollDummyProps = {
  position?: MwendoVec3;
  debug?: boolean;
  paused?: boolean;
  timeScale?: number;
  manualStepCount?: number;
};

const RAGDOLL_COLLISION_GROUPS = interactionGroups([1], [0]);

function BlockPart(props: {
  color: string;
  scale: [number, number, number];
  position?: [number, number, number];
  roughness?: number;
}) {
  return (
    <mesh castShadow receiveShadow position={props.position} scale={props.scale}>
      <boxGeometry />
      <meshStandardMaterial color={props.color} roughness={props.roughness ?? 0.82} />
    </mesh>
  );
}

function HeadPart(props: { position?: [number, number, number] }) {
  return (
    <mesh castShadow receiveShadow position={props.position}>
      <sphereGeometry args={[0.32, 24, 24]} />
      <meshStandardMaterial color="#f1d7b8" roughness={0.9} />
    </mesh>
  );
}

function RagdollBody(
  props: ComponentProps<typeof RigidBody> & { children: ReactNode },
) {
  const { children, ...rest } = props;

  return (
    <RigidBody
      additionalSolverIterations={10}
      angularDamping={3.8}
      canSleep
      collisionGroups={RAGDOLL_COLLISION_GROUPS}
      contactSkin={0.008}
      friction={1.2}
      linearDamping={1.6}
      restitution={0.02}
      solverGroups={RAGDOLL_COLLISION_GROUPS}
      {...rest}
    >
      {children}
    </RigidBody>
  );
}

export function MwendoRagdollDummy({
  position = [0, 4.5, 0],
  debug = false,
  paused = false,
  timeScale = 1,
  manualStepCount = 0,
}: MwendoRagdollDummyProps) {
  const pelvis = useRef<RapierRigidBody>(null!);
  const chest = useRef<RapierRigidBody>(null!);
  const head = useRef<RapierRigidBody>(null!);
  const upperArmLeft = useRef<RapierRigidBody>(null!);
  const lowerArmLeft = useRef<RapierRigidBody>(null!);
  const handLeft = useRef<RapierRigidBody>(null!);
  const upperArmRight = useRef<RapierRigidBody>(null!);
  const lowerArmRight = useRef<RapierRigidBody>(null!);
  const handRight = useRef<RapierRigidBody>(null!);
  const upperLegLeft = useRef<RapierRigidBody>(null!);
  const lowerLegLeft = useRef<RapierRigidBody>(null!);
  const footLeft = useRef<RapierRigidBody>(null!);
  const upperLegRight = useRef<RapierRigidBody>(null!);
  const lowerLegRight = useRef<RapierRigidBody>(null!);
  const footRight = useRef<RapierRigidBody>(null!);

  const bodyDescriptors: MwendoRagdollBodyDescriptor[] = [
    {
      key: "pelvis",
      label: "Pelvis",
      ref: pelvis,
      mass: 2.2,
      color: "#87483d",
      shape: { kind: "box", size: [0.58, 0.46, 0.32] },
    },
    {
      key: "chest",
      label: "Chest",
      ref: chest,
      mass: 2.8,
      color: "#cc6f5a",
      shape: { kind: "box", size: [0.84, 1, 0.42] },
    },
    {
      key: "head",
      label: "Head",
      ref: head,
      mass: 1,
      color: "#f1d7b8",
      shape: { kind: "sphere", radius: 0.32 },
    },
    {
      key: "upperArmLeft",
      label: "Upper Arm L",
      ref: upperArmLeft,
      mass: 0.7,
      color: "#4a88c7",
      shape: { kind: "box", size: [0.24, 0.58, 0.24] },
    },
    {
      key: "lowerArmLeft",
      label: "Lower Arm L",
      ref: lowerArmLeft,
      mass: 0.55,
      color: "#3d6b9b",
      shape: { kind: "box", size: [0.2, 0.54, 0.2] },
    },
    {
      key: "handLeft",
      label: "Hand L",
      ref: handLeft,
      mass: 0.3,
      color: "#f1d7b8",
      shape: { kind: "box", size: [0.18, 0.18, 0.26] },
    },
    {
      key: "upperArmRight",
      label: "Upper Arm R",
      ref: upperArmRight,
      mass: 0.7,
      color: "#4a88c7",
      shape: { kind: "box", size: [0.24, 0.58, 0.24] },
    },
    {
      key: "lowerArmRight",
      label: "Lower Arm R",
      ref: lowerArmRight,
      mass: 0.55,
      color: "#3d6b9b",
      shape: { kind: "box", size: [0.2, 0.54, 0.2] },
    },
    {
      key: "handRight",
      label: "Hand R",
      ref: handRight,
      mass: 0.3,
      color: "#f1d7b8",
      shape: { kind: "box", size: [0.18, 0.18, 0.26] },
    },
    {
      key: "upperLegLeft",
      label: "Upper Leg L",
      ref: upperLegLeft,
      mass: 1.5,
      color: "#203244",
      shape: { kind: "box", size: [0.3, 0.82, 0.3] },
    },
    {
      key: "lowerLegLeft",
      label: "Lower Leg L",
      ref: lowerLegLeft,
      mass: 1.2,
      color: "#162434",
      shape: { kind: "box", size: [0.26, 0.78, 0.26] },
    },
    {
      key: "footLeft",
      label: "Foot L",
      ref: footLeft,
      mass: 0.5,
      color: "#101826",
      shape: { kind: "box", size: [0.24, 0.16, 0.48] },
    },
    {
      key: "upperLegRight",
      label: "Upper Leg R",
      ref: upperLegRight,
      mass: 1.5,
      color: "#203244",
      shape: { kind: "box", size: [0.3, 0.82, 0.3] },
    },
    {
      key: "lowerLegRight",
      label: "Lower Leg R",
      ref: lowerLegRight,
      mass: 1.2,
      color: "#162434",
      shape: { kind: "box", size: [0.26, 0.78, 0.26] },
    },
    {
      key: "footRight",
      label: "Foot R",
      ref: footRight,
      mass: 0.5,
      color: "#101826",
      shape: { kind: "box", size: [0.24, 0.16, 0.48] },
    },
  ];

  const jointDescriptors: MwendoRagdollJointDescriptor[] = [
    {
      key: "spine",
      kind: "spherical",
      bodyA: pelvis,
      bodyB: chest,
      anchorA: [0, 0.28, 0],
      anchorB: [0, -0.4, 0],
    },
    {
      key: "neck",
      kind: "spherical",
      bodyA: chest,
      bodyB: head,
      anchorA: [0, 0.46, 0],
      anchorB: [0, -0.28, 0],
    },
    {
      key: "shoulderLeft",
      kind: "spherical",
      bodyA: chest,
      bodyB: upperArmLeft,
      anchorA: [-0.44, 0.24, 0],
      anchorB: [0, 0.24, 0],
    },
    {
      key: "elbowLeft",
      kind: "revolute",
      bodyA: upperArmLeft,
      bodyB: lowerArmLeft,
      anchorA: [0, -0.24, 0],
      anchorB: [0, 0.24, 0],
      axis: [1, 0, 0],
      limits: [-2.1, 0.1],
    },
    {
      key: "wristLeft",
      kind: "revolute",
      bodyA: lowerArmLeft,
      bodyB: handLeft,
      anchorA: [0, -0.24, 0],
      anchorB: [0, 0.08, 0],
      axis: [1, 0, 0],
      limits: [-0.65, 0.65],
    },
    {
      key: "shoulderRight",
      kind: "spherical",
      bodyA: chest,
      bodyB: upperArmRight,
      anchorA: [0.44, 0.24, 0],
      anchorB: [0, 0.24, 0],
    },
    {
      key: "elbowRight",
      kind: "revolute",
      bodyA: upperArmRight,
      bodyB: lowerArmRight,
      anchorA: [0, -0.24, 0],
      anchorB: [0, 0.24, 0],
      axis: [1, 0, 0],
      limits: [-2.1, 0.1],
    },
    {
      key: "wristRight",
      kind: "revolute",
      bodyA: lowerArmRight,
      bodyB: handRight,
      anchorA: [0, -0.24, 0],
      anchorB: [0, 0.08, 0],
      axis: [1, 0, 0],
      limits: [-0.65, 0.65],
    },
    {
      key: "hipLeft",
      kind: "spherical",
      bodyA: pelvis,
      bodyB: upperLegLeft,
      anchorA: [-0.18, -0.22, 0],
      anchorB: [0, 0.34, 0],
    },
    {
      key: "kneeLeft",
      kind: "revolute",
      bodyA: upperLegLeft,
      bodyB: lowerLegLeft,
      anchorA: [0, -0.34, 0],
      anchorB: [0, 0.34, 0],
      axis: [1, 0, 0],
      limits: [-2.35, 0.15],
    },
    {
      key: "ankleLeft",
      kind: "revolute",
      bodyA: lowerLegLeft,
      bodyB: footLeft,
      anchorA: [0, -0.34, 0],
      anchorB: [0, 0.06, -0.14],
      axis: [1, 0, 0],
      limits: [-0.55, 0.45],
    },
    {
      key: "hipRight",
      kind: "spherical",
      bodyA: pelvis,
      bodyB: upperLegRight,
      anchorA: [0.18, -0.22, 0],
      anchorB: [0, 0.34, 0],
    },
    {
      key: "kneeRight",
      kind: "revolute",
      bodyA: upperLegRight,
      bodyB: lowerLegRight,
      anchorA: [0, -0.34, 0],
      anchorB: [0, 0.34, 0],
      axis: [1, 0, 0],
      limits: [-2.35, 0.15],
    },
    {
      key: "ankleRight",
      kind: "revolute",
      bodyA: lowerLegRight,
      bodyB: footRight,
      anchorA: [0, -0.34, 0],
      anchorB: [0, 0.06, -0.14],
      axis: [1, 0, 0],
      limits: [-0.55, 0.45],
    },
  ];

  useSphericalJoint(pelvis, chest, [[0, 0.28, 0], [0, -0.4, 0]]);
  useSphericalJoint(chest, head, [[0, 0.46, 0], [0, -0.28, 0]]);
  useSphericalJoint(chest, upperArmLeft, [[-0.44, 0.24, 0], [0, 0.24, 0]]);
  useSphericalJoint(chest, upperArmRight, [[0.44, 0.24, 0], [0, 0.24, 0]]);
  useSphericalJoint(pelvis, upperLegLeft, [[-0.18, -0.22, 0], [0, 0.34, 0]]);
  useSphericalJoint(pelvis, upperLegRight, [[0.18, -0.22, 0], [0, 0.34, 0]]);

  useRevoluteJoint(
    upperArmLeft,
    lowerArmLeft,
    [[0, -0.24, 0], [0, 0.24, 0], [1, 0, 0], [-2.1, 0.1]],
  );
  useRevoluteJoint(
    lowerArmLeft,
    handLeft,
    [[0, -0.24, 0], [0, 0.08, 0], [1, 0, 0], [-0.65, 0.65]],
  );
  useRevoluteJoint(
    upperArmRight,
    lowerArmRight,
    [[0, -0.24, 0], [0, 0.24, 0], [1, 0, 0], [-2.1, 0.1]],
  );
  useRevoluteJoint(
    lowerArmRight,
    handRight,
    [[0, -0.24, 0], [0, 0.08, 0], [1, 0, 0], [-0.65, 0.65]],
  );
  useRevoluteJoint(
    upperLegLeft,
    lowerLegLeft,
    [[0, -0.34, 0], [0, 0.34, 0], [1, 0, 0], [-2.35, 0.15]],
  );
  useRevoluteJoint(
    lowerLegLeft,
    footLeft,
    [[0, -0.34, 0], [0, 0.06, -0.14], [1, 0, 0], [-0.55, 0.45]],
  );
  useRevoluteJoint(
    upperLegRight,
    lowerLegRight,
    [[0, -0.34, 0], [0, 0.34, 0], [1, 0, 0], [-2.35, 0.15]],
  );
  useRevoluteJoint(
    lowerLegRight,
    footRight,
    [[0, -0.34, 0], [0, 0.06, -0.14], [1, 0, 0], [-0.55, 0.45]],
  );

  return (
    <group position={position}>
      {debug ? (
        <MwendoRagdollDebug
          bodies={bodyDescriptors}
          joints={jointDescriptors}
          manualStepCount={manualStepCount}
          origin={position}
          paused={paused}
          timeScale={timeScale}
        />
      ) : null}

      <RagdollBody ref={pelvis} colliders="cuboid" mass={2.2} position={[0, 0, 0]}>
        <BlockPart color="#87483d" scale={[0.58, 0.46, 0.32]} />
      </RagdollBody>

      <RagdollBody ref={chest} colliders="cuboid" mass={2.8} position={[0, 0.68, 0]}>
        <BlockPart color="#cc6f5a" scale={[0.84, 1, 0.42]} />
      </RagdollBody>

      <RagdollBody ref={head} colliders="ball" mass={1} position={[0, 1.42, 0]}>
        <HeadPart />
      </RagdollBody>

      <RagdollBody ref={upperArmLeft} colliders="cuboid" mass={0.7} position={[-0.44, 0.68, 0]}>
        <BlockPart color="#4a88c7" scale={[0.24, 0.58, 0.24]} position={[0, -0.05, 0]} />
      </RagdollBody>
      <RagdollBody ref={lowerArmLeft} colliders="cuboid" mass={0.55} position={[-0.44, 0.2, 0]}>
        <BlockPart color="#3d6b9b" scale={[0.2, 0.54, 0.2]} position={[0, -0.03, 0]} />
      </RagdollBody>
      <RagdollBody ref={handLeft} colliders="cuboid" mass={0.3} position={[-0.44, -0.12, 0.02]}>
        <BlockPart color="#f1d7b8" scale={[0.18, 0.18, 0.26]} roughness={0.9} />
      </RagdollBody>

      <RagdollBody ref={upperArmRight} colliders="cuboid" mass={0.7} position={[0.44, 0.68, 0]}>
        <BlockPart color="#4a88c7" scale={[0.24, 0.58, 0.24]} position={[0, -0.05, 0]} />
      </RagdollBody>
      <RagdollBody ref={lowerArmRight} colliders="cuboid" mass={0.55} position={[0.44, 0.2, 0]}>
        <BlockPart color="#3d6b9b" scale={[0.2, 0.54, 0.2]} position={[0, -0.03, 0]} />
      </RagdollBody>
      <RagdollBody ref={handRight} colliders="cuboid" mass={0.3} position={[0.44, -0.12, 0.02]}>
        <BlockPart color="#f1d7b8" scale={[0.18, 0.18, 0.26]} roughness={0.9} />
      </RagdollBody>

      <RagdollBody ref={upperLegLeft} colliders="cuboid" mass={1.5} position={[-0.18, -0.56, 0]}>
        <BlockPart color="#203244" scale={[0.3, 0.82, 0.3]} />
      </RagdollBody>
      <RagdollBody ref={lowerLegLeft} colliders="cuboid" mass={1.2} position={[-0.18, -1.24, 0.02]}>
        <BlockPart color="#162434" scale={[0.26, 0.78, 0.26]} />
      </RagdollBody>
      <RagdollBody ref={footLeft} colliders="cuboid" mass={0.5} position={[-0.18, -1.74, 0.16]}>
        <BlockPart color="#101826" scale={[0.24, 0.16, 0.48]} />
      </RagdollBody>

      <RagdollBody ref={upperLegRight} colliders="cuboid" mass={1.5} position={[0.18, -0.56, 0]}>
        <BlockPart color="#203244" scale={[0.3, 0.82, 0.3]} />
      </RagdollBody>
      <RagdollBody ref={lowerLegRight} colliders="cuboid" mass={1.2} position={[0.18, -1.24, 0.02]}>
        <BlockPart color="#162434" scale={[0.26, 0.78, 0.26]} />
      </RagdollBody>
      <RagdollBody ref={footRight} colliders="cuboid" mass={0.5} position={[0.18, -1.74, 0.16]}>
        <BlockPart color="#101826" scale={[0.24, 0.16, 0.48]} />
      </RagdollBody>
    </group>
  );
}
