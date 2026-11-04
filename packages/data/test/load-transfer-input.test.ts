import { describe, expect, it } from 'vitest';
import { solveLoadTransfer } from '@setuplab/physics';
import rawModel from '../../../assets/models/reference-touring-car.json';
import { buildLoadTransferInput, parseCarModel } from '../src/index.js';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

describe('load-transfer data', () => {
  it('exposes the CG and unsprung fields with their sources and tiers', () => {
    const parsed = parseCarModel(rawModel);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value.wheelbase?.value).toBeCloseTo(257, 12);
    expect(parsed.value.cg.height?.value).toBeCloseTo(28, 12);
    expect(parsed.value.cg.height?.source).toBe('s_default');
    expect(parsed.value.cg.height?.confidence).toBe('estimated');
    expect(parsed.value.cg.frontMassShare?.value).toBeCloseTo(45, 12);
    expect(parsed.value.cg.frontMassShare?.source).toBe('s_derived');
    expect(parsed.value.cg.unsprungHeight?.value).toBeCloseTo(20, 12);
    expect(parsed.value.mass.total?.value).toBeCloseTo(1350, 12);
    expect(parsed.value.mass.total?.source).toBe('s_worked');
    expect(parsed.value.mass.unsprungFront?.value).toBeCloseTo(120, 12);
    expect(parsed.value.mass.unsprungRear?.value).toBeCloseTo(120, 12);
    expect(parsed.value.cg.components).toBeNull();
  });

  it('builds SI load-transfer input from the reference asset', () => {
    const parsed = parseCarModel(rawModel);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const input = buildLoadTransferInput(parsed.value, 9.81);
    expect(input.ok).toBe(true);
    if (!input.ok) return;

    expect(input.value.totalMass_kg.value).toBeCloseTo(1.35, 12);
    expect(input.value.frontMassShare.value).toBeCloseTo(0.45, 12);
    expect(input.value.unsprungFront_kg.value).toBeCloseTo(0.12, 12);
    expect(input.value.unsprungRear_kg.value).toBeCloseTo(0.12, 12);
    expect(input.value.unsprungHeight_m.value).toBeCloseTo(0.02, 12);
    expect(input.value.wheelbase_m.value).toBeCloseTo(0.257, 12);
    expect(input.value.trackFront_m.value).toBeCloseTo(0.172, 12);
    expect(input.value.trackRear_m.value).toBeCloseTo(0.174, 12);
    expect(input.value.rollCentreFront_m.value).toBeCloseTo(0.0099749, 9);
    expect(input.value.rollCentreRear_m.value).toBeCloseTo(0.01789851314583674, 12);
    expect(input.value.rollCentreRear_m.confidence).toBe('modelled');
    expect(input.value.cgDefaultHeight_m?.value).toBeCloseTo(0.028, 12);

    const result = solveLoadTransfer(input.value);
    expect(result.cgRoute).toBe('stated_default');
    expect(result.cgHeight.kind).toBe('defined');
    expect(result.totalLateralLoadTransfer.kind).toBe('defined');
    expect(result.balance.kind).toBe('defined');
    if (
      result.cgHeight.kind !== 'defined' ||
      result.totalLateralLoadTransfer.kind !== 'defined' ||
      result.balance.kind !== 'defined'
    ) {
      return;
    }
    expect(result.cgHeight.value).toBeCloseTo(0.028, 12);
    expect(relativeError(result.totalLateralLoadTransfer.value, 2.1435)).toBeLessThanOrEqual(1e-4);
    expect(relativeError(result.balance.value * 100, 47.01303)).toBeLessThanOrEqual(1e-4);
  });

  it('uses body.cg.components[] for the component-mass route when present (G06.9)', () => {
    const withComponents = clone(rawModel) as {
      body: { cg: Record<string, unknown> };
      sources: Record<string, unknown>;
    };
    withComponents.sources['s_component'] = {
      type: 'estimated',
      method: 'component mass table (docs/specs/physics/01 §4.5)',
      by: 'Setup Lab',
    };
    const rows: readonly [string, number, number][] = [
      ['chassis plate', 84, 8],
      ['motor + rotor + mount', 190, 22],
      ['battery (2S shorty)', 210, 18],
      ['ESC + receiver + wiring', 45, 24],
      ['servo + saver + linkage', 60, 26],
      ['body shell + wing', 85, 36],
      ['hardware, arms, hubs, bumpers', 436, 14],
    ];
    withComponents.body.cg['components'] = rows.map(([component, mass, z]) => ({
      component,
      mass: { value: mass, source: 's_component' },
      z: { value: z, source: 's_component' },
    }));

    const parsed = parseCarModel(withComponents);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.cg.components).toHaveLength(7);

    const input = buildLoadTransferInput(parsed.value, 9.81);
    expect(input.ok).toBe(true);
    if (!input.ok) return;
    expect(input.value.cgComponents).toHaveLength(7);

    const result = solveLoadTransfer(input.value);
    expect(result.cgRoute).toBe('component_mass_moment');
    expect(result.cgHeight.kind).toBe('defined');
    if (result.cgHeight.kind !== 'defined') return;
    expect(relativeError(result.cgHeight.value * 1000, 18.693)).toBeLessThanOrEqual(1e-4);
  });
});
