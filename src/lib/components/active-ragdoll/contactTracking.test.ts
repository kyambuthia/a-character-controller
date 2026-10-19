import { describe, expect, it } from "vitest";
import { measureContactSupport } from "./contactTracking";
import { createHeadlessRig, HEADLESS_TIME_STEP } from "./testing/headlessRig";

describe("measureContactSupport", () => {
  it("reports a foot resting on the ground as supported, whichever way the pair is ordered", async () => {
    const rig = await createHeadlessRig();
    for (let step = 0; step < Math.round(1 / HEADLESS_TIME_STEP); step += 1) {
      rig.step();
    }

    const foot = rig.bodies.footLeft.collider(0);
    const ground = rig.world.getCollider(rig.groundHandle);

    expect(measureContactSupport(rig.world, foot, ground)).toBeGreaterThan(0.9);
    // From the ground's side the foot pushes down on it.
    expect(measureContactSupport(rig.world, ground, foot)).toBeLessThan(-0.9);
  });

  it("returns null when the colliders are not touching", async () => {
    const rig = await createHeadlessRig();
    const head = rig.bodies.head.collider(0);
    const ground = rig.world.getCollider(rig.groundHandle);
    rig.step();

    expect(measureContactSupport(rig.world, head, ground)).toBeNull();
  });
});
