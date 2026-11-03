import { describe, expect, it } from 'vitest';
import {
  buildCamberSeries,
  buildFrontViewScene,
  solveFrontView,
  type Confidence,
  type FrontViewInput,
  type Vec2,
} from '../src/index.js';

const MM = 1 / 1000;

function mm(value: number): number {
  return value * MM;
}

function source(ref: string, value: Vec2, confidence: Confidence = 'measured') {
  return { ref, value, confidence };
}

function referenceCorner(side: 1 | -1 = 1): FrontViewInput {
  const y = (value: number): number => side * mm(value);
  return {
    corner: side === 1 ? 'LF' : 'RF',
    side,
    lowerArmType: 'hinge',
    upperArmType: 'single_link',
    lcaIn_m: source('lca_in_a', { y: y(30), z: mm(12) }),
    lcaOut_m: source('lca_out', { y: y(78), z: mm(7) }),
    ucaIn_m: source('uca_in', { y: y(42), z: mm(45) }),
    ucaOut_m: source('uca_out', { y: y(72.8), z: mm(44) }),
    wheelCentre_m: source('wc', { y: y(86), z: mm(32) }),
    bumpLimit_m: mm(6),
    droopLimit_m: mm(6),
  };
}

function parallelCorner(vertical = false): FrontViewInput {
  return {
    corner: 'LF',
    side: 1,
    lowerArmType: 'hinge',
    upperArmType: 'single_link',
    lcaIn_m: source('lca_in_a', { y: mm(30), z: mm(12) }),
    lcaOut_m: source('lca_out', { y: mm(vertical ? 30 : 78), z: mm(vertical ? 78 : 12) }),
    ucaIn_m: source('uca_in', { y: mm(42), z: mm(vertical ? 12 : 45) }),
    ucaOut_m: source('uca_out', { y: mm(vertical ? 42 : 72.8), z: mm(vertical ? 78 : 45) }),
    wheelCentre_m: source('wc', { y: mm(86), z: mm(32) }),
    bumpLimit_m: mm(6),
    droopLimit_m: mm(6),
  };
}

/** Arms that meet ~8 m away: defined, but far outside any sensible clip. */
function farInstantCentreCorner(): FrontViewInput {
  const base = referenceCorner();
  return {
    ...base,
    ucaOut_m: source('uca_out', { y: mm(72.8), z: mm(41.92) }),
  };
}

function hardpoint(scene: ReturnType<typeof buildFrontViewScene>, id: string) {
  const found = scene.hardpoints.find((item) => item.id === id);
  if (found === undefined) throw new Error(`missing hardpoint ${id}`);
  return found;
}

describe('front-view scene geometry', () => {
  it('maps the roll centre to the physics value and the ray to contact patch and instant centre', () => {
    const input = referenceCorner();
    const result = solveFrontView(input);
    const scene = buildFrontViewScene(input, result);

    expect(result.instantCentre.kind).toBe('defined');
    expect(result.rollCentreHeight.kind).toBe('defined');
    expect(result.rollCentreLateral.kind).toBe('defined');
    if (
      result.instantCentre.kind !== 'defined' ||
      result.rollCentreHeight.kind !== 'defined' ||
      result.rollCentreLateral.kind !== 'defined'
    ) {
      return;
    }

    expect(scene.rollCentre.kind).toBe('defined');
    if (scene.rollCentre.kind !== 'defined') return;

    expect(scene.rollCentre.y).toBe(result.rollCentreHeight.value);
    expect(scene.rollCentre.x).toBe(result.rollCentreLateral.value);
    expect(scene.rollCentre.band).toEqual(result.rollCentreHeight.band);

    expect(scene.rollCentreRay.kind).toBe('drawn');
    if (scene.rollCentreRay.kind !== 'drawn') return;

    const ray = scene.rollCentreRay.segment;
    const patch = hardpoint(scene, 'contact_patch');
    const instant = result.instantCentre.value;

    expect(ray.from.x).toBeCloseTo(patch.point.x, 12);
    expect(ray.from.y).toBeCloseTo(patch.point.y, 12);
    expect(ray.to.x).toBeCloseTo(instant.y, 12);
    expect(ray.to.y).toBeCloseTo(instant.z, 12);
    expect(ray.clipped).toBe(false);

    const patchToInstant = { x: instant.y - patch.point.x, y: instant.z - patch.point.y };
    const rayVector = { x: ray.to.x - ray.from.x, y: ray.to.y - ray.from.y };
    const cross = patchToInstant.x * rayVector.y - patchToInstant.y * rayVector.x;
    expect(Math.abs(cross)).toBeLessThan(1e-9);
  });

  it('keeps the instant-centre rays collinear with their hardpoints', () => {
    const input = referenceCorner();
    const result = solveFrontView(input);
    const scene = buildFrontViewScene(input, result);

    expect(result.instantCentre.kind).toBe('defined');
    if (result.instantCentre.kind !== 'defined') return;
    const instant = result.instantCentre.value;

    for (const [ray, id] of [
      [scene.lowerArmRay, 'lca_in'],
      [scene.upperLinkRay, 'uca_in'],
    ] as const) {
      expect(ray.kind).toBe('drawn');
      if (ray.kind !== 'drawn') continue;
      const anchor = hardpoint(scene, id);
      const a = { x: instant.y - anchor.point.x, y: instant.z - anchor.point.y };
      const b = {
        x: ray.segment.to.x - ray.segment.from.x,
        y: ray.segment.to.y - ray.segment.from.y,
      };
      expect(Math.abs(a.x * b.y - a.y * b.x)).toBeLessThan(1e-9);
    }
  });

  it('renders a parallel-arm scene as values: rays omitted with a reason, roll centre still drawn', () => {
    const input = parallelCorner(false);
    const result = solveFrontView(input);
    const scene = buildFrontViewScene(input, result);

    expect(result.instantCentre.kind).toBe('undefined');
    expect(scene.instantCentre.kind).toBe('undefined');
    if (scene.instantCentre.kind === 'undefined') {
      expect(scene.instantCentre.reason).toBe('parallelLinks');
    }

    for (const ray of [scene.lowerArmRay, scene.upperLinkRay, scene.rollCentreRay]) {
      expect(ray.kind).toBe('omitted');
      if (ray.kind === 'omitted') expect(ray.reason).toBe('parallelLinks');
    }

    expect(scene.rollCentre.kind).toBe('defined');
    if (scene.rollCentre.kind !== 'defined') return;
    expect(scene.rollCentre.y).toBeCloseTo(0, 12);
    expect(scene.rollCentre.x).toBeCloseTo(0, 12);
  });

  it('clips a far instant centre and marks the ray as clipped', () => {
    const input = farInstantCentreCorner();
    const result = solveFrontView(input);
    const scene = buildFrontViewScene(input, result);

    expect(result.instantCentre.kind).toBe('defined');
    expect(scene.instantCentre.kind).toBe('outsideClip');
    expect(scene.lowerArmRay.kind).toBe('drawn');
    if (scene.lowerArmRay.kind !== 'drawn') return;
    expect(scene.lowerArmRay.segment.clipped).toBe(true);

    const endpoints = [scene.lowerArmRay.segment.from, scene.lowerArmRay.segment.to];
    if (scene.upperLinkRay.kind === 'drawn') {
      endpoints.push(scene.upperLinkRay.segment.from, scene.upperLinkRay.segment.to);
    }

    for (const point of endpoints) {
      expect(point.x).toBeGreaterThanOrEqual(scene.clip.minX - 1e-12);
      expect(point.x).toBeLessThanOrEqual(scene.clip.maxX + 1e-12);
      expect(point.y).toBeGreaterThanOrEqual(scene.clip.minY - 1e-12);
      expect(point.y).toBeLessThanOrEqual(scene.clip.maxY + 1e-12);
    }
  });
});

describe('camber series', () => {
  it('sweeps 21 bump samples and marks the static point', () => {
    const series = buildCamberSeries(referenceCorner());
    expect(series.kind).toBe('series');
    if (series.kind !== 'series') return;

    expect(series.samples).toHaveLength(21);
    expect(series.samples[0]?.bump_m).toBeCloseTo(-0.005, 12);
    expect(series.samples[20]?.bump_m).toBeCloseTo(0.005, 12);
    expect(series.staticSample.bump_m).toBeCloseTo(0, 12);
  });
});
