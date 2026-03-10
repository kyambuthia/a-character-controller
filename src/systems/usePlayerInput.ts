import { useEffect, useRef } from "react";

export type InputState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
  crouch: boolean;
};

const initialState: InputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  run: false,
  crouch: false,
};

const keyMap: Record<string, keyof InputState> = {
  ArrowUp: "forward",
  KeyW: "forward",
  ArrowDown: "backward",
  KeyS: "backward",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ShiftLeft: "run",
  ShiftRight: "run",
  ControlLeft: "crouch",
  ControlRight: "crouch",
  KeyC: "crouch",
};

export function usePlayerInput() {
  const stateRef = useRef<InputState>({ ...initialState });

  useEffect(() => {
    const handleKey = (pressed: boolean) => (event: KeyboardEvent) => {
      const mapped = keyMap[event.code];

      if (!mapped) {
        return;
      }

      stateRef.current[mapped] = pressed;
    };

    const handleBlur = () => {
      stateRef.current = { ...initialState };
    };

    const onKeyDown = handleKey(true);
    const onKeyUp = handleKey(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  return stateRef;
}
