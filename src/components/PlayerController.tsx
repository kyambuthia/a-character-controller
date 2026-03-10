import { CapsuleCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group, MathUtils, Vector3 } from "three";
import { usePlayerInput } from "../systems/usePlayerInput";
import { type MovementMode, useGameStore } from "../store/useGameStore";

const forward = new Vector3();
const right = new Vector3();
const movement = new Vector3();

export function PlayerController() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<Group>(null);
  const input = usePlayerInput();
  const setPlayerSnapshot = useGameStore((state) => state.setPlayerSnapshot);
  const bodyColor = useMemo(() => ({ walk: "#2f6fed", run: "#ff6b35", crouch: "#10b981", idle: "#3b4d73" }), []);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    const visual = visualRef.current;

    if (!body || !visual) {
      return;
    }

    const keys = input.current;
    const yaw = useGameStore.getState().cameraYaw;

    forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    right.set(forward.z, 0, -forward.x);
    movement.set(0, 0, 0);

    if (keys.forward) movement.add(forward);
    if (keys.backward) movement.sub(forward);
    if (keys.right) movement.add(right);
    if (keys.left) movement.sub(right);

    const hasMovementInput = movement.lengthSq() > 0;
    if (hasMovementInput) {
      movement.normalize();
    }

    const movementMode: MovementMode = keys.crouch
      ? "crouch"
      : hasMovementInput && keys.run
        ? "run"
        : hasMovementInput
          ? "walk"
          : "idle";

    const speed =
      movementMode === "run" ? 7 :
      movementMode === "walk" ? 4 :
      movementMode === "crouch" ? 2 :
      0;

    const currentVelocity = body.linvel();
    body.setLinvel(
      {
        x: movement.x * speed,
        y: currentVelocity.y,
        z: movement.z * speed,
      },
      true,
    );

    const position = body.translation();
    const facing = hasMovementInput ? Math.atan2(movement.x, movement.z) : useGameStore.getState().playerFacing;

    visual.rotation.y = MathUtils.damp(visual.rotation.y, facing, 10, delta);
    visual.position.y = MathUtils.damp(
      visual.position.y,
      movementMode === "crouch" ? 0.72 : 0.95,
      10,
      delta,
    );
    visual.scale.y = MathUtils.damp(
      visual.scale.y,
      movementMode === "crouch" ? 0.72 : 1,
      10,
      delta,
    );

    setPlayerSnapshot({
      position: [position.x, position.y, position.z],
      facing,
      movementMode,
    });
  });

  const movementMode = useGameStore((state) => state.movementMode);

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      canSleep={false}
      enabledRotations={[false, false, false]}
      linearDamping={8}
      position={[0, 2.5, 6]}
    >
      <CapsuleCollider args={[0.52, 0.34]} />
      <group ref={visualRef}>
        <mesh castShadow position={[0, 0.95, 0]}>
          <capsuleGeometry args={[0.42, 1.25, 8, 16]} />
          <meshStandardMaterial color={bodyColor[movementMode]} roughness={0.45} metalness={0.2} />
        </mesh>
        <mesh castShadow position={[0, 1.86, 0.02]}>
          <sphereGeometry args={[0.28, 24, 24]} />
          <meshStandardMaterial color="#f1d7b8" roughness={0.88} />
        </mesh>
        <mesh castShadow position={[0, 1.86, 0.24]} scale={[0.5, 0.18, 0.25]}>
          <boxGeometry />
          <meshStandardMaterial color="#1f2937" roughness={0.55} />
        </mesh>
      </group>
    </RigidBody>
  );
}
