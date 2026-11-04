import { describe, expect, it } from 'vitest';
import { solveFrontView, solveLoadTransfer, solveRollStiffness } from '@setuplab/physics';
import rawModel from '../../../assets/models/reference-touring-car.json';
import {
  CURRENT_SCHEMA_VERSION,
  absoluteCornerPointMm,
  buildAxleRates,
  buildFrontViewInput,
  buildLoadTransferInput,
  buildRollStiffnessInput,
  chassisDatum,
  hubCentreMm,
  isHubFixedPointKey,
  parseCarModel,
  reportedRollCentreHeightM,
  updateChassisRideHeight,
  updateCornerPointMm,
  updateWheelDiameter,
  wheelSize,
  type CarModelDocument,
  type CornerKey,
  type CornerPointKey,
} from '../src/index.js';

type RawDocument = Record<string, unknown>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parse(input: unknown): CarModelDocument {
  const parsed = parseCarModel(input);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function defined(value: unknown): number {
  const solved = value as { kind?: string; value?: number };
  if (solved.kind !== 'defined' || solved.value === undefined) {
    throw new Error(`expected a defined value, got ${String(solved.kind)}`);
  }
  return solved.value;
}

function rawNumber(node: unknown): number | null {
  const record = node as Record<string, unknown> | null;
  const value = record?.['value'];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function rawPoint(node: unknown): [number, number, number] | null {
  const record = node as Record<string, unknown> | null;
  const value = record?.['value'];
  if (!Array.isArray(value) || value.length !== 3) return null;
  return [Number(value[0]), Number(value[1]), Number(value[2])];
}

const OUTBOARD: readonly CornerPointKey[] = ['lca_out', 'uca_out', 'tie_out'];
const CHASSIS: readonly CornerPointKey[] = [
  'lca_in_a',
  'lca_in_b',
  'uca_in',
  'tie_in',
  'damper_lo',
  'damper_up',
  'arb_drop',
];

/**
 * Reconstruct the pre-slice 1.1.0 document (absolute outboard points and a
 * stored `wc`) from the current 1.2.0 hub-relative asset.
 */
function legacyAbsoluteDocument(): RawDocument {
  const raw = clone(rawModel) as RawDocument;
  raw['schema_version'] = '1.1.0';
  if ((rawModel as { schema_version?: string }).schema_version === '1.2.0') {
    const body = raw['body'] as Record<string, unknown>;
    const thickness = rawNumber((body['chassis'] as Record<string, unknown>)['thickness']) ?? 2;
    const ride = rawNumber(body['reference_ride_height']) ?? 5;
    const wheelbase = rawNumber(body['wheelbase']) ?? 257;
    const axles = raw['axles'] as Record<string, Record<string, unknown>>;
    const corners = raw['corners'] as Record<string, Record<string, unknown>>;
    for (const [key, corner] of Object.entries(corners)) {
      const axleKey = key[1] === 'F' ? 'front' : 'rear';
      const side = key[0] === 'L' ? 1 : -1;
      const axle = axles[axleKey]!;
      const radius = rawNumber(axle['tyre_radius']) ?? 32;
      const track = rawNumber(axle['track']) ?? 0;
      const hub: [number, number, number] = [
        axleKey === 'front' ? wheelbase : 0,
        (side * track) / 2,
        radius - (thickness + ride),
      ];
      const points = corner['points'] as Record<string, unknown>;
      points['wc'] = { value: hub, source: 's_worked' };
      for (const pointKey of OUTBOARD) {
        const offset = rawPoint(points[pointKey]);
        if (offset === null) continue;
        points[pointKey] = {
          value: [hub[0] + offset[0], hub[1] + offset[1], hub[2] + offset[2]],
          source: 's_worked',
        };
      }
    }
  }
  return raw;
}

function absoluteMap(model: CarModelDocument): Record<string, readonly number[]> {
  const map: Record<string, readonly number[]> = {};
  for (const corner of ['LF', 'RF', 'LR', 'RR'] as const) {
    const hub = hubCentreMm(model, corner);
    if (hub !== null) map[`${corner}.hub`] = [hub.x, hub.y, hub.z];
    for (const key of [...CHASSIS, ...OUTBOARD] as const) {
      const point = absoluteCornerPointMm(model, corner, key);
      if (point !== null) map[`${corner}.${key}`] = point.value;
    }
  }
  return map;
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

function camberGainPerMm(model: CarModelDocument, corner: CornerKey): number {
  const input = buildFrontViewInput(model, corner);
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  return (defined(solveFrontView(input.value).camberGain) * 180) / Math.PI / 1000;
}

function rates(model: CarModelDocument, axle: 'front' | 'rear') {
  const result = buildAxleRates(model, axle);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

describe('hub-relative corner geometry', () => {
  it('migrates a 1.1 absolute document to 1.2 and preserves every absolute point', () => {
    const legacy = legacyAbsoluteDocument();
    const oldModel = parse(legacy);
    const before = absoluteMap(oldModel);

    const migrated = parse(legacyAbsoluteDocument());
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(CURRENT_SCHEMA_VERSION).toBe('1.2.0');
    expect(migrated.sources['s_hub_migration']?.type).toBe('derived');

    const after = absoluteMap(migrated);
    for (const key of Object.keys(before)) {
      const expected = before[key];
      const actual = after[key];
      expect(actual, key).toBeDefined();
      if (expected === undefined || actual === undefined) continue;
      expect(actual[0], `${key}.x`).toBeCloseTo(expected[0] ?? Number.NaN, 12);
      expect(actual[1], `${key}.y`).toBeCloseTo(expected[1] ?? Number.NaN, 12);
      expect(actual[2], `${key}.z`).toBeCloseTo(expected[2] ?? Number.NaN, 12);
    }

    const exported = JSON.stringify(migrated.raw);
    const reloaded = parse(JSON.parse(exported) as unknown);
    expect(absoluteMap(reloaded)).toEqual(after);
  });

  it('stores outboard points as hub-relative offsets and keeps chassis points absolute', () => {
    const model = parse(rawModel);
    expect(model.corners.LF?.points.wc).toBeUndefined();
    expect(model.corners.LF?.points.lca_out?.value).toEqual([2, -8, -25]);
    expect(model.corners.LF?.points.lca_in_a?.value).toEqual([238, 30, 5]);

    for (const key of OUTBOARD) expect(isHubFixedPointKey(key)).toBe(true);
    for (const key of CHASSIS) expect(isHubFixedPointKey(key)).toBe(false);

    const hub = hubCentreMm(model, 'LF');
    expect(hub).toEqual({ x: 257, y: 86, z: 25 });
    expect(model.corners.LF?.points.lca_out?.value).toEqual([2, -8, -25]);
    expect(absoluteCornerPointMm(model, 'LF', 'lca_out')?.value).toEqual([259, 78, 0]);
  });

  it('moves the hub and every outboard point down 1 mm when ride height rises 1 mm, leaving chassis points byte-identical', () => {
    const base = parse(rawModel);
    const raised = updateChassisRideHeight(base, 6.0);
    expect(raised.ok).toBe(true);
    if (!raised.ok) return;

    const baseHub = hubCentreMm(base, 'LF');
    const raisedHub = hubCentreMm(raised.value, 'LF');
    expect(baseHub).not.toBeNull();
    expect(raisedHub).not.toBeNull();
    if (baseHub === null || raisedHub === null) return;
    expect(raisedHub.z - baseHub.z).toBeCloseTo(-1, 12);
    expect(raisedHub.y).toBeCloseTo(baseHub.y, 12);
    expect(raisedHub.x).toBeCloseTo(baseHub.x, 12);

    for (const corner of ['LF', 'LR'] as const) {
      for (const key of OUTBOARD) {
        const before = absoluteCornerPointMm(base, corner, key);
        const after = absoluteCornerPointMm(raised.value, corner, key);
        expect(before).not.toBeNull();
        expect(after).not.toBeNull();
        if (before === null || after === null) continue;
        expect(after.value[0]).toBeCloseTo(before.value[0], 12);
        expect(after.value[1]).toBeCloseTo(before.value[1], 12);
        expect(after.value[2]).toBeCloseTo(before.value[2] - 1, 12);
      }
      for (const key of CHASSIS) {
        expect(JSON.stringify(raised.value.corners[corner]?.points[key])).toBe(
          JSON.stringify(base.corners[corner]?.points[key]),
        );
      }
    }

    const baseFrontRc = frontRollCentreMm(base);
    const raisedFrontRc = frontRollCentreMm(raised.value);
    const baseRearRc = rearRollCentreMm(base);
    const raisedRearRc = rearRollCentreMm(raised.value);
    expect(raisedFrontRc).not.toBeCloseTo(baseFrontRc + 1, 6);
    expect(raisedRearRc).not.toBeCloseTo(baseRearRc + 1, 6);
    expect(Number.isFinite(raisedFrontRc)).toBe(true);
    expect(Number.isFinite(raisedRearRc)).toBe(true);
  });

  it('raises the hub and outboard points 1 mm when the wheel diameter grows 2 mm, with the ride height unchanged', () => {
    const base = parse(rawModel);
    const bigger = updateWheelDiameter(base, 'front', 66.0);
    expect(bigger.ok).toBe(true);
    if (!bigger.ok) return;

    expect(bigger.value.referenceRideHeight?.value).toBe(base.referenceRideHeight?.value);
    const baseHub = hubCentreMm(base, 'LF');
    const bigHub = hubCentreMm(bigger.value, 'LF');
    if (baseHub === null || bigHub === null) throw new Error('hub missing');
    expect(bigHub.z - baseHub.z).toBeCloseTo(1, 12);

    for (const key of OUTBOARD) {
      const before = absoluteCornerPointMm(base, 'LF', key);
      const after = absoluteCornerPointMm(bigger.value, 'LF', key);
      if (before === null || after === null) throw new Error('outboard missing');
      expect(after.value[2]).toBeCloseTo(before.value[2] + 1, 12);
      expect(after.value[0]).toBeCloseTo(before.value[0], 12);
      expect(after.value[1]).toBeCloseTo(before.value[1], 12);
    }
    for (const key of CHASSIS) {
      expect(JSON.stringify(bigger.value.corners.LF?.points[key])).toBe(
        JSON.stringify(base.corners.LF?.points[key]),
      );
    }

    expect(frontRollCentreMm(bigger.value)).not.toBeCloseTo(frontRollCentreMm(base), 6);
    expect(rearRollCentreMm(bigger.value)).toBeCloseTo(rearRollCentreMm(base), 12);
  });

  it('keeps the wheel centre exactly one radius above the ground at every ride-height and diameter combination', () => {
    const base = parse(rawModel);
    for (const rideHeight of [3.0, 5.0, 7.0]) {
      const ride = updateChassisRideHeight(base, rideHeight);
      if (!ride.ok) throw new Error(JSON.stringify(ride.errors));
      for (const diameter of [60.0, 64.0, 68.0]) {
        const front = updateWheelDiameter(ride.value, 'front', diameter);
        const both = front.ok ? updateWheelDiameter(front.value, 'rear', diameter) : front;
        if (!both.ok) throw new Error(JSON.stringify(both.errors));
        const datum = chassisDatum(both.value);
        if (datum === null) throw new Error('datum missing');
        for (const axle of ['front', 'rear'] as const) {
          const wheel = wheelSize(both.value, axle);
          if (wheel === null) throw new Error('wheel missing');
          expect(wheel.heightAboveGroundMm).toBeCloseTo(wheel.radiusMm, 12);
          expect(wheel.hubZMm + datum.groundOffsetMm).toBeCloseTo(wheel.radiusMm, 12);
          expect(wheel.diameterMm).toBeCloseTo(diameter, 12);
        }
      }
    }
  });

  it('moves camber more negative for a 0.5 mm inboard upper-ball-stud shim and leaves the inboard and opposite corner unchanged', () => {
    const base = parse(rawModel);
    const beforeOffset = base.corners.LF?.points.uca_out?.value;
    if (beforeOffset === undefined) throw new Error('missing uca_out');
    const shimmed = updateCornerPointMm(base, 'LF', 'uca_out', 1, beforeOffset[1] + 0.5);
    expect(shimmed.ok).toBe(true);
    if (!shimmed.ok) return;

    const beforeCamber = camberGainPerMm(base, 'LF');
    const afterCamber = camberGainPerMm(shimmed.value, 'LF');
    expect(afterCamber).toBeLessThan(beforeCamber);

    for (const key of CHASSIS) {
      expect(JSON.stringify(shimmed.value.corners.LF?.points[key])).toBe(
        JSON.stringify(base.corners.LF?.points[key]),
      );
    }
    expect(JSON.stringify(shimmed.value.corners.LR?.points)).toBe(
      JSON.stringify(base.corners.LR?.points),
    );
    expect(frontRollCentreMm(shimmed.value)).not.toBeCloseTo(frontRollCentreMm(base), 6);
  });

  it('mirrors a left-corner offset to the right corner with y negated', () => {
    const raw = clone(rawModel) as RawDocument;
    delete (raw['corners'] as Record<string, unknown>)['RR'];
    const model = parse(raw);
    const left = model.corners.LR?.points.uca_out?.value;
    const right = model.corners.RR?.points.uca_out?.value;
    if (left === undefined || right === undefined) throw new Error('mirror missing');
    expect(right).toEqual([left[0], -left[1], left[2]]);
    expect(hubCentreMm(model, 'RR')?.y).toBeCloseTo(-87, 12);
  });

  it('still reproduces the reference car goldens a second time', () => {
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
    expect(camberGainPerMm(base, 'LF')).toBeCloseTo(-0.109816, 6);
    expect(defined(frontRates.wheelRate) / 1000).toBeCloseTo(1.11851, 4);
    expect(defined(frontRates.rideFrequency)).toBeCloseTo(10.781, 3);
    expect(defined(roll.frontShare) * 100).toBeCloseTo(62.11, 2);
    expect(defined(transfer.balance) * 100).toBeCloseTo(47.46, 2);
  });
});
