import { describe, expect, it } from 'vitest';
import {
  solveRaiseAndWeigh,
  type Confidence,
  type RaiseAndWeighInput,
  type Sourced,
} from '../src/index.js';

const MM = 1 / 1000;
const G = 1000;

function sourced<T>(ref: string, value: T, confidence: Confidence = 'measured'): Sourced<T> {
  return { ref, value, confidence };
}

function measuredInput(overrides: Partial<RaiseAndWeighInput> = {}): RaiseAndWeighInput {
  return {
    wheelbase_m: sourced('body.wheelbase', 280 * MM),
    totalMass_kg: sourced('body.mass.total', 1600 / G),
    raisedEnd: 'rear',
    raiseHeight_m: sourced('body.cg.raise_and_weigh.raise_height', 102 * MM),
    axleWeightLevel_kg: sourced('body.cg.raise_and_weigh.axle_weight_level', 840 / G),
    axleWeightRaised_kg: sourced('body.cg.raise_and_weigh.axle_weight_raised', 855 / G),
    wheelRadius_m: sourced('axles.front.tyre_radius', 32 * MM),
    weighingTolerance_kg: sourced('body.cg.raise_and_weigh.weighing_tolerance', 5 / G),
    ...overrides,
  };
}

describe('raised-axle CG measurement (D-26)', () => {
  it('reproduces the hand calculation: L 280, W 1600 g, h 102, 840/855 g → 38.71 mm', () => {
    const result = solveRaiseAndWeigh(measuredInput());
    expect(result.cgHeight_m.kind).toBe('defined');
    if (result.cgHeight_m.kind !== 'defined') return;
    // Hand calculation in PR: θ = asin(102/280); L/tanθ = 715.83 mm;
    // (15/1600) × 715.83 + 32 = 38.711 mm.
    expect(Math.abs(result.cgHeight_m.value * 1000 - 38.711)).toBeLessThanOrEqual(0.002);
    expect(result.cgHeight_m.tier).toBe('firm');
    expect(result.cgHeight_m.flags.has('cgInferred')).toBe(false);
  });

  it('a 5 g error on the raised reading moves the height by 2.237 mm', () => {
    const base = solveRaiseAndWeigh(measuredInput());
    const shifted = solveRaiseAndWeigh(
      measuredInput({
        axleWeightRaised_kg: sourced(
          'body.cg.raise_and_weigh.axle_weight_raised',
          (855 + 5) / G,
        ),
      }),
    );
    expect(base.cgHeight_m.kind).toBe('defined');
    expect(shifted.cgHeight_m.kind).toBe('defined');
    if (base.cgHeight_m.kind !== 'defined' || shifted.cgHeight_m.kind !== 'defined') return;
    expect(Math.abs((shifted.cgHeight_m.value - base.cgHeight_m.value) * 1000 - 2.237)).toBeLessThanOrEqual(
      0.002,
    );
  });

  it('carries the weighing tolerance into an absolute band', () => {
    const result = solveRaiseAndWeigh(measuredInput());
    expect(result.cgHeight_m.kind).toBe('defined');
    if (result.cgHeight_m.kind !== 'defined') return;
    // ±5 g on each of two readings, in quadrature: √2 × 5/1600 × 715.83 = 3.163 mm.
    expect(result.band_m).not.toBeNull();
    if (result.band_m === null) return;
    const halfWidth = ((result.band_m.high - result.band_m.low) / 2) * 1000;
    expect(Math.abs(halfWidth - 3.163)).toBeLessThanOrEqual(0.003);
    expect(result.cgHeight_m.band).toEqual(result.band_m);
  });

  it('refuses degenerate geometry instead of returning NaN', () => {
    const result = solveRaiseAndWeigh(measuredInput({ raiseHeight_m: sourced('raise', 280 * MM) }));
    expect(result.cgHeight_m.kind).toBe('undefined');
    if (result.cgHeight_m.kind === 'undefined') {
      expect(result.cgHeight_m.reason).toBe('outOfDomain');
    }
  });
});
