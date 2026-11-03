import type { Sourced } from '../frontView/types.js';
import {
  assertNever,
  defined,
  undefinedResult,
  type Defined,
  type DefinedOptions,
  type Flag,
  type Solved,
  type Tier,
} from '../result/solved.js';
import type {
  AntiRollBarInput,
  AntiRollBarResult,
  AntiRollBarWorking,
  AxleRollInput,
  AxleRollResult,
  AxleRollWorking,
  RollStiffnessInput,
  RollStiffnessResult,
} from './types.js';

function isFirmSource(confidence: Sourced<unknown>['confidence']): boolean {
  return confidence === 'measured' || confidence === 'manufacturer' || confidence === 'derived';
}

function tierOf(sources: readonly Sourced<unknown>[]): Tier {
  return sources.every((source) => isFirmSource(source.confidence)) ? 'firm' : 'inferred';
}

function provenanceOf(sources: readonly Sourced<unknown>[]): Set<string> {
  return new Set(sources.map((source) => source.ref));
}

function flagsOf(sources: readonly Sourced<unknown>[]): Set<Flag> {
  const flags = new Set<Flag>();
  if (sources.some((source) => source.confidence === 'assumed')) flags.add('assumedInput');
  if (
    sources.some(
      (source) => source.confidence === 'estimated' || source.confidence === 'library',
    )
  ) {
    flags.add('lowConfidence');
  }
  return flags;
}

function optionsFromSources(sources: readonly Sourced<unknown>[]): DefinedOptions {
  return {
    tier: tierOf(sources),
    provenance: provenanceOf(sources),
    flags: flagsOf(sources),
  };
}

/**
 * Combine already-solved parts with any raw sources (for example the track).
 * A result is `firm` only when every part is firm and every raw source is not
 * assumed, estimated or borrowed.
 */
function optionsFromParts(
  parts: readonly Defined<number>[],
  sources: readonly Sourced<unknown>[],
): DefinedOptions {
  const provenance = new Set<string>();
  const flags = new Set<Flag>();
  let tier: Tier = sources.every((source) => isFirmSource(source.confidence))
    ? 'firm'
    : 'inferred';

  for (const part of parts) {
    if (part.tier !== 'firm') tier = 'inferred';
    part.provenance.forEach((ref) => provenance.add(ref));
    part.flags.forEach((flag) => flags.add(flag));
  }
  for (const source of sources) {
    provenance.add(source.ref);
    flagsOf([source]).forEach((flag) => flags.add(flag));
  }

  return { tier, provenance, flags };
}

function failureOf(solved: Solved<number>): Solved<number> {
  if (solved.kind === 'defined') {
    throw new Error('cannot build a failure from a defined result');
  }
  return solved;
}

function emptyWorking(type: AntiRollBarInput['type']): AntiRollBarWorking {
  return {
    type,
    torsionalStiffness_NmPerRad: null,
    armLength_m: null,
    motionRatio: null,
    blades: null,
    rateAtLink_Npm: null,
    wheelRate_Npm: null,
  };
}

function refusedBar(input: AntiRollBarInput, solved: Solved<number>): AntiRollBarResult {
  return {
    fitted: true,
    rateAtLink: solved,
    wheelRate: solved,
    working: {
      ...emptyWorking(input.type),
      armLength_m: input.armLength_m?.value ?? null,
      motionRatio: input.motionRatio?.value ?? null,
      blades: input.type === 'blade' ? (input.blades?.value ?? null) : null,
    },
  };
}

/**
 * 05 (5.5)–(5.7): torsion-bar rate at the link and at the wheel.
 * `barDiameter_m`, `span_m` and `armLength_m` are metres, `shearModulus_Pa` is
 * pascals, so no conversion is needed inside the equation: k_θ is N·m/rad and
 * k_bar is N/m. `motionRatio` is IR_arm, dimensionless.
 */
function solveTorsionBar(input: AntiRollBarInput): AntiRollBarResult {
  const barDiameter = input.barDiameter_m;
  const span = input.span_m;
  const armLength = input.armLength_m;
  const shearModulus = input.shearModulus_Pa;
  const motionRatio = input.motionRatio;

  if (
    barDiameter == null ||
    span == null ||
    armLength == null ||
    shearModulus == null ||
    motionRatio == null
  ) {
    const missing: string[] = [];
    if (barDiameter == null) missing.push(`axles.${input.axle}.arb.bar_diameter`);
    if (span == null) missing.push(`axles.${input.axle}.arb.span`);
    if (armLength == null) missing.push(`axles.${input.axle}.arb.arm_length`);
    if (shearModulus == null) missing.push(`axles.${input.axle}.arb.shear_modulus`);
    // TODO(spec §3.2): IR_arm is derived from points.arb_drop when present and assumed
    // to 0.8 only when it is missing; the schema carries no field for the derived value.
    if (motionRatio == null) missing.push('arb.motion_ratio');
    return refusedBar(input, undefinedResult('incompleteModel', missing));
  }

  const sources = [barDiameter, span, armLength, shearModulus, motionRatio];
  const options = optionsFromSources(sources);

  if (
    !Number.isFinite(barDiameter.value) ||
    !Number.isFinite(span.value) ||
    !Number.isFinite(armLength.value) ||
    !Number.isFinite(shearModulus.value) ||
    !Number.isFinite(motionRatio.value)
  ) {
    return refusedBar(input, undefinedResult('outOfDomain', sources.map((source) => source.ref)));
  }
  if (barDiameter.value < 0 || shearModulus.value <= 0) {
    return refusedBar(input, undefinedResult('outOfDomain', sources.map((source) => source.ref)));
  }
  if (span.value <= 0 || armLength.value <= 0) {
    return refusedBar(
      input,
      undefinedResult('incompleteModel', [
        ...(span.value <= 0 ? [`axles.${input.axle}.arb.span`] : []),
        ...(armLength.value <= 0 ? [`axles.${input.axle}.arb.arm_length`] : []),
      ]),
    );
  }

  if (barDiameter.value === 0) {
    return {
      fitted: true,
      rateAtLink: defined(0, options),
      wheelRate: defined(0, options),
      working: {
        ...emptyWorking('torsion_bar'),
        armLength_m: armLength.value,
        motionRatio: motionRatio.value,
        rateAtLink_Npm: 0,
        wheelRate_Npm: 0,
      },
    };
  }

  const polarSecondMoment = (Math.PI * barDiameter.value ** 4) / 32;
  const torsionalStiffness = (shearModulus.value * polarSecondMoment) / span.value;
  const rateAtLink = torsionalStiffness / armLength.value ** 2;
  const wheelRate = rateAtLink * motionRatio.value ** 2;

  return {
    fitted: true,
    rateAtLink: defined(rateAtLink, options),
    wheelRate: defined(wheelRate, options),
    working: {
      type: 'torsion_bar',
      torsionalStiffness_NmPerRad: torsionalStiffness,
      armLength_m: armLength.value,
      motionRatio: motionRatio.value,
      blades: null,
      rateAtLink_Npm: rateAtLink,
      wheelRate_Npm: wheelRate,
    },
  };
}

/**
 * 05 (5.8): a blade bar is `n` identical cantilevers in parallel. The single
 * blade's rate at the link is an input (measured or manufacturer-supplied);
 * `n` multiplies it, never divides it. `fixed` is a single bar.
 */
function solveBladeBar(input: AntiRollBarInput): AntiRollBarResult {
  const singleBladeRate = input.singleBladeRate_Npm;
  const motionRatio = input.motionRatio;
  const bladeSource = input.type === 'blade' ? input.blades : null;

  if (singleBladeRate == null || motionRatio == null || (input.type === 'blade' && bladeSource == null)) {
    const missing: string[] = [];
    if (singleBladeRate == null) missing.push(`axles.${input.axle}.arb.rate_at_link`);
    // TODO(spec §3.2): IR_arm is derived from points.arb_drop when present and assumed
    // to 0.8 only when it is missing; the schema carries no field for the derived value.
    if (motionRatio == null) missing.push('arb.motion_ratio');
    if (input.type === 'blade' && bladeSource == null) {
      // TODO(spec §3.2): fields.yaml has no axles.<axle>.arb.blades, so a blade
      // model loaded through packages/data refuses here instead of assuming n.
      missing.push(`axles.${input.axle}.arb.blades`);
    }
    return refusedBar(input, undefinedResult('incompleteModel', missing));
  }

  const bladeCount = input.type === 'fixed' ? 1 : (bladeSource?.value ?? Number.NaN);
  const sources: Sourced<unknown>[] = [singleBladeRate, motionRatio];
  if (input.type === 'blade' && bladeSource != null) sources.push(bladeSource);
  const options = optionsFromSources(sources);

  if (
    !Number.isFinite(singleBladeRate.value) ||
    !Number.isFinite(motionRatio.value) ||
    !Number.isFinite(bladeCount)
  ) {
    return refusedBar(input, undefinedResult('outOfDomain', sources.map((source) => source.ref)));
  }
  if (singleBladeRate.value < 0 || bladeCount < 1 || !Number.isInteger(bladeCount)) {
    return refusedBar(input, undefinedResult('outOfDomain', sources.map((source) => source.ref)));
  }

  const rateAtLink = singleBladeRate.value * bladeCount;
  const wheelRate = rateAtLink * motionRatio.value ** 2;

  return {
    fitted: true,
    rateAtLink: defined(rateAtLink, options),
    wheelRate: defined(wheelRate, options),
    working: {
      type: input.type,
      torsionalStiffness_NmPerRad: null,
      armLength_m: null,
      motionRatio: motionRatio.value,
      blades: bladeCount,
      rateAtLink_Npm: rateAtLink,
      wheelRate_Npm: wheelRate,
    },
  };
}

/**
 * Solve one axle's anti-roll bar in SI units.
 * - `none` → a defined zero contribution (05 §5, no flag).
 * - a missing span or arm length → `Undefined(incompleteModel)` naming the field.
 * - a blade without a count → `Undefined(incompleteModel)`, never an assumption.
 */
export function solveAntiRollBar(input: AntiRollBarInput): AntiRollBarResult {
  switch (input.type) {
    case 'none':
      return {
        fitted: false,
        rateAtLink: defined(0),
        wheelRate: defined(0),
        working: {
          ...emptyWorking('none'),
          rateAtLink_Npm: 0,
          wheelRate_Npm: 0,
        },
      };
    case 'torsion_bar':
      return solveTorsionBar(input);
    case 'blade':
    case 'fixed':
      return solveBladeBar(input);
    default:
      return assertNever(input.type);
  }
}

/**
 * 05 (5.9) in SI: `k_φ = (k_w/2 + k_bar) · t²` with k_w and k_bar in N/m and
 * t in metres, returning N·m/rad. A refused bar leaves the spring wheel rate in
 * `working` so the rest of the axle is still readable.
 */
function solveAxle(input: AxleRollInput): AxleRollResult {
  const bar = solveAntiRollBar(input.antiRollBar);
  const springRate = input.springWheelRate_Npm;
  const track = input.track_m;

  const working: AxleRollWorking = {
    springWheelRate_Npm: springRate.kind === 'defined' ? springRate.value : null,
    barWheelRate_Npm: bar.wheelRate.kind === 'defined' ? bar.wheelRate.value : null,
    track_m: track === null ? null : track.value,
    halfTrack_m: track === null ? null : track.value / 2,
    rollStiffness_NmPerRad: null,
    antiRollBar: bar.working,
  };

  if (springRate.kind !== 'defined') {
    return { rollStiffness: failureOf(springRate), antiRollBar: bar, working };
  }
  if (!Number.isFinite(springRate.value) || springRate.value < 0) {
    return {
      rollStiffness: undefinedResult('outOfDomain', ['wheel_rate']),
      antiRollBar: bar,
      working,
    };
  }
  if (bar.wheelRate.kind !== 'defined') {
    return { rollStiffness: failureOf(bar.wheelRate), antiRollBar: bar, working };
  }
  if (track === null) {
    return {
      rollStiffness: undefinedResult('incompleteModel', [`axles.${input.axle}.track`]),
      antiRollBar: bar,
      working,
    };
  }
  if (!Number.isFinite(track.value) || track.value <= 0) {
    return {
      rollStiffness: undefinedResult('outOfDomain', [track.ref]),
      antiRollBar: bar,
      working,
    };
  }

  const rollStiffness =
    (springRate.value / 2 + bar.wheelRate.value) * track.value * track.value;
  const options = optionsFromParts([springRate, bar.wheelRate], [track]);

  return {
    rollStiffness: defined(rollStiffness, options),
    antiRollBar: bar,
    working: {
      ...working,
      rollStiffness_NmPerRad: rollStiffness,
    },
  };
}

function totalOf(front: Solved<number>, rear: Solved<number>): Solved<number> {
  if (front.kind !== 'defined') return front;
  if (rear.kind !== 'defined') return rear;
  const total = front.value + rear.value;
  if (!Number.isFinite(total)) return undefinedResult('outOfDomain');
  return defined(total, optionsFromParts([front, rear], []));
}

function frontShareOf(
  front: Solved<number>,
  rear: Solved<number>,
  total: Solved<number>,
): Solved<number> {
  if (front.kind !== 'defined') return front;
  if (rear.kind !== 'defined') return rear;
  if (total.kind !== 'defined') return total;
  if (!(total.value > 0)) return undefinedResult('noRollStiffness');
  return defined(front.value / total.value, optionsFromParts([front, rear], []));
}

/**
 * Solve front and rear axle roll stiffness and the front share. All values are
 * SI inside: `front`/`rear` are N·m/rad, `frontShare` is a dimensionless
 * fraction. The share is `Undefined` unless both axles have a defined stiffness.
 */
export function solveRollStiffness(input: RollStiffnessInput): RollStiffnessResult {
  const front = solveAxle(input.front);
  const rear = solveAxle(input.rear);
  const total = totalOf(front.rollStiffness, rear.rollStiffness);
  return {
    front,
    rear,
    total,
    frontShare: frontShareOf(front.rollStiffness, rear.rollStiffness, total),
  };
}
