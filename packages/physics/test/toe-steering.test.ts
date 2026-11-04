import { describe, expect, it } from 'vitest';
import {
  buildToeSeries,
  solveAckermann,
  solveSteerAngle,
  solveToeAtTieOutHeight,
  type ToeInput,
  type ToeSeries,
} from '../src/index.js';

const MM = 1 / 1000;
const DEG = Math.PI / 180;

type Confidence = ToeInput['lcaOut_m']['confidence'];

function source<T>(ref: string, value: T, confidence: Confidence = 'measured') {
  return { ref, value, confidence };
}

function v3(x: number, y: number, z: number) {
  return { x: x * MM, y: y * MM, z: z * MM };
}

function referenceFront(side: 1 | -1 = 1): ToeInput {
  const left = side === 1;
  return {
    corner: left ? 'LF' : 'RF',
    side,
    lowerArmType: 'hinge',
    upperArmType: 'single_link',
    lcaInA_m: source('lca_in_a', v3(238, side * 30, 12)),
    lcaInB_m: source('lca_in_b', v3(272, side * 30, 12)),
    lcaOut_m: source('lca_out', v3(259, side * 78, 7)),
    ucaIn_m: source('uca_in', v3(250, side * 42, 45)),
    ucaOut_m: source('uca_out', v3(254, side * 72.8, 44)),
    wheelCentre_m: source('wc', v3(257, side * 86, 32)),
    tieIn_m: source('tie_in', v3(225, side * 26, 30)),
    tieOut_m: source('tie_out', v3(243.6802, side * 74.0415, 32)),
    staticToe_rad: source(left ? 'LF.toe' : 'RF.toe', 0.5 * DEG),
    bumpLimit_m: 6 * MM,
    droopLimit_m: 6 * MM,
  };
}

function referenceRear(side: 1 | -1 = 1): ToeInput {
  const left = side === 1;
  return {
    corner: left ? 'LR' : 'RR',
    side,
    lowerArmType: 'hinge',
    upperArmType: 'single_link',
    lcaInA_m: source('lca_in_a', v3(-20, side * 30, 16)),
    lcaInB_m: source('lca_in_b', v3(14, side * 30, 16)),
    lcaOut_m: source('lca_out', v3(1, side * 80, 7)),
    ucaIn_m: source('uca_in', v3(-4, side * 44, 52)),
    ucaOut_m: source('uca_out', v3(0, side * 73.5, 53)),
    wheelCentre_m: source('wc', v3(0, side * 87, 32)),
    tieIn_m: source('tie_in', v3(-22, side * 32, 37)),
    tieOut_m: source('tie_out', v3(-1, side * 75, 38)),
    staticToe_rad: source(left ? 'LR.toe' : 'RR.toe', 0.5 * DEG, 'modelled'),
    bumpLimit_m: 6 * MM,
    droopLimit_m: 6 * MM,
  };
}

function withTieRodLength(input: ToeInput, length_mm: number): ToeInput {
  return { ...input, tieRodLength_m: source('tie_rod.length', length_mm * MM) };
}

function withTieInHeight(input: ToeInput, z_mm: number): ToeInput {
  return {
    ...input,
    tieIn_m: { ...input.tieIn_m, value: v3(input.tieIn_m.value.x / MM, input.tieIn_m.value.y / MM, z_mm) },
  };
}

function definedValue<T extends { kind: string }>(solved: T): T & { value: number } {
  if (solved.kind !== 'defined') {
    throw new Error(`expected defined, got ${JSON.stringify(solved)}`);
  }
  return solved as T & { value: number };
}

function seriesOf(input: ToeInput): ToeSeries {
  const result = buildToeSeries(input);
  if (result.kind !== 'series') {
    throw new Error(`expected series, got ${JSON.stringify(result)}`);
  }
  return result;
}

function toeAt(series: ToeSeries, bumpMm: number): number {
  const sample = series.samples.find((candidate) => Math.abs(candidate.bump_m / MM - bumpMm) < 1e-9);
  if (sample === undefined) throw new Error(`no sample at ${bumpMm} mm`);
  return sample.toe_rad;
}

function tauAt(series: ToeSeries, bumpMm: number): number {
  return toeAt(series, bumpMm) - series.staticSample.toe_rad;
}

function degrees(radians: number): number {
  return radians / DEG;
}

function gainDegreesPerMm(series: ToeSeries): number {
  return degrees(definedValue(series.gain_radPerM).value) / 1000;
}

describe('04 steering golden cases', () => {
  it('G04.1 rack +2.000 mm steers both front wheels right', () => {
    const left = definedValue(solveSteerAngle(referenceFront(1), 2 * MM)).value;
    const right = definedValue(solveSteerAngle(referenceFront(-1), 2 * MM)).value;
    expect(degrees(left)).toBeCloseTo(-7.603, 3);
    expect(degrees(right)).toBeCloseTo(-8.563, 3);
  });

  it('G04.2 reference Ackermann uses contact-patch track', () => {
    const left = definedValue(solveSteerAngle(referenceFront(1), 2 * MM)).value;
    const right = definedValue(solveSteerAngle(referenceFront(-1), 2 * MM)).value;
    const ackermann = solveAckermann(left, right, 0.172, 0.257);
    expect(ackermann.kind).toBe('reported');
    expect(ackermann.percent).toBeCloseTo(127.06, 2);
  });

  it('G04.3 steering arm at -5 degrees gives the documented pair and 99 % Ackermann', () => {
    const options = { steeringArmOffset_rad: -5 * DEG };
    const left = definedValue(solveSteerAngle(referenceFront(1), 2 * MM, options)).value;
    const right = definedValue(solveSteerAngle(referenceFront(-1), 2 * MM, options)).value;
    expect(degrees(left)).toBeCloseTo(-7.202, 3);
    expect(degrees(right)).toBeCloseTo(-7.852, 3);
    const ackermann = solveAckermann(left, right, 0.172, 0.257);
    expect(ackermann.percent).toBeCloseTo(99.0, 1);
  });

  it('G04.4 bump toe table is toe-in positive, same on both front wheels', () => {
    const left = seriesOf(referenceFront(1));
    const right = seriesOf(referenceFront(-1));

    expect(degrees(tauAt(left, -2))).toBeCloseTo(0.166, 3);
    expect(degrees(tauAt(left, 2))).toBeCloseTo(-0.484, 3);
    expect(degrees(tauAt(left, 4))).toBeCloseTo(-1.29, 3);

    expect(degrees(tauAt(right, -2))).toBeCloseTo(0.166, 3);
    expect(degrees(tauAt(right, 2))).toBeCloseTo(-0.484, 3);
    expect(degrees(tauAt(right, 4))).toBeCloseTo(-1.29, 3);

    const axleAtPlusTwo = degrees(tauAt(left, 2) + tauAt(right, 2));
    expect(axleAtPlusTwo).toBeCloseTo(-0.968, 3);
  });

  it('G04.5 bump-steer coefficient is -0.1625 deg/mm', () => {
    expect(gainDegreesPerMm(seriesOf(referenceFront(1)))).toBeCloseTo(-0.1625, 3);
  });

  it('G04.6 moving the inner ball to 32 mm crosses zero', () => {
    const input = withTieRodLength(withTieInHeight(referenceFront(1), 32), 51.5843);
    expect(gainDegreesPerMm(seriesOf(input))).toBeCloseTo(0.0, 3);
  });

  it('G04.7 a rack beyond its mechanical limit is outOfRackTravel', () => {
    const result = solveSteerAngle(referenceFront(1), 40 * MM, { rackLimit_m: 8 * MM });
    expect(result.kind).toBe('undefined');
    if (result.kind === 'undefined') expect(result.reason).toBe('outOfRackTravel');
  });

  it('G04.8 Ackermann is suppressed below half a degree of inner steer', () => {
    const smallLeft = definedValue(solveSteerAngle(referenceFront(1), 0.1 * MM)).value;
    const smallRight = definedValue(solveSteerAngle(referenceFront(-1), 0.1 * MM)).value;
    const suppressed = solveAckermann(smallLeft, smallRight, 0.172, 0.257);
    expect(suppressed.kind).toBe('suppressed');
    expect(suppressed.percent).toBeNull();
    expect(suppressed.flags.has('lowAngle')).toBe(true);
    expect(degrees(suppressed.inner_rad)).toBeCloseTo(0.4, 2);

    const left = definedValue(solveSteerAngle(referenceFront(1), 0.3 * MM)).value;
    const right = definedValue(solveSteerAngle(referenceFront(-1), 0.3 * MM)).value;
    const reported = solveAckermann(left, right, 0.172, 0.257);
    expect(reported.kind).toBe('reported');
    expect(degrees(reported.inner_rad)).toBeCloseTo(1.209, 3);
  });

  it('G04.9 an inconsistent static tie rod is incompleteModel naming the tie points', () => {
    const input = withTieRodLength(referenceFront(1), 51.6843);
    const result = buildToeSeries(input);
    expect(result.kind).toBe('unavailable');
    if (result.kind === 'unavailable') {
      expect(result.reason).toBe('incompleteModel');
      expect(result.inputs).toContain('tie_in');
      expect(result.inputs).toContain('tie_out');
    }
  });

  it('G04.10 the crank-angle height gives -0.430 deg, not the carrier transform', () => {
    const toe = definedValue(solveToeAtTieOutHeight(referenceFront(1), 33.782 * MM)).value;
    const tau = degrees(toe - 0.5 * DEG);
    expect(tau).toBeCloseTo(-0.43, 3);
  });
});

describe('toe-link acceptance', () => {
  it('reports the stored static toe at zero travel at both ends', () => {
    for (const input of [referenceFront(1), referenceFront(-1), referenceRear(1), referenceRear(-1)]) {
      const series = seriesOf(input);
      expect(series.staticSample.bump_m).toBe(0);
      expect(series.staticSample.toe_rad).toBeCloseTo(input.staticToe_rad.value, 12);
    }
  });

  it('solves the rear from a fixed inner point and the front from the rack', () => {
    const rearLeft = seriesOf(referenceRear(1));
    const rearRight = seriesOf(referenceRear(-1));
    expect(degrees(tauAt(rearLeft, 2))).toBeCloseTo(degrees(tauAt(rearRight, 2)), 9);
    expect(definedValue(rearLeft.gain_radPerM).value).not.toBe(0);

    const frontLeft = definedValue(solveSteerAngle(referenceFront(1), 2 * MM)).value;
    expect(degrees(frontLeft)).toBeLessThan(0);
  });

  it('gives the rear toe link a non-zero bump-steer coefficient', () => {
    const rear = seriesOf(referenceRear(1));
    expect(Number.isFinite(gainDegreesPerMm(rear))).toBe(true);
    expect(Math.abs(gainDegreesPerMm(rear))).toBeGreaterThan(0.01);
  });
});
