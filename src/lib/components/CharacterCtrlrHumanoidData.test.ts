import { describe, expect, it } from "vitest";
import {
  CHARACTER_CTRLR_HUMANOID_BODY_DEFINITIONS,
  CHARACTER_CTRLR_HUMANOID_JOINT_DEFINITIONS,
  deriveCharacterCtrlrHumanoidBodyDensity,
} from "./CharacterCtrlrHumanoidData";

describe("CHARACTER_CTRLR_HUMANOID_JOINT_DEFINITIONS", () => {
  it("keeps every joint anchor aligned in the bind pose", () => {
    const bodyPositions = Object.fromEntries(
      CHARACTER_CTRLR_HUMANOID_BODY_DEFINITIONS.map((body) => [body.key, body.position]),
    );

    for (const joint of CHARACTER_CTRLR_HUMANOID_JOINT_DEFINITIONS) {
      const bodyAPosition = bodyPositions[joint.bodyA];
      const bodyBPosition = bodyPositions[joint.bodyB];
      const worldAnchorA = joint.anchorA.map(
        (value, index) => value + bodyAPosition[index],
      );
      const worldAnchorB = joint.anchorB.map(
        (value, index) => value + bodyBPosition[index],
      );
      const alignmentError = Math.hypot(
        worldAnchorA[0] - worldAnchorB[0],
        worldAnchorA[1] - worldAnchorB[1],
        worldAnchorA[2] - worldAnchorB[2],
      );

      expect(
        alignmentError,
        `${joint.key} starts with ${alignmentError.toFixed(4)}m of anchor preload`,
      ).toBeLessThan(1e-6);
    }
  });

  it("keeps the head collider clear of the chest in the bind pose", () => {
    const chest = CHARACTER_CTRLR_HUMANOID_BODY_DEFINITIONS.find((body) => body.key === "chest");
    const head = CHARACTER_CTRLR_HUMANOID_BODY_DEFINITIONS.find((body) => body.key === "head");

    expect(chest).toBeDefined();
    expect(head).toBeDefined();

    if (!chest || !head || chest.shape.kind !== "box" || head.shape.kind !== "sphere") {
      return;
    }

    const chestTop = chest.position[1] + chest.shape.size[1] * 0.5;
    const headBottom = head.position[1] - head.shape.radius;

    expect(headBottom - chestTop).toBeGreaterThanOrEqual(0.03);
  });
});

describe("deriveCharacterCtrlrHumanoidBodyDensity", () => {
  it("gives each auto-generated collider its body's defined mass", async () => {
    // Build the collider exactly as @react-three/rapier's auto-collider would (the shape's own box
    // or sphere) with the derived density, and read back Rapier's mass.
    const RAPIER = (await import("@dimforge/rapier3d-compat")).default;
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

    for (const definition of CHARACTER_CTRLR_HUMANOID_BODY_DEFINITIONS) {
      expect(definition.collider).toBe(definition.shape.kind === "sphere" ? "ball" : "cuboid");
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
      const desc =
        definition.shape.kind === "sphere"
          ? RAPIER.ColliderDesc.ball(definition.shape.radius)
          : RAPIER.ColliderDesc.cuboid(
              definition.shape.size[0] / 2,
              definition.shape.size[1] / 2,
              definition.shape.size[2] / 2,
            );
      world.createCollider(desc.setDensity(deriveCharacterCtrlrHumanoidBodyDensity(definition)), body);

      expect(body.mass(), definition.key).toBeCloseTo(definition.mass, 3);
    }

    world.free();
  });
});
