import { describe, expect, it } from 'vitest';
import {
  solveFrontView,
  solveFrontViewAtBump,
  type Confidence,
  type FrontViewInput,
  type Vec2,
} from '../src/index.js';

const MM = 1 / 1000;
const DEG = Math.PI / 180;

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

describe('front-view kinematics goldens', () => {
  it('G02.1 reference LF static: IC and roll-centre height', () => {
    const result = solveFrontView(referenceCorner());
    expect(result.instantCentre.kind).toBe('defined');
    if (result.instantCentre.kind !== 'defined') return;
    expect(result.instantCentre.value.y).toBeCloseTo(mm(-435.691), 4);
    expect(result.instantCentre.value.z).toBeCloseTo(mm(60.509), 4);

    expect(result.rollCentreHeight.kind).toBe('defined');
    if (result.rollCentreHeight.kind !== 'defined') return;
    expect(result.rollCentreHeight.value).toBeCloseTo(mm(9.9749), 4);
    expect(result.rollCentreLateral.kind).toBe('defined');
    if (result.rollCentreLateral.kind !== 'defined') return;
    expect(result.rollCentreLateral.value).toBeCloseTo(0, 9);
  });

  it('G02.2 reference LF bump +/-0.5 mm: camber gain', () => {
    const result = solveFrontView(referenceCorner());
    const expected = -0.109816 * DEG * 1000;
    expect(result.camberGain.kind).toBe('defined');
    if (result.camberGain.kind !== 'defined') return;
    expect(result.camberGain.value).toBeCloseTo(expected, 5);

    expect(result.camberGainGlobal.kind).toBe('defined');
    if (result.camberGainGlobal.kind !== 'defined') return;
    expect(result.camberGainGlobal.value).toBeCloseTo(expected, 5);
  });

  it('G02.3 reference LF bump +2.000 mm: carrier state and kingpin angle', () => {
    const state = solveFrontViewAtBump(referenceCorner(), mm(2));
    expect(state.kind).toBe('defined');
    if (state.kind !== 'defined') return;

    expect(state.value.upperOuter_m.y).toBeCloseTo(mm(72.8018), 6);
    expect(state.value.upperOuter_m.z).toBeCloseTo(mm(45.9419), 6);
    expect(state.value.wheelCentre_m.y).toBeCloseTo(mm(86.0544), 6);
    expect(state.value.wheelCentre_m.z).toBeCloseTo(mm(34), 6);
    expect(state.value.kingpinAngle_rad).toBeCloseTo(-8.2515 * DEG, 5);
  });

  it('mirrored RF keeps per-wheel camber gain and negates it in the global frame', () => {
    const left = solveFrontView(referenceCorner(1));
    const right = solveFrontView(referenceCorner(-1));

    expect(left.camberGain.kind).toBe('defined');
    expect(right.camberGain.kind).toBe('defined');
    expect(left.camberGainGlobal.kind).toBe('defined');
    expect(right.camberGainGlobal.kind).toBe('defined');
    if (
      left.camberGain.kind !== 'defined' ||
      right.camberGain.kind !== 'defined' ||
      left.camberGainGlobal.kind !== 'defined' ||
      right.camberGainGlobal.kind !== 'defined'
    ) {
      return;
    }

    expect(right.camberGain.value).toBeCloseTo(left.camberGain.value, 8);
    expect(right.camberGainGlobal.value).toBeCloseTo(-left.camberGainGlobal.value, 8);

    expect(left.rollCentreHeight.kind).toBe('defined');
    expect(right.rollCentreHeight.kind).toBe('defined');
    if (left.rollCentreHeight.kind !== 'defined' || right.rollCentreHeight.kind !== 'defined') {
      return;
    }
    expect(right.rollCentreHeight.value).toBeCloseTo(left.rollCentreHeight.value, 8);
    expect(right.rollCentreHeight.value).toBeCloseTo(mm(9.9749), 4);
  });

  it('derived rear geometry is inferred and flagged, never presented as measured', () => {
    const rear = referenceCorner(1);
    const derived: FrontViewInput = {
      ...rear,
      corner: 'LR',
      lcaIn_m: { ...rear.lcaIn_m, confidence: 'derived' },
      lcaOut_m: { ...rear.lcaOut_m, confidence: 'derived' },
      ucaIn_m: { ...rear.ucaIn_m, confidence: 'derived' },
      ucaOut_m: { ...rear.ucaOut_m, confidence: 'derived' },
      wheelCentre_m: { ...rear.wheelCentre_m, confidence: 'derived' },
    };

    const result = solveFrontView(derived);
    const outputs = [
      result.instantCentre,
      result.rollCentreHeight,
      result.rollCentreLateral,
      result.camberGain,
      result.camberGainGlobal,
      result.staticState,
    ];

    for (const output of outputs) {
      expect(output.kind).toBe('defined');
      if (output.kind !== 'defined') continue;
      expect(output.tier).toBe('inferred');
      expect(output.flags.has('derivedGeometry')).toBe(true);
      expect(output.provenance.has('lca_in_a')).toBe(true);
    }

    const measured = solveFrontView(referenceCorner());
    expect(measured.rollCentreHeight.kind).toBe('defined');
    if (measured.rollCentreHeight.kind !== 'defined') return;
    expect(measured.rollCentreHeight.tier).toBe('firm');
    expect(measured.rollCentreHeight.flags.has('derivedGeometry')).toBe(false);
  });

  it('parallel arms return a typed undefined instant centre and a finite limit roll centre', () => {
    const result = solveFrontView(parallelCorner(false));
    expect(result.instantCentre.kind).toBe('undefined');
    if (result.instantCentre.kind === 'undefined') {
      expect(result.instantCentre.reason).toBe('parallelLinks');
    }
    expect(result.rollCentreHeight.kind).toBe('defined');
    if (result.rollCentreHeight.kind !== 'defined') return;
    expect(result.rollCentreHeight.value).toBeCloseTo(0, 12);
    expect(Number.isFinite(result.rollCentreHeight.value)).toBe(true);
    expect(result.rollCentreLateral.kind).toBe('defined');
    if (result.rollCentreLateral.kind !== 'defined') return;
    expect(result.rollCentreLateral.value).toBeCloseTo(0, 12);
  });

  it('vertical parallel arms return degenerateGeometry, never infinity', () => {
    const result = solveFrontView(parallelCorner(true));
    expect(result.rollCentreHeight.kind).toBe('undefined');
    if (result.rollCentreHeight.kind === 'undefined') {
      expect(result.rollCentreHeight.reason).toBe('degenerateGeometry');
    }
    expect(result.instantCentre.kind).toBe('undefined');
    if (result.instantCentre.kind === 'undefined') {
      expect(result.instantCentre.reason).toBe('parallelLinks');
    }
  });
});
