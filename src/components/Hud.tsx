import { useGameStore } from "../store/useGameStore";

export function Hud() {
  const movementMode = useGameStore((state) => state.movementMode);

  return (
    <div className="hud">
      <h1>Mwendo Prototype</h1>
      <p>
        Prototype goal: validate third-person movement, chase camera feel, flatspace
        traversal, and a physics ragdoll before layering authored animation.
      </p>
      <div className="mode">
        <span className="swatch" />
        <span>Mode: {movementMode}</span>
      </div>
      <ul>
        <li>Click the scene to lock the camera.</li>
        <li>Move with WASD or arrow keys.</li>
        <li>Hold Shift to run and Ctrl or C to crouch.</li>
        <li>Walk into the crates, ramp, and ragdoll to test collisions.</li>
      </ul>
    </div>
  );
}
