import { describe, expect, it } from 'vitest';
import {
  buildAntiDiveInput,
  gravitiesToMetresPerSecondSquared,
  parseCarModel,
} from '@setuplab/data';
import { solveAntiDive } from '@setuplab/physics';
import rawModel from '../../assets/models/reference-touring-car.json';

function solve(atG: number) {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const input = buildAntiDiveInput(parsed.value, gravitiesToMetresPerSecondSquared(atG));
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  return solveAntiDive(input.value);
}

describe('anti-dive and anti-squat values', () => {
  it('reports exactly 0.0 % at both ends for the level reference screws', () => {
    const braking = solve(-1);
    const accelerating = solve(1);

    expect(braking.front.percent.kind).toBe('defined');
    expect(accelerating.rear.percent.kind).toBe('defined');
    if (braking.front.percent.kind !== 'defined' || accelerating.rear.percent.kind !== 'defined') {
      return;
    }
    expect(braking.front.percent.value).toBeCloseTo(0, 12);
    expect(accelerating.rear.percent.value).toBeCloseTo(0, 12);
  });
});
