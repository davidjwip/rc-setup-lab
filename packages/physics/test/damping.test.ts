import { describe, expect, it } from 'vitest';
import {
  defined,
  notMeasured,
  solveDampingRatio,
  type Confidence,
  type Sourced,
} from '../src/index.js';

function sourced(
  ref: string,
  value: number,
  confidence: Confidence = 'assumed',
): Sourced<number> {
  return { ref, value, confidence };
}

describe('wheel-level damping ratio (physics/07 (7.2), D-13)', () => {
  it('divides the wheel coefficient by the critical damping', () => {
    const result = solveDampingRatio({
      wheelCoefficient_NsPerM: sourced('corners.LF.damper.c_post', 8.439),
      criticalDamping_NsPerM: defined(33.023),
    });
    expect(result.dampingRatio.kind).toBe('defined');
    if (result.dampingRatio.kind !== 'defined') return;
    expect(result.dampingRatio.value).toBeCloseTo(8.439 / 33.023, 12);
  });

  it('an assumed coefficient carries the D-13 ±50 % band and is inferred', () => {
    const result = solveDampingRatio({
      wheelCoefficient_NsPerM: sourced('corners.LF.damper.c_post', 12),
      criticalDamping_NsPerM: defined(33.023),
    });
    expect(result.dampingRatio.kind).toBe('defined');
    if (result.dampingRatio.kind !== 'defined') return;
    expect(result.dampingRatio.tier).toBe('inferred');
    expect(result.dampingRatio.flags.has('assumedInput')).toBe(true);
    expect(result.dampingRatio.band).not.toBeNull();
    if (result.dampingRatio.band === null) return;
    expect(result.dampingRatio.band.low).toBeCloseTo(result.dampingRatio.value * 0.5, 12);
    expect(result.dampingRatio.band.high).toBeCloseTo(result.dampingRatio.value * 1.5, 12);
  });

  it('a measured coefficient has no invented band', () => {
    const result = solveDampingRatio({
      wheelCoefficient_NsPerM: sourced('corners.LF.damper.c_post', 12, 'measured'),
      criticalDamping_NsPerM: defined(33.023),
    });
    expect(result.dampingRatio.kind).toBe('defined');
    if (result.dampingRatio.kind !== 'defined') return;
    expect(result.dampingRatio.tier).toBe('firm');
    expect(result.dampingRatio.band).toBeNull();
  });

  it('names the missing critical damping instead of returning a number', () => {
    const result = solveDampingRatio({
      wheelCoefficient_NsPerM: sourced('corners.LF.damper.c_post', 12),
      criticalDamping_NsPerM: notMeasured(['body.mass.sprung_front']),
    });
    expect(result.dampingRatio.kind).toBe('notMeasured');
  });
});
