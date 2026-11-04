import {
  buildAxleRates,
  buildDampingRatioInput,
  buildFrontViewInput,
  buildRollStiffnessInput,
  type ArbTypeDocument,
  type CarModelDocument,
  type CornerKey,
} from '@setuplab/data';
import {
  buildFrontViewScene,
  notMeasured,
  solveDampingRatio,
  solveFrontView,
  solveRollStiffness,
  type Band,
  type FrontViewScene,
  type RollStiffnessResult,
  type Solved,
} from '@setuplab/physics';
import type { Axle } from '../editor/hardpoints.js';
import { cornerKeyForAxle } from '../editor/hardpoints.js';
import {
  CRITICAL_DAMPING_UNIT,
  DAMPING_RATIO_UNIT,
  FRONT_SHARE_UNIT,
  RIDE_FREQUENCY_UNIT,
  ROLL_STIFFNESS_UNIT,
  WHEEL_RATE_UNIT,
  formatCriticalDampingValue,
  formatFixedNumber,
  formatFrontShareValue,
  formatInstallationRatio,
  formatRideFrequencyValue,
  formatRollStiffnessValue,
  formatWheelRateValue,
} from '../format/format.js';
import type { SceneLabels } from '../scene/FrontViewScene.js';
import { buildSceneLabels } from '../view/endSummary.js';
import type { ValueProvenance } from '../view/Value.js';
import { provenanceForSolved } from '../view/provenance.js';
import { missingAdvice, missingCopy, missingRefusal, undefinedRefusal } from '../view/refusal.js';

export interface ShockValue {
  readonly id: string;
  readonly label: string;
  readonly value: string | null;
  readonly unit: string;
  readonly provenance: ValueProvenance;
  readonly band: string | null;
  readonly bandReason?: string;
  readonly reason?: string;
  readonly accessibleName: string;
  readonly size: 'large' | 'medium';
  readonly delta?: string | null;
}

export interface ShockSettings {
  readonly springRateNmm: number | null;
  readonly damperCoefficientNsPerM: number | null;
  /** True when the shown coefficient is the model's stated default, not a stored value. */
  readonly damperCoefficientIsStatedDefault: boolean;
  readonly arbType: ArbTypeDocument;
  readonly arbDiameterMm: number | null;
  readonly arbSpanMm: number | null;
  readonly arbArmLengthMm: number | null;
  readonly arbBlades: number | null;
  readonly damperLoOffsetMm: number | null;
  readonly damperUpOffsetMm: number | null;
}

export interface ShockColumn {
  readonly axle: Axle;
  readonly cornerKey: CornerKey;
  readonly scene: FrontViewScene | null;
  readonly labels: SceneLabels | null;
  readonly refusal: string | null;
  readonly edited: boolean;
  readonly wheelRate: ShockValue;
  readonly rideFrequency: ShockValue;
  readonly dampingRatio: ShockValue;
  readonly motionRatio: ShockValue;
  readonly criticalDamping: ShockValue;
  readonly arbWheelRate: ShockValue;
  readonly axleRollStiffness: ShockValue;
  readonly settings: ShockSettings;
}

export interface ShockPageData {
  readonly columns: readonly ShockColumn[];
  readonly frontShare: ShockValue;
}

function missingValue(
  id: string,
  label: string,
  unit: string,
  accessibleName: string,
  reason: string,
  size: 'large' | 'medium' = 'medium',
): ShockValue {
  return {
    id,
    label,
    value: null,
    unit,
    provenance: 'missing',
    band: null,
    bandReason: 'there is no number to compare',
    reason,
    accessibleName,
    size,
  };
}

function undefinedValue(
  id: string,
  label: string,
  unit: string,
  accessibleName: string,
  reason: string,
  size: 'large' | 'medium' = 'medium',
): ShockValue {
  return {
    id,
    label,
    value: null,
    unit,
    provenance: 'undefined',
    band: null,
    bandReason: 'there is no number to compare',
    reason,
    accessibleName,
    size,
  };
}

function solvedValue(
  id: string,
  label: string,
  unit: string,
  accessibleName: string,
  solved: Solved<number>,
  format: (value: number) => string,
  band: string | null,
  bandReason: string,
  size: 'large' | 'medium' = 'medium',
): ShockValue {
  if (solved.kind === 'notMeasured') {
    return missingValue(
      id,
      label,
      unit,
      accessibleName,
      missingRefusal(`The ${accessibleName.toLowerCase()}`, solved.missing),
      size,
    );
  }
  if (solved.kind === 'undefined') {
    if (solved.reason === 'incompleteModel') {
      return missingValue(
        id,
        label,
        unit,
        accessibleName,
        missingRefusal(`The ${accessibleName.toLowerCase()}`, solved.inputs),
        size,
      );
    }
    return undefinedValue(
      id,
      label,
      unit,
      accessibleName,
      undefinedRefusal(`The ${accessibleName.toLowerCase()}`, solved.reason),
      size,
    );
  }
  return {
    id,
    label,
    value: format(solved.value),
    unit,
    provenance: provenanceForSolved(solved),
    band,
    bandReason,
    accessibleName,
    size,
  };
}

/** D-13: the estimate's own interval, printed beside the half-width it implies. */
function formatDampingBand(value: number, band: Band): string {
  const halfWidth = (band.high - band.low) / 2;
  const percent = value === 0 ? 0 : (halfWidth / Math.abs(value)) * 100;
  return `±${percent.toFixed(0)} % [${band.low.toFixed(2)}, ${band.high.toFixed(2)}]`;
}

/** The ratio is re-evaluated at ±5 mm of wheel travel; this is that interval. */
function formatRatioBand(band: Band): string {
  return `±${((band.high - band.low) / 2).toFixed(4)} at ±5 mm`;
}

function settingsFor(
  model: CarModelDocument,
  baseline: CarModelDocument,
  axle: Axle,
  cornerKey: CornerKey,
  damperCoefficientNsPerM: number | null,
): ShockSettings {
  const axleDocument = model.axles[axle];
  const corner = model.corners[cornerKey];
  const baseCorner = baseline.corners[cornerKey];
  const baseY = (point: 'damper_lo' | 'damper_up'): number | null =>
    baseCorner?.points[point]?.value[1] ?? null;
  const currentY = (point: 'damper_lo' | 'damper_up'): number | null =>
    corner?.points[point]?.value[1] ?? null;
  const offset = (point: 'damper_lo' | 'damper_up'): number | null => {
    const base = baseY(point);
    const current = currentY(point);
    return base === null || current === null ? null : current - base;
  };

  return {
    springRateNmm: axleDocument?.springRate?.value ?? null,
    damperCoefficientNsPerM,
    damperCoefficientIsStatedDefault: corner?.damper?.cPost == null,
    arbType: axleDocument?.arb?.type ?? 'none',
    arbDiameterMm: axleDocument?.arb?.barDiameter?.value ?? null,
    arbSpanMm: axleDocument?.arb?.span?.value ?? null,
    arbArmLengthMm: axleDocument?.arb?.armLength?.value ?? null,
    arbBlades: axleDocument?.arb?.blades?.value ?? null,
    damperLoOffsetMm: offset('damper_lo'),
    damperUpOffsetMm: offset('damper_up'),
  };
}

function buildColumn(
  model: CarModelDocument,
  baseline: CarModelDocument,
  axle: Axle,
  includeInstantCentre: boolean,
  edited: boolean,
  roll: RollStiffnessResult | null,
  rollRefusal: string | null,
): ShockColumn {
  const cornerKey = cornerKeyForAxle(axle);
  const axleLabel = axle === 'front' ? 'Front' : 'Rear';
  const axleName = axleLabel.toLowerCase();

  const ratesResult = buildAxleRates(model, axle);
  const rates = ratesResult.ok ? ratesResult.value : null;
  const ratesRefusal = ratesResult.ok
    ? null
    : (() => {
        const refs = ratesResult.errors.map((error) => error.path);
        return `The ${axleName} rates need ${missingCopy(refs)}. ${missingAdvice(refs)}`;
      })();

  const motionRatioText =
    rates !== null && rates.installationRatio.kind === 'defined'
      ? formatInstallationRatio(rates.installationRatio.value, 3)
      : null;

  const viewInput = buildFrontViewInput(model, cornerKey);
  let scene: FrontViewScene | null = null;
  let labels: SceneLabels | null = null;
  let drawingRefusal: string | null = null;
  if (viewInput.ok) {
    const view = solveFrontView(viewInput.value);
    scene = buildFrontViewScene(viewInput.value, view, { includeInstantCentre });
    labels = buildSceneLabels(model, axle, scene, view, edited, {
      axleOnly: true,
      damperMotionRatio: motionRatioText,
    });
  } else {
    const refs = viewInput.errors.map((error) => error.path);
    drawingRefusal = `The ${axleName} drawing needs ${missingCopy(refs)}. ${missingAdvice(refs)}`;
  }

  const missingRates = (label: string, unit: string, id: string, size: 'large' | 'medium' = 'medium') =>
    missingValue(
      id,
      label,
      unit,
      `${axleLabel} ${label.toLowerCase()}`,
      ratesRefusal ??
        `The ${axleName} ${label.toLowerCase()} needs a complete rate set. Measure the corner on Geometry, then set the rate on Shock.`,
      size,
    );

  const wheelRate =
    rates === null
      ? missingRates('Wheel rate', WHEEL_RATE_UNIT, 'wheel-rate', 'large')
      : solvedValue(
          'wheel-rate',
          'Wheel rate',
          WHEEL_RATE_UNIT,
          `${axleLabel} wheel rate`,
          rates.wheelRate,
          (value) => formatWheelRateValue(value),
          null,
          'the rates solve stores no wheel-rate tolerance',
          'large',
        );

  const rideFrequency =
    rates === null
      ? missingRates('Ride frequency', RIDE_FREQUENCY_UNIT, 'ride-frequency', 'large')
      : solvedValue(
          'ride-frequency',
          'Ride frequency',
          RIDE_FREQUENCY_UNIT,
          `${axleLabel} ride frequency`,
          rates.rideFrequency,
          (value) => formatRideFrequencyValue(value),
          null,
          'the rates solve stores no ride-frequency tolerance',
          'large',
        );

  const dampingInput = buildDampingRatioInput(
    model,
    axle,
    rates === null ? notMeasured([]) : rates.criticalDamping,
  );
  const damping = rates === null ? null : solveDampingRatio(dampingInput);
  const dampingRatio =
    damping === null
      ? missingRates('Damping ratio', DAMPING_RATIO_UNIT, 'damping-ratio', 'large')
      : solvedValue(
          'damping-ratio',
          'Damping ratio',
          DAMPING_RATIO_UNIT,
          `${axleLabel} damping ratio`,
          damping.dampingRatio,
          (value) => formatFixedNumber(value, 2),
          damping.dampingRatio.kind === 'defined' && damping.dampingRatio.band !== null
            ? formatDampingBand(damping.dampingRatio.value, damping.dampingRatio.band)
            : null,
          'a firm coefficient stores no tolerance',
          'large',
        );

  const motionRatio =
    rates === null
      ? missingRates('Motion ratio', '', 'motion-ratio')
      : solvedValue(
          'motion-ratio',
          'Motion ratio',
          '',
          `${axleLabel} motion ratio`,
          rates.installationRatio,
          (value) => formatInstallationRatio(value, 3),
          rates.installationRatio.kind === 'defined' && rates.installationRatio.band !== null
            ? formatRatioBand(rates.installationRatio.band)
            : null,
          'the ratio is evaluated at ±5 mm of wheel travel',
        );

  const criticalDamping =
    rates === null
      ? missingRates('Critical damping', CRITICAL_DAMPING_UNIT, 'critical-damping')
      : solvedValue(
          'critical-damping',
          'Critical damping',
          CRITICAL_DAMPING_UNIT,
          `${axleLabel} critical damping`,
          rates.criticalDamping,
          (value) => formatCriticalDampingValue(value),
          null,
          'the rates solve stores no critical-damping tolerance',
        );

  const rollAxle = roll === null ? null : roll[axle];
  const arbWheelRate =
    rollAxle === null
      ? missingValue(
          'arb-wheel-rate',
          'ARB wheel rate',
          WHEEL_RATE_UNIT,
          `${axleLabel} ARB wheel rate`,
          rollRefusal ??
            `The ${axleName} bar rate needs the bar geometry and motion ratio. Measure the corner on Geometry, then set the rate on Shock.`,
        )
      : solvedValue(
          'arb-wheel-rate',
          'ARB wheel rate',
          WHEEL_RATE_UNIT,
          `${axleLabel} ARB wheel rate`,
          rollAxle.antiRollBar.wheelRate,
          (value) => formatWheelRateValue(value, 3),
          null,
          'the bar solve stores no wheel-rate tolerance',
        );

  const axleRollStiffness =
    rollAxle === null
      ? missingValue(
          'axle-roll-stiffness',
          'Axle roll stiffness',
          ROLL_STIFFNESS_UNIT,
          `${axleLabel} axle roll stiffness`,
          rollRefusal ??
            `The ${axleName} roll stiffness needs the spring rate and track. Measure the corner on Geometry, then set the rate on Shock.`,
        )
      : solvedValue(
          'axle-roll-stiffness',
          'Axle roll stiffness',
          ROLL_STIFFNESS_UNIT,
          `${axleLabel} axle roll stiffness`,
          rollAxle.rollStiffness,
          (value) => formatRollStiffnessValue(value),
          null,
          'the roll solve stores no stiffness tolerance',
        );

  return {
    axle,
    cornerKey,
    scene,
    labels,
    refusal: [drawingRefusal, ratesRefusal].filter((part) => part !== null).join(' ') || null,
    edited,
    wheelRate,
    rideFrequency,
    dampingRatio,
    motionRatio,
    criticalDamping,
    arbWheelRate,
    axleRollStiffness,
    settings: settingsFor(
      model,
      baseline,
      axle,
      cornerKey,
      dampingInput.wheelCoefficient_NsPerM.value,
    ),
  };
}

export function buildShockPage(
  model: CarModelDocument,
  baseline: CarModelDocument,
  includeInstantCentre: boolean,
  editedCorners: ReadonlySet<CornerKey>,
  editedRateAxles: ReadonlySet<Axle>,
): ShockPageData {
  const rollInput = buildRollStiffnessInput(model);
  const roll = rollInput.ok ? solveRollStiffness(rollInput.value) : null;
  const rollRefusal = rollInput.ok
    ? null
    : (() => {
        const refs = rollInput.errors.map((error) => error.path);
        return `The roll stiffness needs ${missingCopy(refs)}. ${missingAdvice(refs)}`;
      })();

  const frontShare: ShockValue =
    roll === null
      ? missingValue(
          'front-share',
          'Front roll-stiffness share',
          FRONT_SHARE_UNIT,
          'Front roll-stiffness share',
          rollRefusal ??
            'The front roll-stiffness share needs both axles. Measure the corners on Geometry, then set the rates on Shock.',
        )
      : solvedValue(
          'front-share',
          'Front roll-stiffness share',
          FRONT_SHARE_UNIT,
          'Front roll-stiffness share',
          roll.frontShare,
          (value) => formatFrontShareValue(value),
          null,
          'the roll solve stores no share tolerance',
        );

  return {
    columns: [
      buildColumn(
        model,
        baseline,
        'front',
        includeInstantCentre,
        editedRateAxles.has('front') || editedCorners.has('LF'),
        roll,
        rollRefusal,
      ),
      buildColumn(
        model,
        baseline,
        'rear',
        includeInstantCentre,
        editedRateAxles.has('rear') || editedCorners.has('LR'),
        roll,
        rollRefusal,
      ),
    ],
    frontShare,
  };
}
