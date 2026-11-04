import {
  K_COINCIDENT_TOL_M,
  K_NUMERIC_EPS,
  K_PARALLEL_TOL,
} from '../geometry/tolerances.js';
import type { Vec3 } from '../geometry/vec3.js';
import type { Sourced } from '../frontView/types.js';
import {
  defined,
  undefinedResult,
  type Band,
  type DefinedOptions,
  type Flag,
  type Solved,
} from '../result/solved.js';
import type {
  AntiDiveAxleResult,
  AntiDiveAxleWorking,
  AntiDiveCurve,
  AntiDiveInput,
  AntiDiveResult,
  AntiDiveSample,
  AntiDiveWorking,
  SideViewAxleInput,
} from './types.js';

const DEFAULT_GRAVITY_MPS2 = 9.81;

/**
 * The geometry's angle is modelled from a 2D side-view projection of a real
 * 3D linkage, and the percentage is diagnostic: it never feeds a handling
 * verdict. Both flags travel with every defined value.
 */
const ANTI_DIVE_FLAGS: readonly Flag[] = ['modelledGeometry', 'diagnosticOnly'];

interface LineIntersection {
  readonly lowerSlope: number;
  readonly upperSlope: number;
  readonly x_m: number;
  readonly z_m: number;
}

type IntersectionOutcome =
  | { readonly ok: true; readonly value: LineIntersection }
  | { readonly ok: false; readonly reason: 'parallelLinks' | 'degenerateGeometry' | 'outOfDomain' }
  | { readonly ok: true; readonly value: null; readonly zeroLimit: true };

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function refsOf(axle: SideViewAxleInput): readonly string[] {
  return [
    axle.lowerInnerA_m.ref,
    axle.lowerInnerB_m.ref,
    axle.lowerOuter_m.ref,
    axle.upperInner_m.ref,
    axle.upperOuter_m.ref,
    axle.contactPatchX_m.ref,
  ];
}

function optionsFor(
  sources: readonly Sourced<unknown>[],
  band: Band | null,
): DefinedOptions {
  return {
    tier: 'inferred',
    band,
    provenance: sources.map((source) => source.ref),
    flags: new Set(ANTI_DIVE_FLAGS),
  };
}

function slope(from: Vec3, to: Vec3): number | null {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (Math.abs(dx) <= K_NUMERIC_EPS) return null;
  return dz / dx;
}

/**
 * Intersect the lower arm's side-view line with the upper link's. The lower
 * line passes through the lower ball joint in the direction of the hinge axis
 * (`lca_in_a → lca_in_b`); the upper line is `uca_in → uca_out`.
 *
 * Equal screw heights are the zero-anti-dive limit: the hinge axis is level, the
 * ball joint moves in a vertical side-view plane, and the owner's model returns
 * exactly 0 %. That is a defined zero, not an error. An exact zero-slope
 * parallel pair is the same limit and is also a defined zero; any other
 * parallel pair has no finite instant centre and is refused.
 */
function sideViewInstantCentre(
  axle: SideViewAxleInput,
): IntersectionOutcome {
  const a = axle.lowerInnerA_m.value;
  const b = axle.lowerInnerB_m.value;
  const outer = axle.lowerOuter_m.value;
  const upperInner = axle.upperInner_m.value;
  const upperOuter = axle.upperOuter_m.value;

  const d1x = b.x - a.x;
  const d1z = b.z - a.z;
  const d2x = upperOuter.x - upperInner.x;
  const d2z = upperOuter.z - upperInner.z;
  const lowerLength = Math.hypot(d1x, d1z);
  const upperLength = Math.hypot(d2x, d2z);
  if (lowerLength <= K_COINCIDENT_TOL_M || upperLength <= K_COINCIDENT_TOL_M) {
    return { ok: false, reason: 'degenerateGeometry' };
  }

  if (a.z === b.z) {
    return { ok: true, value: null, zeroLimit: true };
  }

  const denominator = d1x * d2z - d1z * d2x;
  if (Math.abs(denominator) <= K_PARALLEL_TOL * lowerLength * upperLength) {
    if (d1z === 0) {
      return { ok: true, value: null, zeroLimit: true };
    }
    return { ok: false, reason: 'parallelLinks' };
  }

  const t =
    ((upperInner.x - outer.x) * d2z - (upperInner.z - outer.z) * d2x) / denominator;
  const x = outer.x + t * d1x;
  const z = outer.z + t * d1z;
  if (!isFiniteNumber(x) || !isFiniteNumber(z)) {
    return { ok: false, reason: 'outOfDomain' };
  }

  const lowerSlope = slope(a, b);
  const upperSlope = slope(upperInner, upperOuter);
  if (lowerSlope === null || upperSlope === null) {
    return { ok: false, reason: 'degenerateGeometry' };
  }
  return { ok: true, value: { lowerSlope, upperSlope, x_m: x, z_m: z } };
}

function emptyAxleWorking(): AntiDiveAxleWorking {
  return {
    lowerSlope: null,
    upperSlope: null,
    instantCentreX_m: null,
    instantCentreZ_m: null,
    tanTheta: null,
    staticAxleLoad_N: null,
    longitudinalTransfer_N: null,
    dynamicAxleLoad_N: null,
    axleLoadPerMass_mps2: null,
  };
}

/**
 * The axles share of the cars weight at the traction limit, dimensionless.
 *
 * Not `N / kg`: that is m/s², and multiplying a percentage by it inflates the
 * answer by g (a 2 mm shim read -590 % instead of -60 %). The share is
 * `dynamicLoad / (mass * g)`, so gravity belongs in the denominator.
 */
function perMass(dynamicLoad_N: number, mass_kg: number): number {
  return dynamicLoad_N / mass_kg;
}

/**
 * The axle's share of the car's weight at the traction limit, dimensionless.
 *
 * Not `N / kg`: that is m/s² (kept separately as `axleLoadPerMass_mps2`), and
 * multiplying a percentage by it inflates the answer by g — a 2 mm shim read
 * -590 % instead of -60 %. The share is `dynamicLoad / (mass * g)`.
 */
function weightShare(dynamicLoad_N: number, mass_kg: number, gravity_mps2: number): number {
  return dynamicLoad_N / (mass_kg * gravity_mps2);
}

/**
 * The percentage at one axle. `tanTheta` is signed: front positive when the
 * side-view instant centre is behind the front contact patch, rear positive
 * when it is ahead of the rear patch. Wrong-side geometry therefore reads as a
 * negative (pro-dive / pro-squat) percentage rather than being hidden.
 */
function percentage(
  tanTheta: number,
  wheelbase_m: number,
  cgHeight_m: number,
  dynamicLoad_N: number,
  mass_kg: number,
  gravity_mps2: number,
): number {
  return tanTheta * (wheelbase_m / cgHeight_m) * weightShare(dynamicLoad_N, mass_kg, gravity_mps2) * 100;
}

function buildAxleResult(
  input: AntiDiveInput,
  axle: SideViewAxleInput,
  kind: 'front' | 'rear',
  mass_kg: number,
  wheelbase_m: number,
  cgHeight_m: number,
  staticAxleLoad_N: number,
  longitudinalTransfer_N: number,
  acceleration_mps2: number,
): AntiDiveAxleResult {
  type MutableWorking = {
    -readonly [K in keyof AntiDiveAxleWorking]: AntiDiveAxleWorking[K];
  };
  const working: MutableWorking = {
    ...emptyAxleWorking(),
    staticAxleLoad_N,
    longitudinalTransfer_N,
  };
  const dynamicAxleLoad_N = staticAxleLoad_N + longitudinalTransfer_N;
  const gravity_mps2 = input.gravity_mps2 ?? DEFAULT_GRAVITY_MPS2;
  working.dynamicAxleLoad_N = dynamicAxleLoad_N;
  working.axleLoadPerMass_mps2 = perMass(dynamicAxleLoad_N, mass_kg);

  const sources: Sourced<unknown>[] = [
    axle.lowerInnerA_m,
    axle.lowerInnerB_m,
    axle.lowerOuter_m,
    axle.upperInner_m,
    axle.upperOuter_m,
    axle.contactPatchX_m,
    input.wheelbase_m,
    input.cgHeight_m ?? input.totalMass_kg,
    input.totalMass_kg,
    input.frontMassShare,
  ];
  const zero = (): AntiDiveAxleResult => {
    const band: Band = { low: 0, high: 0 };
    return {
      percent: defined(0, optionsFor(sources, band)),
      tanTheta: defined(0, optionsFor(sources, null)),
      dynamicAxleLoad_N: defined(dynamicAxleLoad_N, optionsFor(sources, null)),
      axleLoadPerMass_mps2: defined(working.axleLoadPerMass_mps2 ?? 0, optionsFor(sources, null)),
      working,
    };
  };

  // Anti-dive is a braking quantity and anti-squat an acceleration quantity.
  // At zero or opposite-sign acceleration the event is not happening, so the
  // percentage is a defined zero rather than a static-load artefact.
  if (kind === 'front' ? acceleration_mps2 >= 0 : acceleration_mps2 <= 0) {
    return zero();
  }

  const intersection = sideViewInstantCentre(axle);
  if (!intersection.ok) {
    const failure = undefinedResult(intersection.reason, refsOf(axle));
    return {
      percent: failure,
      tanTheta: failure,
      dynamicAxleLoad_N: failure,
      axleLoadPerMass_mps2: failure,
      working,
    };
  }

  if (intersection.value === null) {
    return zero();
  }

  const { lowerSlope, upperSlope, x_m, z_m } = intersection.value;
  working.lowerSlope = lowerSlope;
  working.upperSlope = upperSlope;
  working.instantCentreX_m = x_m;
  working.instantCentreZ_m = z_m;

  const xCp = axle.contactPatchX_m.value;
  const correctSide = kind === 'front' ? x_m < xCp : x_m > xCp;
  const denominator = kind === 'front' ? xCp - x_m : x_m - xCp;
  if (Math.abs(denominator) <= K_NUMERIC_EPS || !isFiniteNumber(denominator)) {
    const failure = undefinedResult('outOfDomain', refsOf(axle));
    return {
      percent: failure,
      tanTheta: failure,
      dynamicAxleLoad_N: failure,
      axleLoadPerMass_mps2: failure,
      working,
    };
  }
  const rawTan = (z_m - 0) / denominator;
  // Being on the wrong side of the contact patch is pro-dive / pro-squat even
  // when the instant centre is below ground (both numerator and denominator
  // negative). Force the sign from the side, not from the double negative.
  const tanTheta = correctSide ? rawTan : -Math.abs(rawTan);
  working.tanTheta = tanTheta;

  const value = percentage(
    tanTheta,
    wheelbase_m,
    cgHeight_m,
    dynamicAxleLoad_N,
    mass_kg,
    gravity_mps2,
  );

  const bands: number[] = [value];
  const cgBand = input.cgHeightBand_m ?? null;
  if (cgBand !== null && cgBand.low > 0 && cgBand.high > 0) {
    bands.push(
      percentage(tanTheta, wheelbase_m, cgBand.low, dynamicAxleLoad_N, mass_kg, gravity_mps2),
      percentage(tanTheta, wheelbase_m, cgBand.high, dynamicAxleLoad_N, mass_kg, gravity_mps2),
    );
  }
  const band: Band | null =
    cgBand === null ? null : { low: Math.min(...bands), high: Math.max(...bands) };

  return {
    percent: defined(value, optionsFor(sources, band)),
    tanTheta: defined(tanTheta, optionsFor(sources, null)),
    dynamicAxleLoad_N: defined(dynamicAxleLoad_N, optionsFor(sources, null)),
    axleLoadPerMass_mps2: defined(working.axleLoadPerMass_mps2 ?? 0, optionsFor(sources, null)),
    working,
  };
}

/**
 * Solve anti-dive (front) and anti-squat (rear) at one signed longitudinal
 * acceleration. Braking is negative and acceleration positive. The axle share
 * is `Fz_axle(a) / m` from the dynamic load at the traction limit, so no brake
 * bias, torque split or centre-diff field exists.
 */
export function solveAntiDive(input: AntiDiveInput): AntiDiveResult {
  const g = input.gravity_mps2 ?? DEFAULT_GRAVITY_MPS2;
  const mass = input.totalMass_kg.value;
  const wheelbase = input.wheelbase_m.value;
  const cgHeight = input.cgHeight_m === null ? null : input.cgHeight_m.value;
  const frontShare = input.frontMassShare.value;
  const acceleration = input.longitudinalAcceleration_mps2;

  const working: AntiDiveWorking = {
    wheelbase_m: isFiniteNumber(wheelbase) ? wheelbase : null,
    cgHeight_m: cgHeight !== null && isFiniteNumber(cgHeight) ? cgHeight : null,
    totalMass_kg: isFiniteNumber(mass) ? mass : null,
    frontMassShare: isFiniteNumber(frontShare) ? frontShare : null,
    longitudinalAcceleration_mps2: acceleration,
    gravity_mps2: g,
  };

  if (
    input.cgHeight_m === null ||
    cgHeight === null ||
    !isFiniteNumber(cgHeight) ||
    cgHeight <= 0 ||
    !isFiniteNumber(mass) ||
    mass <= 0 ||
    !isFiniteNumber(wheelbase) ||
    wheelbase <= 0 ||
    !isFiniteNumber(frontShare) ||
    frontShare <= 0 ||
    frontShare >= 1 ||
    !isFiniteNumber(acceleration)
  ) {
    const failure =
      input.cgHeight_m === null
        ? undefinedResult('incompleteModel', ['body.cg.height'])
        : undefinedResult('outOfDomain', [
            input.totalMass_kg.ref,
            input.wheelbase_m.ref,
            input.frontMassShare.ref,
          ]);
    const empty: AntiDiveAxleResult = {
      percent: failure,
      tanTheta: failure,
      dynamicAxleLoad_N: failure,
      axleLoadPerMass_mps2: failure,
      working: emptyAxleWorking(),
    };
    return { front: empty, rear: empty, working };
  }

  const staticFront_N = mass * g * frontShare;
  const staticRear_N = mass * g * (1 - frontShare);
  // T_long = m·|a_x|·h/L. The curve is signed by the event: braking transfers
  // to the front, acceleration to the rear, so the magnitude is the load added
  // to the axle being evaluated.
  const transfer_N = (mass * Math.abs(acceleration) * cgHeight) / wheelbase;

  return {
    front: buildAxleResult(
      input,
      input.front,
      'front',
      mass,
      wheelbase,
      cgHeight,
      staticFront_N,
      acceleration < 0 ? transfer_N : 0,
      acceleration,
    ),
    rear: buildAxleResult(
      input,
      input.rear,
      'rear',
      mass,
      wheelbase,
      cgHeight,
      staticRear_N,
      acceleration > 0 ? transfer_N : 0,
      acceleration,
    ),
    working,
  };
}

/**
 * The percentage against signed longitudinal acceleration. The samples let the
 * UI show the curve rather than one number, because the value varies with g and
 * CG height. Braking samples are negative; acceleration samples are positive.
 */
export function solveAntiDiveCurve(
  input: AntiDiveInput,
  options: {
    readonly minAcceleration_mps2?: number;
    readonly maxAcceleration_mps2?: number;
    readonly samples?: number;
  } = {},
): AntiDiveCurve {
  const g = input.gravity_mps2 ?? DEFAULT_GRAVITY_MPS2;
  const min = options.minAcceleration_mps2 ?? -2.5 * g;
  const max = options.maxAcceleration_mps2 ?? 2.5 * g;
  const count = Math.max(2, options.samples ?? 41);
  const samples: AntiDiveSample[] = [];
  for (let index = 0; index < count; index += 1) {
    const acceleration = min + ((max - min) * index) / (count - 1);
    const solved = solveAntiDive({ ...input, longitudinalAcceleration_mps2: acceleration });
    samples.push({
      acceleration_mps2: acceleration,
      antiDivePercent: solved.front.percent,
      antiSquatPercent: solved.rear.percent,
    });
  }
  return {
    samples,
    minAcceleration_mps2: min,
    maxAcceleration_mps2: max,
    front: input.front,
    rear: input.rear,
  };
}
