import { describe, expect, it } from 'vitest';
import {
  solveRates,
  solveRatesFromRatio,
  type Confidence,
  type FrontViewInput,
  type RatesInput,
  type Sourced,
  type Vec2,
} from '../src/index.js';

const MM = 1 / 1000;

function mm(value: number): number {
  return value * MM;
}

function sourced(ref: string, value: Vec2, confidence: Confidence = 'measured'): Sourced<Vec2> {
  return { ref, value, confidence };
}

function referenceFrontView(side: 1 | -1 = 1): FrontViewInput {
  const y = (value: number): number => side * mm(value);
  return {
    corner: side === 1 ? 'LF' : 'RF',
    side,
    lowerArmType: 'hinge',
    upperArmType: 'single_link',
    lcaIn_m: sourced('lca_in_a', { y: y(30), z: mm(12) }),
    lcaOut_m: sourced('lca_out', { y: y(78), z: mm(7) }),
    ucaIn_m: sourced('uca_in', { y: y(42), z: mm(45) }),
    ucaOut_m: sourced('uca_out', { y: y(72.8), z: mm(44) }),
    wheelCentre_m: sourced('wc', { y: y(86), z: mm(32) }),
    bumpLimit_m: mm(6),
    droopLimit_m: mm(6),
  };
}

function referenceRearView(): FrontViewInput {
  return {
    corner: 'LR',
    side: 1,
    lowerArmType: 'hinge',
    upperArmType: 'single_link',
    lcaIn_m: sourced('lca_in_a', { y: mm(30), z: mm(16) }),
    lcaOut_m: sourced('lca_out', { y: mm(80), z: mm(7) }),
    ucaIn_m: sourced('uca_in', { y: mm(44), z: mm(52) }),
    ucaOut_m: sourced('uca_out', { y: mm(73.5), z: mm(53) }),
    wheelCentre_m: sourced('wc', { y: mm(87), z: mm(32) }),
    bumpLimit_m: mm(6),
    droopLimit_m: mm(6),
  };
}

function referenceRatesInput(overrides: Partial<RatesInput> = {}): RatesInput {
  return {
    corner: 'LF',
    frontView: referenceFrontView(),
    damperLo_m: sourced('damper_lo', { y: mm(60), z: mm(8.875) }),
    damperUp_m: sourced('damper_up', { y: mm(44), z: mm(58) }),
    springRate_Npm: { value: 3500, ref: 'axles.front.spring.rate', confidence: 'manufacturer' },
    sprungMass_kg: { value: 0.24375, ref: 'body.mass.sprung_front', confidence: 'derived' },
    ...overrides,
  };
}

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

describe('rates goldens (docs/specs/physics/05-rates.md §7)', () => {
  it('G05.1 reference front damper geometry: IR = 0.565308 ± 1e-5', () => {
    const result = solveRates(referenceRatesInput());
    expect(result.installationRatio.kind).toBe('defined');
    if (result.installationRatio.kind !== 'defined') return;
    expect(Math.abs(result.installationRatio.value - 0.565308)).toBeLessThanOrEqual(1e-5);
  });

  it('G05.2 k_s = 3.50 N/mm and that IR: k_w = 1.11851 N/mm', () => {
    const result = solveRates(referenceRatesInput());
    expect(result.wheelRate.kind).toBe('defined');
    if (result.wheelRate.kind !== 'defined') return;
    const wheelRateNmm = result.wheelRate.value / 1000;
    expect(relativeError(wheelRateNmm, 1.11851)).toBeLessThanOrEqual(1e-4);
  });

  it('G05.3 k_w = 1.11851 N/mm, m_s = 0.24375 kg: f = 10.781 Hz, c_crit = 33.023 N·s/m', () => {
    const result = solveRates(referenceRatesInput());
    expect(result.rideFrequency.kind).toBe('defined');
    expect(result.criticalDamping.kind).toBe('defined');
    if (result.rideFrequency.kind !== 'defined' || result.criticalDamping.kind !== 'defined') return;
    expect(relativeError(result.rideFrequency.value, 10.781)).toBeLessThanOrEqual(1e-4);
    expect(relativeError(result.criticalDamping.value, 33.023)).toBeLessThanOrEqual(1e-4);
  });

  it('keeps the wheel rate when the sprung mass is absent, and names the missing field', () => {
    const result = solveRates(referenceRatesInput({ sprungMass_kg: null }));
    expect(result.wheelRate.kind).toBe('defined');
    expect(result.rideFrequency.kind).toBe('notMeasured');
    expect(result.criticalDamping.kind).toBe('notMeasured');
    if (result.rideFrequency.kind === 'notMeasured') {
      expect(result.rideFrequency.missing).toContain('body.mass.sprung_front');
    }
  });

  it('a stated installation ratio still solves: IR = 0.7071 gives f = 10.286 Hz, c_crit = 40.230 N·s/m', () => {
    const result = solveRatesFromRatio({
      corner: 'LR',
      installationRatio: { value: 0.7071, ref: 'assumed.IR_rear', confidence: 'assumed' },
      springRate_Npm: { value: 2600, ref: 'axles.rear.spring.rate', confidence: 'manufacturer' },
      sprungMass_kg: { value: 0.31125, ref: 'body.mass.sprung_rear', confidence: 'derived' },
    });
    expect(result.installationRatio.kind).toBe('defined');
    expect(result.rideFrequency.kind).toBe('defined');
    expect(result.criticalDamping.kind).toBe('defined');
    if (
      result.installationRatio.kind !== 'defined' ||
      result.rideFrequency.kind !== 'defined' ||
      result.criticalDamping.kind !== 'defined'
    ) {
      return;
    }
    expect(result.installationRatio.value).toBe(0.7071);
    expect(relativeError(result.rideFrequency.value, 10.286)).toBeLessThanOrEqual(1e-4);
    expect(relativeError(result.criticalDamping.value, 40.23)).toBeLessThanOrEqual(1e-4);
    // §6.5: the reference car has no rear hardpoints, so this ratio is not computed from geometry.
    expect(result.installationRatio.tier).toBe('inferred');
    expect(result.installationRatio.flags.has('assumedInput')).toBe(true);
  });

  it('G05.7 damper axis perpendicular to the arm motion: Undefined(noMotionRatio)', () => {
    // D_lo moves tangentially about the lower-arm hinge. A damper along the arm line
    // (parallel to L_o - L_i) is exactly perpendicular to that motion.
    const result = solveRates(
      referenceRatesInput({
        damperUp_m: sourced('damper_up', { y: mm(12), z: mm(13.875) }),
      }),
    );
    expect(result.installationRatio.kind).toBe('undefined');
    if (result.installationRatio.kind === 'undefined') {
      expect(result.installationRatio.reason).toBe('noMotionRatio');
    }
    expect(result.wheelRate.kind).toBe('undefined');
    if (result.wheelRate.kind === 'undefined') {
      expect(result.wheelRate.reason).toBe('noMotionRatio');
    }
  });

  it('G05.11 damper lengthens in bump: Defined with IR < 0 and lowConfidence, not an error', () => {
    // D_up below D_lo: the damper extends as the wheel rises.
    const result = solveRates(
      referenceRatesInput({
        damperUp_m: sourced('damper_up', { y: mm(44), z: mm(-40.25) }),
      }),
    );
    expect(result.installationRatio.kind).toBe('defined');
    if (result.installationRatio.kind !== 'defined') return;
    expect(result.installationRatio.value).toBeLessThan(0);
    expect(result.installationRatio.flags.has('lowConfidence')).toBe(true);
    expect(result.wheelRate.kind).toBe('defined');
  });

  it('G05.13 coincident damper mounts: Undefined(coincidentPoints), never Infinity or NaN', () => {
    const result = solveRates(
      referenceRatesInput({
        damperUp_m: sourced('damper_up', { y: mm(60), z: mm(8.875) }),
      }),
    );
    expect(result.installationRatio.kind).toBe('undefined');
    if (result.installationRatio.kind === 'undefined') {
      expect(result.installationRatio.reason).toBe('coincidentPoints');
      expect(result.installationRatio.inputs).toContain('damper_lo');
      expect(result.installationRatio.inputs).toContain('damper_up');
    }
    expect(result.wheelRate.kind).toBe('undefined');
    if (result.wheelRate.kind === 'undefined') {
      expect(result.wheelRate.reason).toBe('coincidentPoints');
    }
    expect(result.working.installationRatio).toBeNull();
    expect(result.working.wheelRate_Npm).toBeNull();
    expect(Number.isFinite(result.working.damperLengthLow_m ?? Number.NaN)).toBe(true);
  });

  it('G05.6 reference rear damper geometry: IR = 0.689205, f = 10.026 Hz, c_crit = 39.212 N·s/m', () => {
    const rear = referenceRatesInput({
      corner: 'LR',
      frontView: referenceRearView(),
      damperLo_m: sourced('damper_lo', { y: mm(68), z: mm(9) }),
      damperUp_m: sourced('damper_up', { y: mm(56), z: mm(63) }),
      springRate_Npm: { value: 2600, ref: 'axles.rear.spring.rate', confidence: 'measured' },
      sprungMass_kg: { value: 0.311245, ref: 'body.mass.sprung_rear', confidence: 'derived' },
    });
    const result = solveRates(rear);
    expect(result.installationRatio.kind).toBe('defined');
    if (result.installationRatio.kind !== 'defined') return;
    // Independent 2-D four-bar hand check, hθ = 1e-3 rad about lca_in_a:
    // IR = 0.689205; the shipped ±0.5 mm wheel step agrees inside 1e-5.
    expect(Math.abs(result.installationRatio.value - 0.689205)).toBeLessThanOrEqual(1e-5);
    expect(result.installationRatio.flags.has('assumedInput')).toBe(false);
    expect(result.wheelRate.kind).toBe('defined');
    if (result.wheelRate.kind !== 'defined') return;
    expect(relativeError(result.wheelRate.value, 1235.0109)).toBeLessThanOrEqual(1e-4);
    expect(result.rideFrequency.kind).toBe('defined');
    if (result.rideFrequency.kind !== 'defined') return;
    expect(relativeError(result.rideFrequency.value, 10.02546)).toBeLessThanOrEqual(1e-4);
    expect(result.criticalDamping.kind).toBe('defined');
    if (result.criticalDamping.kind !== 'defined') return;
    expect(relativeError(result.criticalDamping.value, 39.21178)).toBeLessThanOrEqual(1e-4);
  });

  it('G05.9 mass budget: 2·m_s,f + 2·m_s,r + m_u = m_total = 1.350 kg to 1e-9', () => {
    const mSprungFrontCorner = 0.24375;
    const mSprungRearCorner = 0.31125;
    const mUnsprung = 0.24;
    const mTotal = 1.35;
    const sum = 2 * mSprungFrontCorner + 2 * mSprungRearCorner + mUnsprung;
    expect(Math.abs(sum - mTotal)).toBeLessThanOrEqual(1e-9);
  });
});
