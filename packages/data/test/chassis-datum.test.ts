import { describe, expect, it } from "vitest";
import {
  solveFrontView,
  solveLoadTransfer,
  solveRollStiffness,
} from "@setuplab/physics";
import rawModel from "../../../assets/models/reference-touring-car.json";
import {
  CURRENT_SCHEMA_VERSION,
  buildAxleRates,
  buildFrontViewInput,
  buildLoadTransferInput,
  buildRollStiffnessInput,
  chassisDatum,
  derivedGroundPlaneMm,
  impliedRideHeightMm,
  parseCarModel,
  parseCarModelJson,
  reportedRollCentreHeightM,
  rideHeightConsistency,
  wheelGroundPlaneMm,
  type CarModelDocument,
} from "../src/index.js";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parse(input: unknown): CarModelDocument {
  const parsed = parseCarModel(input);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function frontResult(model: CarModelDocument) {
  const input = buildFrontViewInput(model, "LF");
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  return solveFrontView(input.value);
}

function rearResult(model: CarModelDocument) {
  const input = buildFrontViewInput(model, "LR");
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  return solveFrontView(input.value);
}

function defined(value: unknown): number {
  const solved = value as { kind?: string; value?: number };
  if (solved.kind !== "defined" || solved.value === undefined) {
    throw new Error(`expected a defined value, got ${String(solved.kind)}`);
  }
  return solved.value;
}

const DEG_PER_MM = 180 / Math.PI / 1000;

/** A v1.0.0 document: every z is from the ground plane, and it has no thickness row. */
function legacyGroundDocument(): Record<string, unknown> {
  const legacy = clone(rawModel) as Record<string, unknown>;
  const offsetMm = 2.0 + 5.0;
  legacy["schema_version"] = "1.0.0";
  (legacy["frame"] as Record<string, unknown>)["origin"] =
    "ground plane, rear axle centre, vehicle centreline";

  const corners = legacy["corners"] as Record<string, Record<string, unknown>>;
  for (const corner of Object.values(corners)) {
    const points = corner["points"] as Record<string, { value: number[] }>;
    for (const point of Object.values(points)) {
      point.value[2] = (point.value[2] ?? 0) + offsetMm;
    }
  }

  const body = legacy["body"] as Record<string, unknown>;
  const cg = body["cg"] as Record<string, { value: number }>;
  cg["height"]!.value += offsetMm;
  cg["unsprung_height"]!.value += offsetMm;
  delete body["chassis"];
  return legacy;
}

describe("chassis datum", () => {
  it("keeps all eight ground-frame results bit-identical after migrating a v1 document", () => {
    const model = parse(legacyGroundDocument());

    expect(model.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(model.sources["s_datum_migration"]?.type).toBe("derived");

    const front = frontResult(model);
    const rear = rearResult(model);
    const frontRatesResult = buildAxleRates(model, "front");
    if (!frontRatesResult.ok)
      throw new Error(JSON.stringify(frontRatesResult.errors));
    const frontRates = frontRatesResult.value;

    const rollInput = buildRollStiffnessInput(model);
    if (!rollInput.ok) throw new Error(JSON.stringify(rollInput.errors));
    const roll = solveRollStiffness(rollInput.value);

    const transferInput = buildLoadTransferInput(model, 9.81);
    if (!transferInput.ok)
      throw new Error(JSON.stringify(transferInput.errors));
    const transfer = solveLoadTransfer(transferInput.value);

    expect(defined(front.rollCentreHeight) * 1000).toBeCloseTo(9.9749, 4);
    expect(defined(front.camberGain) * DEG_PER_MM).toBeCloseTo(-0.109816, 6);
    expect(defined(rear.rollCentreHeight) * 1000).toBeCloseTo(17.8985, 4);
    expect(defined(rear.camberGain) * DEG_PER_MM).toBeCloseTo(-0.2568, 4);
    expect(defined(frontRates.wheelRate) / 1000).toBeCloseTo(1.11851, 4);
    expect(defined(frontRates.rideFrequency)).toBeCloseTo(10.781, 3);
    expect(defined(roll.frontShare) * 100).toBeCloseTo(61.11, 2);
    expect(defined(transfer.balance) * 100).toBeCloseTo(47.01, 2);
  });

  it("migrates a v1 document once and round-trips its numbers through export and reload", () => {
    const once = parse(legacyGroundDocument());
    const exported = JSON.stringify(once.raw);
    const twice = parseCarModelJson(exported);
    expect(twice.ok).toBe(true);
    if (!twice.ok) return;

    expect(twice.value.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(twice.value.corners.LF?.points.wc?.value).toEqual(
      once.corners.LF?.points.wc?.value,
    );
    expect(twice.value.corners.LR?.points.lca_out?.value).toEqual(
      once.corners.LR?.points.lca_out?.value,
    );
    expect(twice.value.chassisThickness?.value).toBeCloseTo(2.0, 12);

    expect(defined(frontResult(twice.value).rollCentreHeight)).toBeCloseTo(
      defined(frontResult(once).rollCentreHeight),
      12,
    );
    expect(defined(frontResult(twice.value).camberGain)).toBeCloseTo(
      defined(frontResult(once).camberGain),
      12,
    );
  });

  it("moves the wheel-derived ground and the reported RC when the tyre radius grows, without touching a hardpoint", () => {
    const base = parse(rawModel);
    const bigger = clone(rawModel) as unknown as Record<string, any>;
    bigger["axles"]["front"]["tyre_radius"]["value"] = 33;
    const changed = parse(bigger);

    expect(changed.corners.LF?.points.wc?.value).toEqual(
      base.corners.LF?.points.wc?.value,
    );
    expect(changed.corners.LR?.points.wc?.value).toEqual(
      base.corners.LR?.points.wc?.value,
    );
    expect(changed.corners.LF?.points.lca_out?.value).toEqual(
      base.corners.LF?.points.lca_out?.value,
    );

    expect(wheelGroundPlaneMm(changed)).toBeCloseTo(
      (wheelGroundPlaneMm(base) ?? 0) - 1,
      12,
    );
    expect(
      reportedRollCentreHeightM(changed, frontResult(changed)),
    ).not.toBeCloseTo(
      reportedRollCentreHeightM(base, frontResult(base)) ?? 0,
      6,
    );
  });

  it("moves the derived ground plane and the reported RC by exactly 0.5 mm when the plate thickens", () => {
    const thinRaw = clone(rawModel) as unknown as Record<string, any>;
    thinRaw["body"]["chassis"]["thickness"]["value"] = 2.5;
    const thin = parse(thinRaw);

    const thickRaw = clone(rawModel) as unknown as Record<string, any>;
    thickRaw["body"]["chassis"]["thickness"]["value"] = 3.0;
    const thick = parse(thickRaw);

    expect(derivedGroundPlaneMm(thick)).toBeCloseTo(
      (derivedGroundPlaneMm(thin) ?? 0) - 0.5,
      12,
    );
    expect(
      (reportedRollCentreHeightM(thick, frontResult(thick)) ?? 0) -
        (reportedRollCentreHeightM(thin, frontResult(thin)) ?? 0),
    ).toBeCloseTo(0.0005, 12);
  });

  it("surfaces a ride-height disagreement above 0.5 mm and stays quiet below it", () => {
    const base = parse(rawModel);
    expect(rideHeightConsistency(base).message).toBeNull();

    const aboveRaw = clone(rawModel) as unknown as Record<string, any>;
    aboveRaw["axles"]["front"]["tyre_radius"]["value"] = 36;
    const above = parse(aboveRaw);
    const aboveCheck = rideHeightConsistency(above);
    expect(aboveCheck.mismatchMm).toBeCloseTo(4, 12);
    expect(aboveCheck.message).toContain("Ride height says 5.0 mm");
    expect(aboveCheck.message).toContain("imply 9.0 mm");

    const belowRaw = clone(rawModel) as unknown as Record<string, any>;
    belowRaw["axles"]["front"]["tyre_radius"]["value"] = 32.4;
    const below = parse(belowRaw);
    expect(rideHeightConsistency(below).mismatchMm).toBeCloseTo(0.4, 12);
    expect(rideHeightConsistency(below).message).toBeNull();

    const datum = chassisDatum(base);
    expect(datum?.groundPlaneMm).toBeCloseTo(-7, 12);
    expect(impliedRideHeightMm(base)).toBeCloseTo(5, 12);
  });
});
