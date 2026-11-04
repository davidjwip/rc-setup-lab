import { describe, expect, it } from 'vitest';
import { solveAntiDive, solveFrontView } from '@setuplab/physics';
import rawModel from '../../../assets/models/reference-touring-car.json';
import {
  buildAntiDiveInput,
  buildFrontViewInput,
  parseCarModel,
  updateAxleLowerInnerShimMm,
  type CarModelDocument,
  type CornerKey,
} from '../src/index.js';

function reference(): CarModelDocument {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function screwPair(model: CarModelDocument, corner: CornerKey) {
  const a = model.corners[corner]?.points.lca_in_a;
  const b = model.corners[corner]?.points.lca_in_b;
  if (a === undefined || b === undefined) throw new Error(`${corner} has no screw pair`);
  return { a: a.value[2], b: b.value[2] };
}

function rollCentreMm(model: CarModelDocument, corner: 'LF' | 'LR'): number {
  const input = buildFrontViewInput(model, corner);
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  const result = solveFrontView(input.value);
  if (result.rollCentreHeight.kind !== 'defined') {
    throw new Error(`${corner} roll centre is not defined`);
  }
  return result.rollCentreHeight.value * 1000;
}

function frontRollCentreMm(model: CarModelDocument): number {
  return rollCentreMm(model, 'LF');
}

function rearSnapshot(model: CarModelDocument): string {
  return JSON.stringify({
    LR: model.corners.LR,
    RR: model.corners.RR,
    rear: model.axles.rear,
  });
}

describe('lower-arm inner shim', () => {
  it('writes the shim as half a millimetre either side of the midpoint', () => {
    const base = reference();
    const edited = updateAxleLowerInnerShimMm(base, 'front', 2);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;

    const pair = screwPair(edited.value, 'LF');
    expect(pair.a).toBeCloseTo(4, 12);
    expect(pair.b).toBeCloseTo(6, 12);
    expect(pair.b - pair.a).toBeCloseTo(2, 12);
    expect((pair.a + pair.b) / 2).toBeCloseTo(5, 12);
  });

  it('keeps the midpoint unchanged to 1e-12 and leaves the front-view golden alone', () => {
    const base = reference();
    const before = screwPair(base, 'LF');
    const beforeRc = frontRollCentreMm(base);

    const edited = updateAxleLowerInnerShimMm(base, 'front', 2);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;

    const after = screwPair(edited.value, 'LF');
    expect((before.a + before.b) / 2).toBeCloseTo((after.a + after.b) / 2, 12);
    expect(frontRollCentreMm(edited.value)).toBeCloseTo(beforeRc, 12);
    expect(frontRollCentreMm(edited.value)).toBeCloseTo(9.9749, 4);
  });

  it('treats zero as exactly zero and returns the untouched document', () => {
    const base = reference();
    const edited = updateAxleLowerInnerShimMm(base, 'front', 0);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(JSON.stringify(edited.value.raw)).toBe(JSON.stringify(base.raw));
    expect(frontRollCentreMm(edited.value)).toBeCloseTo(9.9749, 4);
  });

  it('keeps both roll-centre goldens across the 0 / 0.5 / 1 / 2 mm shim table', () => {
    const base = reference();
    for (const shim of [0, 0.5, 1, 2]) {
      const front = updateAxleLowerInnerShimMm(base, 'front', shim);
      expect(front.ok).toBe(true);
      if (!front.ok) return;
      expect(frontRollCentreMm(front.value)).toBeCloseTo(9.9749, 4);

      const rear = updateAxleLowerInnerShimMm(base, 'rear', shim);
      expect(rear.ok).toBe(true);
      if (!rear.ok) return;
      expect(rollCentreMm(rear.value, 'LR')).toBeCloseTo(17.8985, 4);
    }
  });

  it('shims the rear without touching the front document', () => {
    const base = reference();
    const frontBefore = JSON.stringify({
      LF: base.corners.LF,
      RF: base.corners.RF,
      front: base.axles.front,
    });
    const rearBefore = screwPair(base, 'LR');

    const edited = updateAxleLowerInnerShimMm(base, 'rear', -1.5);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;

    const rearAfter = screwPair(edited.value, 'LR');
    expect(rearAfter.a).toBeCloseTo(rearBefore.a + 0.75, 12);
    expect(rearAfter.b).toBeCloseTo(rearBefore.b - 0.75, 12);
    expect((rearAfter.a + rearAfter.b) / 2).toBeCloseTo(
      (rearBefore.a + rearBefore.b) / 2,
      12,
    );
    expect(
      JSON.stringify({
        LF: edited.value.corners.LF,
        RF: edited.value.corners.RF,
        front: edited.value.axles.front,
      }),
    ).toBe(frontBefore);
  });

  it('leaves the rear document byte-identical for a front edit', () => {
    const base = reference();
    const before = rearSnapshot(base);
    const edited = updateAxleLowerInnerShimMm(base, 'front', 2);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(rearSnapshot(edited.value)).toBe(before);
  });

  it('makes a positive shim put the aft screw higher and read pro-dive at the front', () => {
    const base = reference();
    const level = buildAntiDiveInput(base, -9.81);
    expect(level.ok).toBe(true);
    if (!level.ok) return;
    const levelSolved = solveAntiDive(level.value);
    expect(levelSolved.front.percent.kind).toBe('defined');
    if (levelSolved.front.percent.kind !== 'defined') return;
    expect(levelSolved.front.percent.value).toBeCloseTo(0, 12);

    const edited = updateAxleLowerInnerShimMm(base, 'front', 2);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    const shimmed = buildAntiDiveInput(edited.value, -9.81);
    expect(shimmed.ok).toBe(true);
    if (!shimmed.ok) return;
    const solved = solveAntiDive(shimmed.value);
    expect(solved.front.percent.kind).toBe('defined');
    if (solved.front.percent.kind !== 'defined') return;
    expect(solved.front.percent.value).toBeLessThan(0);
    expect(solved.front.working.lowerSlope).toBeCloseTo(2 / 34, 12);
  });

  it('makes a positive rear shim read pro-squat under acceleration', () => {
    const base = reference();
    const edited = updateAxleLowerInnerShimMm(base, 'rear', 2);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    const input = buildAntiDiveInput(edited.value, 9.81);
    expect(input.ok).toBe(true);
    if (!input.ok) return;
    const solved = solveAntiDive(input.value);
    expect(solved.rear.percent.kind).toBe('defined');
    if (solved.rear.percent.kind !== 'defined') return;
    expect(solved.rear.percent.value).toBeLessThan(0);
  });

  it('refuses a missing screw or a non-finite shim', () => {
    const withoutScrew = clone(reference()) as {
      corners: { LF: { points: Record<string, unknown> } };
    };
    delete withoutScrew.corners.LF.points['lca_in_b'];

    const missing = updateAxleLowerInnerShimMm(withoutScrew as CarModelDocument, 'front', 2);
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.errors.some((error) => error.path === 'corners.LF.points.lca_in_b')).toBe(true);

    expect(updateAxleLowerInnerShimMm(reference(), 'front', Number.NaN).ok).toBe(false);
    expect(updateAxleLowerInnerShimMm(reference(), 'front', Number.POSITIVE_INFINITY).ok).toBe(
      false,
    );
  });
});
