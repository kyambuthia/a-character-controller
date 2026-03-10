import { create } from "zustand";

export type MovementMode = "idle" | "walk" | "run" | "crouch";

type Vec3Tuple = [number, number, number];

type GameState = {
  playerPosition: Vec3Tuple;
  playerFacing: number;
  movementMode: MovementMode;
  cameraYaw: number;
  cameraPitch: number;
  setPlayerSnapshot: (payload: {
    position: Vec3Tuple;
    facing: number;
    movementMode: MovementMode;
  }) => void;
  adjustCamera: (yawDelta: number, pitchDelta: number) => void;
};

export const useGameStore = create<GameState>((set) => ({
  playerPosition: [0, 1.2, 6],
  playerFacing: 0,
  movementMode: "idle",
  cameraYaw: Math.PI,
  cameraPitch: -0.22,
  setPlayerSnapshot: ({ position, facing, movementMode }) =>
    set({
      playerPosition: position,
      playerFacing: facing,
      movementMode,
    }),
  adjustCamera: (yawDelta, pitchDelta) =>
    set((state) => ({
      cameraYaw: state.cameraYaw + yawDelta,
      cameraPitch: Math.max(-1.1, Math.min(0.35, state.cameraPitch + pitchDelta)),
    })),
}));
