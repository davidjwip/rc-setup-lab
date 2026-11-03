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

  it('builds SI roll input and reproduces G05.5 from the reference asset', () => {
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
      expect(relativeError(rearWheelRate.value, 1299.98)).toBeLessThanOrEqual(1e-4);
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
    expect(relativeError(result.rear.rollStiffness.value, 28.368)).toBeLessThanOrEqual(1e-4);
    expect(relativeError(result.frontShare.value * 100, 56.78)).toBeLessThanOrEqual(1e-4);
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
