import { describe, expect, it } from 'vitest';
import {
  solveAntiDive,
  solveAntiDiveCurve,
  type AntiDiveInput,
  type Confidence,
  type SideViewAxleInput,
  type Sourced,
  type Vec3,
} from '../src/index.js';

const MM = 1 / 1000;
const G = 9.81;

function sourced<T>(ref: string, value: T, confidence: Confidence = 'measured'): Sourced<T> {
  return { ref, value, confidence };
}

function point(ref: string, x: number, y: number, z: number): Sourced<Vec3> {
  return sourced(ref, { x: x * MM, y: y * MM, z: z * MM });
}

function frontAxle(rearScrewZ = 12): SideViewAxleInput {
  return {
    lowerInnerA_m: point('LF.points.lca_in_a', 238, 30, 12),
    lowerInnerB_m: point('LF.points.lca_in_b', 272, 30, rearScrewZ),
    lowerOuter_m: point('LF.points.lca_out', 259, 78, 7),
    upperInner_m: point('LF.points.uca_in', 250, 42, 45),
    upperOuter_m: point('LF.points.uca_out', 254, 72.8, 44),
    contactPatchX_m: sourced('body.wheelbase', 257 * MM),
  };
}

function rearAxle(rearScrewZ = 16): SideViewAxleInput {
  return {
    lowerInnerA_m: point('LR.points.lca_in_a', -20, 30, 16),
    lowerInnerB_m: point('LR.points.lca_in_b', 14, 30, rearScrewZ),
    lowerOuter_m: point('LR.points.lca_out', 1, 78, 7),
    upperInner_m: point('LR.points.uca_in', -4, 44, 52),
    upperOuter_m: point('LR.points.uca_out', 0, 72.8, 53),
    contactPatchX_m: sourced('rear.contact_patch_x', 0),
  };
}

function input(overrides: Partial<AntiDiveInput> = {}): AntiDiveInput {
  return {
    front: frontAxle(),
    rear: rearAxle(),
    wheelbase_m: sourced('body.wheelbase', 257 * MM),
    cgHeight_m: sourced('body.cg.height', 28 * MM, 'estimated'),
    cgHeightBand_m: { low: 24 * MM, high: 32 * MM },
    totalMass_kg: sourced('body.mass.total', 1.35),
    frontMassShare: sourced('body.cg.front_mass_share', 0.45, 'derived'),
    longitudinalAcceleration_mps2: -G,
    ...overrides,
  };
}

function valueOf(solved: { kind: string; value?: number }, label: string): number {
  if (solved.kind !== 'defined' || solved.value === undefined) {
    throw new Error(`${label} is ${solved.kind}`);
  }
  return solved.value;
}

describe('anti-dive and anti-squat from two inner pivot screws (#34)', () => {
  it('returns exactly 0.0 % at both ends when the two screws are level, across the plotted range', () => {
    const curve = solveAntiDiveCurve(input());
    expect(curve.samples.length).toBeGreaterThan(10);
    for (const sample of curve.samples) {
      expect(valueOf(sample.antiDivePercent, 'anti-dive')).toBe(0);
      expect(valueOf(sample.antiSquatPercent, 'anti-squat')).toBe(0);
    }
    const atBraking = solveAntiDive(input({ longitudinalAcceleration_mps2: -G }));
    expect(valueOf(atBraking.front.percent, 'anti-dive')).toBe(0);
    expect(valueOf(atBraking.rear.percent, 'anti-squat')).toBe(0);
  });

  it('reproduces the hand calculation: tan θ from the side-view intersection', () => {
    const shimmed = input({
      front: frontAxle(14),
      longitudinalAcceleration_mps2: -G,
    });
    const solved = solveAntiDive(shimmed);
    // Lower line through (259, 7) with slope 2/34; upper through (250, 45) and
    // (254, 44) with slope -0.25. Their intersection is (374.76, 13.81) mm.
    expect(valueOf(solved.front.tanTheta, 'tan θ')).toBeCloseTo(-0.1173, 4);
    expect(solved.front.working.instantCentreX_m).toBeCloseTo(374.76 * MM, 5);
    expect(solved.front.working.instantCentreZ_m).toBeCloseTo(13.81 * MM, 5);
    expect(solved.front.working.lowerSlope).toBeCloseTo(2 / 34, 12);
  });

  it('reproduces the hand calculation: Fz_front / m at 1.0 g', () => {
    const solved = solveAntiDive(input({ longitudinalAcceleration_mps2: -G }));
    // (m·g·0.45 + m·g·h/L) / m = 9.81·0.45 + 9.81·0.028/0.257 = 5.4833 m/s²
    expect(valueOf(solved.front.axleLoadPerMass_mps2, 'Fz_front/m')).toBeCloseTo(5.4833, 4);
    expect(valueOf(solved.front.dynamicAxleLoad_N, 'Fz_front')).toBeCloseTo(7.4024, 4);
  });

  it('makes the rear screw up a pro-dive at the front, with the right sign', () => {
    const level = solveAntiDive(input({ longitudinalAcceleration_mps2: -G }));
    const rearScrewUp = solveAntiDive(
      input({ front: frontAxle(14), longitudinalAcceleration_mps2: -G }),
    );
    expect(valueOf(level.front.percent, 'level anti-dive')).toBe(0);
    expect(valueOf(rearScrewUp.front.percent, 'pro-dive')).toBeLessThan(0);
  });

  it('makes the rear screw up a pro-squat at the rear, and is monotonic there too', () => {
    const level = solveAntiDive(input({ longitudinalAcceleration_mps2: G }));
    expect(valueOf(level.rear.percent, 'level anti-squat')).toBe(0);

    const values = [1, 2, 3, 4, 5].map((shimMm) =>
      valueOf(
        solveAntiDive(
          input({ rear: rearAxle(16 + shimMm), longitudinalAcceleration_mps2: G }),
        ).rear.percent,
        `anti-squat at ${shimMm} mm`,
      ),
    );
    expect(values[0]).toBeCloseTo(-23.71, 1);
    expect(values[4]).toBeCloseTo(-781.8, 1);
    for (let index = 1; index < values.length; index += 1) {
      expect(values[index]!).toBeLessThan(values[index - 1]!);
    }
  });

  it('is monotonic in Δz at the front over 1–5 mm', () => {
    const values = [1, 2, 3, 4, 5].map((shimMm) =>
      valueOf(
        solveAntiDive(
          input({ front: frontAxle(12 + shimMm), longitudinalAcceleration_mps2: -G }),
        ).front.percent,
        `anti-dive at ${shimMm} mm`,
      ),
    );
    for (let index = 1; index < values.length; index += 1) {
      expect(values[index]!).toBeLessThan(values[index - 1]!);
    }
    expect(values[0]).toBeCloseTo(-416.86, 1);
    expect(values[4]).toBeCloseTo(-1106.83, 1);
  });

  it('is monotonic in |a_x| at fixed geometry', () => {
    const magnitudes = [0.25, 0.5, 1.0, 1.5, 2.0].map((g) =>
      valueOf(
        solveAntiDive(
          input({ front: frontAxle(14), longitudinalAcceleration_mps2: -g * G }),
        ).front.percent,
        `anti-dive at ${g} g`,
      ),
    );
    for (let index = 1; index < magnitudes.length; index += 1) {
      expect(magnitudes[index]!).toBeLessThan(magnitudes[index - 1]!);
    }
  });

  it('treats an exact zero-slope parallel pair as the defined zero limit', () => {
    const axle: SideViewAxleInput = {
      ...frontAxle(),
      upperInner_m: point('LF.points.uca_in', 250, 42, 12),
      upperOuter_m: point('LF.points.uca_out', 254, 72.8, 12),
    };
    const solved = solveAntiDive(
      input({ front: axle, longitudinalAcceleration_mps2: -G }),
    );
    expect(valueOf(solved.front.percent, 'zero limit')).toBe(0);
  });

  it('refuses non-zero-slope parallel side-view links with the reason named', () => {
    const axle: SideViewAxleInput = {
      ...frontAxle(14),
      upperInner_m: point('LF.points.uca_in', 250, 42, 40),
      upperOuter_m: point('LF.points.uca_out', 254, 72.8, 40 + (4 * 2) / 34),
    };
    const solved = solveAntiDive(
      input({ front: axle, longitudinalAcceleration_mps2: -G }),
    );
    expect(solved.front.percent.kind).toBe('undefined');
    if (solved.front.percent.kind !== 'undefined') return;
    expect(solved.front.percent.reason).toBe('parallelLinks');
  });

  it('refuses a missing CG height with the field named', () => {
    const solved = solveAntiDive(input({ cgHeight_m: null }));
    expect(solved.front.percent.kind).toBe('undefined');
    if (solved.front.percent.kind !== 'undefined') return;
    expect(solved.front.percent.reason).toBe('incompleteModel');
    expect(solved.front.percent.inputs).toContain('body.cg.height');
  });
});
