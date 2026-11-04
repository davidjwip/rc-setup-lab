import { describe, expect, it } from 'vitest';
import { solveFrontView, solveLoadTransfer, solveRollStiffness } from '@setuplab/physics';
import rawModel from '../../../assets/models/reference-touring-car.json';
import {
  buildFrontViewInput,
  buildLoadTransferInput,
  buildRollStiffnessInput,
  parseCarModel,
  resetCornerPointsMm,
  updateCornerPointMm,
  type CarModelDocument,
} from '../src/index.js';

function parseReference(): CarModelDocument {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function rearSolved(model: CarModelDocument): ReturnType<typeof solveFrontView> {
  const input = buildFrontViewInput(model, 'LR');
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  return solveFrontView(input.value);
}

function rearRollCentre(model: CarModelDocument): number {
  const solved = rearSolved(model);
  if (solved.rollCentreHeight.kind !== 'defined') {
    throw new Error(`rear roll centre is ${solved.rollCentreHeight.kind}`);
  }
  return solved.rollCentreHeight.value;
}

function frontOutputs(model: CarModelDocument): string {
  const input = buildFrontViewInput(model, 'LF');
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  return JSON.stringify(solveFrontView(input.value));
}

describe('hardpoint edits follow the selected axle', () => {
  it('editing LR.uca_in.z moves the rear roll centre down and leaves the front output bit-identical', () => {
    const baseline = parseReference();
    const beforeSolved = rearSolved(baseline);
    const before = rearRollCentre(baseline);
    const frontBefore = frontOutputs(baseline);

    expect(before).toBeCloseTo(0.0178985, 6);
    expect(beforeSolved.camberGain.kind).toBe('defined');

    const edited = updateCornerPointMm(baseline, 'LR', 'uca_in', 2, 53);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;

    const afterSolved = rearSolved(edited.value);
    const after = rearRollCentre(edited.value);
    expect(after).toBeCloseTo(0.0150106, 6);
    expect(after).toBeLessThan(before);
    expect(afterSolved.camberGain.kind).toBe('defined');
    if (beforeSolved.camberGain.kind !== 'defined' || afterSolved.camberGain.kind !== 'defined') {
      return;
    }
    expect(afterSolved.camberGain.value).not.toBeCloseTo(beforeSolved.camberGain.value, 9);
    expect(frontOutputs(edited.value)).toBe(frontBefore);
  });

  it('moves the rear ARB motion ratio, roll-stiffness share and balance through an exposed point', () => {
    const baseline = parseReference();
    const edited = updateCornerPointMm(baseline, 'LR', 'lca_out', 2, -22);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;

    const baseRollInput = buildRollStiffnessInput(baseline);
    const editedRollInput = buildRollStiffnessInput(edited.value);
    expect(baseRollInput.ok).toBe(true);
    expect(editedRollInput.ok).toBe(true);
    if (!baseRollInput.ok || !editedRollInput.ok) return;

    const baseRoll = solveRollStiffness(baseRollInput.value);
    const editedRoll = solveRollStiffness(editedRollInput.value);
    expect(baseRoll.frontShare.kind).toBe('defined');
    expect(editedRoll.frontShare.kind).toBe('defined');
    expect(baseRoll.rear.working.antiRollBar.motionRatio).not.toBeNull();
    expect(editedRoll.rear.working.antiRollBar.motionRatio).not.toBeNull();
    if (baseRoll.frontShare.kind !== 'defined' || editedRoll.frontShare.kind !== 'defined') return;

    expect(editedRoll.rear.working.antiRollBar.motionRatio ?? 0).not.toBeCloseTo(
      baseRoll.rear.working.antiRollBar.motionRatio ?? 0,
      9,
    );
    expect(editedRoll.front.rollStiffness).toEqual(baseRoll.front.rollStiffness);
    expect(editedRoll.frontShare.value).not.toBeCloseTo(baseRoll.frontShare.value, 6);

    const baseTransfer = buildLoadTransferInput(baseline, 9.81);
    const editedTransfer = buildLoadTransferInput(edited.value, 9.81);
    expect(baseTransfer.ok).toBe(true);
    expect(editedTransfer.ok).toBe(true);
    if (!baseTransfer.ok || !editedTransfer.ok) return;

    const baseBalance = solveLoadTransfer(baseTransfer.value).balance;
    const editedBalance = solveLoadTransfer(editedTransfer.value).balance;
    expect(baseBalance.kind).toBe('defined');
    expect(editedBalance.kind).toBe('defined');
    if (baseBalance.kind !== 'defined' || editedBalance.kind !== 'defined') return;
    expect(editedBalance.value).not.toBeCloseTo(baseBalance.value, 6);
  });

  it('restores only the selected corner to the model values', () => {
    const baseline = parseReference();
    const rearBefore = rearRollCentre(baseline);

    const frontEdited = updateCornerPointMm(baseline, 'LF', 'uca_in', 2, 43);
    expect(frontEdited.ok).toBe(true);
    if (!frontEdited.ok) return;
    const rearEdited = updateCornerPointMm(frontEdited.value, 'LR', 'uca_in', 2, 53);
    expect(rearEdited.ok).toBe(true);
    if (!rearEdited.ok) return;
    expect(rearRollCentre(rearEdited.value)).not.toBeCloseTo(rearBefore, 9);

    const reset = resetCornerPointsMm(rearEdited.value, baseline, 'LR');
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;

    expect(reset.value.corners.LR?.points.uca_in?.value).toEqual([-4, 44, 45]);
    expect(rearRollCentre(reset.value)).toBeCloseTo(rearBefore, 12);
    expect(reset.value.corners.LF?.points.uca_in?.value).toEqual([250, 42, 43]);
  });
});
