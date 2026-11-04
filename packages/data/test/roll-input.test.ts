import { describe, expect, it } from 'vitest';
import { solveRollStiffness } from '@setuplab/physics';
import rawModel from '../../../assets/models/reference-touring-car.json';
import { buildRollStiffnessInput, parseCarModel } from '../src/index.js';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

describe('anti-roll bar and roll-stiffness data', () => {
  it('exposes the front and rear ARB and spring fields with their sources', () => {
    const parsed = parseCarModel(rawModel);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const front = parsed.value.axles.front;
    expect(front.springRate?.value).toBeCloseTo(3.5, 12);
    expect(front.arb?.type).toBe('torsion_bar');
    expect(front.arb?.barDiameter?.value).toBeCloseTo(1.5, 12);
    expect(front.arb?.barDiameter?.source).toBe('s_worked');
    expect(front.arb?.barDiameter?.confidence).toBe('measured');
    expect(front.arb?.span?.value).toBeCloseTo(90, 12);
    expect(front.arb?.armLength?.value).toBeCloseTo(20, 12);
    expect(front.arb?.shearModulus?.value).toBeCloseTo(79.3, 12);

    const rear = parsed.value.axles.rear;
    expect(rear).not.toBeNull();
    if (rear === null) return;
    expect(rear.track.value).toBeCloseTo(174, 12);
    expect(rear.springRate?.value).toBeCloseTo(2.6, 12);
    expect(rear.arb?.type).toBe('torsion_bar');
    expect(rear.arb?.barDiameter?.value).toBeCloseTo(1.2, 12);
    expect(rear.arb?.barDiameter?.source).toBe('s_worked');
  });

  it('builds SI roll input from the reference asset and keeps the front golden', () => {
    const parsed = parseCarModel(rawModel);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const input = buildRollStiffnessInput(parsed.value);
    expect(input.ok).toBe(true);
    if (!input.ok) return;

    expect(input.value.front.antiRollBar.barDiameter_m?.value).toBeCloseTo(0.0015, 12);
    expect(input.value.front.antiRollBar.span_m?.value).toBeCloseTo(0.09, 12);
    expect(input.value.front.antiRollBar.armLength_m?.value).toBeCloseTo(0.02, 12);
    expect(input.value.front.antiRollBar.shearModulus_Pa?.value).toBeCloseTo(79.3e9, 3);
    expect(input.value.front.track_m?.value).toBeCloseTo(0.172, 12);
    expect(input.value.rear.track_m?.value).toBeCloseTo(0.174, 12);
    expect(input.value.rear.antiRollBar.barDiameter_m?.value).toBeCloseTo(0.0012, 12);

    const frontWheelRate = input.value.front.springWheelRate_Npm;
    expect(frontWheelRate.kind).toBe('defined');
    if (frontWheelRate.kind === 'defined') {
      expect(relativeError(frontWheelRate.value, 1118.51)).toBeLessThanOrEqual(1e-4);
    }
    const rearWheelRate = input.value.rear.springWheelRate_Npm;
    expect(rearWheelRate.kind).toBe('defined');
    if (rearWheelRate.kind === 'defined') {
      expect(relativeError(rearWheelRate.value, 1235.01)).toBeLessThanOrEqual(1e-4);
    }

    const result = solveRollStiffness(input.value);
    expect(result.front.rollStiffness.kind).toBe('defined');
    expect(result.rear.rollStiffness.kind).toBe('defined');
    expect(result.frontShare.kind).toBe('defined');
    if (
      result.front.rollStiffness.kind !== 'defined' ||
      result.rear.rollStiffness.kind !== 'defined' ||
      result.frontShare.kind !== 'defined'
    ) {
      return;
    }
    expect(relativeError(result.front.rollStiffness.value, 37.274)).toBeLessThanOrEqual(1e-4);
    expect(relativeError(result.rear.rollStiffness.value, 22.7393)).toBeLessThanOrEqual(1e-4);
    expect(relativeError(result.frontShare.value * 100, 62.1096)).toBeLessThanOrEqual(1e-4);

    expect(input.value.front.antiRollBar.motionRatio?.value).toBeCloseTo(0.8, 12);
    expect(input.value.front.antiRollBar.motionRatio?.confidence).toBe('assumed');
    expect(input.value.rear.antiRollBar.motionRatio?.value).toBeCloseTo(0.5457187, 7);
    expect(input.value.rear.antiRollBar.motionRatio?.confidence).toBe('modelled');
    expect(input.value.rear.antiRollBar.motionRatio?.ref).toBe('LR.points.arb_drop');
  });

  it('carries a missing ARB span into the physics result as a named refusal', () => {
    const broken = clone(rawModel) as {
      axles: { front: { arb: Record<string, unknown> } };
    };
    delete broken.axles.front.arb['span'];

    const parsed = parseCarModel(broken);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const input = buildRollStiffnessInput(parsed.value);
    expect(input.ok).toBe(true);
    if (!input.ok) return;
    expect(input.value.front.antiRollBar.span_m).toBeNull();

    const result = solveRollStiffness(input.value);
    expect(result.front.rollStiffness.kind).toBe('undefined');
    if (result.front.rollStiffness.kind === 'undefined') {
      expect(result.front.rollStiffness.inputs).toContain('axles.front.arb.span');
    }
    expect(result.rear.rollStiffness.kind).toBe('defined');
  });

  it('takes rate_at_link as the fitted bar rate when a blade bar has no blade count (D-24)', () => {
    const blade = clone(rawModel) as {
      axles: { front: { arb: Record<string, unknown> } };
    };
    blade.axles.front.arb = {
      type: 'blade',
      rate_at_link: { value: 2.1, source: 's_worked' },
    };

    const parsed = parseCarModel(blade);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.axles.front.arb?.blades).toBeNull();

    const input = buildRollStiffnessInput(parsed.value);
    expect(input.ok).toBe(true);
    if (!input.ok) return;
    expect(input.value.front.antiRollBar.blades?.value).toBe(1);

    const result = solveRollStiffness(input.value);
    expect(result.front.antiRollBar.rateAtLink.kind).toBe('defined');
    if (result.front.antiRollBar.rateAtLink.kind !== 'defined') return;
    expect(result.front.antiRollBar.rateAtLink.value).toBeCloseTo(2100, 9);
  });

  it('multiplies rate_at_link by a present blade count (G05.12, D-24)', () => {
    const blade = clone(rawModel) as {
      axles: { front: { arb: Record<string, unknown> } };
    };
    blade.axles.front.arb = {
      type: 'blade',
      rate_at_link: { value: 2.1, source: 's_worked' },
      blades: { value: 2, source: 's_worked' },
    };

    const parsed = parseCarModel(blade);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.axles.front.arb?.blades?.value).toBe(2);
    expect(parsed.value.axles.front.arb?.blades?.source).toBe('s_worked');

    const input = buildRollStiffnessInput(parsed.value);
    expect(input.ok).toBe(true);
    if (!input.ok) return;

    const result = solveRollStiffness(input.value);
    expect(result.front.antiRollBar.rateAtLink.kind).toBe('defined');
    if (result.front.antiRollBar.rateAtLink.kind !== 'defined') return;
    expect(result.front.antiRollBar.rateAtLink.value).toBeCloseTo(4200, 9);
  });

  it('keeps a fixed bar as the fitted rate with a single bar', () => {
    const fixed = clone(rawModel) as {
      axles: { front: { arb: Record<string, unknown> } };
    };
    fixed.axles.front.arb = {
      type: 'fixed',
      rate_at_link: { value: 2.1, source: 's_worked' },
    };

    const parsed = parseCarModel(fixed);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const input = buildRollStiffnessInput(parsed.value);
    expect(input.ok).toBe(true);
    if (!input.ok) return;
    expect(input.value.front.antiRollBar.blades?.value).toBe(1);

    const result = solveRollStiffness(input.value);
    expect(result.front.antiRollBar.rateAtLink.kind).toBe('defined');
    if (result.front.antiRollBar.rateAtLink.kind !== 'defined') return;
    expect(result.front.antiRollBar.rateAtLink.value).toBeCloseTo(2100, 9);
  });

  it('still refuses a blade bar with no rate_at_link and names the field', () => {
    const blade = clone(rawModel) as {
      axles: { front: { arb: Record<string, unknown> } };
    };
    blade.axles.front.arb = { type: 'blade' };

    const parsed = parseCarModel(blade);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const input = buildRollStiffnessInput(parsed.value);
    expect(input.ok).toBe(true);
    if (!input.ok) return;

    const result = solveRollStiffness(input.value);
    expect(result.front.rollStiffness.kind).toBe('undefined');
    if (result.front.rollStiffness.kind === 'undefined') {
      expect(result.front.rollStiffness.inputs).toContain('axles.front.arb.rate_at_link');
    }
  });

  it('does not invent rear roll stiffness when the rear axle is absent', () => {
    const broken = clone(rawModel) as { axles: { rear?: unknown } };
    delete broken.axles.rear;

    const parsed = parseCarModel(broken);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.axles.rear).toBeNull();

    const input = buildRollStiffnessInput(parsed.value);
    expect(input.ok).toBe(false);
    if (input.ok) return;
    expect(input.errors.some((error) => error.path === 'axles.rear')).toBe(true);
  });
});
