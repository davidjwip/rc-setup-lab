export type Tier = 'firm' | 'inferred';

export interface Band {
  readonly low: number;
  readonly high: number;
}

export interface Basis {
  readonly procedure: string;
  readonly inputs: Readonly<Record<string, number | string>>;
}

export type Ref = string;
export type FieldRef = string;

export type Confidence =
  | 'measured'
  | 'manufacturer'
  | 'derived'
  | 'estimated'
  | 'assumed'
  | 'library';

export type UndefinedReason =
  | 'parallelLinks'
  | 'noIntersection'
  | 'coincidentPoints'
  | 'outOfTravel'
  | 'outOfRackTravel'
  | 'incompleteModel'
  | 'degenerateGeometry'
  | 'noSideViewConstruction'
  | 'noAntiGeometry'
  | 'noMotionRatio'
  | 'noRollStiffness'
  | 'ambiguousBranch'
  | 'zeroLateral'
  | 'outOfDomain';

export type Flag =
  | 'parallelLinks'
  | 'nearlyParallel'
  | 'lowConfidence'
  | 'assumedInput'
  | 'diagnosticOnly'
  | 'cgInferred'
  | 'rollCentreAboveCg';

export interface Defined<T> {
  readonly kind: 'defined';
  readonly value: T;
  readonly tier: Tier;
  readonly band: Band | null;
  readonly basis: Basis | null;
  readonly provenance: ReadonlySet<Ref>;
  readonly flags: ReadonlySet<Flag>;
}

export interface NotMeasured {
  readonly kind: 'notMeasured';
  readonly missing: readonly FieldRef[];
}

export interface Undefined {
  readonly kind: 'undefined';
  readonly reason: UndefinedReason;
  readonly inputs: readonly FieldRef[];
}

export type Solved<T> = Defined<T> | NotMeasured | Undefined;

export interface DefinedOptions {
  readonly tier?: Tier;
  readonly band?: Band | null;
  readonly basis?: Basis | null;
  readonly provenance?: Iterable<Ref>;
  readonly flags?: Iterable<Flag>;
}

export function defined<T>(value: T, options: DefinedOptions = {}): Defined<T> {
  return {
    kind: 'defined',
    value,
    tier: options.tier ?? 'firm',
    band: options.band ?? null,
    basis: options.basis ?? null,
    provenance: new Set(options.provenance ?? []),
    flags: new Set(options.flags ?? []),
  };
}

export function notMeasured(missing: readonly FieldRef[]): NotMeasured {
  return { kind: 'notMeasured', missing };
}

export function undefinedResult(
  reason: UndefinedReason,
  inputs: readonly FieldRef[] = [],
): Undefined {
  return { kind: 'undefined', reason, inputs };
}

export function assertNever(value: never): never {
  throw new Error(`unreachable: ${String(value)}`);
}
