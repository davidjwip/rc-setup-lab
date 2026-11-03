import { describe, expect, it } from 'vitest';
import {
  defined,
  solveAntiRollBar,
  solveRollStiffness,
  type AntiRollBarInput,
  type Confidence,
  type RollStiffnessInput,
  type Sourced,
} from '../src/index.js';

const G_STEEL_PA = 79.3e9;

function sourced<T>(ref: string, value: T, confidence: Confidence = 'measured'): Sourced<T> {
  return { ref, value, confidence };
}

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

function torsionBar(overrides: Partial<AntiRollBarInput> = {}): AntiRollBarInput {
  return {
    type: 'torsion_bar',
    axle: 'front',
    barDiameter_m: sourced('axles.front.arb.bar_diameter', 0.0015),
    span_m: sourced('axles.front.arb.span', 0.09),
    armLength_m: sourced('axles.front.arb.arm_length', 0.02),
    shearModulus_Pa: sourced('axles.front.arb.shear_modulus', G_STEEL_PA),
    motionRatio: sourced('axles.front.arb.motion_ratio', 0.8, 'assumed'),
    ...overrides,
  } as AntiRollBarInput;
}

function referenceRollInput(overrides: {
  front?: Partial<RollStiffnessInput['front']>;
  rear?: Partial<RollStiffnessInput['rear']>;
} = {}): RollStiffnessInput {
  return {
    front: {
      axle: 'front',
      springWheelRate_Npm: defined(1118.51),
      antiRollBar: torsionBar(),
      track_m: sourced('axles.front.track', 0.172),
      ...overrides.front,
    },
    rear: {
      axle: 'rear',
      springWheelRate_Npm: defined(1299.98),
      antiRollBar: torsionBar({
        axle: 'rear',
        barDiameter_m: sourced('axles.rear.arb.bar_diameter', 0.0012),
        span_m: sourced('axles.rear.arb.span', 0.09),
        armLength_m: sourced('axles.rear.arb.arm_length', 0.02),
        shearModulus_Pa: sourced('axles.rear.arb.shear_modulus', G_STEEL_PA),
        motionRatio: sourced('axles.rear.arb.motion_ratio', 0.8, 'assumed'),
      }),
      track_m: sourced('axles.rear.track', 0.174),
      ...overrides.rear,
    },
  };
}

describe('anti-roll bar and roll stiffness goldens (docs/specs/physics/05-rates.md §7)', () => {
  it('G05.4 torsion bar: d = 1.50, L = 90, a = 20, IR_arm = 0.80, G = 79.3 GPa → k_bar = 0.70067 N/mm', () => {
    const result = solveAntiRollBar(torsionBar());
    expect(result.wheelRate.kind).toBe('defined');
    if (result.wheelRate.kind !== 'defined') return;
    expect(relativeError(result.wheelRate.value / 1000, 0.70067)).toBeLessThanOrEqual(1e-4);
  });

  it('G05.5 front axle, §6.4 data: k_φ,f = 37.274 N·m/rad and front share 56.78 %', () => {
    const result = solveRollStiffness(referenceRollInput());
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

  it('G05.10 unit safety: a_arm as 20 mm and as 0.020 m give the identical k_bar = 0.70067 N/mm', () => {
    const armMillimetres = 20;
    const fromMillimetres = solveAntiRollBar(
      torsionBar({ armLength_m: sourced('axles.front.arb.arm_length', armMillimetres / 1000) }),
    );
    const fromMetres = solveAntiRollBar(
      torsionBar({ armLength_m: sourced('axles.front.arb.arm_length', 0.02) }),
    );
    expect(fromMillimetres.wheelRate.kind).toBe('defined');
    expect(fromMetres.wheelRate.kind).toBe('defined');
    if (fromMillimetres.wheelRate.kind !== 'defined' || fromMetres.wheelRate.kind !== 'defined') {
      return;
    }
    expect(fromMillimetres.wheelRate.value).toBe(fromMetres.wheelRate.value);
    expect(relativeError(fromMetres.wheelRate.value / 1000, 0.70067)).toBeLessThanOrEqual(1e-4);
  });

  it('G05.12 blade bar: n = 2 identical blades give twice the single-blade rate (parallel)', () => {
    const one = solveAntiRollBar({
      type: 'blade',
      axle: 'front',
      singleBladeRate_Npm: sourced('axles.front.arb.rate_at_link', 500),
      blades: sourced('axles.front.arb.blades', 1, 'manufacturer'),
      motionRatio: sourced('axles.front.arb.motion_ratio', 0.8, 'assumed'),
    });
    const two = solveAntiRollBar({
      type: 'blade',
      axle: 'front',
      singleBladeRate_Npm: sourced('axles.front.arb.rate_at_link', 500),
      blades: sourced('axles.front.arb.blades', 2, 'manufacturer'),
      motionRatio: sourced('axles.front.arb.motion_ratio', 0.8, 'assumed'),
    });
    expect(one.wheelRate.kind).toBe('defined');
    expect(two.wheelRate.kind).toBe('defined');
    if (one.wheelRate.kind !== 'defined' || two.wheelRate.kind !== 'defined') return;
    expect(relativeError(two.wheelRate.value, 2 * one.wheelRate.value)).toBeLessThanOrEqual(1e-12);
    expect(one.working.rateAtLink_Npm).toBeCloseTo(500, 9);
    expect(two.working.rateAtLink_Npm).toBeCloseTo(1000, 9);
  });
});

describe('anti-roll bar and roll stiffness degenerate cases (05 §5)', () => {
  it('no bar fitted is a defined zero contribution, not an exception', () => {
    const bar = solveAntiRollBar({ type: 'none', axle: 'front' });
    expect(bar.fitted).toBe(false);
    expect(bar.rateAtLink.kind).toBe('defined');
    expect(bar.wheelRate.kind).toBe('defined');
    if (bar.rateAtLink.kind !== 'defined' || bar.wheelRate.kind !== 'defined') return;
    expect(bar.rateAtLink.value).toBe(0);
    expect(bar.wheelRate.value).toBe(0);
  });

  it('a torsion bar with no span refuses roll stiffness and names the missing field', () => {
    const bar = solveAntiRollBar(torsionBar({ span_m: null }));
    expect(bar.wheelRate.kind).toBe('undefined');
    if (bar.wheelRate.kind === 'undefined') {
      expect(bar.wheelRate.reason).toBe('incompleteModel');
      expect(bar.wheelRate.inputs).toContain('axles.front.arb.span');
    }

    const roll = solveRollStiffness(referenceRollInput({ front: { antiRollBar: torsionBar({ span_m: null }) } }));
    expect(roll.front.rollStiffness.kind).toBe('undefined');
    if (roll.front.rollStiffness.kind === 'undefined') {
      expect(roll.front.rollStiffness.inputs).toContain('axles.front.arb.span');
    }
    // The spring side of the same axle still has its wheel rate; the rest of the screen keeps working.
    expect(roll.front.working.springWheelRate_Npm).toBeCloseTo(1118.51, 9);
    expect(roll.rear.rollStiffness.kind).toBe('defined');
  });

  it('a torsion bar with no arm length refuses roll stiffness and names the missing field', () => {
    const roll = solveRollStiffness(
      referenceRollInput({ front: { antiRollBar: torsionBar({ armLength_m: null }) } }),
    );
    expect(roll.front.rollStiffness.kind).toBe('undefined');
    if (roll.front.rollStiffness.kind === 'undefined') {
      expect(roll.front.rollStiffness.inputs).toContain('axles.front.arb.arm_length');
    }
  });

  it('a blade bar with no blade count is undefined, not an assumption', () => {
    const bar = solveAntiRollBar({
      type: 'blade',
      axle: 'front',
      singleBladeRate_Npm: sourced('axles.front.arb.rate_at_link', 500),
      blades: null,
      motionRatio: sourced('axles.front.arb.motion_ratio', 0.8, 'assumed'),
    });
    expect(bar.wheelRate.kind).toBe('undefined');
    if (bar.wheelRate.kind === 'undefined') {
      expect(bar.wheelRate.reason).toBe('incompleteModel');
      expect(bar.wheelRate.inputs).toContain('axles.front.arb.blades');
    }
  });

  it('front share is not measured when one axle has no data', () => {
    const roll = solveRollStiffness(
      referenceRollInput({ rear: { antiRollBar: { type: 'none', axle: 'rear' } } }),
    );
    // A no-bar axle is still a defined roll stiffness; only a missing spring/wheel rate would refuse.
    expect(roll.frontShare.kind).toBe('defined');
  });
});
