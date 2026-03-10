import { Grid } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";

function Crate(props: { position: [number, number, number]; scale?: [number, number, number] }) {
  const scale = props.scale ?? [1.1, 1.1, 1.1];

  return (
    <RigidBody colliders="cuboid" position={props.position} restitution={0.1}>
      <mesh castShadow receiveShadow scale={scale}>
        <boxGeometry />
        <meshStandardMaterial color="#9f7f55" metalness={0.05} roughness={0.88} />
      </mesh>
    </RigidBody>
  );
}

export function FlatArena() {
  return (
    <>
      <Grid
        args={[180, 180]}
        cellColor="#73908d"
        sectionColor="#516864"
        infiniteGrid
        fadeDistance={110}
        fadeStrength={1.6}
        position={[0, 0.002, 0]}
      />

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[90, 0.15, 90]} position={[0, -0.15, 0]} />
        <mesh receiveShadow position={[0, -0.15, 0]}>
          <boxGeometry args={[180, 0.3, 180]} />
          <meshStandardMaterial color="#c6b99b" roughness={1} />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" colliders="cuboid" position={[10, 0.5, -2]} rotation={[0, 0, -0.28]}>
        <mesh castShadow receiveShadow scale={[6, 1, 4]}>
          <boxGeometry />
          <meshStandardMaterial color="#7687a6" roughness={0.9} />
        </mesh>
      </RigidBody>

      <Crate position={[2, 4, -4]} />
      <Crate position={[2, 5.2, -4]} />
      <Crate position={[6, 4.4, -8]} scale={[1.8, 0.8, 1.8]} />
      <Crate position={[-8, 3.8, -2]} />
      <Crate position={[-9.1, 5.1, -2.4]} />
      <Crate position={[-7.4, 5.6, -1.8]} />
    </>
  );
}
