import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense } from "react";
import { FlatArena } from "./components/FlatArena";
import { Hud } from "./components/Hud";
import { Lights } from "./components/Lights";
import { PlayerController } from "./components/PlayerController";
import { RagdollDummy } from "./components/RagdollDummy";
import { ThirdPersonCamera } from "./components/ThirdPersonCamera";

export default function App() {
  return (
    <>
      <Hud />
      <Canvas
        camera={{ fov: 42, near: 0.1, far: 250, position: [0, 3.5, 8] }}
        gl={{ antialias: true }}
        shadows
      >
        <color attach="background" args={["#c9dcff"]} />
        <fog attach="fog" args={["#c9dcff", 30, 120]} />
        <Suspense fallback={null}>
          <Lights />
          <Physics gravity={[0, -9.81, 0]}>
            <FlatArena />
            <PlayerController />
            <RagdollDummy position={[-4, 5.5, -6]} />
          </Physics>
          <ThirdPersonCamera />
        </Suspense>
      </Canvas>
    </>
  );
}
