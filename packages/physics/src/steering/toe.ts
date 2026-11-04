import {
  K_CIRCLE_TOL_M,
  K_COINCIDENT_TOL_M,
  K_NUMERIC_EPS,
} from '../geometry/tolerances.js';
import type { Vec3 } from '../geometry/vec3.js';
import { solveFrontViewAtBump } from '../frontView/kinematics.js';
import type { FrontViewInput, FrontViewState, Sourced } from '../frontView/types.js';
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
  AckermannResult,
  RackSteeringOptions,
  ToeInput,
  ToeSample,
  ToeSeriesResult,
} from './types.js';

export const TOE_SWEEP_MIN_M = -0.005;
export const TOE_SWEEP_MAX_M = 0.005;
export const TOE_SWEEP_SAMPLES = 21;

/** 04 (4.13): the bump-steer slope is a ±0.2 mm central difference. */
const TOE_GAIN_DELTA_M = 0.0002;

/** 04 §4: a static tie rod that misses the measured outer ball by > 0.05 mm. */
const STATIC_TIE_ROD_TOL_M = 0.00005;

const LOW_ANGLE_RAD = (0.5 * Math.PI) / 180;

interface PlanPoint {
  readonly x: number;
  readonly y: number;
}

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

interface ToeFrame {
  readonly view: FrontViewInput;
  readonly staticState: FrontViewState;
  readonly tieIn: Vec3;
  readonly tieOutPlan: PlanPoint;
  readonly tieInPlan: PlanPoint;
  readonly axisGround: PlanPoint;
  readonly rho_m: number;
  readonly tieRodLength_m: number;
  readonly psiStatic_rad: number;
  readonly side: 1 | -1;
  readonly staticToe_rad: number;
}

interface ToeAtBump {
  readonly toe_rad: number;
  readonly tau_rad: number;
}

function sourcesOf(input: ToeInput): readonly Sourced<unknown>[] {
  return [
    input.lcaInA_m,
    input.lcaInB_m,
    input.lcaOut_m,
    input.ucaIn_m,
    input.ucaOut_m,
    input.wheelCentre_m,
    input.tieIn_m,
    input.tieOut_m,
    input.staticToe_rad,
  ];
}

function inputRefs(input: ToeInput): string[] {
  return sourcesOf(input).map((source) => source.ref);
}

function tieRefs(input: ToeInput): string[] {
  return [input.tieIn_m.ref, input.tieOut_m.ref];
}

function isFirmSource(confidence: Confidence): boolean {
  return confidence === 'measured' || confidence === 'manufacturer';
}

function tierOf(input: ToeInput): Tier {
  return sourcesOf(input).every((source) => isFirmSource(source.confidence))
    ? 'firm'
    : 'inferred';
}

function provenanceOf(input: ToeInput): Set<string> {
  const provenance = new Set(inputRefs(input));
  for (const source of sourcesOf(input)) {
    if (source.sourceId !== undefined) provenance.add(source.sourceId);
  }
  return provenance;
}

function outputFlags(input: ToeInput): Set<Flag> {
  const flags = new Set<Flag>();
  const sources = sourcesOf(input);
  if (sources.some((source) => source.confidence === 'assumed')) flags.add('assumedInput');
  if (sources.some((source) => source.confidence === 'estimated' || source.confidence === 'library')) {
    flags.add('lowConfidence');
  }
  if (sources.some((source) => source.confidence === 'derived')) flags.add('derivedGeometry');
  if (sources.some((source) => source.confidence === 'modelled')) flags.add('modelledGeometry');
  return flags;
}

function asVec2(source: Sourced<Vec3>): Sourced<{ y: number; z: number }> {
  return {
    value: { y: source.value.y, z: source.value.z },
    ref: source.ref,
    confidence: source.confidence,
    ...(source.sourceId === undefined ? {} : { sourceId: source.sourceId }),
  };
}

function viewInput(input: ToeInput): FrontViewInput {
  return {
    corner: input.corner,
    side: input.side,
    lowerArmType: input.lowerArmType,
    upperArmType: input.upperArmType,
    lcaIn_m: asVec2(input.lcaInA_m),
    lcaOut_m: asVec2(input.lcaOut_m),
    ucaIn_m: asVec2(input.ucaIn_m),
    ucaOut_m: asVec2(input.ucaOut_m),
    wheelCentre_m: asVec2(input.wheelCentre_m),
    bumpLimit_m: input.bumpLimit_m,
    droopLimit_m: input.droopLimit_m,
  };
}

function plan(x: number, y: number): PlanPoint {
  return { x, y };
}

function planDistance(a: PlanPoint, b: PlanPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function planAngle(point: PlanPoint, origin: PlanPoint): number {
  return Math.atan2(point.y - origin.y, point.x - origin.x);
}

function rotatePlan(point: PlanPoint, origin: PlanPoint, angle: number): PlanPoint {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/** Normalise to (−180°, 180°]; 04 §3.2. */
function wrapAngle(angle: number): number {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= 2 * Math.PI;
  while (wrapped <= -Math.PI) wrapped += 2 * Math.PI;
  return wrapped;
}

/**
 * The steering axis in plan, evaluated at a height. 02 (2.17)–(2.18) is the
 * z = 0 case. The front uses the ground point as 04 §6 pins it; the rear toe
 * link is evaluated at its upper ball joint, where the modelled ties give a
 * conditioned plan circle (see `buildFrame`).
 */
function steeringAxisPointAtHeight(
  lower: Vec3,
  upper: Vec3,
  height_m: number,
): InternalResult<PlanPoint> {
  const dz = upper.z - lower.z;
  if (Math.abs(dz) <= K_NUMERIC_EPS) {
    return { ok: false, reason: 'degenerateGeometry', inputs: ['lca_out', 'uca_out'] };
  }
  const y = lower.y + ((upper.y - lower.y) / dz) * (height_m - lower.z);
  const x = lower.x + ((upper.x - lower.x) / dz) * (height_m - lower.z);
  return { ok: true, value: plan(x, y) };
}

function normalise2(y: number, z: number): { readonly y: number; readonly z: number } {
  const magnitude = Math.hypot(y, z);
  return magnitude === 0 ? { y: 0, z: 0 } : { y: y / magnitude, z: z / magnitude };
}

/**
 * 02 §3.2.3: a carrier-fixed point at a bumped state. The tie-rod outer ball
 * rotates with the carrier axis `Lₒ → Uₒ`, not with the crank angle.
 */
function carrierPointZ(
  point0: Vec3,
  staticState: FrontViewState,
  stateAtBump: FrontViewState,
): number {
  const staticAxis = normalise2(
    staticState.upperOuter_m.y - staticState.lowerOuter_m.y,
    staticState.upperOuter_m.z - staticState.lowerOuter_m.z,
  );
  const bumpedAxis = normalise2(
    stateAtBump.upperOuter_m.y - stateAtBump.lowerOuter_m.y,
    stateAtBump.upperOuter_m.z - stateAtBump.lowerOuter_m.z,
  );
  const delta =
    Math.atan2(bumpedAxis.z, bumpedAxis.y) - Math.atan2(staticAxis.z, staticAxis.y);
  const dy = point0.y - staticState.lowerOuter_m.y;
  const dz = point0.z - staticState.lowerOuter_m.z;
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);
  return stateAtBump.lowerOuter_m.z + dy * sin + dz * cos;
}

function tieRodLength(input: ToeInput, tieIn: Vec3, tieOut: Vec3): number {
  return input.tieRodLength_m === undefined
    ? Math.hypot(tieOut.x - tieIn.x, tieOut.y - tieIn.y, tieOut.z - tieIn.z)
    : input.tieRodLength_m.value;
}

function buildFrame(input: ToeInput): InternalResult<ToeFrame> {
  const view = viewInput(input);
  const staticSolved = solveFrontViewAtBump(view, 0);
  if (staticSolved.kind !== 'defined') {
    return {
      ok: false,
      reason: staticSolved.kind === 'undefined' ? staticSolved.reason : 'incompleteModel',
      inputs: staticSolved.kind === 'undefined' ? [...staticSolved.inputs] : inputRefs(input),
    };
  }

  const tieIn = input.tieIn_m.value;
  const tieOut = input.tieOut_m.value;
  const isRear = input.corner === 'LR' || input.corner === 'RR';
  // Front: the ground point, as 04 §6 pins it. Rear: the modelled toe link
  // sits within 1.5 mm of the axis in plan, so the ground-point circle is
  // tangent over the travel; evaluating the same axis at the upper ball joint
  // keeps the same construction conditioned.
  const axisGround = steeringAxisPointAtHeight(
    input.lcaOut_m.value,
    input.ucaOut_m.value,
    isRear ? input.ucaOut_m.value.z : 0,
  );
  if (!axisGround.ok) return axisGround;

  const tieOutPlan = plan(tieOut.x, tieOut.y);
  const tieInPlan = plan(tieIn.x, tieIn.y);
  const rho_m = planDistance(tieOutPlan, axisGround.value);
  if (rho_m < 0.001) {
    return { ok: false, reason: 'degenerateGeometry', inputs: tieRefs(input) };
  }

  const length_m = tieRodLength(input, tieIn, tieOut);
  if (!(length_m > 0)) {
    return { ok: false, reason: 'coincidentPoints', inputs: tieRefs(input) };
  }

  const zTieOut0_m = carrierPointZ(tieOut, staticSolved.value, staticSolved.value);
  const vertical_m = zTieOut0_m - tieIn.z;
  const rp0Squared_m2 = length_m * length_m - vertical_m * vertical_m;
  if (!(rp0Squared_m2 > 0)) {
    return { ok: false, reason: 'outOfDomain', inputs: tieRefs(input) };
  }

  const rp0_m = Math.sqrt(rp0Squared_m2);
  const measuredPlan_m = planDistance(tieOutPlan, tieInPlan);
  if (Math.abs(rp0_m - measuredPlan_m) > STATIC_TIE_ROD_TOL_M) {
    return { ok: false, reason: 'incompleteModel', inputs: tieRefs(input) };
  }

  return {
    ok: true,
    value: {
      view,
      staticState: staticSolved.value,
      tieIn,
      tieOutPlan,
      tieInPlan,
      axisGround: axisGround.value,
      rho_m,
      tieRodLength_m: length_m,
      psiStatic_rad: planAngle(tieOutPlan, axisGround.value),
      side: input.side,
      staticToe_rad: input.staticToe_rad.value,
    },
  };
}

/**
 * 04 (4.5)–(4.7): intersect the circle about the inner ball (tie-rod plan
 * length) with the circle about the steering axis (fixed knuckle radius).
 * The branch nearest the static outer ball is kept.
 */
function intersectPlan(
  axis: PlanPoint,
  inner: PlanPoint,
  rp_m: number,
  rho_m: number,
  staticOuter: PlanPoint,
): InternalResult<PlanPoint> {
  const dx = axis.x - inner.x;
  const dy = axis.y - inner.y;
  const d_m = Math.hypot(dx, dy);
  if (d_m <= K_COINCIDENT_TOL_M) {
    return { ok: false, reason: 'degenerateGeometry', inputs: ['tie_in'] };
  }

  const aa = (rp_m * rp_m - rho_m * rho_m + d_m * d_m) / (2 * d_m);
  const halfChordSquared = rp_m * rp_m - aa * aa;
  if (halfChordSquared < 0) {
    return { ok: false, reason: 'noIntersection', inputs: ['tie_in', 'tie_out'] };
  }

  const halfChord = Math.sqrt(Math.max(0, halfChordSquared));
  const ex = dx / d_m;
  const ey = dy / d_m;
  const px = -ey;
  const py = ex;
  const baseX = inner.x + aa * ex;
  const baseY = inner.y + aa * ey;
  const candidates = [
    plan(baseX + halfChord * px, baseY + halfChord * py),
    plan(baseX - halfChord * px, baseY - halfChord * py),
  ];
  const distances = candidates.map((candidate) => planDistance(candidate, staticOuter));
  const difference = Math.abs(distances[0]! - distances[1]!);
  if (difference <= K_CIRCLE_TOL_M) {
    return { ok: false, reason: 'ambiguousBranch', inputs: ['tie_in', 'tie_out'] };
  }
  return {
    ok: true,
    value: distances[0]! < distances[1]! ? candidates[0]! : candidates[1]!,
  };
}

function toeAtTieOutHeight(
  input: ToeInput,
  frame: ToeFrame,
  zTieOut_m: number,
): InternalResult<ToeAtBump> {
  const vertical_m = zTieOut_m - frame.tieIn.z;
  const rpSquared_m2 =
    frame.tieRodLength_m * frame.tieRodLength_m - vertical_m * vertical_m;
  if (!(rpSquared_m2 > 0)) {
    return { ok: false, reason: 'outOfDomain', inputs: tieRefs(input) };
  }

  const intersection = intersectPlan(
    frame.axisGround,
    frame.tieInPlan,
    Math.sqrt(rpSquared_m2),
    frame.rho_m,
    frame.tieOutPlan,
  );
  if (!intersection.ok) return intersection;

  const psi = planAngle(intersection.value, frame.axisGround);
  const tau = -frame.side * wrapAngle(psi - frame.psiStatic_rad);
  return {
    ok: true,
    value: { toe_rad: frame.staticToe_rad + tau, tau_rad: tau },
  };
}

function toeAtBump(input: ToeInput, frame: ToeFrame, bump_m: number): InternalResult<ToeAtBump> {
  const state = solveFrontViewAtBump(frame.view, bump_m);
  if (state.kind !== 'defined') {
    return {
      ok: false,
      reason: state.kind === 'undefined' ? state.reason : 'outOfTravel',
      inputs: state.kind === 'undefined' ? [...state.inputs] : inputRefs(input),
    };
  }

  const zTieOut_m = carrierPointZ(input.tieOut_m.value, frame.staticState, state.value);
  return toeAtTieOutHeight(input, frame, zTieOut_m);
}

/**
 * The plan-view construction at a prescribed outer-ball height. 04 §6.4's
 * sensitivity table and G04.10 use it to separate the carrier transform from
 * the plan solve.
 */
export function solveToeAtTieOutHeight(
  input: ToeInput,
  zTieOut_m: number,
): Solved<number> {
  const frame = buildFrame(input);
  if (!frame.ok) return undefinedResult(frame.reason, frame.inputs);
  const solved = toeAtTieOutHeight(input, frame.value, zTieOut_m);
  if (!solved.ok) return undefinedResult(solved.reason, solved.inputs);
  return defined(solved.value.toe_rad, solvedOptions(input));
}

function solvedOptions(input: ToeInput, band: Band | null = null) {
  return {
    tier: tierOf(input),
    band,
    provenance: provenanceOf(input),
    flags: outputFlags(input),
  };
}

/**
 * 04 §3.2–3.6: steer one front corner from rack travel. Returns the geometric
 * steer angle δ in radians, global frame, positive = the car turns left.
 * Static toe is a setup offset and is not added here.
 */
export function solveSteerAngle(
  input: ToeInput,
  rackTravel_m: number,
  options: RackSteeringOptions = {},
): Solved<number> {
  const frame = buildFrame(input);
  if (!frame.ok) return undefinedResult(frame.reason, frame.inputs);
  const geometry = frame.value;

  const limit = options.rackLimit_m;
  if (limit !== undefined && Math.abs(rackTravel_m) > limit) {
    return undefinedResult('outOfRackTravel', [
      'axles.front.steering.rack.travel_limit',
    ]);
  }

  const alpha = (options.steeringArmOffset_rad ?? 0) * geometry.side;
  const rotatedOuter = rotatePlan(geometry.tieOutPlan, geometry.axisGround, alpha);
  const rp_m = planDistance(rotatedOuter, geometry.tieInPlan);
  if (!(rp_m > 0)) {
    return undefinedResult('outOfDomain', tieRefs(input));
  }

  const inner = plan(geometry.tieInPlan.x, geometry.tieInPlan.y + rackTravel_m);
  const intersection = intersectPlan(
    geometry.axisGround,
    inner,
    rp_m,
    geometry.rho_m,
    rotatedOuter,
  );
  if (!intersection.ok) return undefinedResult(intersection.reason, intersection.inputs);

  const delta = wrapAngle(
    planAngle(intersection.value, geometry.axisGround) -
      planAngle(rotatedOuter, geometry.axisGround),
  );
  return defined(delta, solvedOptions(input));
}

/**
 * 04 (4.9): Ackermann percentage from the two steer angles. `t` is the
 * contact-patch track, not the steering-axis spacing (04 §3.3).
 */
export function solveAckermann(
  left_rad: number,
  right_rad: number,
  track_m: number,
  wheelbase_m: number,
): AckermannResult {
  const left = Math.abs(left_rad);
  const right = Math.abs(right_rad);
  const inner = Math.max(left, right);
  const outer = Math.min(left, right);

  if (inner < LOW_ANGLE_RAD) {
    return {
      kind: 'suppressed',
      percent: null,
      inner_rad: inner,
      outer_rad: outer,
      flags: new Set<Flag>(['lowAngle']),
    };
  }
  if (!(track_m > 0) || !(wheelbase_m > 0)) {
    return {
      kind: 'suppressed',
      percent: null,
      inner_rad: inner,
      outer_rad: outer,
      flags: new Set<Flag>(),
    };
  }

  const cotInner = 1 / Math.tan(inner);
  const cotOuter = 1 / Math.tan(outer);
  return {
    kind: 'reported',
    percent: (100 * (cotOuter - cotInner)) / (track_m / wheelbase_m),
    inner_rad: inner,
    outer_rad: outer,
    flags: new Set<Flag>(),
  };
}

/**
 * Sample absolute toe against wheel travel. Positive toe = toe-in, matching
 * D-17; the stored static toe is the value at zero travel for a consistent
 * model.
 */
export function buildToeSeries(input: ToeInput): ToeSeriesResult {
  const frame = buildFrame(input);
  if (!frame.ok) {
    return {
      kind: 'unavailable',
      reason: frame.reason,
      inputs: frame.inputs,
      source: 'steering.toe',
    };
  }
  const statics = frame.value;

  const samples: ToeSample[] = [];
  let failure: InternalFailure | null = null;
  for (let index = 0; index < TOE_SWEEP_SAMPLES; index += 1) {
    const ratio = index / (TOE_SWEEP_SAMPLES - 1);
    const bump_m =
      TOE_SWEEP_MIN_M + (TOE_SWEEP_MAX_M - TOE_SWEEP_MIN_M) * ratio;
    const solved = toeAtBump(input, statics, bump_m);
    if (!solved.ok) {
      failure = solved;
      break;
    }
    samples.push({ bump_m, toe_rad: solved.value.toe_rad });
  }

  const high = toeAtBump(input, statics, TOE_GAIN_DELTA_M);
  const low = toeAtBump(input, statics, -TOE_GAIN_DELTA_M);
  const top = toeAtBump(input, statics, TOE_SWEEP_MAX_M);
  const bottom = toeAtBump(input, statics, TOE_SWEEP_MIN_M);
  const staticSolved = toeAtBump(input, statics, 0);
  if (
    failure !== null ||
    !high.ok ||
    !low.ok ||
    !top.ok ||
    !bottom.ok ||
    !staticSolved.ok
  ) {
    const candidates: readonly (InternalFailure | null)[] = [
      failure,
      high.ok ? null : high,
      low.ok ? null : low,
      top.ok ? null : top,
      bottom.ok ? null : bottom,
      staticSolved.ok ? null : staticSolved,
    ];
    const failed = candidates.find((candidate): candidate is InternalFailure => candidate !== null);
    return {
      kind: 'unavailable',
      reason: failed?.reason ?? 'noBumpSteerSolution',
      inputs: failed?.inputs ?? inputRefs(input),
      source: 'steering.toe',
    };
  }

  const gain_radPerM = (high.value.toe_rad - low.value.toe_rad) / (2 * TOE_GAIN_DELTA_M);
  const totalAcrossRange_rad = top.value.toe_rad - bottom.value.toe_rad;
  const direction =
    Math.abs(totalAcrossRange_rad) < 1e-12
      ? 'neutral'
      : totalAcrossRange_rad > 0
        ? 'toe-in'
        : 'toe-out';

  const staticSample = {
    bump_m: 0,
    toe_rad: staticSolved.value.toe_rad,
  };

  return {
    kind: 'series',
    samples,
    staticSample,
    bumpRange_m: { min: TOE_SWEEP_MIN_M, max: TOE_SWEEP_MAX_M },
    gain_radPerM: defined(gain_radPerM, solvedOptions(input)),
    totalAcrossRange_rad: defined(totalAcrossRange_rad, solvedOptions(input)),
    direction,
    source: 'steering.toe',
  };
}

/** The scalar outputs, for callers that do not need the curve. */
export function solveToe(input: ToeInput): {
  readonly gain_radPerM: Solved<number>;
  readonly totalAcrossRange_rad: Solved<number>;
  readonly direction: 'toe-in' | 'toe-out' | 'neutral';
} {
  const series = buildToeSeries(input);
  if (series.kind === 'unavailable') {
    const failure = undefinedResult(series.reason, inputRefs(input));
    return {
      gain_radPerM: failure,
      totalAcrossRange_rad: failure,
      direction: 'neutral',
    };
  }
  return {
    gain_radPerM: series.gain_radPerM,
    totalAcrossRange_rad: series.totalAcrossRange_rad,
    direction: series.direction,
  };
}
