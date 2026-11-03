import { describe, expect, it } from 'vitest';
import { solveFrontView, solveLoadTransfer, solveRollStiffness } from '@setuplab/physics';
import rawModel from '../../../assets/models/reference-touring-car.json';
import {
  buildFrontViewInput,
  buildLoadTransferInput,
  buildRollStiffnessInput,
  parseCarModel,
} from '../src/index.js';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('rear corner derived geometry', () => {
  it('declares the rear corner as derived and says exactly what was done', () => {
    const parsed = parseCarModel(rawModel);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value.axles.rear?.derivedFrom).toBe('front');

    const rearSource = parsed.value.sources['s_rear_mirrored'];
    expect(rearSource?.type).toBe('derived');
    expect(rearSource?.method).toBe(
      'mirrored from the LF/RF corner by symmetry about the vehicle centreline; rear hardpoints NOT measured',
    );

    expect(parsed.value.corners.LR?.points.lca_out?.source).toBe('s_rear_mirrored');
    expect(parsed.value.corners.RR?.points.lca_out?.source).toBe('s_rear_mirrored');
    expect(parsed.value.corners.LR?.points.lca_out?.confidence).toBe('derived');
    expect(parsed.value.corners.RR?.points.lca_out?.confidence).toBe('derived');
  });

  it('solves the rear corner as inferred and flagged, with every output carrying the derivation', () => {
    const parsed = parseCarModel(rawModel);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const input = buildFrontViewInput(parsed.value, 'LR');
    expect(input.ok).toBe(true);
    if (!input.ok) return;

    expect(input.value.lcaIn_m.confidence).toBe('derived');
    expect(input.value.lcaOut_m.confidence).toBe('derived');
    expect(input.value.ucaIn_m.confidence).toBe('derived');
    expect(input.value.ucaOut_m.confidence).toBe('derived');
    expect(input.value.wheelCentre_m.confidence).toBe('derived');

    const result = solveFrontView(input.value);
    const outputs = [
      result.instantCentre,
      result.rollCentreHeight,
      result.rollCentreLateral,
      result.camberGain,
      result.camberGainGlobal,
      result.staticState,
    ];

    for (const output of outputs) {
      expect(output.kind).toBe('defined');
      if (output.kind !== 'defined') continue;
      expect(output.tier).toBe('inferred');
      expect(output.flags.has('derivedGeometry')).toBe(true);
      expect(output.provenance.has('LR.points.lca_in_a')).toBe(true);
      expect(output.provenance.has('LR.points.wc')).toBe(true);
      expect(output.provenance.has('s_rear_mirrored')).toBe(true);
    }
  });

  it('does not silently mirror the front corner into a rear corner when one is absent', () => {
    const withoutRear = clone(rawModel) as {
      corners: Record<string, unknown>;
    };
    delete withoutRear.corners['LR'];
    delete withoutRear.corners['RR'];
    const parsed = parseCarModel(withoutRear);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const input = buildFrontViewInput(parsed.value, 'LR');
    expect(input.ok).toBe(false);
    if (input.ok) return;
    expect(input.errors.some((error) => error.path === 'corners.LR')).toBe(true);
  });

  it('leaves the front/rear balance unchanged when the rear corners are absent', () => {
    const withRearCorners = parseCarModel(rawModel);
    expect(withRearCorners.ok).toBe(true);
    if (!withRearCorners.ok) return;

    const withoutRear = clone(rawModel) as {
      corners: Record<string, unknown>;
    };
    delete withoutRear.corners['LR'];
    delete withoutRear.corners['RR'];
    const withoutRearCorners = parseCarModel(withoutRear);
    expect(withoutRearCorners.ok).toBe(true);
    if (!withoutRearCorners.ok) return;

    const rollWith = buildRollStiffnessInput(withRearCorners.value);
    const rollWithout = buildRollStiffnessInput(withoutRearCorners.value);
    expect(rollWith.ok).toBe(true);
    expect(rollWithout.ok).toBe(true);
    if (!rollWith.ok || !rollWithout.ok) return;

    const rollResultWith = solveRollStiffness(rollWith.value);
    const rollResultWithout = solveRollStiffness(rollWithout.value);
    expect(rollResultWith.frontShare.kind).toBe('defined');
    expect(rollResultWithout.frontShare.kind).toBe('defined');
    if (
      rollResultWith.frontShare.kind !== 'defined' ||
      rollResultWithout.frontShare.kind !== 'defined'
    ) {
      return;
    }
    expect(rollResultWith.frontShare.value).toBeCloseTo(rollResultWithout.frontShare.value, 12);

    const transferWith = buildLoadTransferInput(withRearCorners.value, 9.81);
    const transferWithout = buildLoadTransferInput(withoutRearCorners.value, 9.81);
    expect(transferWith.ok).toBe(true);
    expect(transferWithout.ok).toBe(true);
    if (!transferWith.ok || !transferWithout.ok) return;

    const balanceWith = solveLoadTransfer(transferWith.value).balance;
    const balanceWithout = solveLoadTransfer(transferWithout.value).balance;
    expect(balanceWith.kind).toBe('defined');
    expect(balanceWithout.kind).toBe('defined');
    if (balanceWith.kind !== 'defined' || balanceWithout.kind !== 'defined') return;
    expect(balanceWith.value).toBeCloseTo(balanceWithout.value, 12);
  });
});
