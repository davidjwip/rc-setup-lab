import { distance, type Vec2 } from '../geometry/vec2.js';
import { solveFrontViewAtBump } from '../frontView/kinematics.js';
import type { FrontViewInput, Sourced } from '../frontView/types.js';
import {
  defined,
  notMeasured,
  undefinedResult,
  type Flag,
  type Solved,
  type Tier,
} from '../result/solved.js';
import type { RatesFromRatioInput, RatesInput, RatesResult, RatesWorking } from './types.js';

/**
 * Half-width of the central difference on wheel travel.
 * 05 §3.1's reviewer check uses ±0.5 mm of wheel travel; the shipped θ-step value
 * (0.565308) and this wheel-step value agree inside G05.1's 1e-5 tolerance.
 * The step is fixed so the number is comparable between corners; a model with less
 * than 0.5 mm of bump or droop returns `outOfTravel` rather than silently shrinking it.
 */
const INSTALLATION_RATIO_STEP_M = 0.0005;

/**
 * A ratio this close to zero is the spec's `noMotionRatio` case (05 §5): the damper
 * axis is perpendicular to the arm's motion, so the first derivative of damper length
 * with respect to wheel travel vanishes. 1e-5 is G05.1's own tolerance on IR, and at
 * that ratio k_w/k_s = 1e-10 — physically indistinguishable from zero.
 */
const K_MOTION_RATIO_TOL = 1e-5;

type RatioOutcome =
  | {
      readonly ok: true;
      readonly ratio: number;
      readonly damperLengthLow_m: number | null;
      readonly damperLengthHigh_m: number | null;
    }
  | {
      readonly ok: false;
      readonly solved: Solved<number>;
      readonly damperLengthLow_m: number | null;
      readonly damperLengthHigh_m: number | null;
    };

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

function failureOf(solved: Solved<unknown>): Solved<number> {
  if (solved.kind === 'undefined') return undefinedResult(solved.reason, solved.inputs);
  if (solved.kind === 'notMeasured') return notMeasured(solved.missing);
  throw new Error('cannot build a failure from a defined result');
}

function rotateAbout(point: Vec2, hinge: Vec2, angle_rad: number): Vec2 {
  const dy = point.y - hinge.y;
  const dz = point.z - hinge.z;
  const cosine = Math.cos(angle_rad);
  const sine = Math.sin(angle_rad);
  return {
    y: hinge.y + dy * cosine - dz * sine,
    z: hinge.z + dy * sine + dz * cosine,
  };
}

/**
 * 05 (5.1)–(5.2): IR = −dL_damper/dz_wheel, central-differenced over ±0.5 mm of wheel travel.
 * `damper_lo` is on the lower arm, so it rotates about the lower-arm inner point by
 * (θ − θ₀) — the arm transform, not the carrier transform (02 §3.2.3).
 */
function installationRatioFromGeometry(
  frontView: FrontViewInput,
  damperLo: Sourced<Vec2>,
  damperUp: Sourced<Vec2>,
): RatioOutcome {
  const refs = [damperLo.ref, damperUp.ref];
  const hinge = frontView.lcaIn_m.value;
  const theta0 = Math.atan2(
    frontView.lcaOut_m.value.z - hinge.z,
    frontView.lcaOut_m.value.y - hinge.y,
  );

  const high = solveFrontViewAtBump(frontView, INSTALLATION_RATIO_STEP_M);
  const low = solveFrontViewAtBump(frontView, -INSTALLATION_RATIO_STEP_M);
  if (high.kind !== 'defined' || low.kind !== 'defined') {
    const failed = high.kind !== 'defined' ? high : low;
    return { ok: false, solved: failureOf(failed), damperLengthLow_m: null, damperLengthHigh_m: null };
  }

  const damperLow = rotateAbout(
    damperLo.value,
    hinge,
    low.value.crankAngle_rad - theta0,
  );
  const damperHigh = rotateAbout(
    damperLo.value,
    hinge,
    high.value.crankAngle_rad - theta0,
  );
  const lengthLow = distance(damperUp.value, damperLow);
  const lengthHigh = distance(damperUp.value, damperHigh);
  const ratio = -(lengthHigh - lengthLow) / (2 * INSTALLATION_RATIO_STEP_M);

  if (!Number.isFinite(ratio)) {
    return {
      ok: false,
      solved: undefinedResult('degenerateGeometry', refs),
      damperLengthLow_m: lengthLow,
      damperLengthHigh_m: lengthHigh,
    };
  }
  if (Math.abs(ratio) <= K_MOTION_RATIO_TOL) {
    return {
      ok: false,
      solved: undefinedResult('noMotionRatio', refs),
      damperLengthLow_m: lengthLow,
      damperLengthHigh_m: lengthHigh,
    };
  }

  return {
    ok: true,
    ratio,
    damperLengthLow_m: lengthLow,
    damperLengthHigh_m: lengthHigh,
  };
}

function ratioFromInput(installationRatio: Sourced<number>): RatioOutcome {
  const ratio = installationRatio.value;
  if (!Number.isFinite(ratio)) {
    return {
      ok: false,
      solved: undefinedResult('outOfDomain', [installationRatio.ref]),
      damperLengthLow_m: null,
      damperLengthHigh_m: null,
    };
  }
  if (Math.abs(ratio) <= K_MOTION_RATIO_TOL) {
    return {
      ok: false,
      solved: undefinedResult('noMotionRatio', [installationRatio.ref]),
      damperLengthLow_m: null,
      damperLengthHigh_m: null,
    };
  }
  return {
    ok: true,
    ratio,
    damperLengthLow_m: null,
    damperLengthHigh_m: null,
  };
}

function missingMassRef(corner: RatesInput['corner'] | RatesFromRatioInput['corner']): string {
  return corner === 'LR' || corner === 'RR'
    ? 'body.mass.sprung_rear'
    : 'body.mass.sprung_front';
}

function assemble(
  corner: RatesInput['corner'],
  sources: readonly Sourced<unknown>[],
  ratioOutcome: RatioOutcome,
  springRate: Sourced<number>,
  sprungMass: Sourced<number> | null,
  bumpStep_m: number,
): RatesResult {
  const tier = tierOf(sources);
  const provenance = provenanceOf(sources);
  const baseFlags = flagsOf(sources);

  const working: RatesWorking = {
    bumpStep_m,
    damperLengthLow_m: ratioOutcome.damperLengthLow_m,
    damperLengthHigh_m: ratioOutcome.damperLengthHigh_m,
    springRate_Npm: springRate.value,
    installationRatio: ratioOutcome.ok ? ratioOutcome.ratio : null,
    wheelRate_Npm: null,
    sprungMass_kg: sprungMass === null ? null : sprungMass.value,
  };

  if (!ratioOutcome.ok) {
    return {
      installationRatio: ratioOutcome.solved,
      wheelRate: failureOf(ratioOutcome.solved),
      rideFrequency: failureOf(ratioOutcome.solved),
      criticalDamping: failureOf(ratioOutcome.solved),
      working,
    };
  }

  const flags = new Set<Flag>(baseFlags);
  // 05 §5: a negative ratio is a real geometric inversion, reported, not refused.
  if (ratioOutcome.ratio < 0) flags.add('lowConfidence');

  const installationRatio = defined(ratioOutcome.ratio, { tier, provenance, flags });

  if (!Number.isFinite(springRate.value) || springRate.value <= 0) {
    const refusal = undefinedResult('outOfDomain', [springRate.ref]);
    return {
      installationRatio,
      wheelRate: refusal,
      rideFrequency: refusal,
      criticalDamping: refusal,
      working,
    };
  }

  const wheelRate_Npm = springRate.value * ratioOutcome.ratio * ratioOutcome.ratio;
  // TODO(spec §4.8): the wheel-rate band needs per-field tolerances, which fields.yaml does not
  // yet carry (00 §11 item 1). Until then the envelope reports no band rather than inventing one.
  const wheelRate = defined(wheelRate_Npm, { tier, provenance, flags });
  const solvedWorking: RatesWorking = { ...working, wheelRate_Npm };

  if (sprungMass === null) {
    const missing = notMeasured([missingMassRef(corner)]);
    return {
      installationRatio,
      wheelRate,
      rideFrequency: missing,
      criticalDamping: missing,
      working: solvedWorking,
    };
  }

  if (!Number.isFinite(sprungMass.value) || sprungMass.value <= 0) {
    const refusal = undefinedResult('outOfDomain', [sprungMass.ref]);
    return {
      installationRatio,
      wheelRate,
      rideFrequency: refusal,
      criticalDamping: refusal,
      working: solvedWorking,
    };
  }

  const omega = Math.sqrt(wheelRate_Npm / sprungMass.value);
  const rideFrequency_Hz = omega / (2 * Math.PI);
  const criticalDamping_NsPerM = 2 * Math.sqrt(wheelRate_Npm * sprungMass.value);

  return {
    installationRatio,
    wheelRate,
    rideFrequency: defined(rideFrequency_Hz, { tier, provenance, flags }),
    criticalDamping: defined(criticalDamping_NsPerM, { tier, provenance, flags }),
    working: solvedWorking,
  };
}

function sourcesFor(input: RatesInput): readonly Sourced<unknown>[] {
  return [
    input.frontView.lcaIn_m,
    input.frontView.lcaOut_m,
    input.frontView.ucaIn_m,
    input.frontView.ucaOut_m,
    input.frontView.wheelCentre_m,
    input.damperLo_m,
    input.damperUp_m,
    input.springRate_Npm,
    ...(input.sprungMass_kg === null ? [] : [input.sprungMass_kg]),
  ];
}

/**
 * Solve one corner's installation ratio, wheel rate, ride frequency and critical damping.
 * All lengths are metres, `springRate_Npm` is N/m, `sprungMass_kg` is kg.
 */
export function solveRates(input: RatesInput): RatesResult {
  const ratio = installationRatioFromGeometry(input.frontView, input.damperLo_m, input.damperUp_m);
  return assemble(
    input.corner,
    sourcesFor(input),
    ratio,
    input.springRate_Npm,
    input.sprungMass_kg,
    INSTALLATION_RATIO_STEP_M,
  );
}

/**
 * Solve the rates from an explicit installation ratio, for a corner with no measured
 * hardpoints (05 §6.5). The ratio's provenance and confidence carry into the envelope.
 */
export function solveRatesFromRatio(input: RatesFromRatioInput): RatesResult {
  const sources: readonly Sourced<unknown>[] = [
    input.installationRatio,
    input.springRate_Npm,
    ...(input.sprungMass_kg === null ? [] : [input.sprungMass_kg]),
  ];
  return assemble(
    input.corner,
    sources,
    ratioFromInput(input.installationRatio),
    input.springRate_Npm,
    input.sprungMass_kg,
    0,
  );
}
