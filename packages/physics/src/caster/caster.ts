import { K_COINCIDENT_TOL_M, K_NUMERIC_EPS } from '../geometry/tolerances.js';
import {
  length3,
  normalize3,
  rotateAboutAxis,
  scale3,
  sub3,
  type Vec3,
} from '../geometry/vec3.js';
import type { Sourced } from '../frontView/types.js';
import {
  defined,
  undefinedResult,
  type Band,
  type Confidence,
  type Flag,
  type Solved,
  type Tier,
  type UndefinedReason,
} from '../result/solved.js';
import type {
  CamberInSteerResult,
  CamberInSteerSample,
  CamberInSteerSeries,
  CasterInput,
  SteeringAxisResult,
  SteeringAxisWorking,
} from './types.js';

/** V5's setup-station pass marks (physics/99-validation §7), not propagated inputs. */
export const CASTER_BAND_RAD = (0.3 * Math.PI) / 180;
export const KPI_BAND_RAD = (0.3 * Math.PI) / 180;
export const SCRUB_BAND_M = 0.001;
export const TRAIL_BAND_M = 0.001;

/** The series the card reports, in degrees: 0, 5, 10, 15, 20, 25, 30. */
export const CAMBER_STEER_ANGLES_DEG = [0, 5, 10, 15, 20, 25, 30] as const;
export const CAMBER_STEER_ANGLES_RAD: readonly number[] = CAMBER_STEER_ANGLES_DEG.map(
  (degrees) => (degrees * Math.PI) / 180,
);

const STEER_SIGN = 'positive steer = car turns left';
const CAMBER_SIGN = 'positive camber = top outboard';

interface InternalFailure {
  readonly ok: false;
  readonly reason: UndefinedReason;
  readonly inputs: readonly string[];
}

interface InternalSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

type InternalResult<T> = InternalSuccess<T> | InternalFailure;

function isRearCorner(corner: CasterInput['corner']): boolean {
  return corner === 'LR' || corner === 'RR';
}

function sourcesOf(input: CasterInput): readonly Sourced<unknown>[] {
  return [input.lowerBallJoint_m, input.upperBallJoint_m, input.wheelCentre_m];
}

function inputRefs(input: CasterInput): string[] {
  return sourcesOf(input).map((source) => source.ref);
}

function isFirmSource(confidence: Confidence): boolean {
  return confidence === 'measured' || confidence === 'manufacturer';
}

function tierOf(input: CasterInput): Tier {
  return sourcesOf(input).every((source) => isFirmSource(source.confidence))
    ? 'firm'
    : 'inferred';
}

function provenanceOf(input: CasterInput): Set<string> {
  const provenance = new Set(inputRefs(input));
  for (const source of sourcesOf(input)) {
    if (source.sourceId !== undefined) provenance.add(source.sourceId);
  }
  return provenance;
}

function outputFlags(input: CasterInput): Set<Flag> {
  const flags = new Set<Flag>(['derivedGeometry']);
  const sources = sourcesOf(input);
  if (sources.some((source) => source.confidence === 'assumed')) flags.add('assumedInput');
  if (sources.some((source) => source.confidence === 'estimated' || source.confidence === 'library')) {
    flags.add('lowConfidence');
  }
  if (sources.some((source) => source.confidence === 'modelled')) flags.add('modelledGeometry');
  return flags;
}

function solvedOptions(input: CasterInput, band: Band | null) {
  return {
    tier: tierOf(input),
    band,
    provenance: provenanceOf(input),
    flags: outputFlags(input),
  };
}

function bandOf(value: number, halfWidth: number): Band {
  return { low: value - halfWidth, high: value + halfWidth };
}

function refused(reason: UndefinedReason, input: CasterInput): SteeringAxisResult {
  const failure = undefinedResult(reason, inputRefs(input));
  return {
    caster_rad: failure,
    kpi_rad: failure,
    scrub_m: failure,
    trail_m: failure,
    working: emptyWorking(),
  };
}

function emptyWorking(): SteeringAxisWorking {
  return {
    deltaXOverDeltaZ: null,
    deltaYOverDeltaZ: null,
    axisGroundX_m: null,
    axisGroundY_m: null,
    contactPatchX_m: null,
    contactPatchY_m: null,
  };
}

function axisOf(input: CasterInput): InternalResult<{
  readonly lower: Vec3;
  readonly upper: Vec3;
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
}> {
  const lower = input.lowerBallJoint_m.value;
  const upper = input.upperBallJoint_m.value;
  const dx = upper.x - lower.x;
  const dy = upper.y - lower.y;
  const dz = upper.z - lower.z;
  if (length3({ x: dx, y: dy, z: dz }) <= K_COINCIDENT_TOL_M) {
    return { ok: false, reason: 'degenerateGeometry', inputs: inputRefs(input) };
  }
  return { ok: true, value: { lower, upper, dx, dy, dz } };
}

/**
 * Module 04 §3.7: the steering axis is the 3-D line Lₒ→Uₒ. Caster and KPI are
 * angles of that line, so they are built from differences and are invariant to
 * a pure vertical translation of the corner (ride height and wheel radius move
 * the hub, not the stored offsets). Scrub and trail evaluate the same line where
 * it meets the ground.
 */
export function solveSteeringAxis(input: CasterInput): SteeringAxisResult {
  if (isRearCorner(input.corner)) return refused('noSteeringAxis', input);

  const axis = axisOf(input);
  if (!axis.ok) return refused(axis.reason, input);

  const { lower, dx, dy, dz } = axis.value;
  const caster = Math.atan2(-dx, dz);
  const kpi = input.side * Math.atan2(-dy, dz);
  if (!Number.isFinite(caster) || !Number.isFinite(kpi)) {
    return refused('outOfDomain', input);
  }

  const wheelCentre = input.wheelCentre_m.value;
  const contactPatchX = wheelCentre.x;
  const contactPatchY = wheelCentre.y;
  const working: { -readonly [K in keyof SteeringAxisWorking]: SteeringAxisWorking[K] } = {
    deltaXOverDeltaZ: Math.abs(dz) <= K_NUMERIC_EPS ? null : dx / dz,
    deltaYOverDeltaZ: Math.abs(dz) <= K_NUMERIC_EPS ? null : dy / dz,
    axisGroundX_m: null,
    axisGroundY_m: null,
    contactPatchX_m: contactPatchX,
    contactPatchY_m: contactPatchY,
  };

  let scrub: Solved<number>;
  let trail: Solved<number>;
  if (Math.abs(dz) <= K_NUMERIC_EPS) {
    const failure = undefinedResult('degenerateGeometry', inputRefs(input));
    scrub = failure;
    trail = failure;
  } else {
    const axisGroundX = lower.x - working.deltaXOverDeltaZ! * lower.z;
    const axisGroundY = lower.y - working.deltaYOverDeltaZ! * lower.z;
    working.axisGroundX_m = axisGroundX;
    working.axisGroundY_m = axisGroundY;
    const trailValue = axisGroundX - contactPatchX;
    const scrubValue = input.side * (contactPatchY - axisGroundY);
    trail = defined(trailValue, solvedOptions(input, bandOf(trailValue, TRAIL_BAND_M)));
    scrub = defined(scrubValue, solvedOptions(input, bandOf(scrubValue, SCRUB_BAND_M)));
  }

  return {
    caster_rad: defined(caster, solvedOptions(input, bandOf(caster, CASTER_BAND_RAD))),
    kpi_rad: defined(kpi, solvedOptions(input, bandOf(kpi, KPI_BAND_RAD))),
    scrub_m: scrub,
    trail_m: trail,
    working,
  };
}

/**
 * The module-04 carrier transform, extended to three dimensions: rotate a point
 * rigidly about the kingpin axis. The toe module applies the same rigid-carrier
 * idea in the front-view plane; this is the steer case the plan solve cannot
 * express.
 */
export function rotateCarrierAboutKingpin(
  point: Vec3,
  lowerBallJoint: Vec3,
  upperBallJoint: Vec3,
  steer_rad: number,
): Vec3 {
  return rotateAboutAxis(
    point,
    lowerBallJoint,
    sub3(upperBallJoint, lowerBallJoint),
    steer_rad,
  );
}

function camberAboutDirection(
  direction: Vec3,
  side: CasterInput['side'],
  steer_rad: number,
): number {
  // A line has no direction. Choose the upward end so a positive steer angle is
  // a left turn on both sides of the car.
  const upward = direction.z < 0 ? scale3(direction, -1) : direction;
  const rotated = rotateAboutAxis(
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: 0 },
    upward,
    steer_rad,
  );
  return side * Math.atan2(rotated.y, rotated.z);
}

/**
 * Camber change attributable to caster, per wheel.
 *
 * The upright is rotated rigidly about the real 3-D kingpin axis, exactly as
 * the module-04 carrier transform rotates it in the front-view plane. The card
 * is a caster card, so the rotation is compared with the same upright whose
 * caster has been zeroed (same y and z, upper ball joint directly above the
 * lower in x): the difference isolates caster and is exactly zero when caster
 * is zero, rather than reporting the separate KPI-only term as a caster effect.
 * This is a full rigid-body rotation difference, not `caster · sin δ`.
 *
 * Positive steer = left turn; at a positive angle the left wheel is inside and
 * the right wheel is outside. Positive camber = top outboard. The value is a
 * change from the static upright, not an absolute camber.
 */
export function solveCamberInSteer(
  input: CasterInput,
  steer_rad: number,
): Solved<number> {
  if (isRearCorner(input.corner)) {
    return undefinedResult('noSteeringAxis', inputRefs(input));
  }
  if (!Number.isFinite(steer_rad)) {
    return undefinedResult('outOfDomain', inputRefs(input));
  }

  const axis = axisOf(input);
  if (!axis.ok) return undefinedResult(axis.reason, axis.inputs);

  const { dx, dy, dz } = axis.value;
  const actual = camberAboutDirection(normalize3({ x: dx, y: dy, z: dz }), input.side, steer_rad);
  const kpiOnly = camberAboutDirection(normalize3({ x: 0, y: dy, z: dz }), input.side, steer_rad);
  const camber = actual - kpiOnly;
  return defined(camber, solvedOptions(input, null));
}

/**
 * The camber-in-steer series at 0/5/10/15/20/25/30° for one front corner. Build
 * it for both front corners to compare the inside and outside wheel: at a
 * positive steer angle the left wheel is inside and the right wheel is outside.
 */
export function buildCamberInSteerSeries(input: CasterInput): CamberInSteerResult {
  if (isRearCorner(input.corner)) {
    return {
      kind: 'unavailable',
      reason: 'noSteeringAxis',
      inputs: inputRefs(input),
      source: 'caster.camberInSteer',
    };
  }

  const axis = axisOf(input);
  if (!axis.ok) {
    return {
      kind: 'unavailable',
      reason: axis.reason,
      inputs: axis.inputs,
      source: 'caster.camberInSteer',
    };
  }

  const samples: CamberInSteerSample[] = [];
  for (const steer_rad of CAMBER_STEER_ANGLES_RAD) {
    const solved = solveCamberInSteer(input, steer_rad);
    if (solved.kind !== 'defined') {
      return {
        kind: 'unavailable',
        reason: solved.kind === 'undefined' ? solved.reason : 'degenerateGeometry',
        inputs: solved.kind === 'undefined' ? [...solved.inputs] : inputRefs(input),
        source: 'caster.camberInSteer',
      };
    }
    samples.push({ steer_rad, camber_rad: solved.value });
  }

  const series: CamberInSteerSeries = {
    kind: 'series',
    corner: input.corner,
    side: input.side,
    samples,
    steerSign: STEER_SIGN,
    camberSign: CAMBER_SIGN,
    source: 'caster.camberInSteer',
  };
  return series;
}
