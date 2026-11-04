import { describe, expect, it } from "vitest";
import { solveFrontView, solveLoadTransfer, solveRollStiffness } from "@setuplab/physics";
import rawModel from "../../../assets/models/reference-touring-car.json";
import {
  buildAxleRates,
  buildFrontViewInput,
  buildLoadTransferInput,
  buildRollStiffnessInput,
  derivedGroundPlaneMm,
  inferredWheel,
  parseCarModel,
  reportedRollCentreHeightM,
  updateChassisRideHeight,
  updateChassisThickness,
  updateCornerPointMm,
  type CarModelDocument,
} from "../src/index.js";
import fieldPaths from "../src/schema/field-paths.json";

function parse(input: unknown): CarModelDocument {
  const parsed = parseCarModel(input);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function update(
  model: CarModelDocument,
  field: "ride_height" | "thickness",
  valueMm: number,
): CarModelDocument {
  const edited =
    field === "ride_height"
      ? updateChassisRideHeight(model, valueMm)
      : updateChassisThickness(model, valueMm);
  if (!edited.ok) throw new Error(JSON.stringify(edited.errors));
  return edited.value;
}

function movePoint(
  model: CarModelDocument,
  corner: "LF" | "LR",
  zMm: number,
): CarModelDocument {
  const edited = updateCornerPointMm(model, corner, "wc", 2, zMm);
  if (!edited.ok) throw new Error(JSON.stringify(edited.errors));
  return edited.value;
}

function defined(value: unknown): number {
  const solved = value as { kind?: string; value?: number };
  if (solved.kind !== "defined" || solved.value === undefined) {
    throw new Error(`expected a defined value, got ${String(solved.kind)}`);
  }
  return solved.value;
}

function frontRollCentreMm(model: CarModelDocument): number {
  const input = buildFrontViewInput(model, "LF");
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  const heightM = reportedRollCentreHeightM(model, solveFrontView(input.value));
  if (heightM === null) throw new Error("front roll centre is not defined");
  return heightM * 1000;
}

function rearRollCentreMm(model: CarModelDocument): number {
  const input = buildFrontViewInput(model, "LR");
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  const heightM = reportedRollCentreHeightM(model, solveFrontView(input.value));
  if (heightM === null) throw new Error("rear roll centre is not defined");
  return heightM * 1000;
}

function rates(model: CarModelDocument, axle: "front" | "rear") {
  const result = buildAxleRates(model, axle);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

describe("chassis ride height and plate thickness", () => {
  it("moves both roll-centre heights by exactly +1 mm for a 1 mm ride-height change and leaves the rates bit-identical", () => {
    const base = parse(rawModel);
    const raised = update(base, "ride_height", 6.0);

    expect(derivedGroundPlaneMm(raised)).toBeCloseTo(-8.0, 12);
    expect(frontRollCentreMm(raised) - frontRollCentreMm(base)).toBeCloseTo(1.0, 12);
    expect(rearRollCentreMm(raised) - rearRollCentreMm(base)).toBeCloseTo(1.0, 12);

    for (const axle of ["front", "rear"] as const) {
      const before = rates(base, axle);
      const after = rates(raised, axle);
      expect(defined(after.wheelRate)).toBeCloseTo(defined(before.wheelRate), 12);
      expect(defined(after.rideFrequency)).toBeCloseTo(defined(before.rideFrequency), 12);
    }

    for (const corner of ["LF", "LR"] as const) {
      const baseInput = buildFrontViewInput(base, corner);
      const raisedInput = buildFrontViewInput(raised, corner);
      if (!baseInput.ok || !raisedInput.ok) throw new Error("front-view input refused");
      expect(defined(solveFrontView(raisedInput.value).camberGain)).toBeCloseTo(
        defined(solveFrontView(baseInput.value).camberGain),
        12,
      );
    }

    expect(JSON.stringify(raised.corners.LF?.points)).toBe(
      JSON.stringify(base.corners.LF?.points),
    );
    expect(JSON.stringify(raised.corners.LR?.points)).toBe(
      JSON.stringify(base.corners.LR?.points),
    );
  });

  it("worked example: ride height 5.0 → 6.0 mm moves both ends and both inferred diameters by the documented amount", () => {
    const base = parse(rawModel);
    const raised = update(base, "ride_height", 6.0);

    expect(frontRollCentreMm(base)).toBeCloseTo(9.9749, 4);
    expect(frontRollCentreMm(raised)).toBeCloseTo(10.9749, 4);
    expect(rearRollCentreMm(base)).toBeCloseTo(17.8985, 4);
    expect(rearRollCentreMm(raised)).toBeCloseTo(18.8985, 4);

    expect(inferredWheel(base, "front").inferredDiameterMm).toBeCloseTo(64.0, 12);
    expect(inferredWheel(base, "rear").inferredDiameterMm).toBeCloseTo(64.0, 12);
    expect(inferredWheel(raised, "front").inferredDiameterMm).toBeCloseTo(66.0, 12);
    expect(inferredWheel(raised, "rear").inferredDiameterMm).toBeCloseTo(66.0, 12);
  });

  it("moves the roll-centre heights by exactly +1 mm when the plate thickens, and only thickness + ride height reaches the ground plane", () => {
    const base = parse(rawModel);
    const thicker = update(base, "thickness", 3.0);

    expect(derivedGroundPlaneMm(thicker)).toBeCloseTo(-8.0, 12);
    expect(frontRollCentreMm(thicker) - frontRollCentreMm(base)).toBeCloseTo(1.0, 12);
    expect(rearRollCentreMm(thicker) - rearRollCentreMm(base)).toBeCloseTo(1.0, 12);

    const plateHeavy = update(update(base, "ride_height", 7.0), "thickness", 1.0);
    const shimHeavy = update(update(base, "ride_height", 3.0), "thickness", 5.0);

    expect(derivedGroundPlaneMm(plateHeavy)).toBeCloseTo(
      derivedGroundPlaneMm(shimHeavy) ?? 0,
      12,
    );
    const plateInput = buildFrontViewInput(plateHeavy, "LF");
    const shimInput = buildFrontViewInput(shimHeavy, "LF");
    if (!plateInput.ok || !shimInput.ok) throw new Error("front-view input refused");
    expect(plateInput.value.lcaIn_m.value.z).toBeCloseTo(
      shimInput.value.lcaIn_m.value.z,
      12,
    );

    const tyreChangedRaw = JSON.parse(JSON.stringify(rawModel)) as {
      axles: { front: { tyre_radius: { value: number } } };
    };
    tyreChangedRaw.axles.front.tyre_radius.value = 36;
    expect(derivedGroundPlaneMm(parse(tyreChangedRaw))).toBeCloseTo(
      derivedGroundPlaneMm(base) ?? 0,
      12,
    );
  });

  it("computes each axle's wheel diameter from the wheel centre and ground plane, never from the stored tyre radius", () => {
    const base = parse(rawModel);
    const frontBase = inferredWheel(base, "front");
    const rearBase = inferredWheel(base, "rear");

    expect(frontBase?.heightAboveGroundMm).toBeCloseTo(32.0, 12);
    expect(frontBase?.inferredDiameterMm).toBeCloseTo(64.0, 12);
    expect(rearBase?.inferredDiameterMm).toBeCloseTo(64.0, 12);

    const moved = movePoint(base, "LF", 27.0);
    const frontMoved = inferredWheel(moved, "front");
    const rearMoved = inferredWheel(moved, "rear");

    expect(frontMoved?.inferredRadiusMm).toBeCloseTo(34.0, 12);
    expect(frontMoved?.inferredDiameterMm).toBeCloseTo(68.0, 12);
    expect(frontMoved?.storedTyreRadiusMm).toBeCloseTo(32.0, 12);
    expect(rearMoved?.inferredDiameterMm).toBeCloseTo(64.0, 12);
    expect(derivedGroundPlaneMm(moved)).toBeCloseTo(derivedGroundPlaneMm(base) ?? 0, 12);
    expect(moved.corners.LF?.points.lca_out?.value).toEqual(
      base.corners.LF?.points.lca_out?.value,
    );
    expect(moved.axles.front.tyreRadius?.value).toBe(base.axles.front.tyreRadius?.value);

    const raised = update(base, "ride_height", 6.0);
    expect(inferredWheel(raised, "front")?.inferredDiameterMm).toBeCloseTo(66.0, 12);
    expect(inferredWheel(raised, "rear")?.inferredDiameterMm).toBeCloseTo(66.0, 12);
  });

  it("has no car-model schema path, document key or exported edit for a user-supplied wheel diameter", async () => {
    const base = parse(rawModel);
    expect(
      fieldPaths.carModel.some((path) => /(wheel|tyre|tire).*diameter/i.test(path)),
    ).toBe(false);
    expect(JSON.stringify(base.raw)).not.toMatch(/(wheel|tyre|tire)[^"]*diameter/i);
    expect("wheelDiameter" in base).toBe(false);
    const data = await import("../src/index.js");
    expect(
      Object.keys(data).filter((name) => /(wheel|tyre|tire).*diameter/i.test(name)),
    ).toEqual([]);
  });

  it("surfaces the inferred-vs-recorded wheel note above 0.5 mm and stays silent below it", () => {
    const base = parse(rawModel);
    expect(inferredWheel(base, "front")?.consistencyMessage).toBeNull();

    const above = movePoint(base, "LF", 26.0);
    const message = inferredWheel(above, "front")?.consistencyMessage ?? "";
    expect(message).toContain("66.0 mm across");
    expect(message).toContain("records 64.0 mm");
    expect(message).toContain("check the wheel centre height or the ride height");

    const below = movePoint(base, "LF", 25.4);
    expect(inferredWheel(below, "front")?.consistencyMessage).toBeNull();

    const raised = update(base, "ride_height", 6.0);
    expect(inferredWheel(raised, "front")?.consistencyMessage).toContain("66.0 mm across");
  });

  it("keeps the reference car's own golden values", () => {
    const base = parse(rawModel);
    const frontRates = rates(base, "front");
    const rollInput = buildRollStiffnessInput(base);
    if (!rollInput.ok) throw new Error(JSON.stringify(rollInput.errors));
    const roll = solveRollStiffness(rollInput.value);
    const transferInput = buildLoadTransferInput(base, 9.81);
    if (!transferInput.ok) throw new Error(JSON.stringify(transferInput.errors));
    const transfer = solveLoadTransfer(transferInput.value);

    expect(frontRollCentreMm(base)).toBeCloseTo(9.9749, 4);
    expect(rearRollCentreMm(base)).toBeCloseTo(17.8985, 4);
    expect(defined(frontRates.wheelRate) / 1000).toBeCloseTo(1.11851, 4);
    expect(defined(frontRates.rideFrequency)).toBeCloseTo(10.781, 3);
    expect(defined(roll.frontShare) * 100).toBeCloseTo(62.11, 2);
    expect(defined(transfer.balance) * 100).toBeCloseTo(47.46, 2);
  });
});
