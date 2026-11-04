import { describe, expect, it } from 'vitest';
import {
  buildCamberInSteerSeries,
  buildToeSeries,
  solveFrontView,
  solveSteeringAxis,
} from '@setuplab/physics';
import rawModel from '../../../assets/models/reference-touring-car.json';
import {
  buildAxleRates,
  buildCasterInput,
  buildFrontViewInput,
  buildToeInput,
  parseCarModel,
  updateChassisRideHeight,
  updateWheelDiameter,
  type CarModelDocument,
} from '../src/index.js';

const DEG = Math.PI / 180;

function parse(input: unknown): CarModelDocument {
  const parsed = parseCarModel(input);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function defined(value: { kind: string; value?: number }, label: string): number {
  if (value.kind !== 'defined' || value.value === undefined) {
    throw new Error(`${label} is ${value.kind}`);
  }
  return value.value;
}

function casterValues(model: CarModelDocument) {
  const input = buildCasterInput(model, 'LF');
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  const solved = solveSteeringAxis(input.value);
  return {
    caster: defined(solved.caster_rad, 'caster'),
    kpi: defined(solved.kpi_rad, 'KPI'),
    scrub: defined(solved.scrub_m, 'scrub'),
    trail: defined(solved.trail_m, 'trail'),
  };
}

function series(model: CarModelDocument, corner: 'LF' | 'RF') {
  const input = buildCasterInput(model, corner);
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  const result = buildCamberInSteerSeries(input.value);
  if (result.kind !== 'series') throw new Error(result.reason);
  return result;
}

function camberAt(corner: 'LF' | 'RF', steerDegrees: number, model = parse(rawModel)): number {
  const sample = series(model, corner).samples.find(
    (candidate) => Math.abs(candidate.steer_rad / DEG - steerDegrees) < 1e-9,
  );
  if (sample === undefined) throw new Error(`no sample at ${steerDegrees}`);
  return sample.camber_rad;
}

function withStoredCaster(model: CarModelDocument, casterDegrees: number): CarModelDocument {
  const raw = JSON.parse(JSON.stringify(model.raw)) as Record<string, unknown>;
  const corners = raw['corners'] as Record<string, Record<string, unknown>>;
  corners['LF']!['caster'] = { value: casterDegrees, source: 's_worked' };
  return parse(raw);
}

describe('caster from the two ball joints (data boundary)', () => {
  it('reproduces the reference car on both front corners', () => {
    for (const corner of ['LF', 'RF'] as const) {
      const input = buildCasterInput(parse(rawModel), corner);
      if (!input.ok) throw new Error(JSON.stringify(input.errors));
      const solved = solveSteeringAxis(input.value);
      expect((defined(solved.caster_rad, 'caster') / DEG)).toBeCloseTo(7.6961, 4);
      expect((defined(solved.kpi_rad, 'KPI') / DEG)).toBeCloseTo(8.0, 4);
      expect(defined(solved.scrub_m, 'scrub') * 1000).toBeCloseTo(7.0162, 4);
      expect(defined(solved.trail_m, 'trail') * 1000).toBeCloseTo(2.9459, 4);
    }
  });

  it('leaves caster, KPI, scrub and trail bit-identical when ride height changes', () => {
    const base = parse(rawModel);
    const raised = updateChassisRideHeight(base, 8.0);
    if (!raised.ok) throw new Error(JSON.stringify(raised.errors));
    expect(casterValues(raised.value)).toEqual(casterValues(base));
  });

  it('keeps the angles bit-identical across a wheel-diameter change; scrub and trail follow the ground intersection', () => {
    const base = parse(rawModel);
    const bigger = updateWheelDiameter(base, 'front', 68.0);
    if (!bigger.ok) throw new Error(JSON.stringify(bigger.errors));

    const before = casterValues(base);
    const after = casterValues(bigger.value);
    // The axis direction is built from stored offsets, so caster and KPI cannot move.
    expect(after.caster).toBe(before.caster);
    expect(after.kpi).toBe(before.kpi);
    // Scrub and trail are the axis's intersection with the road. A larger wheel
    // translates the upright vertically, so that intersection (and nothing
    // else) moves; freezing them would report a ground point the car no longer
    // has.
    expect(after.scrub).not.toBe(before.scrub);
    expect(after.trail).not.toBe(before.trail);
  });

  it('refuses a rear corner: no steering axis, no card, no division', () => {
    const rear = buildCasterInput(parse(rawModel), 'LR');
    expect(rear.ok).toBe(false);
    if (rear.ok) return;
    expect(rear.errors[0]?.path).toContain('caster');
    expect(rear.errors[0]?.message).toContain('rear');
  });

  it('same x on both ball joints gives caster 0 and camber-in-steer 0 at every steer angle', () => {
    const base = parse(rawModel);
    // Absolute upper x must equal the lower ball joint's 259 mm; the hub x is 257.
    const raw = JSON.parse(JSON.stringify(base.raw)) as Record<string, unknown>;
    const corners = raw['corners'] as Record<string, Record<string, unknown>>;
    const points = corners['LF']!['points'] as Record<string, unknown>;
    const upper = points['uca_out'] as { value: number[] };
    upper.value[0] = 2;
    const edited = parse(raw);

    const input = buildCasterInput(edited, 'LF');
    if (!input.ok) throw new Error(JSON.stringify(input.errors));
    const solved = solveSteeringAxis(input.value);
    expect(Math.abs(defined(solved.caster_rad, 'caster'))).toBe(0);
    const curve = buildCamberInSteerSeries(input.value);
    if (curve.kind !== 'series') throw new Error(curve.reason);
    for (const sample of curve.samples) expect(Math.abs(sample.camber_rad)).toBe(0);
  });

  it('at 20 degrees the outside wheel gains negative camber and the inside wheel the opposite', () => {
    // Positive steer is a left turn: LF is inside, RF is outside.
    expect(camberAt('RF', 20)).toBeLessThan(0);
    expect(camberAt('LF', 20)).toBeGreaterThan(0);
    expect(camberAt('RF', 20)).toBeLessThan(camberAt('LF', 20));
  });

  it('changing the stored caster field leaves bump steer, toe gain, roll centre and wheel rate bit-identical', () => {
    const base = parse(rawModel);
    const stored = withStoredCaster(base, 12.0);

    const toeBefore = buildToeInput(base, 'LF');
    const toeAfter = buildToeInput(stored, 'LF');
    if (!toeBefore.ok || !toeAfter.ok) throw new Error('toe input did not build');
    const toeSeriesBefore = buildToeSeries(toeBefore.value);
    const toeSeriesAfter = buildToeSeries(toeAfter.value);
    if (toeSeriesBefore.kind !== 'series' || toeSeriesAfter.kind !== 'series') {
      throw new Error('toe series did not build');
    }
    expect(toeSeriesAfter.gain_radPerM).toEqual(toeSeriesBefore.gain_radPerM);
    expect(toeSeriesAfter.totalAcrossRange_rad).toEqual(toeSeriesBefore.totalAcrossRange_rad);

    const viewBefore = buildFrontViewInput(base, 'LF');
    const viewAfter = buildFrontViewInput(stored, 'LF');
    if (!viewBefore.ok || !viewAfter.ok) throw new Error('front-view input did not build');
    expect(solveFrontView(viewAfter.value).rollCentreHeight).toEqual(
      solveFrontView(viewBefore.value).rollCentreHeight,
    );

    const ratesBefore = buildAxleRates(base, 'front');
    const ratesAfter = buildAxleRates(stored, 'front');
    if (!ratesBefore.ok || !ratesAfter.ok) throw new Error('rates did not build');
    expect(ratesAfter.value.wheelRate).toEqual(ratesBefore.value.wheelRate);
  });
});
