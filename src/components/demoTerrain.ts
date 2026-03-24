import { Color, Float32BufferAttribute, PlaneGeometry, Vector3 } from "three";

export const DEMO_TERRAIN_WORLD_SIZE = 220;
export const DEMO_TERRAIN_SEGMENTS = 120;
export const DEMO_TERRAIN_SPAWN_X = 0;
export const DEMO_TERRAIN_SPAWN_Z = 18;
export const DEMO_TERRAIN_DUMMY_X = -22;
export const DEMO_TERRAIN_DUMMY_Z = -20;
export const DEMO_TERRAIN_CAPSULE_SPAWN_CLEARANCE = 0.88;
export const DEMO_TERRAIN_RAGDOLL_SPAWN_CLEARANCE = 2.75;
export const DEMO_TERRAIN_DUMMY_SPAWN_CLEARANCE = 4.2;

const normalSampleA = new Vector3();
const normalSampleB = new Vector3();
const normalSampleCenter = new Vector3();
const terrainNormal = new Vector3();
const terrainTangentX = new Vector3();
const terrainTangentZ = new Vector3();
const terrainBaseColor = new Color();
const terrainHighColor = new Color();
const terrainRockColor = new Color();
const terrainShadeColor = new Color();
const terrainLowlandColor = new Color();
const terrainColor = new Color();

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function hash2(x: number, z: number) {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function valueNoise2(x: number, z: number) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = x0 + 1;
  const z1 = z0 + 1;
  const sx = smoothstep(0, 1, x - x0);
  const sz = smoothstep(0, 1, z - z0);
  const n00 = hash2(x0, z0);
  const n10 = hash2(x1, z0);
  const n01 = hash2(x0, z1);
  const n11 = hash2(x1, z1);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sz;
}

function fbm2(x: number, z: number, octaves: number, lacunarity: number, gain: number) {
  let amplitude = 0.5;
  let frequency = 1;
  let sum = 0;
  let normalizer = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    sum += (valueNoise2(x * frequency, z * frequency) * 2 - 1) * amplitude;
    normalizer += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return normalizer > 0 ? sum / normalizer : 0;
}

function ridgeNoise2(x: number, z: number) {
  const warpedX = x + fbm2(x * 0.32, z * 0.32, 3, 2.1, 0.5) * 1.4;
  const warpedZ = z + fbm2(x * 0.34 + 8.2, z * 0.34 - 3.1, 3, 2.2, 0.5) * 1.4;
  const base = fbm2(warpedX, warpedZ, 4, 2.05, 0.52);
  return 1 - Math.abs(base);
}

function flattenPad(
  value: number,
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
  radius: number,
  blendRadius: number,
  targetHeight: number,
) {
  const distance = Math.hypot(x - centerX, z - centerZ);
  const blend = 1 - smoothstep(radius, radius + blendRadius, distance);
  return value * (1 - blend) + targetHeight * blend;
}

function sampleFeatureShapes(x: number, z: number) {
  const plateau =
    Math.exp(-((x - 34) ** 2 + (z + 18) ** 2) / (2 * 26 ** 2)) * 2.8;
  const shoulder =
    Math.exp(-((x + 42) ** 2 + (z - 28) ** 2) / (2 * 38 ** 2)) * 2.1;
  const valley =
    -Math.exp(-((x - 8) ** 2 + (z - 4) ** 2) / (2 * 70 ** 2)) * 1.9;
  const distantRise =
    Math.exp(-((x - 84) ** 2 + (z - 76) ** 2) / (2 * 54 ** 2)) * 1.7;

  return plateau + shoulder + valley + distantRise;
}

export function sampleDemoTerrainHeight(x: number, z: number) {
  const warpX = x + fbm2(x * 0.012 + 13.2, z * 0.012 - 4.7, 4, 2, 0.5) * 18;
  const warpZ = z + fbm2(x * 0.012 - 7.4, z * 0.012 + 5.3, 4, 2.1, 0.5) * 18;
  const broadSlope = z * -0.012;
  const continental = fbm2(warpX * 0.009, warpZ * 0.009, 5, 2.05, 0.5) * 5.6;
  const detail = fbm2(warpX * 0.032, warpZ * 0.032, 4, 2.15, 0.48) * 1.5;
  const ridgeNoise = ridgeNoise2(warpX * 0.028, warpZ * 0.028) * 3.2;
  const featureShapes = sampleFeatureShapes(x, z);
  const valleyCarve =
    -Math.exp(-((x + 6) ** 2 + (z - 6) ** 2) / (2 * 42 ** 2)) * 2.4;
  const shoulderLift =
    Math.exp(-((x - 52) ** 2 + (z - 44) ** 2) / (2 * 64 ** 2)) * 2.1;

  let height =
    broadSlope + continental + detail + ridgeNoise + featureShapes + valleyCarve + shoulderLift;

  const spawnTarget = 1.08;
  const dummyTarget = 0.92;
  height = flattenPad(
    height,
    x,
    z,
    DEMO_TERRAIN_SPAWN_X,
    DEMO_TERRAIN_SPAWN_Z,
    10,
    14,
    spawnTarget,
  );
  height = flattenPad(
    height,
    x,
    z,
    DEMO_TERRAIN_DUMMY_X,
    DEMO_TERRAIN_DUMMY_Z,
    8,
    10,
    dummyTarget,
  );

  return height;
}

export function sampleDemoTerrainNormal(
  x: number,
  z: number,
  sampleOffset = 0.75,
) {
  normalSampleCenter.set(x, sampleDemoTerrainHeight(x, z), z);
  normalSampleA.set(
    x + sampleOffset,
    sampleDemoTerrainHeight(x + sampleOffset, z),
    z,
  );
  normalSampleB.set(
    x,
    sampleDemoTerrainHeight(x, z + sampleOffset),
    z + sampleOffset,
  );
  terrainTangentX.subVectors(normalSampleA, normalSampleCenter);
  terrainTangentZ.subVectors(normalSampleB, normalSampleCenter);
  terrainNormal.crossVectors(terrainTangentZ, terrainTangentX).normalize();

  if (terrainNormal.y < 0) {
    terrainNormal.multiplyScalar(-1);
  }

  return terrainNormal.clone();
}

export function getDemoTerrainSpawnPosition(
  x: number,
  z: number,
  clearanceY: number,
): [number, number, number] {
  return [x, sampleDemoTerrainHeight(x, z) + clearanceY, z];
}

export function createDemoTerrainGeometry() {
  const geometry = new PlaneGeometry(
    DEMO_TERRAIN_WORLD_SIZE,
    DEMO_TERRAIN_WORLD_SIZE,
    DEMO_TERRAIN_SEGMENTS,
    DEMO_TERRAIN_SEGMENTS,
  );
  geometry.rotateX(-Math.PI / 2);

  const positionAttribute = geometry.getAttribute("position");
  const positions = positionAttribute.array as Float32Array;

  for (let index = 0; index < positions.length; index += 3) {
    const x = positions[index] ?? 0;
    const z = positions[index + 2] ?? 0;
    positions[index + 1] = sampleDemoTerrainHeight(x, z);
  }

  positionAttribute.needsUpdate = true;
  geometry.computeVertexNormals();

  const normalAttribute = geometry.getAttribute("normal");
  const normals = normalAttribute.array as Float32Array;
  const colors = new Float32Array((positions.length / 3) * 3);

  for (let index = 0; index < positions.length; index += 3) {
    const y = positions[index + 1] ?? 0;
    const slope = 1 - (normals[index + 1] ?? 1);
    const height01 = smoothstep(-4, 7.5, y);
    const rock01 = smoothstep(0.12, 0.4, slope);
    const lowland01 = 1 - smoothstep(-1, 3.2, y);

    terrainBaseColor.setRGB(0.28, 0.39, 0.23);
    terrainHighColor.setRGB(0.67, 0.63, 0.54);
    terrainRockColor.setRGB(0.43, 0.41, 0.38);
    terrainShadeColor.setRGB(0.2, 0.24, 0.18);
    terrainLowlandColor.setRGB(0.56, 0.48, 0.33);

    terrainColor.copy(terrainBaseColor).lerp(terrainHighColor, height01 * 0.72);
    terrainColor.lerp(terrainRockColor, rock01 * 0.88);
    terrainColor.lerp(terrainLowlandColor, lowland01 * 0.35);
    terrainColor.lerp(terrainShadeColor, slope * 0.16);

    colors[index] = terrainColor.r;
    colors[index + 1] = terrainColor.g;
    colors[index + 2] = terrainColor.b;
  }

  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const index = geometry.getIndex();
  if (!index) {
    throw new Error("Expected terrain geometry index data.");
  }

  return {
    geometry,
    colliderVertices: new Float32Array(positions),
    colliderIndices: new Uint32Array(index.array as ArrayLike<number>),
  };
}
