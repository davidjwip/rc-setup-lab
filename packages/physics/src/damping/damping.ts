import type { Sourced } from '../frontView/types.js';
import {
  defined,
  undefinedResult,
  type DefinedOptions,
  type Flag,
  type Solved,
  type Tier,
} from '../result/solved.js';
import type { DampingRatioInput, DampingRatioResult, DampingRatioWorking } from './types.js';

/**
 * D-13 / physics/07 §6.6: the assumed damper parameters carry a ±50 % band
 * above blow-off. A coefficient with no stored tolerance is therefore quoted
 * with the same stated interval rather than a band invented per call.
 */
const DEFAULT_ESTIMATE_TOLERANCE = 0.5;

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

function optionsFrom(sources: readonly Sourced<unknown>[]): DefinedOptions {
  return {
    tier: tierOf(sources),
    provenance: provenanceOf(sources),
    flags: flagsOf(sources),
  };
}

function failureOf(solved: Solved<unknown>): Solved<number> {
  if (solved.kind === 'defined') {
    throw new Error('cannot build a failure from a defined result');
  }
  return solved;
}

/**
 * 07 (7.2): ζ = c_wheel / c_crit at the wheel.
 *
 * The coefficient is estimated in this slice (D-13), so the output carries its
 * band, tier `inferred` and the estimate flags. A firm coefficient still keeps
 * the critical damping's own provenance, because c_crit is derived from the
 * spring rate, geometry and sprung mass.
 */
export function solveDampingRatio(input: DampingRatioInput): DampingRatioResult {
  const coefficient = input.wheelCoefficient_NsPerM;
  const critical = input.criticalDamping_NsPerM;

  const working: DampingRatioWorking = {
    wheelCoefficient_NsPerM: Number.isFinite(coefficient.value) ? coefficient.value : null,
    criticalDamping_NsPerM: critical.kind === 'defined' ? critical.value : null,
  };

  if (critical.kind !== 'defined') {
    return { dampingRatio: failureOf(critical), working };
  }
  if (!Number.isFinite(coefficient.value) || coefficient.value < 0) {
    return {
      dampingRatio: undefinedResult('outOfDomain', [coefficient.ref]),
      working,
    };
  }
  if (!Number.isFinite(critical.value) || critical.value <= 0) {
    return {
      dampingRatio: undefinedResult('outOfDomain', ['critical_damping']),
      working,
    };
  }

  const ratio = coefficient.value / critical.value;
  const sources = optionsFrom([coefficient]);
  const flags = new Set<Flag>(sources.flags ?? []);
  for (const flag of critical.flags) flags.add(flag);
  const provenance = new Set<string>(sources.provenance ?? []);
  critical.provenance.forEach((ref) => provenance.add(ref));
  const options: DefinedOptions = {
    tier: critical.tier === 'firm' && sources.tier === 'firm' ? 'firm' : 'inferred',
    flags,
    provenance,
  };

  const firmCoefficient = isFirmSource(coefficient.confidence);
  const halfWidth =
    coefficient.tolerance ?? (firmCoefficient ? 0 : DEFAULT_ESTIMATE_TOLERANCE);
  const band =
    halfWidth > 0
      ? {
          low: Math.max(0, ratio * (1 - halfWidth)),
          high: ratio * (1 + halfWidth),
        }
      : null;

  return {
    dampingRatio: defined(ratio, {
      ...options,
      band,
      basis: {
        procedure: 'wheel_coefficient_v1',
        inputs: {
          c_wheel_NsPerM: coefficient.value,
          c_crit_NsPerM: critical.value,
        },
      },
    }),
    working,
  };
}
