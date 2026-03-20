import type { RevoluteImpulseJoint } from "@dimforge/rapier3d-compat";
import { createRef, type MutableRefObject, type RefObject } from "react";
import type { RapierRigidBody } from "@react-three/rapier";
import type { CharacterCtrlrVec3 } from "../types";

type CharacterCtrlrQuat = [number, number, number, number];

export type CharacterCtrlrHumanoidBodyKey =
  | "pelvis"
  | "chest"
  | "head"
  | "upperArmLeft"
  | "lowerArmLeft"
  | "handLeft"
  | "upperArmRight"
  | "lowerArmRight"
  | "handRight"
  | "upperLegLeft"
  | "lowerLegLeft"
  | "footLeft"
  | "upperLegRight"
  | "lowerLegRight"
  | "footRight";

export type CharacterCtrlrHumanoidBodyShape =
  | {
      kind: "box";
      size: CharacterCtrlrVec3;
    }
  | {
      kind: "sphere";
      radius: number;
    };

export type CharacterCtrlrHumanoidBodyDefinition = {
  key: CharacterCtrlrHumanoidBodyKey;
  label: string;
  position: CharacterCtrlrVec3;
  mass: number;
  color: string;
  collider: "cuboid" | "ball";
  shape: CharacterCtrlrHumanoidBodyShape;
  meshOffset?: CharacterCtrlrVec3;
  roughness?: number;
};

export type CharacterCtrlrHumanoidSphericalJointDefinition = {
  key: CharacterCtrlrHumanoidSphericalJointKey;
  kind: "spherical";
  bodyA: CharacterCtrlrHumanoidBodyKey;
  bodyB: CharacterCtrlrHumanoidBodyKey;
  anchorA: CharacterCtrlrVec3;
  anchorB: CharacterCtrlrVec3;
};

export type CharacterCtrlrHumanoidSphericalJointKey = "spine";

export type CharacterCtrlrHumanoidFixedJointKey = "neck";

export type CharacterCtrlrHumanoidFixedJointDefinition = {
  key: CharacterCtrlrHumanoidFixedJointKey;
  kind: "fixed";
  bodyA: CharacterCtrlrHumanoidBodyKey;
  bodyB: CharacterCtrlrHumanoidBodyKey;
  anchorA: CharacterCtrlrVec3;
  anchorB: CharacterCtrlrVec3;
  frameA: CharacterCtrlrQuat;
  frameB: CharacterCtrlrQuat;
};

export type CharacterCtrlrHumanoidRevoluteJointKey =
  | "shoulderLeft"
  | "shoulderRight"
  | "hipLeft"
  | "hipRight"
  | "elbowLeft"
  | "wristLeft"
  | "elbowRight"
  | "wristRight"
  | "kneeLeft"
  | "ankleLeft"
  | "kneeRight"
  | "ankleRight";

export type CharacterCtrlrHumanoidRevoluteJointDefinition = {
  key: CharacterCtrlrHumanoidRevoluteJointKey;
  kind: "revolute";
  bodyA: CharacterCtrlrHumanoidBodyKey;
  bodyB: CharacterCtrlrHumanoidBodyKey;
  anchorA: CharacterCtrlrVec3;
  anchorB: CharacterCtrlrVec3;
  axis: CharacterCtrlrVec3;
  limits: [number, number];
};

export type CharacterCtrlrHumanoidJointDefinition =
  | CharacterCtrlrHumanoidFixedJointDefinition
  | CharacterCtrlrHumanoidSphericalJointDefinition
  | CharacterCtrlrHumanoidRevoluteJointDefinition;

export type CharacterCtrlrHumanoidBodyRefs = Record<
  CharacterCtrlrHumanoidBodyKey,
  RefObject<RapierRigidBody | null>
>;

export type CharacterCtrlrHumanoidRevoluteJointRefs = Record<
  CharacterCtrlrHumanoidRevoluteJointKey,
  MutableRefObject<RevoluteImpulseJoint | null>
>;

export const CHARACTER_CTRLR_HUMANOID_BODY_DEFINITIONS: CharacterCtrlrHumanoidBodyDefinition[] = [
  {
    key: "pelvis",
    label: "Pelvis",
    position: [0, 0, 0],
    mass: 2.2,
    color: "#87483d",
    collider: "cuboid",
    shape: { kind: "box", size: [0.58, 0.46, 0.32] },
  },
  {
    key: "chest",
    label: "Chest",
    position: [0, 0.68, 0],
    mass: 2.8,
    color: "#cc6f5a",
    collider: "cuboid",
    shape: { kind: "box", size: [0.84, 1, 0.42] },
  },
  {
    key: "head",
    label: "Head",
    position: [0, 1.5, 0],
    mass: 0.6,
    color: "#f1d7b8",
    collider: "ball",
    shape: { kind: "sphere", radius: 0.28 },
    roughness: 0.9,
  },
  {
    key: "upperArmLeft",
    label: "Upper Arm L",
    position: [-0.44, 0.68, 0],
    mass: 0.55,
    color: "#4a88c7",
    collider: "cuboid",
    shape: { kind: "box", size: [0.24, 0.58, 0.24] },
    meshOffset: [0, -0.05, 0],
  },
  {
    key: "lowerArmLeft",
    label: "Lower Arm L",
    position: [-0.44, 0.2, 0],
    mass: 0.4,
    color: "#3d6b9b",
    collider: "cuboid",
    shape: { kind: "box", size: [0.2, 0.54, 0.2] },
    meshOffset: [0, -0.03, 0],
  },
  {
    key: "handLeft",
    label: "Hand L",
    position: [-0.44, -0.12, 0],
    mass: 0.18,
    color: "#f1d7b8",
    collider: "cuboid",
    shape: { kind: "box", size: [0.18, 0.18, 0.26] },
    roughness: 0.9,
  },
  {
    key: "upperArmRight",
    label: "Upper Arm R",
    position: [0.44, 0.68, 0],
    mass: 0.55,
    color: "#4a88c7",
    collider: "cuboid",
    shape: { kind: "box", size: [0.24, 0.58, 0.24] },
    meshOffset: [0, -0.05, 0],
  },
  {
    key: "lowerArmRight",
    label: "Lower Arm R",
    position: [0.44, 0.2, 0],
    mass: 0.4,
    color: "#3d6b9b",
    collider: "cuboid",
    shape: { kind: "box", size: [0.2, 0.54, 0.2] },
    meshOffset: [0, -0.03, 0],
  },
  {
    key: "handRight",
    label: "Hand R",
    position: [0.44, -0.12, 0],
    mass: 0.18,
    color: "#f1d7b8",
    collider: "cuboid",
    shape: { kind: "box", size: [0.18, 0.18, 0.26] },
    roughness: 0.9,
  },
  {
    key: "upperLegLeft",
    label: "Upper Leg L",
    position: [-0.18, -0.63, 0],
    mass: 1.5,
    color: "#203244",
    collider: "cuboid",
    shape: { kind: "box", size: [0.3, 0.82, 0.3] },
  },
  {
    key: "lowerLegLeft",
    label: "Lower Leg L",
    position: [-0.18, -1.43, 0],
    mass: 1.2,
    color: "#162434",
    collider: "cuboid",
    shape: { kind: "box", size: [0.26, 0.78, 0.26] },
  },
  {
    key: "footLeft",
    label: "Foot L",
    position: [-0.18, -1.9, 0.14],
    mass: 0.5,
    color: "#101826",
    collider: "cuboid",
    shape: { kind: "box", size: [0.24, 0.16, 0.48] },
  },
  {
    key: "upperLegRight",
    label: "Upper Leg R",
    position: [0.18, -0.63, 0],
    mass: 1.5,
    color: "#203244",
    collider: "cuboid",
    shape: { kind: "box", size: [0.3, 0.82, 0.3] },
  },
  {
    key: "lowerLegRight",
    label: "Lower Leg R",
    position: [0.18, -1.43, 0],
    mass: 1.2,
    color: "#162434",
    collider: "cuboid",
    shape: { kind: "box", size: [0.26, 0.78, 0.26] },
  },
  {
    key: "footRight",
    label: "Foot R",
    position: [0.18, -1.9, 0.14],
    mass: 0.5,
    color: "#101826",
    collider: "cuboid",
    shape: { kind: "box", size: [0.24, 0.16, 0.48] },
  },
];

export const CHARACTER_CTRLR_HUMANOID_SPHERICAL_JOINT_DEFINITIONS: CharacterCtrlrHumanoidSphericalJointDefinition[] =
  [
    {
      key: "spine",
      kind: "spherical",
      bodyA: "pelvis",
      bodyB: "chest",
      anchorA: [0, 0.28, 0],
      anchorB: [0, -0.4, 0],
    },
  ];

export const CHARACTER_CTRLR_HUMANOID_FIXED_JOINT_DEFINITIONS: CharacterCtrlrHumanoidFixedJointDefinition[] =
  [
    {
      key: "neck",
      kind: "fixed",
      bodyA: "chest",
      bodyB: "head",
      anchorA: [0, 0.54, 0],
      anchorB: [0, -0.28, 0],
      frameA: [0, 0, 0, 1],
      frameB: [0, 0, 0, 1],
    },
  ];

export const CHARACTER_CTRLR_HUMANOID_REVOLUTE_JOINT_DEFINITIONS: CharacterCtrlrHumanoidRevoluteJointDefinition[] =
  [
    {
      key: "shoulderLeft",
      kind: "revolute",
      bodyA: "chest",
      bodyB: "upperArmLeft",
      anchorA: [-0.44, 0.24, 0],
      anchorB: [0, 0.24, 0],
      axis: [1, 0, 0],
      limits: [-1.3, 1],
    },
    {
      key: "shoulderRight",
      kind: "revolute",
      bodyA: "chest",
      bodyB: "upperArmRight",
      anchorA: [0.44, 0.24, 0],
      anchorB: [0, 0.24, 0],
      axis: [1, 0, 0],
      limits: [-1.3, 1],
    },
    {
      key: "hipLeft",
      kind: "revolute",
      bodyA: "pelvis",
      bodyB: "upperLegLeft",
      anchorA: [-0.18, -0.22, 0],
      anchorB: [0, 0.41, 0],
      axis: [1, 0, 0],
      limits: [-0.95, 0.85],
    },
    {
      key: "hipRight",
      kind: "revolute",
      bodyA: "pelvis",
      bodyB: "upperLegRight",
      anchorA: [0.18, -0.22, 0],
      anchorB: [0, 0.41, 0],
      axis: [1, 0, 0],
      limits: [-0.95, 0.85],
    },
    {
      key: "elbowLeft",
      kind: "revolute",
      bodyA: "upperArmLeft",
      bodyB: "lowerArmLeft",
      anchorA: [0, -0.24, 0],
      anchorB: [0, 0.24, 0],
      axis: [1, 0, 0],
      limits: [-2.1, 0.1],
    },
    {
      key: "wristLeft",
      kind: "revolute",
      bodyA: "lowerArmLeft",
      bodyB: "handLeft",
      anchorA: [0, -0.24, 0],
      anchorB: [0, 0.08, 0],
      axis: [1, 0, 0],
      limits: [-0.65, 0.65],
    },
    {
      key: "elbowRight",
      kind: "revolute",
      bodyA: "upperArmRight",
      bodyB: "lowerArmRight",
      anchorA: [0, -0.24, 0],
      anchorB: [0, 0.24, 0],
      axis: [1, 0, 0],
      limits: [-2.1, 0.1],
    },
    {
      key: "wristRight",
      kind: "revolute",
      bodyA: "lowerArmRight",
      bodyB: "handRight",
      anchorA: [0, -0.24, 0],
      anchorB: [0, 0.08, 0],
      axis: [1, 0, 0],
      limits: [-0.65, 0.65],
    },
    {
      key: "kneeLeft",
      kind: "revolute",
      bodyA: "upperLegLeft",
      bodyB: "lowerLegLeft",
      anchorA: [0, -0.41, 0],
      anchorB: [0, 0.39, 0],
      axis: [1, 0, 0],
      limits: [-2.35, 0.15],
    },
    {
      key: "ankleLeft",
      kind: "revolute",
      bodyA: "lowerLegLeft",
      bodyB: "footLeft",
      anchorA: [0, -0.39, 0],
      anchorB: [0, 0.08, -0.14],
      axis: [1, 0, 0],
      limits: [-0.55, 0.45],
    },
    {
      key: "kneeRight",
      kind: "revolute",
      bodyA: "upperLegRight",
      bodyB: "lowerLegRight",
      anchorA: [0, -0.41, 0],
      anchorB: [0, 0.39, 0],
      axis: [1, 0, 0],
      limits: [-2.35, 0.15],
    },
    {
      key: "ankleRight",
      kind: "revolute",
      bodyA: "lowerLegRight",
      bodyB: "footRight",
      anchorA: [0, -0.39, 0],
      anchorB: [0, 0.08, -0.14],
      axis: [1, 0, 0],
      limits: [-0.55, 0.45],
    },
  ];

export const CHARACTER_CTRLR_HUMANOID_JOINT_DEFINITIONS: CharacterCtrlrHumanoidJointDefinition[] = [
  ...CHARACTER_CTRLR_HUMANOID_FIXED_JOINT_DEFINITIONS,
  ...CHARACTER_CTRLR_HUMANOID_SPHERICAL_JOINT_DEFINITIONS,
  ...CHARACTER_CTRLR_HUMANOID_REVOLUTE_JOINT_DEFINITIONS,
];

export function createCharacterCtrlrHumanoidBodyRefs(): CharacterCtrlrHumanoidBodyRefs {
  return {
    pelvis: createRef<RapierRigidBody>(),
    chest: createRef<RapierRigidBody>(),
    head: createRef<RapierRigidBody>(),
    upperArmLeft: createRef<RapierRigidBody>(),
    lowerArmLeft: createRef<RapierRigidBody>(),
    handLeft: createRef<RapierRigidBody>(),
    upperArmRight: createRef<RapierRigidBody>(),
    lowerArmRight: createRef<RapierRigidBody>(),
    handRight: createRef<RapierRigidBody>(),
    upperLegLeft: createRef<RapierRigidBody>(),
    lowerLegLeft: createRef<RapierRigidBody>(),
    footLeft: createRef<RapierRigidBody>(),
    upperLegRight: createRef<RapierRigidBody>(),
    lowerLegRight: createRef<RapierRigidBody>(),
    footRight: createRef<RapierRigidBody>(),
  };
}

export function createCharacterCtrlrHumanoidRevoluteJointRefs(): CharacterCtrlrHumanoidRevoluteJointRefs {
  return {
    shoulderLeft: { current: null },
    shoulderRight: { current: null },
    hipLeft: { current: null },
    hipRight: { current: null },
    elbowLeft: { current: null },
    wristLeft: { current: null },
    elbowRight: { current: null },
    wristRight: { current: null },
    kneeLeft: { current: null },
    ankleLeft: { current: null },
    kneeRight: { current: null },
    ankleRight: { current: null },
  };
}
