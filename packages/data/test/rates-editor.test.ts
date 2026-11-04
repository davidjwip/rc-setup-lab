import { describe, expect, it } from 'vitest';
import {
  solveDampingRatio,
  solveFrontView,
  solveLoadTransfer,
  solveRollStiffness,
} from '@setuplab/physics';
import rawModel from '../../../assets/models/reference-touring-car.json';
import {
  buildAxleRates,
  buildDampingRatioInput,
  buildFrontViewInput,
  buildLoadTransferInput,
  buildRollStiffnessInput,
  parseCarModel,
  resetAxleRates,
  restoreCornerPointMm,
  updateAxleArbBlades,
  updateAxleArbType,
  updateAxleArbValue,
  updateAxleDamperCoefficient,
  updateAxleSpringRate,
  updateCornerPointMm,
  updateDamperMountLateralMm,
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
      3.0 * 0.689205 ** 2 * 1000,
      0,
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

describe('blade count and damper mount offsets are scoped per axle', () => {
  it('writes the blade count on the selected axle and leaves the other axle untouched', () => {
    const baseline = parseReference();
    const rearBefore = JSON.stringify({
      axle: baseline.axles.rear,
      corner: baseline.corners.LR,
    });

    const model = edited(baseline, updateAxleArbBlades(baseline, 'front', 2));
    expect(model.axles.front.arb?.blades?.value).toBe(2);
    expect(model.axles.front.arb?.blades?.confidence).toBe('estimated');
    expect(
      JSON.stringify({ axle: model.axles.rear, corner: model.corners.LR }),
    ).toBe(rearBefore);
  });

  it('moves one damper eye laterally as a session edit and leaves the other corner untouched', () => {
    const baseline = parseReference();
    const rearBefore = JSON.stringify(baseline.corners.LR);

    const model = edited(
      baseline,
      updateDamperMountLateralMm(baseline, 'front', 'damper_up', 49),
    );
    const before = baseline.corners.LF?.points.damper_up;
    const after = model.corners.LF?.points.damper_up;
    expect(before).toBeDefined();
    expect(after).toBeDefined();
    if (before === undefined || after === undefined) return;
    expect(after.value[1]).toBeCloseTo(49, 12);
    expect(after.value[0]).toBe(before.value[0]);
    expect(after.value[2]).toBe(before.value[2]);
    expect(after.confidence).toBe('estimated');
    expect(after.source).toBe('s_session');
    expect(JSON.stringify(model.corners.LR)).toBe(rearBefore);
  });

  it('restores a moved damper eye exactly, including its baseline provenance', () => {
    const baseline = parseReference();
    const moved = edited(
      baseline,
      updateDamperMountLateralMm(baseline, 'front', 'damper_up', 49),
    );
    const restored = edited(
      moved,
      restoreCornerPointMm(moved, baseline, 'LF', 'damper_up'),
    );

    expect(restored.corners.LF?.points.damper_up).toEqual(
      baseline.corners.LF?.points.damper_up,
    );
    expect(restored.corners.LF?.points.damper_up?.source).toBe('s_worked');
    expect(restored.corners.LF?.points.damper_up?.confidence).toBe('measured');
  });

  it('does not touch the front ARB or spring when a damper eye moves', () => {
    const baseline = parseReference();
    const before = snapshot(baseline, 'front');
    const model = edited(
      baseline,
      updateDamperMountLateralMm(baseline, 'front', 'damper_up', 49),
    );
    const after = snapshot(model, 'front');

    expect(model.axles.front.springRate?.value).toBe(3.5);
    expect(model.axles.front.arb?.barDiameter?.value).toBe(1.5);
    expect(values(after.rates.installationRatio)).not.toBe(
      values(before.rates.installationRatio),
    );
    expect(values(after.rates.wheelRate)).not.toBe(values(before.rates.wheelRate));
    expect(values(after.roll.front.antiRollBar.wheelRate)).toBe(
      values(before.roll.front.antiRollBar.wheelRate),
    );
  });
});

describe('damper motion ratio is geometry, not a lookup', () => {

  function frontView(model: CarModelDocument, corner: 'LF' | 'LR') {
    const input = buildFrontViewInput(model, corner);
    if (!input.ok) throw new Error(JSON.stringify(input.errors));
    return input.value;
  }

  function numbers(model: CarModelDocument, axle: 'front' | 'rear') {
    const s = snapshot(model, axle);
    return {
      ir: values(s.rates.installationRatio),
      wheelRate: values(s.rates.wheelRate),
      frequency: values(s.rates.rideFrequency),
      critical: values(s.rates.criticalDamping),
      damping: values(s.damping.dampingRatio),
    };
  }

  it('derives each end from its own damper mounts: rear 0.6892, not the old stated 0.7071', () => {
    const model = parseReference();
    const front = numbers(model, 'front');
    const rear = numbers(model, 'rear');

    expect(front.ir).toBeCloseTo(0.565308, 4);
    expect(rear.ir).toBeCloseTo(0.689205, 4);
    expect(rear.ir).not.toBeCloseTo(0.7071, 3);

    // Old stated IR -> derived IR, with the rates that followed it.
    expect(rear.wheelRate).toBeCloseTo(2600 * 0.689205 ** 2, 0);
    expect(rear.frequency).toBeCloseTo(10.0256, 4);
    expect(rear.critical).toBeCloseTo(39.2122, 3);

    const rearRates = buildAxleRates(model, 'rear');
    expect(rearRates.ok).toBe(true);
    if (!rearRates.ok) return;
    expect(rearRates.value.installationRatio.kind).toBe('defined');
    if (rearRates.value.installationRatio.kind !== 'defined') return;
    expect(rearRates.value.installationRatio.flags.has('assumedInput')).toBe(false);
    // The rear hardpoints are modelled, so the derived ratio is inferred, not firm.
    expect(rearRates.value.installationRatio.tier).toBe('inferred');
  });

  it('standing the damper up raises MR, k_w by IR² and f by √IR, and lowers ζ; roll centre and camber are bit-identical', () => {
    const baseline = parseReference();
    const before = numbers(baseline, 'front');
    const beforeView = solveFrontView(frontView(baseline, 'LF'));

    // On this left corner the lower eye is outboard of the upper eye, so
    // standing the damper up means moving damper_up.y outboard (44 -> 49 mm).
    const moved = edited(
      baseline,
      updateCornerPointMm(baseline, 'LF', 'damper_up', 1, 49),
    );
    const after = numbers(moved, 'front');
    const afterView = solveFrontView(frontView(moved, 'LF'));

    expect(after.ir).toBeGreaterThan(before.ir as number);
    expect(before.ir).toBeCloseTo(0.565308, 4);
    expect(after.ir).toBeCloseTo(0.586537, 4);

    expect((after.wheelRate as number) / (before.wheelRate as number)).toBeCloseTo(
      ((after.ir as number) / (before.ir as number)) ** 2,
      12,
    );
    expect((after.frequency as number) / (before.frequency as number)).toBeCloseTo(
      (after.ir as number) / (before.ir as number),
      12,
    );
    expect(after.damping).toBeLessThan(before.damping as number);

    expect(afterView.rollCentreHeight).toEqual(beforeView.rollCentreHeight);
    expect(afterView.camberGain).toEqual(beforeView.camberGain);
  });

  it('leaning the same upper eye inboard lowers the motion ratio', () => {
    const baseline = parseReference();
    const before = numbers(baseline, 'front');
    const moved = edited(
      baseline,
      updateCornerPointMm(baseline, 'LF', 'damper_up', 1, 39),
    );
    const after = numbers(moved, 'front');
    expect(after.ir).toBeLessThan(before.ir as number);
    expect(after.ir).toBeCloseTo(0.540681, 4);
    expect(after.wheelRate).toBeLessThan(before.wheelRate as number);
  });

  it('moving the lower eye outboard lengthens the lever and raises the motion ratio', () => {
    const baseline = parseReference();
    const before = numbers(baseline, 'front');
    const moved = edited(
      baseline,
      updateCornerPointMm(baseline, 'LF', 'damper_lo', 1, 63),
    );
    const after = numbers(moved, 'front');
    expect(after.ir).toBeGreaterThan(before.ir as number);
    expect(after.ir).toBeCloseTo(0.608253, 4);
    expect(after.wheelRate).toBeCloseTo(
      (before.wheelRate as number) * ((after.ir as number) / (before.ir as number)) ** 2,
      6,
    );
  });

  it('keeps the two ends independent: moving the front damper leaves the rear bit-identical', () => {
    const baseline = parseReference();
    const rearBefore = snapshot(baseline, 'rear');
    const moved = edited(
      baseline,
      updateCornerPointMm(baseline, 'LF', 'damper_up', 1, 49),
    );
    const rearAfter = snapshot(moved, 'rear');

    expect(rearAfter.rates).toEqual(rearBefore.rates);
    expect(rearAfter.damping).toEqual(rearBefore.damping);
    expect(rearAfter.roll.rear).toEqual(rearBefore.roll.rear);
  });
});
