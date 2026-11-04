import { describe, expect, it } from 'vitest';
import { solveFrontView, solveLoadTransfer } from '@setuplab/physics';
import rawModel from '../../../assets/models/reference-touring-car.json';
import {
  buildFrontViewInput,
  buildLoadTransferInput,
  parseCarModel,
  reportedRollCentreHeightM,
  updateChassisRideHeight,
} from '../src/index.js';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withRaiseAndWeigh(document: ReturnType<typeof clone>): ReturnType<typeof clone> {
  const raw = document as {
    sources: Record<string, unknown>;
    body: { cg: Record<string, unknown> };
  };
  raw.sources['s_raise'] = {
    type: 'measured',
    method: 'raised rear 102 mm, front axle re-weighed',
  };
  raw.body.cg['raise_and_weigh'] = {
    raised_end: 'rear',
    raise_height: { value: 102, source: 's_raise' },
    axle_weight_level: { value: 840, source: 's_raise' },
    axle_weight_raised: { value: 855, source: 's_raise' },
    weighing_tolerance: { value: 5, source: 's_raise' },
  };
  return raw;
}

describe('measured CG route (D-26)', () => {
  it('reports measured when raise-and-weigh data is present', () => {
    const raw = withRaiseAndWeigh(clone(rawModel));
    const parsed = parseCarModel(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.cg.raiseAndWeigh?.raisedEnd).toBe('rear');

    const input = buildLoadTransferInput(parsed.value, 9.81);
    expect(input.ok).toBe(true);
    if (!input.ok) return;
    const result = solveLoadTransfer(input.value);
    expect(result.cgRoute).toBe('raise_and_weigh');
  });

  it('uses the measured height when the document has no stored CG z', () => {
    const raw = withRaiseAndWeigh(clone(rawModel)) as {
      sources: Record<string, unknown>;
      body: { cg: Record<string, unknown> };
    };
    delete raw.body.cg['height'];

    const parsed = parseCarModel(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const input = buildLoadTransferInput(parsed.value, 9.81);
    expect(input.ok).toBe(true);
    if (!input.ok) return;
    const result = solveLoadTransfer(input.value);
    expect(result.cgRoute).toBe('raise_and_weigh');
    expect(result.cgHeight.kind).toBe('defined');
    if (result.cgHeight.kind !== 'defined') return;
    // L 257, W 1350 g, h 102 mm, 840/855 g, r 32 mm → 38.604 mm.
    expect(Math.abs(result.cgHeight.value * 1000 - 38.604)).toBeLessThanOrEqual(0.01);
    expect(result.cgHeight.tier).toBe('firm');
    expect(result.cgHeight.flags.has('cgInferred')).toBe(false);
    expect(result.cgHeightBand).not.toBeNull();
  });

  it('labels the default route when no measurement or component table exists', () => {
    const parsed = parseCarModel(rawModel);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const input = buildLoadTransferInput(parsed.value, 9.81);
    expect(input.ok).toBe(true);
    if (!input.ok) return;
    const result = solveLoadTransfer(input.value);
    expect(result.cgRoute).toBe('stated_default');
    expect(result.cgHeight.kind).toBe('defined');
    if (result.cgHeight.kind !== 'defined') return;
    expect(Math.abs(result.cgHeight.value * 1000 - 28.0)).toBeLessThanOrEqual(1e-9);
    expect(result.cgHeightBand).not.toBeNull();
    if (result.cgHeightBand === null) return;
    expect(((result.cgHeightBand.high - result.cgHeightBand.low) / 2) * 1000).toBeCloseTo(4.0, 9);
  });

  it('lowering 5 mm drops the roll centres faster than the CG, increasing roll sensitivity', () => {
    const parsed = parseCarModel(rawModel);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const stock = parsed.value;
    const lowered = updateChassisRideHeight(stock, 0.0);
    if (!lowered.ok) throw new Error(JSON.stringify(lowered.errors));

    const measure = (model: typeof stock) => {
      const frontView = buildFrontViewInput(model, 'LF');
      const rearView = buildFrontViewInput(model, 'LR');
      if (!frontView.ok || !rearView.ok) throw new Error('front view failed');
      const frontRc = reportedRollCentreHeightM(model, solveFrontView(frontView.value));
      const rearRc = reportedRollCentreHeightM(model, solveFrontView(rearView.value));
      const input = buildLoadTransferInput(model, 9.81);
      if (!input.ok) throw new Error(JSON.stringify(input.errors));
      const result = solveLoadTransfer(input.value);
      if (frontRc === null || rearRc === null) throw new Error('roll centre refused');
      return {
        frontRcMm: frontRc * 1000,
        rearRcMm: rearRc * 1000,
        cgAboveGround_m: input.value.cgDefaultHeight_m?.value ?? Number.NaN,
        arm_m: result.working.rollMomentArm_m ?? Number.NaN,
        sensitivity: result.working.rollSensitivity_degPerG ?? Number.NaN,
        rollMoment: result.rollMoment,
        rollAxis: result.rollAxisHeight,
        sprungCg: result.working.sprungCgHeight_m,
      };
    };

    const at5 = measure(stock);
    const at0 = measure(lowered.value);

    // Stock invariants.
    expect(at5.frontRcMm).toBeCloseTo(9.9749, 4);
    expect(at5.rearRcMm).toBeCloseTo(17.898513, 6);
    expect(at5.cgAboveGround_m * 1000).toBeCloseTo(28.0, 9);
    expect(at5.arm_m * 1000).toBeCloseTo(15.396842, 6);
    expect(at5.sensitivity).toBeCloseTo(0.160066, 6);

    // 5 mm lower: both roll centres fall, the CG falls by exactly 5 mm, the arm grows.
    expect(at0.frontRcMm).toBeCloseTo(2.019457, 6);
    expect(at0.rearRcMm).toBeCloseTo(10.180266, 6);
    expect(at0.cgAboveGround_m * 1000).toBeCloseTo(23.0, 9);
    expect(at0.arm_m * 1000).toBeCloseTo(18.221828, 6);
    expect(at0.sensitivity).toBeCloseTo(0.191693, 6);

    expect(at0.frontRcMm).toBeLessThan(at5.frontRcMm);
    expect(at0.rearRcMm).toBeLessThan(at5.rearRcMm);
    // RC drops 7.96 mm front / 7.72 mm rear against the CG's 5 mm: the arm grows.
    expect(at5.cgAboveGround_m - at0.cgAboveGround_m).toBeCloseTo(0.005, 9);
    expect(at0.arm_m).toBeGreaterThan(at5.arm_m);
    expect(at0.sensitivity).toBeGreaterThan(at5.sensitivity);

    // The arm is the SPRUNG CG above the roll axis, not the whole-car CG.
    expect(at5.sprungCg).not.toBeNull();
    if (at5.sprungCg !== null && at5.rollAxis.kind === 'defined') {
      expect(at5.arm_m).toBeCloseTo(at5.sprungCg - at5.rollAxis.value, 12);
      expect(at5.arm_m).not.toBeCloseTo(at5.cgAboveGround_m - at5.rollAxis.value, 3);
    }
  });
});
