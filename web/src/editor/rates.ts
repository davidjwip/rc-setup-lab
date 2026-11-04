import {
  buildAxleRates,
  buildDampingRatioInput,
  buildLoadTransferInput,
  buildRollStiffnessInput,
  gravitiesToMetresPerSecondSquared,
  type ArbTypeDocument,
  type CarModelDocument,
} from '@setuplab/data';
import {
  solveDampingRatio,
  solveLoadTransfer,
  solveRollStiffness,
  type Solved,
} from '@setuplab/physics';

export type RateAxle = 'front' | 'rear';
export type ArbGeometryField = 'bar_diameter' | 'span' | 'arm_length';

export type RateChange =
  | { readonly kind: 'spring'; readonly valueNmm: number }
  | { readonly kind: 'damper'; readonly valueNsPerM: number }
  | { readonly kind: 'arbType'; readonly value: ArbTypeDocument }
  | {
      readonly kind: 'arbValue';
      readonly field: ArbGeometryField;
      readonly valueMm: number;
    };

export interface RateRange {
  readonly min: number;
  readonly max: number;
  readonly unit: string;
  readonly step: number;
}

/**
 * fields.yaml plausible ranges. The editor refuses outside them rather than
 * clamping, matching the hardpoint editor's behaviour.
 */
export const RATE_RANGES: Readonly<Record<'spring' | 'damper' | 'barDiameter' | 'span' | 'armLength', RateRange>> = {
  spring: { min: 1.5, max: 6.0, unit: 'N/mm', step: 0.01 },
  damper: { min: 5.0, max: 40.0, unit: 'N·s/m', step: 0.1 },
  barDiameter: { min: 0.5, max: 2.5, unit: 'mm', step: 0.01 },
  span: { min: 50.0, max: 120.0, unit: 'mm', step: 0.1 },
  armLength: { min: 12.0, max: 30.0, unit: 'mm', step: 0.1 },
};

export type RateCheck =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly message: string };

export function checkRateValue(text: string, range: RateRange): RateCheck {
  const trimmed = text.trim();
  const value = Number(trimmed);
  if (trimmed === '' || !Number.isFinite(value)) {
    return { ok: false, message: `Enter a number in ${range.unit}.` };
  }
  if (value < range.min || value > range.max) {
    return {
      ok: false,
      message: `Must be between ${range.min} and ${range.max} ${range.unit}; fields.yaml sets that range.`,
    };
  }
  return { ok: true, value };
}

export interface RateSnapshot {
  readonly springRateNmm: number | null;
  readonly damperCoefficient: number | null;
  readonly arbType: ArbTypeDocument;
  readonly arbDiameterMm: number | null;
  readonly arbSpanMm: number | null;
  readonly arbArmLengthMm: number | null;
  readonly wheelRateNmm: number | null;
  readonly rideFrequencyHz: number | null;
  readonly criticalDamping: number | null;
  readonly dampingRatio: number | null;
  readonly dampingLow: number | null;
  readonly dampingHigh: number | null;
  readonly arbWheelRateNmm: number | null;
  readonly axleRollStiffness: number | null;
  readonly frontShare: number | null;
  readonly balance: number | null;
}

function valueOf(solved: Solved<number>): number | null {
  return solved.kind === 'defined' ? solved.value : null;
}

function bandOf(solved: Solved<number>): readonly [number | null, number | null] {
  if (solved.kind !== 'defined' || solved.band === null) return [null, null];
  return [solved.band.low, solved.band.high];
}

export function rateSnapshot(
  model: CarModelDocument,
  axle: RateAxle,
  lateralG = 1,
): RateSnapshot {
  const axleDocument = model.axles[axle];
  const ratesResult = buildAxleRates(model, axle);
  const rates = ratesResult.ok ? ratesResult.value : null;
  const dampingInput =
    rates === null ? null : buildDampingRatioInput(model, axle, rates.criticalDamping);
  const damping = dampingInput === null ? null : solveDampingRatio(dampingInput);
  const dampingRatio = damping === null ? null : damping.dampingRatio;
  const [dampingLow, dampingHigh] =
    dampingRatio === null ? [null, null] : bandOf(dampingRatio);

  const rollInput = buildRollStiffnessInput(model);
  const roll = rollInput.ok ? solveRollStiffness(rollInput.value) : null;
  const axleRoll = roll === null ? null : roll[axle];

  const transferInput = buildLoadTransferInput(
    model,
    gravitiesToMetresPerSecondSquared(lateralG),
  );
  const transfer = transferInput.ok ? solveLoadTransfer(transferInput.value) : null;

  return {
    springRateNmm: axleDocument?.springRate?.value ?? null,
    damperCoefficient:
      dampingInput === null
        ? null
        : dampingInput.wheelCoefficient_NsPerM.value,
    arbType: axleDocument?.arb?.type ?? 'none',
    arbDiameterMm: axleDocument?.arb?.barDiameter?.value ?? null,
    arbSpanMm: axleDocument?.arb?.span?.value ?? null,
    arbArmLengthMm: axleDocument?.arb?.armLength?.value ?? null,
    wheelRateNmm:
      rates === null || valueOf(rates.wheelRate) === null
        ? null
        : (valueOf(rates.wheelRate) as number) / 1000,
    rideFrequencyHz: rates === null ? null : valueOf(rates.rideFrequency),
    criticalDamping: rates === null ? null : valueOf(rates.criticalDamping),
    dampingRatio: dampingRatio === null ? null : valueOf(dampingRatio),
    dampingLow,
    dampingHigh,
    arbWheelRateNmm:
      axleRoll === null || valueOf(axleRoll.antiRollBar.wheelRate) === null
        ? null
        : (valueOf(axleRoll.antiRollBar.wheelRate) as number) / 1000,
    axleRollStiffness: axleRoll === null ? null : valueOf(axleRoll.rollStiffness),
    frontShare: roll === null ? null : valueOf(roll.frontShare),
    balance: transfer === null ? null : valueOf(transfer.balance),
  };
}

const AXLE_LABEL: Readonly<Record<RateAxle, string>> = {
  front: 'Front',
  rear: 'Rear',
};

const ARB_TYPE_LABEL: Readonly<Record<ArbTypeDocument, string>> = {
  torsion_bar: 'torsion bar',
  blade: 'blade',
  fixed: 'fixed',
  none: 'none',
};

function direction(label: string, before: number | null, after: number | null): string {
  if (before === null || after === null) return `${label} not comparable`;
  if (after > before) return `${label} up`;
  if (after < before) return `${label} down`;
  return `${label} unchanged`;
}

function number(value: number | null, digits: number): string {
  return value === null ? '—' : value.toFixed(digits);
}

/**
 * One line, computed from the actual before/after values. It states what moved
 * and which way, never what the car will do (glossary §1, D-13).
 */
export function describeRateChange(
  change: RateChange,
  axle: RateAxle,
  before: RateSnapshot,
  after: RateSnapshot,
): string {
  const end = AXLE_LABEL[axle];
  switch (change.kind) {
    case 'spring':
      return `${end} spring ${number(before.springRateNmm, 2)} → ${number(
        after.springRateNmm,
        2,
      )} N/mm: ${direction('ride frequency', before.rideFrequencyHz, after.rideFrequencyHz)}, ${direction(
        'damping ratio',
        before.dampingRatio,
        after.dampingRatio,
      )}.`;
    case 'damper':
      return `${end} damper ${number(before.damperCoefficient, 1)} → ${number(
        after.damperCoefficient,
        1,
      )} N·s/m: ${direction('damping ratio', before.dampingRatio, after.dampingRatio)}.`;
    case 'arbType':
      return `${end} ARB type ${ARB_TYPE_LABEL[before.arbType]} → ${ARB_TYPE_LABEL[change.value]}: ${direction(
        'ARB wheel rate',
        before.arbWheelRateNmm,
        after.arbWheelRateNmm,
      )}, ${direction('front roll-stiffness share', before.frontShare, after.frontShare)}.`;
    case 'arbValue': {
      const label =
        change.field === 'bar_diameter'
          ? 'ARB diameter'
          : change.field === 'span'
            ? 'ARB span'
            : 'ARB arm length';
      const beforeValue =
        change.field === 'bar_diameter'
          ? before.arbDiameterMm
          : change.field === 'span'
            ? before.arbSpanMm
            : before.arbArmLengthMm;
      return `${end} ${label} ${number(beforeValue, 2)} → ${number(
        change.valueMm,
        2,
      )} mm: ${direction('ARB wheel rate', before.arbWheelRateNmm, after.arbWheelRateNmm)}, ${direction(
        'front roll-stiffness share',
        before.frontShare,
        after.frontShare,
      )}.`;
    }
  }
}
