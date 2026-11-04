import { describe, expect, it } from 'vitest';
import {
  CAMBER_STEER_ANGLES_RAD,
  buildCamberInSteerSeries,
  solveAntiDive,
  solveCamberInSteer,
  solveSteeringAxis,
  type AntiDiveInput,
  type CasterInput,
  type Confidence,
  type SideViewAxleInput,
  type Sourced,
  type Vec3,
} from '../src/index.js';

const MM = 1 / 1000;
const DEG = Math.PI / 180;

function sourced<T>(ref: string, value: T, confidence: Confidence = 'measured'): Sourced<T> {
  return { ref, value, confidence };
}

function point(ref: string, x: number, y: number, z: number): Sourced<Vec3> {
  return sourced(ref, { x: x * MM, y: y * MM, z: z * MM });
}

function reference(side: 1 | -1 = 1): CasterInput {
  const left = side === 1;
  return {
    corner: left ? 'LF' : 'RF',
    side,
    lowerBallJoint_m: point('lca_out', 259, side * 78, 7),
    upperBallJoint_m: point('uca_out', 254, side * 72.8, 44),
    wheelCentre_m: point('wc', 257, side * 86, 32),
  };
}

function withCaster(input: CasterInput, rearwardMm: number): CasterInput {
  return {
    ...input,
    upperBallJoint_m: {
      ...input.upperBallJoint_m,
      value: {
        ...input.upperBallJoint_m.value,
        x: input.upperBallJoint_m.value.x - rearwardMm * MM,
      },
    },
  };
}

function definedValue(solved: { kind: string; value?: number }, label: string): number {
  if (solved.kind !== 'defined' || solved.value === undefined) {
    throw new Error(`${label} is ${solved.kind}`);
  }
  return solved.value;
}

function degrees(radians: number): number {
  return radians / DEG;
}

function series(input: CasterInput) {
  const result = buildCamberInSteerSeries(input);
  if (result.kind !== 'series') throw new Error(`expected series, got ${result.reason}`);
  return result;
}

function camberAt(result: ReturnType<typeof series>, steerDegrees: number): number {
  const sample = result.samples.find(
    (candidate) => Math.abs(candidate.steer_rad / DEG - steerDegrees) < 1e-9,
  );
  if (sample === undefined) throw new Error(`no sample at ${steerDegrees} deg`);
  return sample.camber_rad;
}

describe('steering-axis geometry (caster, KPI, scrub, trail)', () => {
  it('reproduces the reference car: caster 7.70, KPI 8.00, scrub 7.02 mm, trail 2.95 mm', () => {
    const solved = solveSteeringAxis(reference(1));
    expect(degrees(definedValue(solved.caster_rad, 'caster'))).toBeCloseTo(7.6961, 4);
    expect(degrees(definedValue(solved.kpi_rad, 'KPI'))).toBeCloseTo(8.0, 4);
    expect(definedValue(solved.scrub_m, 'scrub') / MM).toBeCloseTo(7.0162, 4);
    expect(definedValue(solved.trail_m, 'trail') / MM).toBeCloseTo(2.9459, 4);
  });

  it('keeps caster, KPI, scrub and trail per-wheel signed and mirrored', () => {
    const left = solveSteeringAxis(reference(1));
    const right = solveSteeringAxis(reference(-1));
    expect(degrees(definedValue(right.caster_rad, 'right caster'))).toBeCloseTo(
      degrees(definedValue(left.caster_rad, 'left caster')),
      12,
    );
    expect(degrees(definedValue(right.kpi_rad, 'right KPI'))).toBeCloseTo(
      degrees(definedValue(left.kpi_rad, 'left KPI')),
      12,
    );
    expect(definedValue(right.scrub_m, 'right scrub')).toBeCloseTo(
      definedValue(left.scrub_m, 'left scrub'),
      12,
    );
    expect(definedValue(right.trail_m, 'right trail')).toBeCloseTo(
      definedValue(left.trail_m, 'left trail'),
      12,
    );
  });

  it('zero caster: both ball joints on the same x gives caster 0 and camber-in-steer 0 everywhere', () => {
    const noCaster: CasterInput = {
      ...reference(1),
      upperBallJoint_m: point('uca_out', 259, 72.8, 44),
    };
    const solved = solveSteeringAxis(noCaster);
    expect(Math.abs(definedValue(solved.caster_rad, 'caster'))).toBe(0);
    // KPI is still 8 degrees here; the series isolates caster, so it is zero.
    expect(degrees(definedValue(solved.kpi_rad, 'KPI'))).toBeCloseTo(8.0, 4);
    const curve = series(noCaster);
    for (const sample of curve.samples) expect(Math.abs(sample.camber_rad)).toBe(0);
  });

  it('moving the upper ball joint rearward raises caster and makes the outside wheel more negative', () => {
    const baseLeft = series(reference(1));
    const baseRight = series(reference(-1));
    const casteredLeft = series(withCaster(reference(1), 2));
    const casteredRight = series(withCaster(reference(-1), 2));

    const baseCaster = degrees(definedValue(solveSteeringAxis(reference(1)).caster_rad, 'base caster'));
    const moreCaster = degrees(
      definedValue(solveSteeringAxis(withCaster(reference(1), 2)).caster_rad, 'castered caster'),
    );
    expect(moreCaster).toBeGreaterThan(baseCaster);

    // At +20 deg the car turns left: LF is the inside wheel, RF the outside.
    const insideBase = camberAt(baseLeft, 20);
    const insideCastered = camberAt(casteredLeft, 20);
    const outsideBase = camberAt(baseRight, 20);
    const outsideCastered = camberAt(casteredRight, 20);

    expect(outsideCastered).toBeLessThan(outsideBase);
    expect(outsideCastered).toBeLessThan(0);
    expect(insideCastered).toBeGreaterThan(insideBase);
    expect(insideCastered).toBeGreaterThan(outsideCastered);
  });

  it('refuses a rear corner instead of dividing by zero', () => {
    const rear: CasterInput = {
      ...reference(1),
      corner: 'LR',
    };
    const solved = solveSteeringAxis(rear);
    for (const key of ['caster_rad', 'kpi_rad', 'scrub_m', 'trail_m'] as const) {
      expect(solved[key].kind).toBe('undefined');
      if (solved[key].kind === 'undefined') expect(solved[key].reason).toBe('noSteeringAxis');
    }
    for (const value of Object.values(solved)) {
      if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
    }
    expect(buildCamberInSteerSeries(rear).kind).toBe('unavailable');
  });

  it('models no steering-axis anti-dive term, and the total is the link contribution', () => {
    const axle: SideViewAxleInput = {
      lowerInnerA_m: point('lfa', 238, 30, 12),
      lowerInnerB_m: point('lfb', 272, 30, 12),
      lowerOuter_m: point('lfo', 259, 78, 7),
      upperInner_m: point('lfi', 250, 42, 45),
      upperOuter_m: point('lfo2', 254, 72.8, 44),
      contactPatchX_m: sourced('body.wheelbase', 257 * MM),
    };
    const input: AntiDiveInput = {
      front: axle,
      rear: axle,
      wheelbase_m: sourced('body.wheelbase', 257 * MM),
      cgHeight_m: sourced('body.cg.height', 28 * MM, 'estimated'),
      totalMass_kg: sourced('body.mass.total', 1.35),
      frontMassShare: sourced('body.cg.front_mass_share', 0.45, 'derived'),
      longitudinalAcceleration_mps2: -9.81,
    };
    const solved = solveAntiDive(input);
    expect(solved.front.contributions.steeringAxis).toBeNull();
    expect(definedValue(solved.front.contributions.total, 'total')).toBe(
      definedValue(solved.front.contributions.links, 'links'),
    );
  });

  it('samples the camber-in-steer series at 0/5/10/15/20/25/30 degrees', () => {
    const curve = series(reference(1));
    expect(curve.samples.map((sample) => Math.round(sample.steer_rad / DEG))).toEqual([
      0, 5, 10, 15, 20, 25, 30,
    ]);
    expect(CAMBER_STEER_ANGLES_RAD).toHaveLength(7);
    expect(curve.steerSign).toContain('left');
    expect(curve.camberSign).toContain('outboard');
    expect(Math.abs(camberAt(curve, 0))).toBe(0);
    const twenty = solveCamberInSteer(reference(1), 20 * DEG);
    expect(twenty.kind).toBe('defined');
    if (twenty.kind === 'defined') expect(Number.isFinite(twenty.value)).toBe(true);
  });
});
