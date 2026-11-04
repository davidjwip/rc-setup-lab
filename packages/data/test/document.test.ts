import { describe, expect, it } from 'vitest';
import rawModel from '../../../assets/models/reference-touring-car.json';
import {
  degreesToRadians,
  metresToMillimetres,
  millimetresToMetres,
  parseCarModel,
  parseCarModelJson,
  radiansToDegrees,
  updateCornerPointMm,
  buildFrontViewInput,
  buildRatesInput,
} from '../src/index.js';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('document model', () => {
  it('parses the bundled reference model and preserves provenance', () => {
    const result = parseCarModel(rawModel);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe('mdl_reference_tc_front');
    expect(result.value.symmetry).toBe(true);
    expect(result.value.corners.LF?.points.lca_out?.value).toEqual([259, 78, 7]);
    expect(result.value.corners.RF?.points.lca_out?.value).toEqual([259, -78, 7]);
    expect(result.value.sources['s_worked']?.type).toBe('measured');
  });

  it('converts mm to SI exactly once when building a front-view input', () => {
    const parsed = parseCarModel(rawModel);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const input = buildFrontViewInput(parsed.value, 'LF');
    expect(input.ok).toBe(true);
    if (!input.ok) return;
    expect(input.value.lcaIn_m.value.y).toBeCloseTo(0.03, 12);
    expect(input.value.lcaOut_m.value.z).toBeCloseTo(0.007, 12);
    expect(input.value.ucaOut_m.value.y).toBeCloseTo(0.0728, 12);
    expect(input.value.wheelCentre_m.value.y).toBeCloseTo(0.086, 12);
    expect(input.value.bumpLimit_m).toBeCloseTo(0.006, 12);
    expect(input.value.side).toBe(1);
  });

  it('exposes the spring rate, damper mounts and sprung mass with their sources', () => {
    const parsed = parseCarModel(rawModel);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.axles.front.springRate?.value).toBeCloseTo(3.5, 12);
    expect(parsed.value.mass.sprungFront?.value).toBeCloseTo(487.49, 12);
    expect(parsed.value.mass.sprungRear?.value).toBeCloseTo(622.49, 12);

    const input = buildRatesInput(parsed.value, 'LF');
    expect(input.ok).toBe(true);
    if (!input.ok) return;
    expect(input.value.springRate_Npm.value).toBeCloseTo(3500, 9);
    expect(input.value.springRate_Npm.ref).toBe('axles.front.spring.rate');
    expect(input.value.damperLo_m.value.y).toBeCloseTo(0.06, 12);
    expect(input.value.damperLo_m.value.z).toBeCloseTo(0.008875, 12);
    expect(input.value.damperUp_m.value.y).toBeCloseTo(0.044, 12);
    expect(input.value.sprungMass_kg?.value).toBeCloseTo(0.243745, 12);
    expect(input.value.sprungMass_kg?.ref).toBe('body.mass.sprung_front');
  });

  it('keeps rear rates out of this geometry slice', () => {
    // The rear geometry is modelled now, but the rates path still reads the
    // front spring and front sprung mass. Rear rates are the spring/damper
    // slice; the roll builder derives the rear ARB ratio meanwhile.
    const parsed = parseCarModel(rawModel);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const input = buildRatesInput(parsed.value, 'LR');
    expect(input.ok).toBe(false);
    if (input.ok) return;
    expect(input.errors.some((error) => error.path === 'axles.rear')).toBe(true);
  });

  it('builds the mirrored right-hand corner with the correct side sign', () => {
    const parsed = parseCarModel(rawModel);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const input = buildFrontViewInput(parsed.value, 'RF');
    expect(input.ok).toBe(true);
    if (!input.ok) return;
    expect(input.value.side).toBe(-1);
    expect(input.value.lcaOut_m.value.y).toBeCloseTo(-0.078, 12);
  });

  it('rejects a measured field with no source instead of throwing', () => {
    const broken = clone(rawModel) as Record<string, unknown>;
    const corners = broken['corners'] as Record<string, Record<string, unknown>>;
    const points = corners['LF']?.['points'] as Record<string, Record<string, unknown>>;
    delete points['lca_out']?.['source'];
    const result = parseCarModel(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((error) => error.code === 'missingSource')).toBe(true);
  });

  it('reports invalid JSON as a typed error', () => {
    const result = parseCarModelJson('{ not json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('invalidJson');
  });

  it('rejects a document that declares metres instead of millimetres', () => {
    const broken = clone(rawModel) as Record<string, unknown>;
    (broken['units'] as Record<string, unknown>)['length'] = 'm';
    const result = parseCarModel(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((error) => error.code === 'unitMismatch')).toBe(true);
  });

  it('editing a hardpoint revalidates and updates the converted input', () => {
    const parsed = parseCarModel(rawModel);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const edited = updateCornerPointMm(parsed.value, 'LF', 'lca_out', 2, 7.5);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    const input = buildFrontViewInput(edited.value, 'LF');
    expect(input.ok).toBe(true);
    if (!input.ok) return;
    expect(input.value.lcaOut_m.value.z).toBeCloseTo(0.0075, 12);
    expect(input.value.lcaOut_m.ref).toBe('LF.points.lca_out');
  });

  it('round-trips the display units without drift at 0.1 mm resolution', () => {
    for (const value of [0, 0.1, 1, 9.9, 78, 172, 999.9, 2999.9]) {
      expect(metresToMillimetres(millimetresToMetres(value))).toBeCloseTo(value, 9);
    }
    expect(radiansToDegrees(degreesToRadians(-2))).toBeCloseTo(-2, 12);
  });
});
