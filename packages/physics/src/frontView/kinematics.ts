import {
  K_BRANCH_RESIDUAL_M,
  K_COINCIDENT_TOL_M,
  K_NUMERIC_EPS,
  K_PARALLEL_TOL,
  K_VERTICAL_PARALLEL_TOL,
} from '../geometry/tolerances.js';
import {
  add,
  distance,
  dot,
  length,
  normalize,
  perpendicular,
  scale,
  sub,
  type Vec2,
} from '../geometry/vec2.js';
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
  FrontViewInput,
  FrontViewResult,
  FrontViewState,
  FrontViewWorking,
  Sourced,
} from './types.js';

const CAMBER_DELTA_M = 0.0005;
const RC_HEIGHT_BAND_M = 0.001;
const SCAN_HALF_WIDTH_RAD = 0.6;
const SCAN_STEPS = 64;
const BISECTION_STEPS = 40;

interface StaticGeometry {
  readonly a_m: number;
  readonly b_m: number;
  readonly d_m: number;
  readonly theta0_rad: number;
  readonly branch: 1 | -1;
  readonly lowerInner_m: Vec2;
  readonly upperInner_m: Vec2;
  readonly lowerOuter_m: Vec2;
  readonly upperOuter_m: Vec2;
  readonly wheelCentre_m: Vec2;
  readonly carrierU_m: number;
  readonly carrierV_m: number;
}

interface InternalState {
  readonly theta_rad: number;
  readonly lowerOuter_m: Vec2;
  readonly upperOuter_m: Vec2;
  readonly wheelCentre_m: Vec2;
  readonly kingpinAngle_rad: number;
  readonly kingpinAngleGlobal_rad: number;
}

type InternalFailure = {
  readonly ok: false;
  readonly reason: UndefinedReason;
  readonly inputs: readonly string[];
};

type InternalSuccess<T> = { readonly ok: true; readonly value: T };

type InternalResult<T> = InternalSuccess<T> | InternalFailure;

function inputRefs(input: FrontViewInput): string[] {
  return [
    input.lcaIn_m.ref,
    input.lcaOut_m.ref,
    input.ucaIn_m.ref,
    input.ucaOut_m.ref,
    input.wheelCentre_m.ref,
  ];
}

function isFirmSource(confidence: Confidence): boolean {
  return confidence === 'measured' || confidence === 'manufacturer' || confidence === 'derived';
}

function tierOf(input: FrontViewInput): Tier {
  const sources: readonly Sourced<unknown>[] = [
    input.lcaIn_m,
    input.lcaOut_m,
    input.ucaIn_m,
    input.ucaOut_m,
    input.wheelCentre_m,
  ];
  return sources.every((source) => isFirmSource(source.confidence)) ? 'firm' : 'inferred';
}

function provenanceOf(input: FrontViewInput): Set<string> {
  return new Set(inputRefs(input));
}

function outputFlags(input: FrontViewInput): Set<Flag> {
  const flags = new Set<Flag>();
  const sources: readonly Sourced<unknown>[] = [
    input.lcaIn_m,
    input.lcaOut_m,
    input.ucaIn_m,
    input.ucaOut_m,
    input.wheelCentre_m,
  ];
  if (sources.some((source) => source.confidence === 'assumed')) flags.add('assumedInput');
  if (sources.some((source) => source.confidence === 'estimated' || source.confidence === 'library')) {
    flags.add('lowConfidence');
  }
  return flags;
}

function circleUpperOuter(
  lowerOuter: Vec2,
  upperInner: Vec2,
  b_m: number,
  d_m: number,
  branch: 1 | -1,
): { readonly point: Vec2 | null; readonly halfChordSquared: number } {
  const delta = sub(lowerOuter, upperInner);
  const chordDistance = length(delta);
  if (chordDistance <= K_COINCIDENT_TOL_M) {
    return { point: null, halfChordSquared: -1 };
  }
  const along = (b_m * b_m - d_m * d_m + chordDistance * chordDistance) / (2 * chordDistance);
  const halfChordSquared = b_m * b_m - along * along;
  if (halfChordSquared < 0) return { point: null, halfChordSquared };
  const halfChord = Math.sqrt(halfChordSquared);
  const direction = scale(delta, 1 / chordDistance);
  const normal = perpendicular(direction);
  return {
    point: add(upperInner, add(scale(direction, along), scale(normal, branch * halfChord))),
    halfChordSquared,
  };
}

function computeStatic(input: FrontViewInput): InternalResult<StaticGeometry> {
  const lowerInner = input.lcaIn_m.value;
  const lowerOuter = input.lcaOut_m.value;
  const upperInner = input.ucaIn_m.value;
  const upperOuter = input.ucaOut_m.value;
  const wheelCentre = input.wheelCentre_m.value;

  const a_m = distance(lowerOuter, lowerInner);
  const b_m = distance(upperOuter, upperInner);
  const d_m = distance(upperOuter, lowerOuter);
  if (a_m <= K_COINCIDENT_TOL_M || b_m <= K_COINCIDENT_TOL_M || d_m <= K_COINCIDENT_TOL_M) {
    return { ok: false, reason: 'degenerateGeometry', inputs: inputRefs(input) };
  }

  const theta0_rad = Math.atan2(lowerOuter.z - lowerInner.z, lowerOuter.y - lowerInner.y);
  const plus = circleUpperOuter(lowerOuter, upperInner, b_m, d_m, 1);
  const minus = circleUpperOuter(lowerOuter, upperInner, b_m, d_m, -1);
  if (plus.point === null && minus.point === null) {
    return { ok: false, reason: 'noIntersection', inputs: inputRefs(input) };
  }

  const plusResidual = plus.point === null ? Number.POSITIVE_INFINITY : distance(plus.point, upperOuter);
  const minusResidual =
    minus.point === null ? Number.POSITIVE_INFINITY : distance(minus.point, upperOuter);
  const branch: 1 | -1 = plusResidual <= minusResidual ? 1 : -1;
  if (Math.min(plusResidual, minusResidual) > K_BRANCH_RESIDUAL_M) {
    return { ok: false, reason: 'incompleteModel', inputs: ['lca_out', 'uca_out'] };
  }

  const selected = branch === 1 ? plus.point : minus.point;
  if (selected === null) {
    return { ok: false, reason: 'noIntersection', inputs: inputRefs(input) };
  }

  const e1 = scale(sub(selected, lowerOuter), 1 / d_m);
  const e2 = perpendicular(e1);
  const toWheelCentre = sub(wheelCentre, lowerOuter);

  return {
    ok: true,
    value: {
      a_m,
      b_m,
      d_m,
      theta0_rad,
      branch,
      lowerInner_m: lowerInner,
      upperInner_m: upperInner,
      lowerOuter_m: lowerOuter,
      upperOuter_m: selected,
      wheelCentre_m: wheelCentre,
      carrierU_m: dot(toWheelCentre, e1),
      carrierV_m: dot(toWheelCentre, e2),
    },
  };
}

function stateAtTheta(
  input: FrontViewInput,
  geometry: StaticGeometry,
  theta_rad: number,
): InternalResult<InternalState> {
  const crank = { y: Math.cos(theta_rad), z: Math.sin(theta_rad) };
  const lowerOuter = add(geometry.lowerInner_m, scale(crank, geometry.a_m));
  const upper = circleUpperOuter(
    lowerOuter,
    geometry.upperInner_m,
    geometry.b_m,
    geometry.d_m,
    geometry.branch,
  );
  if (upper.point === null) {
    return { ok: false, reason: 'outOfTravel', inputs: inputRefs(input) };
  }

  const e1 = scale(sub(upper.point, lowerOuter), 1 / geometry.d_m);
  const e2 = perpendicular(e1);
  const wheelCentre = add(
    lowerOuter,
    add(scale(e1, geometry.carrierU_m), scale(e2, geometry.carrierV_m)),
  );
  const kingpinGlobal = Math.atan2(upper.point.y - lowerOuter.y, upper.point.z - lowerOuter.z);

  return {
    ok: true,
    value: {
      theta_rad,
      lowerOuter_m: lowerOuter,
      upperOuter_m: upper.point,
      wheelCentre_m: wheelCentre,
      kingpinAngle_rad: input.side * kingpinGlobal,
      kingpinAngleGlobal_rad: kingpinGlobal,
    },
  };
}

function staticState(input: FrontViewInput, geometry: StaticGeometry): InternalResult<InternalState> {
  return stateAtTheta(input, geometry, geometry.theta0_rad);
}

function solveAtBump(
  input: FrontViewInput,
  geometry: StaticGeometry,
  bump_m: number,
): InternalResult<InternalState> {
  if (bump_m > input.bumpLimit_m || bump_m < -input.droopLimit_m) {
    return { ok: false, reason: 'outOfTravel', inputs: inputRefs(input) };
  }

  const targetZ_m = geometry.wheelCentre_m.z + bump_m;
  const start = geometry.theta0_rad - SCAN_HALF_WIDTH_RAD;
  const end = geometry.theta0_rad + SCAN_HALF_WIDTH_RAD;
  const step = (end - start) / SCAN_STEPS;

  let previousTheta: number | null = null;
  let previousValue = 0;
  const brackets: Array<{ readonly lowTheta: number; readonly highTheta: number }> = [];

  for (let index = 0; index <= SCAN_STEPS; index += 1) {
    const theta = start + step * index;
    const state = stateAtTheta(input, geometry, theta);
    if (!state.ok) {
      previousTheta = null;
      previousValue = 0;
      continue;
    }
    const value = state.value.wheelCentre_m.z - targetZ_m;

    if (Math.abs(value) <= K_NUMERIC_EPS) {
      return state;
    }
    if (previousTheta !== null && previousValue * value < 0) {
      brackets.push({ lowTheta: previousTheta, highTheta: theta });
    }
    previousTheta = theta;
    previousValue = value;
  }

  if (brackets.length === 0) {
    return { ok: false, reason: 'outOfTravel', inputs: inputRefs(input) };
  }
  if (brackets.length > 1) {
    return { ok: false, reason: 'ambiguousBranch', inputs: inputRefs(input) };
  }

  const bracket = brackets[0];
  if (bracket === undefined) {
    return { ok: false, reason: 'outOfTravel', inputs: inputRefs(input) };
  }

  let lowTheta = bracket.lowTheta;
  let highTheta = bracket.highTheta;
  const lowState = stateAtTheta(input, geometry, lowTheta);
  if (!lowState.ok) return lowState;
  const lowValue = lowState.value.wheelCentre_m.z - targetZ_m;

  let solution = lowState.value;
  for (let index = 0; index < BISECTION_STEPS; index += 1) {
    const midTheta = (lowTheta + highTheta) / 2;
    const midState = stateAtTheta(input, geometry, midTheta);
    if (!midState.ok) return midState;
    const midValue = midState.value.wheelCentre_m.z - targetZ_m;
    solution = midState.value;
    if (lowValue * midValue <= 0) {
      highTheta = midTheta;
    } else {
      lowTheta = midTheta;
    }
  }

  return { ok: true, value: solution };
}

function wrapState(input: FrontViewInput, state: InternalState, bump_m: number): Solved<FrontViewState> {
  return defined(
    {
      bump_m,
      crankAngle_rad: state.theta_rad,
      lowerOuter_m: state.lowerOuter_m,
      upperOuter_m: state.upperOuter_m,
      wheelCentre_m: state.wheelCentre_m,
      kingpinAngle_rad: state.kingpinAngle_rad,
      kingpinAngleGlobal_rad: state.kingpinAngleGlobal_rad,
    },
    {
      tier: tierOf(input),
      provenance: provenanceOf(input),
      flags: outputFlags(input),
    },
  );
}

function instantCentreFor(
  input: FrontViewInput,
  state: InternalState,
): InternalResult<Vec2> {
  const lowerInner = input.lcaIn_m.value;
  const upperInner = input.ucaIn_m.value;
  const d1 = sub(state.lowerOuter_m, lowerInner);
  const d2 = sub(state.upperOuter_m, upperInner);
  const denominator = d1.y * d2.z - d1.z * d2.y;
  const scaleProduct = length(d1) * length(d2);
  if (scaleProduct <= K_NUMERIC_EPS || Math.abs(denominator) < K_PARALLEL_TOL * scaleProduct) {
    return { ok: false, reason: 'parallelLinks', inputs: inputRefs(input) };
  }

  const p2MinusP1 = sub(upperInner, lowerInner);
  const t = (p2MinusP1.y * d2.z - p2MinusP1.z * d2.y) / denominator;
  return { ok: true, value: add(lowerInner, scale(d1, t)) };
}

function rollCentreFromInstantCentre(
  input: FrontViewInput,
  instantCentre: Vec2,
): { readonly y_m: number; readonly z_m: number } | null {
  const contactPatchY_m = input.side * Math.abs(input.wheelCentre_m.value.y);
  const denominator = instantCentre.y - contactPatchY_m;
  if (Math.abs(denominator) <= K_NUMERIC_EPS) return null;
  const z_m = instantCentre.z * (0 - contactPatchY_m) / denominator;
  return { y_m: 0, z_m };
}

function rollCentreFromParallelLimit(
  input: FrontViewInput,
): { readonly y_m: number; readonly z_m: number } | InternalFailure {
  const d1 = sub(input.lcaOut_m.value, input.lcaIn_m.value);
  const direction = normalize(d1);
  if (Math.abs(direction.y) <= K_VERTICAL_PARALLEL_TOL) {
    return { ok: false, reason: 'degenerateGeometry', inputs: inputRefs(input) };
  }
  const contactPatchY_m = input.side * Math.abs(input.wheelCentre_m.value.y);
  const z_m = 0 - (direction.z * contactPatchY_m) / direction.y;
  return { y_m: 0, z_m };
}

function camberGain(
  input: FrontViewInput,
  geometry: StaticGeometry,
): {
  readonly perWheel: Solved<number>;
  readonly global: Solved<number>;
} {
  const high = solveAtBump(input, geometry, CAMBER_DELTA_M);
  const low = solveAtBump(input, geometry, -CAMBER_DELTA_M);
  if (!high.ok) {
    return {
      perWheel: undefinedResult(high.reason, high.inputs),
      global: undefinedResult(high.reason, high.inputs),
    };
  }
  if (!low.ok) {
    return {
      perWheel: undefinedResult(low.reason, low.inputs),
      global: undefinedResult(low.reason, low.inputs),
    };
  }

  const divisor = 2 * CAMBER_DELTA_M;
  const perWheelValue =
    (high.value.kingpinAngle_rad - low.value.kingpinAngle_rad) / divisor;
  const globalValue =
    (high.value.kingpinAngleGlobal_rad - low.value.kingpinAngleGlobal_rad) / divisor;

  return {
    perWheel: defined(perWheelValue, {
      tier: tierOf(input),
      provenance: provenanceOf(input),
      flags: outputFlags(input),
    }),
    global: defined(globalValue, {
      tier: tierOf(input),
      provenance: provenanceOf(input),
      flags: outputFlags(input),
    }),
  };
}

function workingFrom(
  input: FrontViewInput,
  state: InternalState,
  instantCentre: InternalResult<Vec2>,
): FrontViewWorking {
  const lowerDelta = sub(state.lowerOuter_m, input.lcaIn_m.value);
  const upperDelta = sub(state.upperOuter_m, input.ucaIn_m.value);
  const contactPatchY_m = input.side * Math.abs(input.wheelCentre_m.value.y);
  const lowerSlope =
    Math.abs(lowerDelta.y) <= K_NUMERIC_EPS ? null : lowerDelta.z / lowerDelta.y;
  const upperSlope =
    Math.abs(upperDelta.y) <= K_NUMERIC_EPS ? null : upperDelta.z / upperDelta.y;
  const ic = instantCentre.ok ? instantCentre.value : null;
  const rollCentreSlope =
    ic === null || Math.abs(ic.y - contactPatchY_m) <= K_NUMERIC_EPS
      ? null
      : ic.z / (ic.y - contactPatchY_m);

  return {
    lowerSlope,
    upperSlope,
    contactPatchY_m,
    contactPatchZ_m: 0,
    instantCentreY_m: ic?.y ?? null,
    instantCentreZ_m: ic?.z ?? null,
    rollCentreSlope,
  };
}

export function solveFrontViewAtBump(
  input: FrontViewInput,
  bump_m: number,
): Solved<FrontViewState> {
  const geometry = computeStatic(input);
  if (!geometry.ok) return undefinedResult(geometry.reason, geometry.inputs);
  const state = solveAtBump(input, geometry.value, bump_m);
  if (!state.ok) return undefinedResult(state.reason, state.inputs);
  return wrapState(input, state.value, bump_m);
}

export function solveFrontView(input: FrontViewInput): FrontViewResult {
  const geometry = computeStatic(input);
  if (!geometry.ok) {
    const failure = undefinedResult(geometry.reason, geometry.inputs);
    return {
      instantCentre: failure,
      rollCentreHeight: failure,
      rollCentreLateral: failure,
      camberGain: failure,
      camberGainGlobal: failure,
      staticState: failure,
      working: {
        lowerSlope: null,
        upperSlope: null,
        contactPatchY_m: input.side * Math.abs(input.wheelCentre_m.value.y),
        contactPatchZ_m: 0,
        instantCentreY_m: null,
        instantCentreZ_m: null,
        rollCentreSlope: null,
      },
    };
  }

  const staticResult = staticState(input, geometry.value);
  if (!staticResult.ok) {
    const failure = undefinedResult(staticResult.reason, staticResult.inputs);
    return {
      instantCentre: failure,
      rollCentreHeight: failure,
      rollCentreLateral: failure,
      camberGain: failure,
      camberGainGlobal: failure,
      staticState: failure,
      working: {
        lowerSlope: null,
        upperSlope: null,
        contactPatchY_m: input.side * Math.abs(input.wheelCentre_m.value.y),
        contactPatchZ_m: 0,
        instantCentreY_m: null,
        instantCentreZ_m: null,
        rollCentreSlope: null,
      },
    };
  }

  const state = staticResult.value;
  const instantCentre = instantCentreFor(input, state);
  const flags = outputFlags(input);
  const tier = tierOf(input);
  const provenance = provenanceOf(input);

  let instantCentreSolved: Solved<Vec2>;
  let rollCentre:
    | { readonly y_m: number; readonly z_m: number }
    | InternalFailure
    | null = null;
  let rollCentreFlags = new Set<Flag>(flags);

  if (instantCentre.ok) {
    instantCentreSolved = defined(instantCentre.value, { tier, provenance, flags });
    rollCentre = rollCentreFromInstantCentre(input, instantCentre.value);
  } else {
    instantCentreSolved = undefinedResult(instantCentre.reason, instantCentre.inputs);
    rollCentreFlags = new Set<Flag>([...flags, 'parallelLinks']);
    rollCentre = rollCentreFromParallelLimit(input);
  }

  let rollCentreHeight: Solved<number>;
  let rollCentreLateral: Solved<number>;

  if (rollCentre !== null && 'ok' in rollCentre) {
    const failure = undefinedResult(rollCentre.reason, rollCentre.inputs);
    rollCentreHeight = failure;
    rollCentreLateral = failure;
  } else if (rollCentre === null) {
    const failure = undefinedResult('degenerateGeometry', inputRefs(input));
    rollCentreHeight = failure;
    rollCentreLateral = failure;
  } else {
    const band: Band = {
      low: rollCentre.z_m - RC_HEIGHT_BAND_M,
      high: rollCentre.z_m + RC_HEIGHT_BAND_M,
    };
    rollCentreHeight = defined(rollCentre.z_m, {
      tier,
      band,
      provenance,
      flags: rollCentreFlags,
    });
    rollCentreLateral = defined(rollCentre.y_m, {
      tier,
      provenance,
      flags: rollCentreFlags,
    });
  }

  const camber = camberGain(input, geometry.value);

  return {
    instantCentre: instantCentreSolved,
    rollCentreHeight,
    rollCentreLateral,
    camberGain: camber.perWheel,
    camberGainGlobal: camber.global,
    staticState: wrapState(input, state, 0),
    working: workingFrom(input, state, instantCentre),
  };
}
