import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group } from "three";

const STAR_SHELL_INNER_RADIUS = 110;
const STAR_SHELL_OUTER_RADIUS = 150;
const STAR_COUNT = 5200;
const BRIGHT_STAR_COUNT = 180;

function createStarGeometry(count: number, minRadius: number, maxRadius: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const z = Math.random() * 2 - 1;
    const azimuth = Math.random() * Math.PI * 2;
    const radial = Math.sqrt(Math.max(0, 1 - z * z));
    const directionX = Math.cos(azimuth) * radial;
    const directionY = z;
    const directionZ = Math.sin(azimuth) * radial;
    const radius = minRadius + Math.random() * (maxRadius - minRadius);

    positions[offset] = directionX * radius;
    positions[offset + 1] = directionY * radius;
    positions[offset + 2] = directionZ * radius;

    const hue = Math.random();
    const warmMix = hue < 0.18 ? 1 : 0;
    const coolMix = hue > 0.84 ? 1 : 0;
    const brightness = 0.62 + Math.random() * 0.38;

    const red = (0.82 + warmMix * 0.18 + coolMix * -0.06) * brightness;
    const green = (0.84 + warmMix * 0.08 + coolMix * -0.02) * brightness;
    const blue = (0.9 + warmMix * -0.12 + coolMix * 0.1) * brightness;

    colors[offset] = Math.min(1, red);
    colors[offset + 1] = Math.min(1, green);
    colors[offset + 2] = Math.min(1, blue);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export function DemoPlanetBackdrop() {
  const { camera } = useThree();
  const skyRef = useRef<Group>(null);
  const starGeometry = useMemo(
    () => createStarGeometry(STAR_COUNT, STAR_SHELL_INNER_RADIUS, STAR_SHELL_OUTER_RADIUS),
    [],
  );
  const brightStarGeometry = useMemo(
    () => createStarGeometry(BRIGHT_STAR_COUNT, STAR_SHELL_INNER_RADIUS, STAR_SHELL_OUTER_RADIUS),
    [],
  );

  useFrame(() => {
    if (!skyRef.current) {
      return;
    }

    skyRef.current.position.copy(camera.position);
  });

  return (
    <group ref={skyRef}>
      <points geometry={starGeometry} frustumCulled={false}>
        <pointsMaterial
          color="#ffffff"
          size={0.8}
          sizeAttenuation={false}
          vertexColors
          transparent
          opacity={0.72}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </points>

      <points geometry={brightStarGeometry} frustumCulled={false}>
        <pointsMaterial
          color="#ffffff"
          size={1.45}
          sizeAttenuation={false}
          vertexColors
          transparent
          opacity={0.82}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </points>

      <mesh position={[140, 92, -110]}>
        <sphereGeometry args={[13, 28, 28]} />
        <meshBasicMaterial color="#f8e8be" transparent opacity={0.96} />
      </mesh>

      <mesh position={[140, 92, -110]} scale={1.6}>
        <sphereGeometry args={[13, 20, 20]} />
        <meshBasicMaterial color="#f6d18c" transparent opacity={0.08} depthWrite={false} />
      </mesh>
    </group>
  );
}
