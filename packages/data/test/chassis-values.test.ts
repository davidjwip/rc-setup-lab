import { describe, expect, it } from 'vitest';
import { solveFrontView, solveLoadTransfer, solveRollStiffness } from '@setuplab/physics';
import rawModel from '../../../assets/models/reference-touring-car.json';
import {
  absoluteCornerPointMm,
  buildAxleRates,
  buildFrontViewInput,
  buildLoadTransferInput,
  buildRollStiffnessInput,
  derivedGroundPlaneMm,
  hubCentreMm,
  inferredWheel,
  parseCarModel,
  reportedRollCentreHeightM,
  updateChassisRideHeight,
  updateChassisThickness,
  updateWheelDiameter,
  wheelSize,
  type CarModelDocument,
} from '../src/index.js';
import fieldPaths from '../src/schema/field-paths.json';

function parse(input: unknown): CarModelDocument {
  const parsed = parseCarModel(input);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function update(
  model: CarModelDocument,
  field: 'ride_height' | 'thickness',
  valueMm: number,
): CarModelDocument {
  const edited =
    field === 'ride_height'
      ? updateChassisRideHeight(model, valueMm)
      : updateChassisThickness(model, valueMm);
  if (!edited.ok) throw new Error(JSON.stringify(edited.errors));
  return edited.value;
}

function defined(value: unknown): number {
  const solved = value as { kind?: string; value?: number };
  if (solved.kind !== 'defined' || solved.value === undefined) {
    throw new Error(`expected a defined value, got ${String(solved.kind)}`);
  }
  return solved.value;
}

function frontRollCentreMm(model: CarModelDocument): number {
  const input = buildFrontViewInput(model, 'LF');
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  const heightM = reportedRollCentreHeightM(model, solveFrontView(input.value));
  if (heightM === null) throw new Error('front roll centre is not defined');
  return heightM * 1000;
}

function rearRollCentreMm(model: CarModelDocument): number {
  const input = buildFrontViewInput(model, 'LR');
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  const heightM = reportedRollCentreHeightM(model, solveFrontView(input.value));
  if (heightM === null) throw new Error('rear roll centre is not defined');
  return heightM * 1000;
}

function rates(model: CarModelDocument, axle: 'front' | 'rear') {
  const result = buildAxleRates(model, axle);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const CHASSIS_POINTS = [
  'lca_in_a',
  'lca_in_b',
  'uca_in',
  'tie_in',
  'damper_lo',
  'damper_up',
  'arb_drop',
] as const;
const OUTBOARD_POINTS = ['lca_out', 'uca_out', 'tie_out'] as const;

describe('chassis values place the derived hub', () => {
  it('moves the hub and every outboard point down 1 mm for a 1 mm ride-height rise, leaving every chassis point unchanged', () => {
    const base = parse(rawModel);
    const raised = update(base, 'ride_height', 6.0);

    expect(derivedGroundPlaneMm(raised)).toBeCloseTo(-8.0, 12);
    const baseHub = hubCentreMm(base, 'LF');
    const raisedHub = hubCentreMm(raised, 'LF');
    if (baseHub === null || raisedHub === null) throw new Error('hub missing');
    expect(raisedHub.z - baseHub.z).toBeCloseTo(-1, 12);

    for (const corner of ['LF', 'LR'] as const) {
      for (const key of OUTBOARD_POINTS) {
        const before = absoluteCornerPointMm(base, corner, key);
        const after = absoluteCornerPointMm(raised, corner, key);
        if (before === null || after === null) throw new Error('outboard missing');
        expect(after.value[2]).toBeCloseTo(before.value[2] - 1, 12);
      }
      for (const key of CHASSIS_POINTS) {
        expect(JSON.stringify(raised.corners[corner]?.points[key])).toBe(
          JSON.stringify(base.corners[corner]?.points[key]),
        );
      }
    }

    // The arm has rotated, so the roll centre follows the geometry rather than +1 mm.
    expect(frontRollCentreMm(raised)).not.toBeCloseTo(frontRollCentreMm(base) + 1, 6);
    expect(rearRollCentreMm(raised)).not.toBeCloseTo(rearRollCentreMm(base) + 1, 6);
  });

  it('moves the derived ground plane by the plate thickness and lets the arms decide the roll-centre change', () => {
    const base = parse(rawModel);
    const thicker = update(base, 'thickness', 3.0);

    expect(derivedGroundPlaneMm(thicker)).toBeCloseTo(-8.0, 12);
    expect(frontRollCentreMm(thicker)).not.toBeCloseTo(frontRollCentreMm(base) + 1, 6);
    expect(rearRollCentreMm(thicker)).not.toBeCloseTo(rearRollCentreMm(base) + 1, 6);
  });

  it('raises the hub and outboard points when the wheel diameter grows and leaves the ride height alone', () => {
    const base = parse(rawModel);
    const bigger = updateWheelDiameter(base, 'front', 66.0);
    if (!bigger.ok) throw new Error(JSON.stringify(bigger.errors));

    expect(bigger.value.referenceRideHeight?.value).toBeCloseTo(5.0, 12);
    const baseHub = hubCentreMm(base, 'LF');
    const bigHub = hubCentreMm(bigger.value, 'LF');
    if (baseHub === null || bigHub === null) throw new Error('hub missing');
    expect(bigHub.z - baseHub.z).toBeCloseTo(1, 12);

    const before = absoluteCornerPointMm(base, 'LF', 'uca_out');
    const after = absoluteCornerPointMm(bigger.value, 'LF', 'uca_out');
    if (before === null || after === null) throw new Error('outboard missing');
    expect(after.value[2] - before.value[2]).toBeCloseTo(1, 12);

    for (const key of CHASSIS_POINTS) {
      expect(JSON.stringify(bigger.value.corners.LF?.points[key])).toBe(
        JSON.stringify(base.corners.LF?.points[key]),
      );
    }
  });

  it('reports the stored radius as the wheel-centre height above ground, with no second diameter to disagree with it', () => {
    const base = parse(rawModel);
    for (const axle of ['front', 'rear'] as const) {
      const wheel = wheelSize(base, axle);
      if (wheel === null) throw new Error('wheel missing');
      expect(wheel.heightAboveGroundMm).toBeCloseTo(wheel.radiusMm, 12);
      expect(wheel.diameterMm).toBeCloseTo(64.0, 12);
      expect(inferredWheel(base, axle).consistencyMessage).toBeNull();
      expect(inferredWheel(base, axle).inferredDiameterMm).toBeCloseTo(64.0, 12);
    }

    const raised = update(base, 'ride_height', 6.0);
    expect(wheelSize(raised, 'front')?.heightAboveGroundMm).toBeCloseTo(32.0, 12);
    expect(inferredWheel(raised, 'front').inferredDiameterMm).toBeCloseTo(64.0, 12);
  });

  it('still has no schema path or document key for a separate wheel-diameter field', () => {
    const base = parse(rawModel);
    expect(
      fieldPaths.carModel.some((path) => /(wheel|tyre|tire).*diameter/i.test(path)),
    ).toBe(false);
    expect(JSON.stringify(base.raw)).not.toMatch(/(wheel|tyre|tire)[^"]*diameter/i);
    expect('wheelDiameter' in base).toBe(false);
  });

  it('keeps the reference car own golden values', () => {
    const base = parse(rawModel);
    const frontRates = rates(base, 'front');
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
