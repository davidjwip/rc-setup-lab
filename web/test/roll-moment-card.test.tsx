import { describe, expect, it } from 'vitest';
import {
  buildLoadTransferInput,
  gravitiesToMetresPerSecondSquared,
  parseCarModel,
} from '@setuplab/data';
import { solveLoadTransfer } from '@setuplab/physics';
import rawModel from '../../assets/models/reference-touring-car.json';

function result() {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const input = buildLoadTransferInput(
    parsed.value,
    gravitiesToMetresPerSecondSquared(1),
  );
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  return solveLoadTransfer(input.value);
}

describe('chassis roll sensitivity values', () => {
  it('reads the same reference roll moment, arm and sensitivity', () => {
    const solved = result();

    expect(solved.rollMomentArm.kind).toBe('defined');
    expect(solved.rollMoment.kind).toBe('defined');
    expect(solved.rollSensitivity_degPerG.kind).toBe('defined');
    if (
      solved.rollMomentArm.kind !== 'defined' ||
      solved.rollMoment.kind !== 'defined' ||
      solved.rollSensitivity_degPerG.kind !== 'defined'
    ) {
      return;
    }

    expect(solved.rollMomentArm.value * 1000).toBeCloseTo(15.4, 2);
    expect(solved.rollMoment.value).toBeCloseTo(0.168, 3);
    expect(solved.rollSensitivity_degPerG.value).toBeCloseTo(0.1601, 4);
  });
});
