import { describe, expect, it } from 'vitest';
import { solveAntiDive, solveFrontView } from '@setuplab/physics';
import rawModel from '../../../assets/models/reference-touring-car.json';
import {
  buildAntiDiveInput,
  buildFrontViewInput,
  parseCarModel,
  reportedRollCentreHeightM,
  updateCornerPointMm,
  type CarModelDocument,
  type CornerKey,
} from '../src/index.js';

function parse(input: unknown): CarModelDocument {
  const parsed = parseCarModel(input);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function rollCentreMm(model: CarModelDocument, corner: CornerKey = 'LF'): number {
  const input = buildFrontViewInput(model, corner);
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  const height = reportedRollCentreHeightM(model, solveFrontView(input.value));
  if (height === null) throw new Error('roll centre is not defined');
  return height * 1000;
}

function shim(model: CarModelDocument, corner: CornerKey, point: 'lca_in_a' | 'lca_in_b', deltaMm: number): CarModelDocument {
  const current = model.corners[corner]?.points[point];
  if (current === undefined) throw new Error(`missing ${point}`);
  const edited = updateCornerPointMm(model, corner, point, 2, current.value[2] + deltaMm);
  if (!edited.ok) throw new Error(JSON.stringify(edited.errors));
  return edited.value;
}

describe('two-screw inner pivot split (#34, D-27)', () => {
  it('keeps the front view on the midpoint: one screw +1 mm is half of both screws +1 mm', () => {
    const base = parse(rawModel);
    const frontScrew = shim(base, 'LF', 'lca_in_b', 1);
    const bothScrews = shim(base, 'LF', 'lca_in_a', 1);
    const both = shim(bothScrews, 'LF', 'lca_in_b', 1);

    const baseRc = rollCentreMm(base);
    const oneRc = rollCentreMm(frontScrew);
    const bothRc = rollCentreMm(both);

    expect(oneRc - baseRc).toBeCloseTo((bothRc - baseRc) / 2, 2);
    // The midpoint is exact at the input boundary; the roll-centre response is
    // then the same non-linear function at z_mid, so it follows to display
    // precision rather than bit-for-bit.
    const oneInput = buildFrontViewInput(frontScrew, 'LF');
    const bothInput = buildFrontViewInput(both, 'LF');
    if (!oneInput.ok || !bothInput.ok) throw new Error('front-view inputs did not build');
    expect(oneInput.value.lcaIn_m.value.z - 0.012).toBeCloseTo(0.0005, 12);
    expect(bothInput.value.lcaIn_m.value.z - 0.012).toBeCloseTo(0.001, 12);
    // Raising both screws by 1 mm still moves the front view; it is not a no-op.
    expect(bothRc).not.toBeCloseTo(baseRc, 9);
  });

  it('keeps every front-view golden bit-identical when the screws are level', () => {
    const base = parse(rawModel);
    const left = buildFrontViewInput(base, 'LF');
    if (!left.ok) throw new Error(JSON.stringify(left.errors));
    const solved = solveFrontView(left.value);
    if (solved.rollCentreHeight.kind !== 'defined') throw new Error('refused');
    expect(rollCentreMm(base)).toBeCloseTo(9.9749, 4);
    expect(rollCentreMm(base, 'LR')).toBeCloseTo(17.8985, 4);
  });

  it('builds the side-view input with the two pivot heights independent and derives CG above ground', () => {
    const base = parse(rawModel);
    const input = buildAntiDiveInput(base, -9.81);
    expect(input.ok).toBe(true);
    if (!input.ok) return;

    expect(input.value.front.lowerInnerA_m.value.z).toBeCloseTo(0.012, 12);
    expect(input.value.front.lowerInnerB_m.value.z).toBeCloseTo(0.012, 12);
    expect(input.value.rear.lowerInnerA_m.value.z).toBeCloseTo(0.016, 12);
    expect(input.value.rear.lowerInnerB_m.value.z).toBeCloseTo(0.016, 12);
    expect(input.value.cgHeight_m?.value).toBeCloseTo(0.028, 12);

    const solved = solveAntiDive(input.value);
    expect(solved.front.percent.kind).toBe('defined');
    expect(solved.rear.percent.kind).toBe('defined');
    if (solved.front.percent.kind === 'defined') expect(solved.front.percent.value).toBe(0);
    if (solved.rear.percent.kind === 'defined') expect(solved.rear.percent.value).toBe(0);
  });

  it('moves the side-view instant centre when one screw is raised and leaves the other axle alone', () => {
    const base = parse(rawModel);
    const shimmed = shim(base, 'LF', 'lca_in_b', 2);

    const before = buildAntiDiveInput(base, -9.81);
    const after = buildAntiDiveInput(shimmed, -9.81);
    if (!before.ok || !after.ok) throw new Error('inputs did not build');

    const beforeSolved = solveAntiDive(before.value);
    const afterSolved = solveAntiDive(after.value);
    expect(beforeSolved.front.working.instantCentreX_m).toBeNull();
    expect(afterSolved.front.working.instantCentreX_m).not.toBeNull();
    expect(afterSolved.rear.working.instantCentreX_m).toBeNull();
    if (afterSolved.front.percent.kind !== 'defined') throw new Error('front refused');
    expect(afterSolved.front.percent.value).toBeLessThan(0);
  });

});
