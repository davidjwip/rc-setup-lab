import type { Confidence, Solved } from '@setuplab/physics';
import type { ValueProvenance } from './Value.js';

const CONFIDENCE_RANK: Readonly<Record<Confidence, number>> = {
  measured: 6,
  manufacturer: 5,
  derived: 4,
  modelled: 3,
  estimated: 2,
  assumed: 1,
  library: 0,
};

const PROVENANCE_RANK: Readonly<Record<ValueProvenance, number>> = {
  computed: 6,
  measured: 5,
  modelled: 4,
  inferred: 3,
  estimated: 2,
  missing: 1,
  undefined: 0,
};

/**
 * A stored input's own provenance, in the page's vocabulary. `derived` is a
 * computed result of measured inputs on this car; `manufacturer` and `library`
 * are another source's numbers, never a local measurement.
 */
export function provenanceForConfidence(confidence: Confidence): ValueProvenance {
  switch (confidence) {
    case 'measured':
      return 'measured';
    case 'derived':
      return 'computed';
    case 'modelled':
      return 'modelled';
    case 'estimated':
    case 'assumed':
      return 'estimated';
    case 'manufacturer':
    case 'library':
      return 'inferred';
  }
}

/**
 * A solved output's provenance. This is the one mapping the page trusts:
 * `computed` means the solve used inputs measured on this car, and an inferred,
 * modelled or estimated result can never return `computed`.
 */
export function provenanceForSolved(value: Solved<unknown>): ValueProvenance {
  if (value.kind === 'notMeasured') return 'missing';
  if (value.kind === 'undefined') return 'undefined';
  if (value.flags.has('assumedInput') || value.flags.has('lowConfidence')) return 'estimated';
  if (value.flags.has('modelledGeometry')) return 'modelled';
  if (value.flags.has('derivedGeometry') || value.tier === 'inferred') return 'inferred';
  return 'computed';
}

/** The more cautious of two provenances; used when a value reads two inputs. */
export function weakerProvenance(
  left: ValueProvenance,
  right: ValueProvenance,
): ValueProvenance {
  return PROVENANCE_RANK[left] <= PROVENANCE_RANK[right] ? left : right;
}

export function provenanceForConfidences(
  confidences: readonly Confidence[],
): ValueProvenance {
  if (confidences.length === 0) return 'missing';
  return confidences
    .map(provenanceForConfidence)
    .reduce((weakest, next) => weakerProvenance(weakest, next));
}

export { CONFIDENCE_RANK };
