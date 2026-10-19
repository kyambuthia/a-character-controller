import { describe, expect, it } from "vitest";
import { advanceStandingFootPlant } from "./standing";
import type { StandingFootPlant } from "./controllerTypes";

const STEP = 1 / 60;

function simulatePlant(seconds: number, facing: number, turnInPlaceRequested = false) {
  let plant: StandingFootPlant | null = null;
  let supportCenter: [number, number, number] = [2, 0, -3];
  const first = advanceStandingFootPlant({
    currentPlant: null,
    supportCenter,
    supportPlaneY: 0,
    facing,
    delta: STEP,
    turnInPlaceRequested,
  });
  plant = first;

  for (let step = 0; step < seconds / STEP; step += 1) {
    // Feed back the feet's own centre as the new support centre, like the player does each step.
    supportCenter = [
      (plant.left[0] + plant.right[0]) / 2,
      0,
      (plant.left[2] + plant.right[2]) / 2,
    ];
    plant = advanceStandingFootPlant({
      currentPlant: plant,
      supportCenter,
      supportPlaneY: 0,
      facing,
      delta: STEP,
      turnInPlaceRequested,
    });
  }

  return { first, last: plant };
}

describe("standing foot plant", () => {
  it("does not creep when the support centre is fed back from the feet", () => {
    const { first, last } = simulatePlant(10, 0.4);

    expect(last.left[0]).toBeCloseTo(first.left[0], 6);
    expect(last.left[2]).toBeCloseTo(first.left[2], 6);
    expect(last.right[0]).toBeCloseTo(first.right[0], 6);
    expect(last.right[2]).toBeCloseTo(first.right[2], 6);
  });

  it("keeps the first anchor", () => {
    const { first, last } = simulatePlant(2, 0);

    expect(last.anchor).toEqual(first.anchor);
  });

  it("places the feet ahead of the ankle line and the sole height one foot-half above the plane", () => {
    const { first } = simulatePlant(0, 0);

    // facing 0 is +Z; the foot box centre sits 0.14 m ahead of the ankle line.
    expect(first.left[2] - first.anchor[1]).toBeCloseTo(0.14, 6);
    expect(first.left[1]).toBeCloseTo(0.08, 6);
  });
});
