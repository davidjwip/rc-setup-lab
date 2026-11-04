import { describe, expect, it } from 'vitest';
import { buildToeSeries } from '@setuplab/physics';
import rawModel from '../../../assets/models/reference-touring-car.json';
import { buildToeInput, parseCarModel } from '../src/index.js';

function gainDegPerMm(corner: 'LF' | 'LR'): number {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error('reference model failed to parse');
  const input = buildToeInput(parsed.value, corner);
  if (!input.ok) throw new Error(`toe input refused for ${corner}`);
  const series = buildToeSeries(input.value);
  if (series.kind !== 'series') throw new Error(`no toe series for ${corner}`);
  const gain = series.gain_radPerM;
  if (gain.kind !== 'defined') throw new Error(`toe gain undefined for ${corner}`);
  return ((gain.value * 180) / Math.PI) / 1000;
}

describe('reference model toe gain', () => {
  it('reproduces the front golden G04.5', () => {
    expect(gainDegPerMm('LF')).toBeCloseTo(-0.1625, 3);
  });

  // The rear toe link is MODELLED, not measured. This pins the value the model
  // currently produces so a change to the geometry cannot move it silently. The
  // link is placed to give a small toe-in gain in compression (stability) — the
  // opposite sign to the front's toe-out. An earlier placement put the tie-out
  // 2 mm from the kingpin axis and produced -0.73 deg/mm: nonsense reported as
  // physics. If a slice intends to change this number, this assertion is where
  // it must say so.
  it('gives the modelled rear a small toe-in gain in compression', () => {
    const rear = gainDegPerMm('LR');
    expect(rear).toBeGreaterThan(0);
    expect(rear).toBeCloseTo(0.0512, 3);
  });
});
