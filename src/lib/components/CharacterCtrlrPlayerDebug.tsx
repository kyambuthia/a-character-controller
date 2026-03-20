import { Billboard, Line, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  useAfterPhysicsStep,
  useRapier,
  type RapierRigidBody,
} from "@react-three/rapier";
import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import {
  Color,
  DoubleSide,
  Vector3,
  type Group,
  type Mesh,
} from "three";
import type { CharacterCtrlrMovementMode, CharacterCtrlrSupportState, CharacterCtrlrVec3 } from "../types";

type JointRefMap = {
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

type PlayerDebugStateRef = RefObject<{
  facing: number;
  movementMode: CharacterCtrlrMovementMode;
  grounded: boolean;
  supportState: CharacterCtrlrSupportState;
} | null>;

type JointSnapshot = {
  key: string;
  position: CharacterCtrlrVec3;
};

type ContactSnapshot = {
  key: string;
  point: CharacterCtrlrVec3;
  normalEnd: CharacterCtrlrVec3;
  intensity: number;
};

type GhostSnapshot = {
  id: number;
  position: CharacterCtrlrVec3;
  quaternion: [number, number, number, number];
  sleeping: boolean;
};

type PlayerDebugSnapshot = {
  bodyPosition: CharacterCtrlrVec3;
  bodyQuaternion: [number, number, number, number];
  velocityEnd: CharacterCtrlrVec3;
  facingEnd: CharacterCtrlrVec3;
  movementMode: CharacterCtrlrMovementMode;
  grounded: boolean;
  supportState: CharacterCtrlrSupportState;
  sleeping: boolean;
  mass: number;
  linearVelocity: CharacterCtrlrVec3;
  angularVelocity: CharacterCtrlrVec3;
  linearSpeed: number;
  angularSpeed: number;
  joints: JointSnapshot[];
  contacts: ContactSnapshot[];
  trail: CharacterCtrlrVec3[];
  ghosts: GhostSnapshot[];
  liveStepCount: number;
};

type PlayerDebugLiveSnapshot = Omit<
  PlayerDebugSnapshot,
  "contacts" | "trail" | "ghosts" | "liveStepCount"
>;

type CharacterCtrlrPlayerDebugProps = {
  bodyRef: RefObject<RapierRigidBody | null>;
  capsuleHalfHeight: number;
  capsuleRadius: number;
  debugStateRef: PlayerDebugStateRef;
  joints: JointRefMap;
  paused?: boolean;
  timeScale?: number;
  manualStepCount?: number;
};

const EMPTY_DEBUG_SNAPSHOT: PlayerDebugSnapshot = {
  bodyPosition: [0, 0, 0],
  bodyQuaternion: [0, 0, 0, 1],
  velocityEnd: [0, 0, 0],
  facingEnd: [0, 0, 1],
  movementMode: "idle",
  grounded: false,
  supportState: "none",
  sleeping: false,
  mass: 1,
  linearVelocity: [0, 0, 0],
  angularVelocity: [0, 0, 0],
  linearSpeed: 0,
  angularSpeed: 0,
  joints: [],
  contacts: [],
  trail: [],
  ghosts: [],
  liveStepCount: 0,
};

const EMPTY_LIVE_SNAPSHOT: PlayerDebugLiveSnapshot = {
  bodyPosition: [0, 0, 0],
  bodyQuaternion: [0, 0, 0, 1],
  velocityEnd: [0, 0, 0],
  facingEnd: [0, 0, 1],
  movementMode: "idle",
  grounded: false,
  supportState: "none",
  sleeping: false,
  mass: 1,
  linearVelocity: [0, 0, 0],
  angularVelocity: [0, 0, 0],
  linearSpeed: 0,
  angularSpeed: 0,
  joints: [],
};

const tempVector = new Vector3();
const linkPairs = [
  ["pelvis", "spine"],
  ["spine", "head"],
  ["spine", "leftUpperArm"],
  ["leftUpperArm", "leftLowerArm"],
  ["spine", "rightUpperArm"],
  ["rightUpperArm", "rightLowerArm"],
  ["pelvis", "leftUpperLeg"],
  ["leftUpperLeg", "leftLowerLeg"],
  ["pelvis", "rightUpperLeg"],
  ["rightUpperLeg", "rightLowerLeg"],
] as const;

function isValidRigidBody(
  body: RapierRigidBody | null | undefined,
): body is RapierRigidBody {
  if (!body) {
    return false;
  }

  try {
    return body.isValid();
  } catch {
    return false;
  }
}

function isValidCollider(
  collider: ReturnType<RapierRigidBody["collider"]> | null | undefined,
) {
  if (!collider) {
    return false;
  }

  try {
    return collider.isValid();
  } catch {
    return false;
  }
}

function toTuple3(value: { x: number; y: number; z: number }): CharacterCtrlrVec3 {
  return [value.x, value.y, value.z];
}

function toTuple4(value: { x: number; y: number; z: number; w: number }) {
  return [value.x, value.y, value.z, value.w] as [number, number, number, number];
}

function getGroupPosition(ref: RefObject<Group | null>) {
  const object = ref.current;

  if (!object) {
    return null;
  }

  object.getWorldPosition(tempVector);
  return toTuple3(tempVector);
}

function mixColor(from: string, to: string, amount: number) {
  return new Color(from)
    .lerp(new Color(to), Math.max(0, Math.min(1, amount)))
    .getStyle();
}

function activityColor(snapshot: PlayerDebugSnapshot) {
  if (snapshot.sleeping) {
    return "#5e7388";
  }

  const energy = Math.min(1, snapshot.linearSpeed / 4 + snapshot.angularSpeed / 10);
  return mixColor("#8cf0c6", "#ff7b60", energy);
}

function capsuleCenter(position: CharacterCtrlrVec3, capsuleHalfHeight: number, capsuleRadius: number): CharacterCtrlrVec3 {
  return [
    position[0],
    position[1] + capsuleHalfHeight + capsuleRadius,
    position[2],
  ];
}

function CapsuleShell({
  capsuleHalfHeight,
  capsuleRadius,
  snapshot,
}: {
  capsuleHalfHeight: number;
  capsuleRadius: number;
  snapshot: PlayerDebugSnapshot;
}) {
  return (
    <mesh
      position={capsuleCenter(snapshot.bodyPosition, capsuleHalfHeight, capsuleRadius)}
      quaternion={snapshot.bodyQuaternion}
      renderOrder={8}
    >
      <capsuleGeometry args={[capsuleRadius, capsuleHalfHeight * 2, 8, 16]} />
      <meshBasicMaterial
        color={activityColor(snapshot)}
        depthTest={false}
        depthWrite={false}
        opacity={snapshot.sleeping ? 0.18 : 0.42}
        side={DoubleSide}
        transparent
        wireframe
      />
    </mesh>
  );
}

function GhostCapsule({
  capsuleHalfHeight,
  capsuleRadius,
  ghost,
  opacity,
}: {
  capsuleHalfHeight: number;
  capsuleRadius: number;
  ghost: GhostSnapshot;
  opacity: number;
}) {
  return (
    <mesh
      position={capsuleCenter(ghost.position, capsuleHalfHeight, capsuleRadius)}
      quaternion={ghost.quaternion}
      renderOrder={4}
    >
      <capsuleGeometry args={[capsuleRadius, capsuleHalfHeight * 2, 8, 16]} />
      <meshBasicMaterial
        color="#cfe7ff"
        depthTest={false}
        depthWrite={false}
        opacity={opacity}
        transparent
      />
    </mesh>
  );
}

function MassMarker({
  snapshot,
  capsuleHalfHeight,
  capsuleRadius,
}: {
  snapshot: PlayerDebugSnapshot;
  capsuleHalfHeight: number;
  capsuleRadius: number;
}) {
  const radius = 0.05 + snapshot.mass * 0.015;

  return (
    <mesh
      position={capsuleCenter(snapshot.bodyPosition, capsuleHalfHeight, capsuleRadius)}
      renderOrder={10}
    >
      <sphereGeometry args={[radius, 10, 10]} />
      <meshBasicMaterial
        color={activityColor(snapshot)}
        depthTest={false}
        depthWrite={false}
        opacity={0.72}
        transparent
      />
    </mesh>
  );
}

function VelocityVector({ snapshot }: { snapshot: PlayerDebugSnapshot }) {
  if (snapshot.linearSpeed < 0.05) {
    return null;
  }

  return (
    <Line
      color="#50d2ff"
      depthTest={false}
      lineWidth={1.2}
      points={[snapshot.bodyPosition, snapshot.velocityEnd]}
    />
  );
}

function AngularVelocityVector({ snapshot }: { snapshot: PlayerDebugSnapshot }) {
  if (snapshot.angularSpeed < 0.08) {
    return null;
  }

  const origin: CharacterCtrlrVec3 = [
    snapshot.bodyPosition[0],
    snapshot.bodyPosition[1] + 0.12,
    snapshot.bodyPosition[2],
  ];
  const end: CharacterCtrlrVec3 = [
    origin[0] + snapshot.angularVelocity[0] * 0.12,
    origin[1] + snapshot.angularVelocity[1] * 0.12,
    origin[2] + snapshot.angularVelocity[2] * 0.12,
  ];

  return <Line color="#ff7bf3" depthTest={false} lineWidth={1.2} points={[origin, end]} />;
}

function TrailLine({ trail, grounded }: { trail: CharacterCtrlrVec3[]; grounded: boolean }) {
  if (trail.length < 2) {
    return null;
  }

  return (
    <Line
      color={grounded ? "#8be4ff" : "#ffd2a0"}
      depthTest={false}
      lineWidth={0.9}
      opacity={0.48}
      points={trail}
      transparent
    />
  );
}

function CenterOfMassMarker({ position }: { position: CharacterCtrlrVec3 }) {
  const top: CharacterCtrlrVec3 = [position[0], position[1] + 0.7, position[2]];
  const right: CharacterCtrlrVec3 = [position[0] + 0.2, position[1], position[2]];
  const left: CharacterCtrlrVec3 = [position[0] - 0.2, position[1], position[2]];
  const front: CharacterCtrlrVec3 = [position[0], position[1], position[2] + 0.2];
  const back: CharacterCtrlrVec3 = [position[0], position[1], position[2] - 0.2];

  return (
    <group renderOrder={12}>
      <Line color="#ffd369" depthTest={false} lineWidth={1.8} points={[position, top]} />
      <Line color="#ffd369" depthTest={false} lineWidth={1.8} points={[left, right]} />
      <Line color="#ffd369" depthTest={false} lineWidth={1.8} points={[back, front]} />
      <mesh position={position}>
        <sphereGeometry args={[0.11, 14, 14]} />
        <meshBasicMaterial
          color="#ffe08b"
          depthTest={false}
          depthWrite={false}
          opacity={0.88}
          transparent
        />
      </mesh>
    </group>
  );
}

function ContactNormal({ contact }: { contact: ContactSnapshot }) {
  return (
    <group renderOrder={16}>
      <Line
        color={mixColor("#7fe9ff", "#ff8b5b", Math.min(1, contact.intensity))}
        depthTest={false}
        lineWidth={1.4}
        points={[contact.point, contact.normalEnd]}
      />
      <mesh position={contact.point}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshBasicMaterial
          color="#fff4ba"
          depthTest={false}
          depthWrite={false}
          opacity={0.9}
          transparent
        />
      </mesh>
    </group>
  );
}

function DebugBoard({
  liveStepCount,
  manualStepCount,
  paused,
  timeScale,
  snapshot,
}: {
  liveStepCount: number;
  manualStepCount: number;
  paused: boolean;
  timeScale: number;
  snapshot: PlayerDebugSnapshot;
}) {
  return (
    <Billboard
      position={[
        snapshot.bodyPosition[0],
        snapshot.bodyPosition[1] + 2.4,
        snapshot.bodyPosition[2],
      ]}
    >
      <group>
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[4.1, 1.45]} />
          <meshBasicMaterial
            color="#061521"
            depthWrite={false}
            opacity={0.62}
            side={DoubleSide}
            transparent
          />
        </mesh>
        <Text
          anchorX="center"
          anchorY="middle"
          color="#dff7ff"
          fontSize={0.16}
          position={[0, 0.38, 0]}
        >
          PLAYER DEBUG
        </Text>
        <Text
          anchorX="center"
          anchorY="middle"
          color={paused ? "#ff9f80" : "#9af4d1"}
          fontSize={0.12}
          position={[0, 0.12, 0]}
        >
          {paused ? "paused" : "live"}  x{timeScale.toFixed(2)}  manual {manualStepCount}
        </Text>
        <Text
          anchorX="center"
          anchorY="middle"
          color="#acd8e8"
          fontSize={0.1}
          position={[0, -0.12, 0]}
        >
          {snapshot.movementMode}  {snapshot.grounded ? "grounded" : "airborne"}  support {snapshot.supportState}
        </Text>
        <Text
          anchorX="center"
          anchorY="middle"
          color="#7ea4b3"
          fontSize={0.09}
          position={[0, -0.38, 0]}
        >
          frames {liveStepCount}
        </Text>
      </group>
    </Billboard>
  );
}

function buildSnapshot(
  bodyRef: RefObject<RapierRigidBody | null>,
  debugStateRef: PlayerDebugStateRef,
  joints: JointRefMap,
): PlayerDebugLiveSnapshot {
  const body = bodyRef.current;
  const debugState = debugStateRef.current;

  if (!isValidRigidBody(body) || !debugState) {
    return EMPTY_LIVE_SNAPSHOT;
  }

  try {
    const translation = body.translation();
    const rotation = body.rotation();
    const linearVelocity = body.linvel();
    const angularVelocity = body.angvel();
    const velocityScale = 0.2;
    const facingScale = 1;
    const bodyPosition: CharacterCtrlrVec3 = [translation.x, translation.y, translation.z];
    const linearSpeed = Math.hypot(linearVelocity.x, linearVelocity.y, linearVelocity.z);
    const angularSpeed = Math.hypot(angularVelocity.x, angularVelocity.y, angularVelocity.z);
    const velocityEnd: CharacterCtrlrVec3 = [
      translation.x + linearVelocity.x * velocityScale,
      translation.y + 0.35 + linearVelocity.y * velocityScale,
      translation.z + linearVelocity.z * velocityScale,
    ];
    const facingEnd: CharacterCtrlrVec3 = [
      translation.x + Math.sin(debugState.facing) * facingScale,
      translation.y + 0.6,
      translation.z + Math.cos(debugState.facing) * facingScale,
    ];

    const jointRefs: Array<[string, RefObject<Group | null>]> = [
      ["pelvis", joints.pelvisRef],
      ["spine", joints.spineRef],
      ["head", joints.headRef],
      ["leftUpperArm", joints.leftUpperArmRef],
      ["leftLowerArm", joints.leftLowerArmRef],
      ["rightUpperArm", joints.rightUpperArmRef],
      ["rightLowerArm", joints.rightLowerArmRef],
      ["leftUpperLeg", joints.leftUpperLegRef],
      ["leftLowerLeg", joints.leftLowerLegRef],
      ["rightUpperLeg", joints.rightUpperLegRef],
      ["rightLowerLeg", joints.rightLowerLegRef],
    ];
    const jointEntries: JointSnapshot[] = jointRefs.flatMap(([key, ref]) => {
      const position = getGroupPosition(ref);
      return position ? [{ key, position }] : [];
    });

    return {
      bodyPosition,
      bodyQuaternion: toTuple4(rotation),
      velocityEnd,
      facingEnd,
      movementMode: debugState.movementMode,
      grounded: debugState.grounded,
      supportState: debugState.supportState,
      sleeping: body.isSleeping(),
      mass: typeof body.mass === "function" ? body.mass() : 1,
      linearVelocity: toTuple3(linearVelocity),
      angularVelocity: toTuple3(angularVelocity),
      linearSpeed,
      angularSpeed,
      joints: jointEntries,
    };
  } catch {
    return EMPTY_LIVE_SNAPSHOT;
  }
}

function buildDiagnosticsSnapshot(
  liveSnapshot: PlayerDebugLiveSnapshot,
  bodyRef: RefObject<RapierRigidBody | null>,
  world: ReturnType<typeof useRapier>["world"],
  colliderStates: ReturnType<typeof useRapier>["colliderStates"],
  liveStepCount: number,
  trailPoints: MutableRefObject<CharacterCtrlrVec3[]>,
  ghostSnapshots: MutableRefObject<GhostSnapshot[]>,
  ghostId: MutableRefObject<number>,
  lastGhostAt: MutableRefObject<number>,
) {
  const body = bodyRef.current;

  if (!isValidRigidBody(body)) {
    return {
      ...EMPTY_DEBUG_SNAPSHOT,
      ...liveSnapshot,
      contacts: [],
      trail: trailPoints.current ?? [],
      ghosts: ghostSnapshots.current ?? [],
      liveStepCount,
    } satisfies PlayerDebugSnapshot;
  }

  const nextTrail = [...(trailPoints.current ?? []), liveSnapshot.bodyPosition].slice(-18);
  trailPoints.current = nextTrail;
  const contacts: ContactSnapshot[] = [];
  for (let index = 0; index < body.numColliders(); index += 1) {
    let collider;

    try {
      collider = body.collider(index);
    } catch {
      continue;
    }

    if (!isValidCollider(collider)) {
      continue;
    }

    for (const colliderState of colliderStates.values()) {
      const otherCollider = colliderState.collider;

      if (!otherCollider || otherCollider.handle === collider.handle) {
        continue;
      }

      let parent;

      try {
        parent = otherCollider.parent();
      } catch {
        continue;
      }

      if (isValidRigidBody(parent) && parent.handle === body.handle) {
        continue;
      }

      try {
        world.contactPair(collider, otherCollider, (manifold, flipped) => {
          const normal = manifold.normal();
          const orientation = flipped ? -1 : 1;

          for (let contactIndex = 0; contactIndex < manifold.numSolverContacts(); contactIndex += 1) {
            const point = manifold.solverContactPoint(contactIndex);
            const localPoint: CharacterCtrlrVec3 = [point.x, point.y, point.z];
            const normalEnd: CharacterCtrlrVec3 = [
              localPoint[0] + normal.x * 0.42 * orientation,
              localPoint[1] + normal.y * 0.42 * orientation,
              localPoint[2] + normal.z * 0.42 * orientation,
            ];
            const intensity =
              manifold.numContacts() > 0
                ? Math.min(
                    1,
                    manifold.contactImpulse(
                      Math.min(contactIndex, manifold.numContacts() - 1),
                    ) / 2.8,
                  )
                : 0.15;

            contacts.push({
              key: `${collider.handle}:${otherCollider.handle}:${contactIndex}`,
              point: localPoint,
              normalEnd,
              intensity,
            });
          }
        });
      } catch {
        continue;
      }
    }
  }

  const now = performance.now();
  if (now - lastGhostAt.current > 180) {
    ghostId.current += 1;
    ghostSnapshots.current = [
      {
        id: ghostId.current,
        position: liveSnapshot.bodyPosition,
        quaternion: liveSnapshot.bodyQuaternion,
        sleeping: liveSnapshot.sleeping,
      },
      ...(ghostSnapshots.current ?? []),
    ].slice(0, 4);
    lastGhostAt.current = now;
  }

  return {
    ...liveSnapshot,
    contacts,
    trail: nextTrail,
    ghosts: ghostSnapshots.current ?? [],
    liveStepCount,
  } satisfies PlayerDebugSnapshot;
}

export function CharacterCtrlrPlayerDebug({
  bodyRef,
  capsuleHalfHeight,
  capsuleRadius,
  debugStateRef,
  joints,
  paused = false,
  timeScale = 1,
  manualStepCount = 0,
}: CharacterCtrlrPlayerDebugProps) {
  const rapier = useRapier();
  const [liveSnapshot, setLiveSnapshot] = useState<PlayerDebugLiveSnapshot>(EMPTY_LIVE_SNAPSHOT);
  const [diagnosticsSnapshot, setDiagnosticsSnapshot] = useState<PlayerDebugSnapshot>(EMPTY_DEBUG_SNAPSHOT);
  const capsuleMeshRef = useRef<Mesh>(null);
  const liveStepCount = useRef(0);
  const trailPoints = useRef<CharacterCtrlrVec3[]>([]);
  const ghostSnapshots = useRef<GhostSnapshot[]>([]);
  const ghostId = useRef(0);
  const lastGhostAt = useRef(0);

  useEffect(() => {
    const nextLiveSnapshot = buildSnapshot(bodyRef, debugStateRef, joints);
    setLiveSnapshot(nextLiveSnapshot);
    setDiagnosticsSnapshot(
      buildDiagnosticsSnapshot(
        nextLiveSnapshot,
        bodyRef,
        rapier.world,
        rapier.colliderStates,
        liveStepCount.current,
        trailPoints,
        ghostSnapshots,
        ghostId,
        lastGhostAt,
      ),
    );
  }, [bodyRef, debugStateRef, joints, rapier.colliderStates, rapier.world]);

  useAfterPhysicsStep(() => {
    liveStepCount.current += 1;

    const nextDiagnosticsSnapshot = buildDiagnosticsSnapshot(
      buildSnapshot(bodyRef, debugStateRef, joints),
      bodyRef,
      rapier.world,
      rapier.colliderStates,
      liveStepCount.current,
      trailPoints,
      ghostSnapshots,
      ghostId,
      lastGhostAt,
    );

    startTransition(() => {
      setDiagnosticsSnapshot(nextDiagnosticsSnapshot);
    });
  });

  useFrame(() => {
    const body = bodyRef.current;
    const capsuleMesh = capsuleMeshRef.current;

    if (!isValidRigidBody(body) || !capsuleMesh) {
      return;
    }

    try {
      const translation = body.translation();
      capsuleMesh.position.set(
        translation.x,
        translation.y + capsuleHalfHeight + capsuleRadius,
        translation.z,
      );
      setLiveSnapshot(buildSnapshot(bodyRef, debugStateRef, joints));
    } catch {
      setLiveSnapshot(EMPTY_LIVE_SNAPSHOT);
    }
  });

  const snapshot: PlayerDebugSnapshot = {
    ...diagnosticsSnapshot,
    ...liveSnapshot,
  };
  const jointMap = new Map(snapshot.joints.map((joint) => [joint.key, joint.position]));

  return (
    <group userData={{ characterCtrlrIgnoreCameraOcclusion: true }}>
      <DebugBoard
        liveStepCount={snapshot.liveStepCount}
        manualStepCount={manualStepCount}
        paused={paused}
        snapshot={snapshot}
        timeScale={timeScale}
      />

      {snapshot.ghosts.map((ghost, index) => (
        <GhostCapsule
          key={ghost.id}
          capsuleHalfHeight={capsuleHalfHeight}
          capsuleRadius={capsuleRadius}
          ghost={ghost}
          opacity={Math.max(0.04, 0.16 - index * 0.03)}
        />
      ))}

      <TrailLine grounded={snapshot.grounded} trail={snapshot.trail} />

      <group>
        <CapsuleShell
          capsuleHalfHeight={capsuleHalfHeight}
          capsuleRadius={capsuleRadius}
          snapshot={snapshot}
        />
        <MassMarker
          capsuleHalfHeight={capsuleHalfHeight}
          capsuleRadius={capsuleRadius}
          snapshot={snapshot}
        />
        <VelocityVector snapshot={snapshot} />
        <AngularVelocityVector snapshot={snapshot} />
      </group>

      <mesh ref={capsuleMeshRef} renderOrder={12}>
        <capsuleGeometry args={[capsuleRadius, capsuleHalfHeight * 2, 8, 16]} />
        <meshBasicMaterial
          color="#8fe6ff"
          depthTest={false}
          depthWrite={false}
          opacity={0.18}
          side={DoubleSide}
          transparent
          wireframe
        />
      </mesh>

      <Line
        color="#ff9f5b"
        depthTest={false}
        lineWidth={1.5}
        points={[
          [
            snapshot.bodyPosition[0],
            snapshot.bodyPosition[1] + 0.6,
            snapshot.bodyPosition[2],
          ],
          snapshot.facingEnd,
        ]}
      />
      <Line
        color="#56dbff"
        depthTest={false}
        lineWidth={1.3}
        points={[
          [
            snapshot.bodyPosition[0],
            snapshot.bodyPosition[1] + 0.35,
            snapshot.bodyPosition[2],
          ],
          snapshot.velocityEnd,
        ]}
      />

      {linkPairs.flatMap(([from, to]) => {
        const start = jointMap.get(from);
        const end = jointMap.get(to);

        if (!start || !end) {
          return [];
        }

        return (
          <Line
            key={`${from}:${to}`}
            color="#f4f7fb"
            depthTest={false}
            lineWidth={1.1}
            points={[start, end]}
          />
        );
      })}

      {snapshot.joints.map((joint) => (
        <mesh key={joint.key} position={joint.position} renderOrder={14}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <meshBasicMaterial
            color="#ffde8a"
            depthTest={false}
            depthWrite={false}
            opacity={0.86}
            transparent
          />
        </mesh>
      ))}

      {snapshot.contacts.map((contact) => (
        <ContactNormal key={contact.key} contact={contact} />
      ))}

      <CenterOfMassMarker
        position={capsuleCenter(snapshot.bodyPosition, capsuleHalfHeight, capsuleRadius)}
      />
    </group>
  );
}
