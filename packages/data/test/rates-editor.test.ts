import { describe, expect, it } from 'vitest';
import { solveDampingRatio, solveLoadTransfer, solveRollStiffness } from '@setuplab/physics';
import rawModel from '../../../assets/models/reference-touring-car.json';
import {
  buildAxleRates,
  buildDampingRatioInput,
  buildLoadTransferInput,
  buildRollStiffnessInput,
  parseCarModel,
  resetAxleRates,
  updateAxleArbType,
  updateAxleArbValue,
  updateAxleDamperCoefficient,
  updateAxleSpringRate,
  type CarModelDocument,
} from '../src/index.js';

function parseReference(): CarModelDocument {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function snapshot(model: CarModelDocument, axle: 'front' | 'rear') {
  const rates = buildAxleRates(model, axle);
  if (!rates.ok) throw new Error(JSON.stringify(rates.errors));
  const damping = solveDampingRatio(
    buildDampingRatioInput(model, axle, rates.value.criticalDamping),
  );
  const rollInput = buildRollStiffnessInput(model);
  if (!rollInput.ok) throw new Error(JSON.stringify(rollInput.errors));
  const roll = solveRollStiffness(rollInput.value);
  const transferInput = buildLoadTransferInput(model, 9.81);
  if (!transferInput.ok) throw new Error(JSON.stringify(transferInput.errors));
  const transfer = solveLoadTransfer(transferInput.value);
  return { rates: rates.value, damping, roll, transfer };
}

function values(solved: { kind: string; value?: number }): number | null {
  return solved.kind === 'defined' && typeof solved.value === 'number' ? solved.value : null;
}

function edited(model: CarModelDocument, result: { ok: boolean; value?: CarModelDocument }) {
  if (!result.ok || result.value === undefined) {
    throw new Error(JSON.stringify((result as { errors?: unknown }).errors));
  }
  return result.value;
}

describe('rates editor edits the model document per axle', () => {
  it('changing the front spring rate leaves rear spring outputs and all ARB rates bit-identical', () => {
    const baseline = parseReference();
    const before = snapshot(baseline, 'front');
    const rearBefore = snapshot(baseline, 'rear');

    const afterModel = edited(baseline, updateAxleSpringRate(baseline, 'front', 4.0));
    const after = snapshot(afterModel, 'front');
    const rearAfter = snapshot(afterModel, 'rear');

    expect(values(after.rates.wheelRate)).not.toBe(values(before.rates.wheelRate));
    expect(rearAfter.rates).toEqual(rearBefore.rates);
    expect(rearAfter.damping).toEqual(rearBefore.damping);
    expect(rearAfter.roll.rear).toEqual(rearBefore.roll.rear);
    expect(after.roll.rear).toEqual(before.roll.rear);
    expect(after.roll.front.antiRollBar).toEqual(before.roll.front.antiRollBar);
  });

  it('changing the ARB diameter moves roll stiffness and balance but not wheel rate, frequency, critical damping or damping ratio', () => {
    const baseline = parseReference();
    const before = snapshot(baseline, 'front');

    const afterModel = edited(baseline, updateAxleArbValue(baseline, 'front', 'bar_diameter', 1.6));
    const after = snapshot(afterModel, 'front');

    expect(after.rates).toEqual(before.rates);
    expect(values(after.damping.dampingRatio)).toBe(values(before.damping.dampingRatio));
    expect(values(after.roll.front.antiRollBar.wheelRate)).not.toBe(
      values(before.roll.front.antiRollBar.wheelRate),
    );
    expect(values(after.roll.front.rollStiffness)).not.toBe(
      values(before.roll.front.rollStiffness),
    );
    expect(values(after.roll.frontShare)).not.toBe(values(before.roll.frontShare));
    expect(values(after.transfer.balance)).not.toBe(values(before.transfer.balance));
  });

  it('changing the damper coefficient changes damping ratio only', () => {
    const baseline = parseReference();
    const before = snapshot(baseline, 'front');

    const afterModel = edited(
      baseline,
      updateAxleDamperCoefficient(baseline, 'front', 18.0),
    );
    const after = snapshot(afterModel, 'front');

    expect(after.rates).toEqual(before.rates);
    expect(after.roll).toEqual(before.roll);
    expect(values(after.transfer.balance)).toBe(values(before.transfer.balance));
    expect(values(after.damping.dampingRatio)).not.toBe(values(before.damping.dampingRatio));
    expect(values(after.damping.dampingRatio) ?? 0).toBeGreaterThan(
      values(before.damping.dampingRatio) ?? 0,
    );
  });

  it('arb.type none removes the ARB contribution as an exact zero and moves the share', () => {
    const baseline = parseReference();
    const before = snapshot(baseline, 'front');

    const afterModel = edited(baseline, updateAxleArbType(baseline, 'front', 'none'));
    const after = snapshot(afterModel, 'front');

    expect(values(after.roll.front.antiRollBar.wheelRate)).toBe(0);
    expect(after.roll.front.antiRollBar.fitted).toBe(false);
    expect(values(after.roll.front.rollStiffness) ?? 0).toBeLessThan(
      values(before.roll.front.rollStiffness) ?? 0,
    );
    expect(values(after.roll.frontShare)).not.toBe(values(before.roll.frontShare));
    expect(after.rates).toEqual(before.rates);
  });

  it('carries the damping estimate band and never upgrades the edited coefficient to measured', () => {
    const baseline = parseReference();
    const before = snapshot(baseline, 'front');
    expect(before.damping.dampingRatio.kind).toBe('defined');
    if (before.damping.dampingRatio.kind !== 'defined') return;
    expect(before.damping.dampingRatio.tier).toBe('inferred');
    expect(before.damping.dampingRatio.flags.has('assumedInput')).toBe(true);
    expect(before.damping.dampingRatio.band).not.toBeNull();

    const afterModel = edited(
      baseline,
      updateAxleDamperCoefficient(baseline, 'front', 18.0),
    );
    expect(afterModel.corners.LF?.damper?.cPost?.confidence).toBe('estimated');
    const after = snapshot(afterModel, 'front');
    if (after.damping.dampingRatio.kind !== 'defined') return;
    const band = after.damping.dampingRatio.band;
    expect(band).not.toBeNull();
    if (band === null) return;
    expect(band.low).toBeCloseTo(after.damping.dampingRatio.value * 0.5, 9);
    expect(band.high).toBeCloseTo(after.damping.dampingRatio.value * 1.5, 9);
    expect(after.damping.dampingRatio.flags.has('lowConfidence')).toBe(true);
  });

  it('leaves every hardpoint untouched', () => {
    const baseline = parseReference();
    let model = edited(baseline, updateAxleSpringRate(baseline, 'front', 4.0));
    model = edited(model, updateAxleDamperCoefficient(model, 'front', 18.0));
    model = edited(model, updateAxleArbType(model, 'rear', 'none'));
    model = edited(model, updateAxleArbValue(model, 'rear', 'span', 100));
    expect(JSON.stringify(model.corners.LF?.points)).toBe(
      JSON.stringify(baseline.corners.LF?.points),
    );
    expect(JSON.stringify(model.corners.LR?.points)).toBe(
      JSON.stringify(baseline.corners.LR?.points),
    );
  });

  it('keeps each end on its own spring rate when the axle changes', () => {
    const baseline = parseReference();
    let model = edited(baseline, updateAxleSpringRate(baseline, 'front', 4.0));
    model = edited(model, updateAxleSpringRate(model, 'rear', 3.0));

    expect(model.axles.front.springRate?.value).toBeCloseTo(4.0, 12);
    expect(model.axles.rear?.springRate?.value).toBeCloseTo(3.0, 12);
    expect(values(snapshot(model, 'front').rates.wheelRate)).toBeCloseTo(
      4.0 * 0.565308 ** 2 * 1000,
      1,
    );
    expect(values(snapshot(model, 'rear').rates.wheelRate)).toBeCloseTo(
      3.0 * 0.7071 ** 2 * 1000,
      6,
    );
  });

  it('reset this axle clears its rate edits without touching the other end or the hardpoints', () => {
    const baseline = parseReference();
    let model = edited(baseline, updateAxleSpringRate(baseline, 'front', 4.0));
    model = edited(model, updateAxleDamperCoefficient(model, 'front', 18.0));
    model = edited(model, updateAxleArbType(model, 'front', 'none'));
    model = edited(model, updateAxleSpringRate(model, 'rear', 3.0));

    const reset = edited(model, resetAxleRates(model, baseline, 'front'));
    expect(reset.axles.front.springRate?.value).toBeCloseTo(3.5, 12);
    expect(reset.axles.front.arb?.type).toBe('torsion_bar');
    expect(reset.axles.front.arb?.barDiameter?.value).toBeCloseTo(1.5, 12);
    expect(reset.corners.LF?.damper?.cPost).toBeUndefined();
    expect(reset.axles.rear?.springRate?.value).toBeCloseTo(3.0, 12);
    expect(JSON.stringify(reset.corners.LF?.points)).toBe(
      JSON.stringify(baseline.corners.LF?.points),
    );
    expect(snapshot(reset, 'front').rates).toEqual(snapshot(baseline, 'front').rates);
  });
});
