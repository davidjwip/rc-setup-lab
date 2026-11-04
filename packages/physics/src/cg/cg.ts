import type { Sourced } from '../frontView/types.js';
import {
  defined,
  undefinedResult,
  type Band,
  type DefinedOptions,
  type Flag,
  type Tier,
} from '../result/solved.js';
import type {
  RaiseAndWeighInput,
  RaiseAndWeighResult,
  RaiseAndWeighWorking,
} from './types.js';

function isFirmSource(confidence: Sourced<unknown>['confidence']): boolean {
  return confidence === 'measured' || confidence === 'manufacturer' || confidence === 'derived';
}

function tierOf(sources: readonly Sourced<unknown>[]): Tier {
  return sources.every((source) => isFirmSource(source.confidence)) ? 'firm' : 'inferred';
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
    provenance: new Set(sources.map((source) => source.ref)),
    flags: flagsOf(sources),
  };
}

function absoluteBand(value: number, halfWidth: number): Band {
  return { low: value - halfWidth, high: value + halfWidth };
}

function emptyWorking(raisedEnd: RaiseAndWeighInput['raisedEnd']): RaiseAndWeighWorking {
  return {
    raisedEnd,
    theta_rad: null,
    tanTheta: null,
    deltaWeight_kg: null,
    lever_m: null,
    wheelRadius_m: null,
  };
}

/**
 * The raised-axle, two-scale CG measurement (Bob Wright's garage procedure):
 *
 * ```text
 * θ      = asin(h / L)
 * h_cg   = (W_raised − W_level) / W_total × L / tan θ + r_wheel
 * ```
 *
 * `W_level` and `W_raised` are the axle opposite the raised end, so the
 * difference is positive when the raised end adds load to the measured axle.
 * The result is the **whole-car** CG height above the ground; the sprung CG is
 * derived later by subtracting the unsprung masses (06 (6.1)).
 *
 * The band is the repeat-reading uncertainty of the two weighings, combined in
 * quadrature: `±tol × √2 × (L / tan θ) / W_total`. It is not a fit to a
 * scatter plot; it is the sensitivity of the formula to the stated scale
 * tolerance. A 5 g error on one reading moves the height by `5/W × L/tan θ`.
 */
export function solveRaiseAndWeigh(input: RaiseAndWeighInput): RaiseAndWeighResult {
  const wheelbase = input.wheelbase_m;
  const total = input.totalMass_kg;
  const raise = input.raiseHeight_m;
  const level = input.axleWeightLevel_kg;
  const raised = input.axleWeightRaised_kg;
  const radius = input.wheelRadius_m;
  const tolerance = input.weighingTolerance_kg ?? null;
  const sources: Sourced<unknown>[] = [wheelbase, total, raise, level, raised, radius];
  if (tolerance !== null) sources.push(tolerance);

  const working = emptyWorking(input.raisedEnd);
  const refs = sources.map((source) => source.ref);

  const finiteAll =
    Number.isFinite(wheelbase.value) &&
    Number.isFinite(total.value) &&
    Number.isFinite(raise.value) &&
    Number.isFinite(level.value) &&
    Number.isFinite(raised.value) &&
    Number.isFinite(radius.value);

  if (
    !finiteAll ||
    !(wheelbase.value > 0) ||
    !(total.value > 0) ||
    !(raise.value > 0) ||
    !(raise.value < wheelbase.value) ||
    level.value < 0 ||
    raised.value < 0 ||
    radius.value < 0
  ) {
    return { cgHeight_m: undefinedResult('outOfDomain', refs), band_m: null, working };
  }

  const theta = Math.asin(raise.value / wheelbase.value);
  // tan(asin(x)) without the cancellation at h → L.
  const tanTheta = raise.value / Math.sqrt(wheelbase.value ** 2 - raise.value ** 2);
  if (!Number.isFinite(theta) || !Number.isFinite(tanTheta) || !(tanTheta > 0)) {
    return { cgHeight_m: undefinedResult('outOfDomain', refs), band_m: null, working };
  }

  const lever = wheelbase.value / tanTheta;
  const deltaWeight = raised.value - level.value;
  const cgHeight = (deltaWeight / total.value) * lever + radius.value;
  if (!Number.isFinite(cgHeight) || cgHeight <= 0) {
    return { cgHeight_m: undefinedResult('outOfDomain', refs), band_m: null, working };
  }

  const halfWidth =
    tolerance !== null && Number.isFinite(tolerance.value) && tolerance.value >= 0
      ? (tolerance.value * Math.SQRT2 * lever) / total.value
      : null;
  const band = halfWidth === null ? null : absoluteBand(cgHeight, halfWidth);

  return {
    cgHeight_m: defined(cgHeight, { ...optionsFromSources(sources), band }),
    band_m: band,
    working: {
      raisedEnd: input.raisedEnd,
      theta_rad: theta,
      tanTheta,
      deltaWeight_kg: deltaWeight,
      lever_m: lever,
      wheelRadius_m: radius.value,
    },
  };
}
