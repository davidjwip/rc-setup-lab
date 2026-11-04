import { describe, expect, it } from 'vitest';
import { buildCasterInput, parseCarModel } from '@setuplab/data';
import { buildCamberInSteerSeries, solveSteeringAxis } from '@setuplab/physics';
import rawModel from '../../assets/models/reference-touring-car.json';

function caster() {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const input = buildCasterInput(parsed.value, 'LF');
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  return { input: input.value, result: solveSteeringAxis(input.value) };
}

describe('caster and steering-axis values', () => {
  it('shows caster, KPI, scrub and trail with the reference values and their signs', () => {
    const { result } = caster();
    expect(result.caster_rad.kind).toBe('defined');
    expect(result.kpi_rad.kind).toBe('defined');
    expect(result.scrub_m.kind).toBe('defined');
    expect(result.trail_m.kind).toBe('defined');
    if (
      result.caster_rad.kind !== 'defined' ||
      result.kpi_rad.kind !== 'defined' ||
      result.scrub_m.kind !== 'defined' ||
      result.trail_m.kind !== 'defined'
    ) {
      return;
    }

    expect((result.caster_rad.value * 180) / Math.PI).toBeCloseTo(7.7, 2);
    expect((result.kpi_rad.value * 180) / Math.PI).toBeCloseTo(8.0, 2);
    expect(result.scrub_m.value * 1000).toBeCloseTo(7.02, 2);
    expect(result.trail_m.value * 1000).toBeCloseTo(2.95, 2);
  });

  it('builds the camber-in-steer series from the same steering axis', () => {
    const { input } = caster();
    const series = buildCamberInSteerSeries(input);
    expect(series.kind).toBe('series');
  });
});
