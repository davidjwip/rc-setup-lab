import {
  absoluteCornerPointMm,
  buildFrontViewInput,
  buildToeInput,
  reportedRollCentreHeightM,
  type CarModelDocument,
  type CornerKey,
} from '@setuplab/data';
import {
  buildCamberSeries,
  buildFrontViewScene,
  buildToeSeries,
  solveFrontView,
  type FrontViewScene,
  type Solved,
  type ToeSeriesResult,
} from '@setuplab/physics';
import type { Axle } from '../editor/hardpoints.js';
import { cornerKeyForAxle } from '../editor/hardpoints.js';
import {
  SHIM_BAND_MM,
  hingeAngleBandDegrees,
  hingeAngleDegrees,
} from '../editor/shim.js';
import {
  CAMBER_GAIN_UNIT,
  LENGTH_UNIT,
  TOE_GAIN_UNIT,
  formatBandFromDegrees,
  formatBandFromMetres,
  formatCamberGainValue,
  formatFixedNumber,
  formatRollCentreHeightValue,
  formatSignedNumber,
  formatToeGainValue,
} from '../format/format.js';
import { buildCamberChart, buildToeChart, type CamberChartView, type ToeChartView } from '../scene/presenter.js';
import type { SceneLabels } from '../scene/FrontViewScene.js';
import { buildSceneLabels } from '../view/endSummary.js';
import type { ValueProvenance } from '../view/Value.js';
import {
  provenanceForConfidences,
  provenanceForSolved,
} from '../view/provenance.js';

export interface GeometryValue {
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
}

export interface GeometryColumn {
  readonly axle: Axle;
  readonly cornerKey: CornerKey;
  readonly scene: FrontViewScene | null;
  readonly labels: SceneLabels | null;
  readonly camber: CamberChartView | null;
  readonly toe: ToeChartView | null;
  readonly rollCentre: GeometryValue;
  readonly camberGain: GeometryValue;
  readonly toeGain: GeometryValue;
  readonly span: GeometryValue;
  readonly shim: GeometryValue;
  readonly hingeAngle: GeometryValue;
  readonly shimInput: {
    readonly valueMm: number;
    readonly baseMidpointMm: number | null;
    readonly spanMm: number | null;
  };
  readonly refusal: string | null;
}

const REASON_COPY: Readonly<Record<string, string>> = {
  parallelLinks: 'the upper and lower links are parallel in this view',
  degenerateGeometry: 'two points coincide or a link has zero length',
  coincidentPoints: 'two points coincide',
  outOfTravel: 'the wheel is outside its modelled travel',
  incompleteModel: 'a required measurement is missing',
  noIntersection: 'the links do not meet in a usable instant centre',
  outOfDomain: 'the geometry has no finite answer',
  noBumpSteerSolution: 'the toe link has no usable solution at this travel',
  noSteeringAxis: 'the corner has no steering axis',
  zeroLateral: 'there is no lateral load to solve',
  noRollStiffness: 'the roll stiffness is not available',
  noAntiGeometry: 'the anti-dive geometry is not available',
  noSideViewConstruction: 'the side-view construction is not available',
  noMotionRatio: 'the motion ratio is not available',
  ambiguousBranch: 'the linkage has more than one assembly branch',
  outOfRackTravel: 'the rack is outside its travel',
};

export function undefinedReasonCopy(reason: string): string {
  return REASON_COPY[reason] ?? 'the geometry has no answer';
}

function missingTerm(ref: string): string {
  if (ref.includes('lca_in')) return 'the lower arm inner screw heights';
  if (ref.includes('lca_out')) return 'the lower ball joint';
  if (ref.includes('uca_out')) return 'the upper ball stud';
  if (ref.includes('uca_in')) return 'the upper link inner point';
  if (ref.includes('tie_')) return 'the tie rod';
  if (ref.includes('damper_lo') || ref.includes('damper_up')) return 'the damper mount points';
  if (ref.includes('spring.rate')) return 'the spring rate';
  if (ref.includes('sprung_')) return 'the sprung mass';
  if (ref.includes('rate_at_link')) return "the blade's rate at the link";
  if (ref.includes('arb.blades')) return 'the blade count';
  if (ref.includes('bar_diameter')) return 'the bar diameter';
  if (ref.includes('arb.span')) return 'the bar span';
  if (ref.includes('arm_length')) return 'the bar arm length';
  if (ref.includes('arb.')) return 'the anti-roll bar geometry';
  if (ref.includes('bump_limit')) return 'the bump limit';
  if (ref.includes('droop_limit')) return 'the droop limit';
  if (ref.includes('thickness')) return 'the chassis plate thickness';
  if (ref.includes('ride_height')) return 'the ride height';
  if (ref.includes('wheelbase')) return 'the wheelbase';
  if (ref.includes('tyre_radius')) return 'the tyre radius';
  return 'a required measurement';
}

export function missingCopy(refs: readonly string[]): string {
  const terms = [...new Set(refs.map(missingTerm))];
  if (terms.length === 0) return 'a required measurement';
  if (terms.length === 1) return terms[0] ?? 'a required measurement';
  return `${terms.slice(0, -1).join(', ')} and ${terms[terms.length - 1]}`;
}

function missingValue(
  id: string,
  label: string,
  unit: string,
  accessibleName: string,
  reason: string,
): GeometryValue {
  return {
    id,
    label,
    value: null,
    unit,
    provenance: 'missing',
    band: null,
    bandReason: 'not a number',
    reason,
    accessibleName,
    size: 'large',
  };
}

function undefinedValue(
  id: string,
  label: string,
  unit: string,
  accessibleName: string,
  reason: string,
): GeometryValue {
  return {
    id,
    label,
    value: null,
    unit,
    provenance: 'undefined',
    band: null,
    bandReason: 'not a number',
    reason,
    accessibleName,
    size: 'large',
  };
}

function solvedHeadline(
  id: string,
  label: string,
  unit: string,
  accessibleName: string,
  solved: Solved<number>,
  format: (value: number) => string,
  band: string | null,
  bandReason: string,
  reason: string,
): GeometryValue {
  if (solved.kind !== 'defined') {
    return solved.kind === 'notMeasured'
      ? missingValue(id, label, unit, accessibleName, reason)
      : undefinedValue(
          id,
          label,
          unit,
          accessibleName,
          `${label} is undefined because ${undefinedReasonCopy(solved.reason)}.`,
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
    size: 'large',
  };
}

function toeSeriesRefusal(toeSeries: ToeSeriesResult | null, axleLabel: string): GeometryValue {
  if (toeSeries === null) {
    return missingValue(
      'toe-gain',
      'Toe gain',
      TOE_GAIN_UNIT,
      `${axleLabel} toe gain`,
      `The ${axleLabel.toLowerCase()} toe gain needs the tie rod and its endpoints.`,
    );
  }
  if (toeSeries.kind === 'unavailable') {
    return undefinedValue(
      'toe-gain',
      'Toe gain',
      TOE_GAIN_UNIT,
      `${axleLabel} toe gain`,
      `The ${axleLabel.toLowerCase()} toe gain is undefined because ${undefinedReasonCopy(
        toeSeries.reason,
      )}.`,
    );
  }
  return solvedHeadline(
    'toe-gain',
    'Toe gain',
    TOE_GAIN_UNIT,
    `${axleLabel} toe gain`,
    toeSeries.gain_radPerM,
    (value) => formatToeGainValue(value),
    null,
    'the toe solve stores no tolerance',
    `The ${axleLabel.toLowerCase()} toe gain needs the tie rod and its endpoints.`,
  );
}

export function buildGeometryColumn(
  model: CarModelDocument,
  axle: Axle,
  includeInstantCentre: boolean,
  edited: boolean,
): GeometryColumn {
  const cornerKey = cornerKeyForAxle(axle);
  const axleLabel = axle === 'front' ? 'Front' : 'Rear';
  const inputResult = buildFrontViewInput(model, cornerKey);

  let scene: FrontViewScene | null = null;
  let labels: SceneLabels | null = null;
  let camber: CamberChartView | null = null;
  let toe: ToeChartView | null = null;
  let rollCentre: GeometryValue;
  let camberGain: GeometryValue;
  let toeGain: GeometryValue;
  let refusal: string | null = null;

  const toeInput = buildToeInput(model, cornerKey);
  const toeSeries = toeInput.ok ? buildToeSeries(toeInput.value) : null;
  if (toeSeries !== null && toeSeries.kind === 'series') {
    toe = buildToeChart(toeSeries);
  }
  toeGain = toeSeriesRefusal(toeSeries, axleLabel);

  if (!inputResult.ok) {
    refusal = `The ${axleLabel.toLowerCase()} drawing needs ${missingCopy(
      inputResult.errors.map((error) => error.path),
    )}.`;
    rollCentre = missingValue(
      'roll-centre',
      'Roll-centre height',
      LENGTH_UNIT,
      `${axleLabel} roll-centre height`,
      refusal,
    );
    camberGain = missingValue(
      'camber-gain',
      'Camber gain',
      CAMBER_GAIN_UNIT,
      `${axleLabel} camber gain`,
      refusal,
    );
  } else {
    const result = solveFrontView(inputResult.value);
    scene = buildFrontViewScene(inputResult.value, result, { includeInstantCentre });
    labels = buildSceneLabels(model, axle, scene, result, edited, { axleOnly: true });

    const reported = reportedRollCentreHeightM(model, result);
    rollCentre = solvedHeadline(
      'roll-centre',
      'Roll-centre height',
      LENGTH_UNIT,
      `${axleLabel} roll-centre height`,
      result.rollCentreHeight,
      (value) => formatRollCentreHeightValue(reported ?? value),
      result.rollCentreHeight.kind === 'defined' && result.rollCentreHeight.band !== null
        ? formatBandFromMetres(result.rollCentreHeight.band)
        : null,
      'the model stores no roll-centre tolerance',
      `The ${axleLabel.toLowerCase()} roll centre needs a complete hardpoint set.`,
    );
    camberGain = solvedHeadline(
      'camber-gain',
      'Camber gain',
      CAMBER_GAIN_UNIT,
      `${axleLabel} camber gain`,
      result.camberGain,
      (value) => formatCamberGainValue(value),
      null,
      'the camber-gain solve stores no tolerance',
      `The ${axleLabel.toLowerCase()} camber gain needs a complete hardpoint set.`,
    );

    const camberSeries = buildCamberSeries(inputResult.value);
    if (camberSeries.kind === 'series') {
      camber = buildCamberChart(camberSeries);
    }
  }

  const fore = absoluteCornerPointMm(model, cornerKey, 'lca_in_a');
  const aft = absoluteCornerPointMm(model, cornerKey, 'lca_in_b');
  let spanMm: number | null = null;
  let shimMm = 0;
  let baseMidpointMm: number | null = null;
  let span: GeometryValue;

  if (fore === null || aft === null) {
    const reason = `The ${axleLabel.toLowerCase()} hinge needs both inner pivot screws.`;
    span = {
      id: 'span',
      label: 'Span between the screws',
      value: null,
      unit: LENGTH_UNIT,
      provenance: 'missing',
      band: null,
      bandReason: 'not a number',
      reason,
      accessibleName: `${axleLabel} lower-arm inner screw span`,
      size: 'medium',
    };
  } else {
    spanMm = Math.abs(aft.value[0] - fore.value[0]);
    baseMidpointMm = (fore.value[2] + aft.value[2]) / 2;
    shimMm = aft.value[2] - fore.value[2];
    const spanProvenance = provenanceForConfidences([fore.confidence, aft.confidence]);
    span =
      spanMm > 0
        ? {
            id: 'span',
            label: 'Span between the screws',
            value: formatFixedNumber(spanMm, 1),
            unit: LENGTH_UNIT,
            provenance: spanProvenance,
            band: null,
            bandReason: 'the model stores the screw positions, not a tolerance',
            accessibleName: `${axleLabel} lower-arm inner screw span`,
            size: 'medium',
          }
        : {
            id: 'span',
            label: 'Span between the screws',
            value: null,
            unit: LENGTH_UNIT,
            provenance: 'undefined',
            band: null,
            bandReason: 'not a number',
            reason: 'The two inner screws share the same fore-aft position, so there is no span to divide.',
            accessibleName: `${axleLabel} lower-arm inner screw span`,
            size: 'medium',
          };
  }

  const shim: GeometryValue =
    fore === null || aft === null
      ? {
          id: 'shim',
          label: 'Shim',
          value: null,
          unit: LENGTH_UNIT,
          provenance: 'missing',
          band: null,
          bandReason: 'not a number',
          reason: `The ${axleLabel.toLowerCase()} shim needs both inner pivot screws.`,
          accessibleName: `${axleLabel} lower-arm inner shim`,
          size: 'medium',
        }
      : {
          id: 'shim',
          label: 'Shim',
          value: formatSignedNumber(shimMm, 1),
          unit: LENGTH_UNIT,
          provenance: 'estimated',
          band: `±${SHIM_BAND_MM.toFixed(2)} ${LENGTH_UNIT}`,
          bandReason: 'the value is entered to 0.1 mm',
          accessibleName: `${axleLabel} lower-arm inner shim, positive raises the aft screw`,
          size: 'medium',
        };

  let hingeAngle: GeometryValue;
  if (fore === null || aft === null) {
    hingeAngle = {
      id: 'hinge-angle',
      label: 'Hinge angle',
      value: null,
      unit: '°',
      provenance: 'missing',
      band: null,
      bandReason: 'not a number',
      reason: `The ${axleLabel.toLowerCase()} hinge angle needs both inner pivot screws.`,
      accessibleName: `${axleLabel} lower-arm hinge angle`,
      size: 'medium',
    };
  } else if (spanMm === null || spanMm <= 0) {
    hingeAngle = {
      id: 'hinge-angle',
      label: 'Hinge angle',
      value: null,
      unit: '°',
      provenance: 'undefined',
      band: null,
      bandReason: 'not a number',
      reason: 'The two inner screws share the same fore-aft position, so there is no hinge axis to tilt.',
      accessibleName: `${axleLabel} lower-arm hinge angle`,
      size: 'medium',
    };
  } else {
    const angle = hingeAngleDegrees(shimMm, spanMm);
    const band = hingeAngleBandDegrees(shimMm, spanMm);
    hingeAngle =
      angle === null || band === null
        ? {
            id: 'hinge-angle',
            label: 'Hinge angle',
            value: null,
            unit: '°',
            provenance: 'undefined',
            band: null,
            bandReason: 'not a number',
            reason: 'The hinge angle has no finite answer for this span.',
            accessibleName: `${axleLabel} lower-arm hinge angle`,
            size: 'medium',
          }
        : {
            id: 'hinge-angle',
            label: 'Hinge angle',
            value: formatSignedNumber(angle, 2),
            unit: '°',
            provenance: 'estimated',
            band: formatBandFromDegrees(band),
            bandReason: 'the shim is entered to 0.1 mm',
            accessibleName: `${axleLabel} lower-arm hinge angle`,
            size: 'medium',
          };
  }

  return {
    axle,
    cornerKey,
    scene,
    labels,
    camber,
    toe,
    rollCentre,
    camberGain,
    toeGain,
    span,
    shim,
    hingeAngle,
    shimInput: { valueMm: shimMm, baseMidpointMm, spanMm },
    refusal,
  };
}
