import { describe, expect, it } from 'vitest';
import { defined, notMeasured, undefinedResult } from '@setuplab/physics';
import {
  SHIM_BAND_MM,
  checkShimText,
  hingeAngleBandDegrees,
  hingeAngleDegrees,
  screwHeights,
} from '../src/editor/shim.js';
import { formatSignedNumber } from '../src/format/format.js';
import { provenanceForConfidence, provenanceForSolved } from '../src/view/provenance.js';

describe('shim to hinge angle', () => {
  it('turns a 2.0 mm shim on a 34.0 mm span into 3.37 degrees', () => {
    const angle = hingeAngleDegrees(2, 34);
    expect(angle).not.toBeNull();
    if (angle === null) return;
    expect(angle).toBeCloseTo(3.3665, 4);
    expect(formatSignedNumber(angle, 2)).toBe('+3.37');
  });

  it('returns exactly zero for a level pair', () => {
    expect(hingeAngleDegrees(0, 34)).toBe(0);
    expect(formatSignedNumber(hingeAngleDegrees(0, 34) ?? 0, 2)).toBe('0.00');
  });

  it('tabulates the 0 / 0.5 / 1 / 2 mm shims on a 34.0 mm span', () => {
    const table = [0, 0.5, 1, 2].map((shim) => ({
      shim,
      angle: formatSignedNumber(hingeAngleDegrees(shim, 34) ?? 0, 2),
    }));
    expect(table).toEqual([
      { shim: 0, angle: '0.00' },
      { shim: 0.5, angle: '+0.84' },
      { shim: 1, angle: '+1.68' },
      { shim: 2, angle: '+3.37' },
    ]);
  });

  it('keeps the sign: positive is the aft screw higher', () => {
    const positive = hingeAngleDegrees(2, 34);
    const negative = hingeAngleDegrees(-2, 34);
    expect(positive).not.toBeNull();
    expect(negative).not.toBeNull();
    if (positive === null || negative === null) return;
    expect(positive).toBeGreaterThan(0);
    expect(negative).toBeCloseTo(-positive, 12);
  });

  it('carries the entry band through the angle', () => {
    const band = hingeAngleBandDegrees(2, 34);
    expect(band).not.toBeNull();
    if (band === null) return;
    expect(band.low).toBeLessThan(3.3664);
    expect(band.high).toBeGreaterThan(3.3664);
    const expected =
      (Math.atan((2 + SHIM_BAND_MM) / 34) * 180) / Math.PI -
      (Math.atan((2 - SHIM_BAND_MM) / 34) * 180) / Math.PI;
    expect(band.high - band.low).toBeCloseTo(expected, 12);
  });

  it('refuses a zero or missing span instead of returning infinity', () => {
    expect(hingeAngleDegrees(2, 0)).toBeNull();
    expect(hingeAngleDegrees(2, -34)).toBeNull();
    expect(hingeAngleBandDegrees(2, 0)).toBeNull();
  });

  it('splits the shim either side of the midpoint', () => {
    const heights = screwHeights(5, 2);
    expect(heights.a).toBeCloseTo(4, 12);
    expect(heights.b).toBeCloseTo(6, 12);
    expect((heights.a + heights.b) / 2).toBeCloseTo(5, 12);
    expect(heights.b - heights.a).toBeCloseTo(2, 12);
  });
});

describe('shim entry', () => {
  it('accepts a decimal shim without validating a partial entry', () => {
    expect(checkShimText('2.0', 5)).toEqual({ ok: true, value: 2 });
    expect(checkShimText('-0.5', 5)).toEqual({ ok: true, value: -0.5 });
  });

  it('refuses an empty or non-finite entry in racer words', () => {
    const empty = checkShimText('', 5);
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.message).toBe('Enter a shim in millimetres.');

    const text = checkShimText('two', 5);
    expect(text.ok).toBe(false);
    if (text.ok) return;
    expect(text.message).toBe('Enter a shim in millimetres.');
  });

  it('refuses a shim that would push a screw outside the model limit', () => {
    const over = checkShimText('6001', 0);
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.message).toContain('3000');
    expect(over.message.toLowerCase()).not.toContain('lca_in');
  });
});

describe('provenance mapping', () => {
  it('maps a firm measured solve to computed', () => {
    expect(provenanceForSolved(defined(1, { tier: 'firm' }))).toBe('computed');
  });

  it('never maps an inferred solve to computed', () => {
    expect(provenanceForSolved(defined(1, { tier: 'inferred' }))).toBe('inferred');
  });

  it('names modelled and estimated contributions separately', () => {
    expect(provenanceForSolved(defined(1, { tier: 'firm', flags: ['modelledGeometry'] }))).toBe(
      'modelled',
    );
    expect(provenanceForSolved(defined(1, { tier: 'inferred', flags: ['assumedInput'] }))).toBe(
      'estimated',
    );
    expect(provenanceForSolved(defined(1, { tier: 'inferred', flags: ['lowConfidence'] }))).toBe(
      'estimated',
    );
    expect(provenanceForSolved(defined(1, { tier: 'inferred', flags: ['derivedGeometry'] }))).toBe(
      'inferred',
    );
  });

  it('keeps missing and undefined distinct from every numeral', () => {
    expect(provenanceForSolved(notMeasured(['lca_in']))).toBe('missing');
    expect(provenanceForSolved(undefinedResult('parallelLinks'))).toBe('undefined');
  });

  it('maps a stored source to the same words the model uses', () => {
    expect(provenanceForConfidence('measured')).toBe('measured');
    expect(provenanceForConfidence('derived')).toBe('computed');
    expect(provenanceForConfidence('modelled')).toBe('modelled');
    expect(provenanceForConfidence('estimated')).toBe('estimated');
    expect(provenanceForConfidence('assumed')).toBe('estimated');
  });
});
