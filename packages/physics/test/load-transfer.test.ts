import { describe, expect, it } from 'vitest';
import {
  defined,
  inferCgHeight,
  solveLoadTransfer,
  type CgComponentInput,
  type Confidence,
  type LoadTransferInput,
  type Sourced,
} from '../src/index.js';

const MM = 1 / 1000;
const G = 9.81;

function sourced<T>(ref: string, value: T, confidence: Confidence = 'measured'): Sourced<T> {
  return { ref, value, confidence };
}

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

function referenceInput(overrides: Partial<LoadTransferInput> = {}): LoadTransferInput {
  return {
    totalMass_kg: sourced('body.mass.total', 1.35),
    frontMassShare: sourced('body.cg.front_mass_share', 0.45, 'derived'),
    unsprungFront_kg: sourced('body.mass.unsprung_front', 0.12, 'estimated'),
    unsprungRear_kg: sourced('body.mass.unsprung_rear', 0.12, 'estimated'),
    unsprungHeight_m: sourced('body.cg.unsprung_height', 20 * MM, 'assumed'),
    cgComponents: null,
    wheelbase_m: sourced('body.wheelbase', 257 * MM),
    trackFront_m: sourced('axles.front.track', 172 * MM),
    trackRear_m: sourced('axles.rear.track', 174 * MM),
    rollCentreFront_m: sourced('front.roll_centre_height', 9.9749 * MM, 'derived'),
    rollCentreRear_m: sourced('assumed.rear_roll_centre_height', 6.0 * MM, 'assumed'),
    rollStiffnessFront_NmPerRad: defined(37.274),
    rollStiffnessRear_NmPerRad: defined(28.368),
    lateralAcceleration_mps2: G,
    ...overrides,
  };
}

function componentTable(): readonly CgComponentInput[] {
  const rows: readonly [string, number, number][] = [
    ['chassis plate', 84, 8],
    ['motor + rotor + mount', 190, 22],
    ['battery (2S shorty)', 210, 18],
    ['ESC + receiver + wiring', 45, 24],
    ['servo + saver + linkage', 60, 26],
    ['body shell + wing', 85, 36],
    ['hardware, arms, hubs, bumpers', 436, 14],
  ];
  return rows.map(([name, grams, heightMm]) => ({
    mass_kg: sourced(`body.cg.components.${name}.mass`, grams / 1000, 'estimated'),
    height_m: sourced(`body.cg.components.${name}.z`, heightMm * MM, 'estimated'),
  }));
}

describe('load-transfer goldens (docs/specs/physics/06-load-transfer.md §7)', () => {
  it('G06.1 reference car: static corner weights 2.9798 N front / 3.6420 N rear', () => {
    const result = solveLoadTransfer(referenceInput());
    expect(result.staticFrontCorner.kind).toBe('defined');
    expect(result.staticRearCorner.kind).toBe('defined');
    if (result.staticFrontCorner.kind !== 'defined' || result.staticRearCorner.kind !== 'defined') {
      return;
    }
    expect(relativeError(result.staticFrontCorner.value, 2.9798)).toBeLessThanOrEqual(1e-4);
    expect(relativeError(result.staticRearCorner.value, 3.642)).toBeLessThanOrEqual(1e-4);
  });

  it('G06.2 reference car at 1 g: TLLT = 2.1435 N with the mean track', () => {
    const result = solveLoadTransfer(referenceInput());
    expect(result.totalLateralLoadTransfer.kind).toBe('defined');
    if (result.totalLateralLoadTransfer.kind !== 'defined') return;
    expect(relativeError(result.totalLateralLoadTransfer.value, 2.1435)).toBeLessThanOrEqual(1e-4);
    // D-18/06 §6.7: the magnitude carries the CG band and is never `firm`.
    expect(result.totalLateralLoadTransfer.tier).toBe('inferred');
    expect(result.totalLateralLoadTransfer.flags.has('cgInferred')).toBe(true);
    expect(result.totalLateralLoadTransfer.band).not.toBeNull();
  });

  it('G06.3 reference car at 1 g: h_s, h_ra, M_el and φ', () => {
    const result = solveLoadTransfer(referenceInput());
    expect(result.working.sprungCgHeight_m).not.toBeNull();
    expect(result.rollAxisHeight.kind).toBe('defined');
    expect(result.rollMoment.kind).toBe('defined');
    expect(result.rollAngle.kind).toBe('defined');
    if (
      result.working.sprungCgHeight_m === null ||
      result.rollAxisHeight.kind !== 'defined' ||
      result.rollMoment.kind !== 'defined' ||
      result.rollAngle.kind !== 'defined'
    ) {
      return;
    }
    expect(relativeError(result.working.sprungCgHeight_m * 1000, 29.7297)).toBeLessThanOrEqual(1e-4);
    expect(relativeError(result.rollAxisHeight.value * 1000, 7.789)).toBeLessThanOrEqual(1e-4);
    expect(relativeError(result.rollMoment.value, 0.23892)).toBeLessThanOrEqual(1e-4);
    expect(relativeError((result.rollAngle.value * 180) / Math.PI, 0.20854)).toBeLessThanOrEqual(1e-4);
  });

  it('G06.4 reference car at 1 g: ΔW_f, ΔW_r and balance 56.15 %', () => {
    const result = solveLoadTransfer(referenceInput());
    expect(result.front.total.kind).toBe('defined');
    expect(result.rear.total.kind).toBe('defined');
    expect(result.balance.kind).toBe('defined');
    if (
      result.front.total.kind !== 'defined' ||
      result.rear.total.kind !== 'defined' ||
      result.balance.kind !== 'defined'
    ) {
      return;
    }
    expect(relativeError(result.front.total.value, 1.20299)).toBeLessThanOrEqual(1e-4);
    expect(relativeError(result.rear.total.value, 0.93929)).toBeLessThanOrEqual(1e-4);
    expect(relativeError(result.balance.value * 100, 56.15)).toBeLessThanOrEqual(1e-4);
  });

  it('G06.5 front outer 120.2 %, inner 79.8 %, and inner + outer = 2 × static', () => {
    const result = solveLoadTransfer(referenceInput());
    expect(result.frontWheel.outer.kind).toBe('defined');
    expect(result.frontWheel.inner.kind).toBe('defined');
    expect(result.frontWheel.outerShareOfStatic.kind).toBe('defined');
    expect(result.frontWheel.innerShareOfStatic.kind).toBe('defined');
    if (
      result.frontWheel.outer.kind !== 'defined' ||
      result.frontWheel.inner.kind !== 'defined' ||
      result.frontWheel.outerShareOfStatic.kind !== 'defined' ||
      result.frontWheel.innerShareOfStatic.kind !== 'defined' ||
      result.staticFrontCorner.kind !== 'defined'
    ) {
      return;
    }
    expect(relativeError(result.frontWheel.outer.value, 3.5813)).toBeLessThanOrEqual(1e-4);
    expect(relativeError(result.frontWheel.inner.value, 2.3783)).toBeLessThanOrEqual(1e-4);
    // §7 prints these to 0.1 %, so compare at that displayed precision.
    expect(Math.abs(result.frontWheel.outerShareOfStatic.value * 100 - 120.2)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(result.frontWheel.innerShareOfStatic.value * 100 - 79.8)).toBeLessThanOrEqual(0.05);
    expect(
      Math.abs(
        result.frontWheel.inner.value +
          result.frontWheel.outer.value -
          2 * result.staticFrontCorner.value,
      ),
    ).toBeLessThanOrEqual(1e-9);
  });

  it('G06.6 k_φ,total = 0 refuses roll angle and balance with noRollStiffness', () => {
    const result = solveLoadTransfer(
      referenceInput({
        rollStiffnessFront_NmPerRad: defined(0),
        rollStiffnessRear_NmPerRad: defined(0),
      }),
    );
    expect(result.rollAngle.kind).toBe('undefined');
    if (result.rollAngle.kind === 'undefined') {
      expect(result.rollAngle.reason).toBe('noRollStiffness');
    }
    expect(result.balance.kind).toBe('undefined');
    if (result.balance.kind === 'undefined') {
      expect(result.balance.reason).toBe('noRollStiffness');
    }
    expect(result.totalLateralLoadTransfer.kind).toBe('defined');
  });

  it('G06.7 a_y = 0: transfers are zero, balance is Undefined(zeroLateral), the rest stays defined', () => {
    const result = solveLoadTransfer(referenceInput({ lateralAcceleration_mps2: 0 }));
    expect(result.totalLateralLoadTransfer.kind).toBe('defined');
    expect(result.rollAngle.kind).toBe('defined');
    expect(result.front.total.kind).toBe('defined');
    expect(result.front.elastic.kind).toBe('defined');
    expect(result.front.geometric.kind).toBe('defined');
    expect(result.front.unsprung.kind).toBe('defined');
    expect(result.staticFrontCorner.kind).toBe('defined');
    expect(result.frontWheel.outer.kind).toBe('defined');
    expect(result.residual.kind).toBe('defined');
    if (
      result.totalLateralLoadTransfer.kind !== 'defined' ||
      result.rollAngle.kind !== 'defined' ||
      result.front.total.kind !== 'defined' ||
      result.front.elastic.kind !== 'defined' ||
      result.front.geometric.kind !== 'defined' ||
      result.front.unsprung.kind !== 'defined'
    ) {
      return;
    }
    expect(result.totalLateralLoadTransfer.value).toBe(0);
    expect(result.rollAngle.value).toBe(0);
    expect(result.front.total.value).toBe(0);
    expect(result.front.elastic.value).toBe(0);
    expect(result.front.geometric.value).toBe(0);
    expect(result.front.unsprung.value).toBe(0);
    expect(result.balance.kind).toBe('undefined');
    if (result.balance.kind === 'undefined') {
      expect(result.balance.reason).toBe('zeroLateral');
    }
  });

  it('G06.8 consistency residual for §6 is −0.055 % ± 0.002', () => {
    const result = solveLoadTransfer(referenceInput());
    expect(result.residual.kind).toBe('defined');
    if (result.residual.kind !== 'defined') return;
    expect(Math.abs(result.residual.value * 100 - -0.055)).toBeLessThanOrEqual(0.002);
  });

  it('G06.9 component-mass h = 18.693 mm → TLLT 1.4310 N, φ 0.10095°, balance 55.70 %', () => {
    const result = solveLoadTransfer(referenceInput({ cgComponents: componentTable() }));
    expect(result.cgRoute).toBe('component_mass_moment');
    expect(result.cgHeight.kind).toBe('defined');
    expect(result.totalLateralLoadTransfer.kind).toBe('defined');
    expect(result.rollAngle.kind).toBe('defined');
    expect(result.balance.kind).toBe('defined');
    if (
      result.cgHeight.kind !== 'defined' ||
      result.totalLateralLoadTransfer.kind !== 'defined' ||
      result.rollAngle.kind !== 'defined' ||
      result.balance.kind !== 'defined'
    ) {
      return;
    }
    expect(relativeError(result.cgHeight.value * 1000, 18.693)).toBeLessThanOrEqual(1e-4);
    expect(relativeError(result.totalLateralLoadTransfer.value, 1.431)).toBeLessThanOrEqual(1e-4);
    expect(relativeError((result.rollAngle.value * 180) / Math.PI, 0.10095)).toBeLessThanOrEqual(1e-4);
    expect(relativeError(result.balance.value * 100, 55.7)).toBeLessThanOrEqual(1e-4);
  });

  it('G06.11 balance is invariant to a_y; loads scale', () => {
    const low = solveLoadTransfer(referenceInput({ lateralAcceleration_mps2: 0.1 * G }));
    const high = solveLoadTransfer(referenceInput({ lateralAcceleration_mps2: 2.5 * G }));
    expect(low.balance.kind).toBe('defined');
    expect(high.balance.kind).toBe('defined');
    expect(low.totalLateralLoadTransfer.kind).toBe('defined');
    expect(high.totalLateralLoadTransfer.kind).toBe('defined');
    if (
      low.balance.kind !== 'defined' ||
      high.balance.kind !== 'defined' ||
      low.totalLateralLoadTransfer.kind !== 'defined' ||
      high.totalLateralLoadTransfer.kind !== 'defined'
    ) {
      return;
    }
    expect(Math.abs(low.balance.value - high.balance.value)).toBeLessThanOrEqual(1e-9);
    expect(
      relativeError(high.totalLateralLoadTransfer.value, 25 * low.totalLateralLoadTransfer.value),
    ).toBeLessThanOrEqual(1e-9);
  });

  it('G06.12 x_cg = w_f · l = 115.65 mm; the (1 − w_f) branch is not the CG', () => {
    const result = solveLoadTransfer(referenceInput());
    expect(result.working.cgLongitudinal_m).not.toBeNull();
    if (result.working.cgLongitudinal_m === null) return;
    expect(Math.abs(result.working.cgLongitudinal_m * 1000 - 115.65)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(result.working.cgLongitudinal_m * 1000 - 141.35)).toBeGreaterThan(20);
  });
});

describe('CG-height inference (D-14, D-18, 01 §4.5)', () => {
  it('uses the stated 28.0 mm default when no component table is present', () => {
    const result = inferCgHeight({
      totalMass_kg: sourced('body.mass.total', 1.35),
      unsprungMass_kg: sourced('body.mass.unsprung', 0.24),
      unsprungHeight_m: sourced('body.cg.unsprung_height', 0.02, 'assumed'),
      components: null,
    });
    expect(result.route).toBe('stated_default');
    expect(result.height_m.kind).toBe('defined');
    if (result.height_m.kind !== 'defined') return;
    expect(result.height_m.value).toBe(0.028);
    expect(result.height_m.tier).toBe('inferred');
    expect(result.height_m.flags.has('cgInferred')).toBe(true);
  });

  it('computes the component-mass first moment including unsprung mass', () => {
    const result = inferCgHeight({
      totalMass_kg: sourced('body.mass.total', 1.35),
      unsprungMass_kg: sourced('body.mass.unsprung', 0.24),
      unsprungHeight_m: sourced('body.cg.unsprung_height', 0.02, 'assumed'),
      components: componentTable(),
    });
    expect(result.route).toBe('component_mass_moment');
    expect(result.height_m.kind).toBe('defined');
    if (result.height_m.kind !== 'defined') return;
    expect(relativeError(result.height_m.value * 1000, 18.693)).toBeLessThanOrEqual(1e-4);
  });
});

describe('load-transfer degenerate cases (06 §5)', () => {
  it('refuses when unsprung mass is not less than total mass', () => {
    const result = solveLoadTransfer(
      referenceInput({
        unsprungFront_kg: sourced('body.mass.unsprung_front', 0.8, 'estimated'),
        unsprungRear_kg: sourced('body.mass.unsprung_rear', 0.8, 'estimated'),
      }),
    );
    expect(result.totalLateralLoadTransfer.kind).toBe('undefined');
    if (result.totalLateralLoadTransfer.kind === 'undefined') {
      expect(result.totalLateralLoadTransfer.reason).toBe('outOfDomain');
    }
  });

  it('refuses a zero track rather than dividing by it', () => {
    const result = solveLoadTransfer(referenceInput({ trackFront_m: sourced('axles.front.track', 0) }));
    expect(result.totalLateralLoadTransfer.kind).toBe('undefined');
  });

  it('reports a roll centre above the sprung CG as computed, with the flag', () => {
    const result = solveLoadTransfer(
      referenceInput({ rollCentreFront_m: sourced('front.roll_centre_height', 0.065, 'derived') }),
    );
    expect(result.rollMoment.kind).toBe('defined');
    if (result.rollMoment.kind !== 'defined') return;
    expect(result.rollMoment.value).toBeLessThan(0);
    expect(result.rollMoment.flags.has('rollCentreAboveCg')).toBe(true);
  });

  it('G06.10 is out of scope: no chassis torsional stiffness in this module', () => {
    // TODO(spec §6.8): G06.10 needs module 10 (chassis torsion), which does not
    // exist yet. The rigid-chassis solve must not pretend to model it.
    const result = solveLoadTransfer(referenceInput());
    expect(result.balance.kind).toBe('defined');
    expect(result.working.lateralAcceleration_mps2).toBe(G);
  });
});
