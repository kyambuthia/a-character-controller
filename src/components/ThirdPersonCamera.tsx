import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Euler, Vector3 } from "three";
import { useGameStore } from "../store/useGameStore";

const focus = new Vector3();
const desiredPosition = new Vector3();
const offset = new Vector3(0, 1.85, 5.1);
const rotation = new Euler(0, 0, 0, "YXZ");

export function ThirdPersonCamera() {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const adjustCamera = useGameStore((state) => state.adjustCamera);

  useEffect(() => {
    const element = gl.domElement;

    const onPointerDown = () => {
      if (document.pointerLockElement !== element) {
        void element.requestPointerLock();
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== element) {
        return;
      }

      adjustCamera(-event.movementX * 0.0026, -event.movementY * 0.002);
    };

    element.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("mousemove", onMouseMove);

    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("mousemove", onMouseMove);
    };
  }, [adjustCamera, gl]);

  useFrame((_, delta) => {
    const state = useGameStore.getState();
    const [x, y, z] = state.playerPosition;

    focus.set(x, y + 1.2, z);
    rotation.set(state.cameraPitch, state.cameraYaw, 0);
    desiredPosition.copy(offset).applyEuler(rotation).add(focus);
    camera.position.lerp(desiredPosition, 1 - Math.exp(-delta * 8));
    camera.lookAt(focus);
  });

  return null;
}
