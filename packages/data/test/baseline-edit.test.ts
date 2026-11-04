import { describe, expect, it } from 'vitest';
import rawModel from '../../../assets/models/reference-touring-car.json';
import {
  parseCarModel,
  updateAxleTrack,
  updateBodyWheelbase,
  updateCgFrontMassShare,
  updateCgHeight,
  updateMassTotal,
  updateUnsprungMass,
} from '../src/index.js';
import type { CarModelDocument } from '../src/index.js';

function reference(): CarModelDocument {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

describe('baseline vehicle-value edits', () => {
  it('writes the wheelbase and keeps its stored source', () => {
    const edited = updateBodyWheelbase(reference(), 260);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.value.wheelbase?.value).toBe(260);
    expect(edited.value.wheelbase?.source).toBe('s_worked');
  });

  it('writes total and unsprung masses in grams', () => {
    const withTotal = updateMassTotal(reference(), 1400);
    expect(withTotal.ok).toBe(true);
    if (!withTotal.ok) return;
    expect(withTotal.value.mass.total?.value).toBe(1400);

    const withFront = updateUnsprungMass(withTotal.value, 'front', 130);
    expect(withFront.ok).toBe(true);
    if (!withFront.ok) return;
    expect(withFront.value.mass.unsprungFront?.value).toBe(130);

    const withRear = updateUnsprungMass(withFront.value, 'rear', 110);
    expect(withRear.ok).toBe(true);
    if (!withRear.ok) return;
    expect(withRear.value.mass.unsprungRear?.value).toBe(110);
    expect(withRear.value.mass.total?.value).toBe(1400);
  });

  it('writes the CG height and front mass share without inventing provenance', () => {
    const withHeight = updateCgHeight(reference(), 24);
    expect(withHeight.ok).toBe(true);
    if (!withHeight.ok) return;
    expect(withHeight.value.cg.height?.value).toBe(24);
    expect(withHeight.value.cg.height?.confidence).toBe('estimated');

    const withShare = updateCgFrontMassShare(withHeight.value, 46);
    expect(withShare.ok).toBe(true);
    if (!withShare.ok) return;
    expect(withShare.value.cg.frontMassShare?.value).toBe(46);
    expect(withShare.value.cg.frontMassShare?.confidence).toBe('derived');
  });

  it('writes either axle track independently', () => {
    const front = updateAxleTrack(reference(), 'front', 176);
    expect(front.ok).toBe(true);
    if (!front.ok) return;
    expect(front.value.axles.front.track.value).toBe(176);
    expect(front.value.axles.rear?.track.value).toBe(174);

    const rear = updateAxleTrack(front.value, 'rear', 178);
    expect(rear.ok).toBe(true);
    if (!rear.ok) return;
    expect(rear.value.axles.rear?.track.value).toBe(178);
    expect(rear.value.axles.front.track.value).toBe(176);
  });

  it('refuses a non-finite value', () => {
    expect(updateBodyWheelbase(reference(), Number.NaN).ok).toBe(false);
    expect(updateMassTotal(reference(), Number.POSITIVE_INFINITY).ok).toBe(false);
    expect(updateCgHeight(reference(), Number.NaN).ok).toBe(false);
    expect(updateAxleTrack(reference(), 'front', Number.NaN).ok).toBe(false);
  });
});
