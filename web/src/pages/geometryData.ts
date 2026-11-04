import {
  absoluteCornerPointMm,
  buildFrontViewInput,
  buildToeInput,
  hubCentreMeasured,
  reportedRollCentreHeightM,
  type CarModelDocument,
  type CornerKey,
  type CornerPointKey,
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
import type { Axle, GeometryHardpointDefinition } from '../editor/hardpoints.js';
import {
  GEOMETRY_INNER_HARDPOINTS,
  GEOMETRY_OUTBOARD_HARDPOINTS,
  cornerKeyForAxle,
} from '../editor/hardpoints.js';
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
  provenanceForConfidence,
  provenanceForConfidences,
  provenanceForSolved,
} from '../view/provenance.js';
import {
  missingAdvice,
  missingCopy,
  missingRefusal,
  undefinedRefusal,
} from '../view/refusal.js';

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
  readonly delta?: string | null;
}

export interface GeometryHardpointAxis {
  readonly axis: 1 | 2;
  readonly axisName: 'y' | 'z';
  readonly baseMm: number;
  readonly editValueMm: number | null;
  readonly value: GeometryValue;
  readonly absolute: GeometryValue;
  readonly direction: string;
  readonly edited: boolean;
}

export interface GeometryHardpointRow {
  readonly key: CornerPointKey;
  readonly label: string;
  readonly group: 'inner' | 'outboard';
  readonly xMm: number | null;
  readonly axes: readonly GeometryHardpointAxis[];
}

export interface GeometryHub {
  readonly y: GeometryValue;
  readonly z: GeometryValue;
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
  readonly innerPivots: readonly GeometryHardpointRow[];
  readonly outboardPoints: readonly GeometryHardpointRow[];
  readonly hub: GeometryHub;
  readonly refusal: string | null;
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
    bandReason: 'there is no number to compare',
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
    bandReason: 'there is no number to compare',
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
          undefinedRefusal(label, solved.reason),
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
      missingRefusal(`${axleLabel} toe gain`, ['corners.tie_in', 'corners.tie_out']),
    );
  }
  if (toeSeries.kind === 'unavailable') {
    return undefinedValue(
      'toe-gain',
      'Toe gain',
      TOE_GAIN_UNIT,
      `${axleLabel} toe gain`,
      undefinedRefusal(`${axleLabel} toe gain`, toeSeries.reason),
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
    missingRefusal(`${axleLabel} toe gain`, ['corners.tie_in', 'corners.tie_out']),
  );
}

function hardpointReading(
  id: string,
  label: string,
  value: string | null,
  provenance: GeometryValue['provenance'],
  band: string | null,
  bandReason: string,
  accessibleName: string,
  reason?: string,
): GeometryValue {
  return {
    id,
    label,
    value,
    unit: LENGTH_UNIT,
    provenance,
    band,
    bandReason,
    ...(reason === undefined ? {} : { reason }),
    accessibleName,
    size: 'medium',
  };
}

function shimDirection(key: CornerPointKey, axisName: 'y' | 'z'): string {
  if (key === 'uca_out' && axisName === 'z') {
    return '+ is up and makes camber gain more negative; − is down and makes camber gain less negative.';
  }
  if (key === 'uca_out') {
    return '+ is outboard; − is inboard.';
  }
  if (axisName === 'y') {
    return '+ is outboard; − is inboard.';
  }
  return '+ is up; − is down.';
}

function buildHardpointRow(
  model: CarModelDocument,
  baseline: CarModelDocument,
  axleLabel: string,
  cornerKey: CornerKey,
  definition: GeometryHardpointDefinition,
): GeometryHardpointRow {
  const point = model.corners[cornerKey]?.points[definition.key];
  const baselinePoint = baseline.corners[cornerKey]?.points[definition.key];
  const absolute = absoluteCornerPointMm(model, cornerKey, definition.key);
  const shim = definition.group === 'outboard';
  const axes: GeometryHardpointAxis[] = ([1, 2] as const).map((axis) => {
    const axisName = axis === 1 ? 'y' : 'z';
    const baseMm = shim ? (baselinePoint?.value[axis] ?? 0) : 0;
    const currentMm = point?.value[axis] ?? null;
    const editValueMm =
      currentMm === null ? null : shim ? currentMm - baseMm : currentMm;
    const absoluteMm = absolute?.value[axis] ?? null;
    const provenance =
      point === undefined ? 'missing' : provenanceForConfidence(point.confidence);
    const absoluteProvenance =
      absolute === null ? 'missing' : provenanceForConfidence(absolute.confidence);
    const entryName = `${axleLabel} ${definition.label}${shim ? ' shim' : ''} ${axisName}`;
    const absoluteName = `${axleLabel} ${definition.label} composed ${axisName}`;
    const edited =
      point !== undefined &&
      baselinePoint !== undefined &&
      point.value[axis] !== baselinePoint.value[axis];

    return {
      axis,
      axisName,
      baseMm,
      editValueMm,
      value: hardpointReading(
        `${definition.key}-${axisName}`,
        `${definition.label} ${axisName}`,
        editValueMm === null ? null : formatFixedNumber(editValueMm, 1),
        provenance,
        null,
        shim
          ? 'the shim offset is entered to 0.1 mm'
          : 'the model stores the hardpoint, not a tolerance',
        entryName,
        editValueMm === null
          ? `Missing: the ${definition.label.toLowerCase()} point. Measure it on Geometry.`
          : undefined,
      ),
      absolute: hardpointReading(
        `${definition.key}-absolute-${axisName}`,
        `${definition.label} absolute ${axisName}`,
        absoluteMm === null ? null : formatFixedNumber(absoluteMm, 1),
        absoluteProvenance,
        null,
        'the composed point stores no tolerance',
        absoluteName,
        absoluteMm === null
          ? `Missing: the ${definition.label.toLowerCase()} composed point. Measure the hardpoint on Geometry.`
          : undefined,
      ),
      direction: shim ? shimDirection(definition.key, axisName) : '',
      edited,
    };
  });

  return {
    key: definition.key,
    label: definition.label,
    group: definition.group,
    xMm: point?.value[0] ?? null,
    axes,
  };
}

function buildHub(model: CarModelDocument, axleLabel: string, cornerKey: CornerKey): GeometryHub {
  const hub = hubCentreMeasured(model, cornerKey);
  const provenance = hub === null ? 'missing' : provenanceForConfidence(hub.confidence);
  const reason =
    'Missing: the wheel centre. Measure the ride height, plate thickness and wheel diameter on Home.';
  return {
    y: hardpointReading(
      'hub-y',
      'Hub y',
      hub === null ? null : formatFixedNumber(hub.value[1], 1),
      provenance,
      null,
      'the hub is derived, not measured, and stores no tolerance',
      `${axleLabel} wheel centre y`,
      hub === null ? reason : undefined,
    ),
    z: hardpointReading(
      'hub-z',
      'Hub z',
      hub === null ? null : formatFixedNumber(hub.value[2], 1),
      provenance,
      null,
      'the hub is derived, not measured, and stores no tolerance',
      `${axleLabel} wheel centre z`,
      hub === null ? reason : undefined,
    ),
  };
}

export function buildGeometryColumn(
  model: CarModelDocument,
  axle: Axle,
  includeInstantCentre: boolean,
  edited: boolean,
  baseline: CarModelDocument = model,
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
    const refs = inputResult.errors.map((error) => error.path);
    refusal = `The ${axleLabel.toLowerCase()} drawing needs ${missingCopy(refs)}. ${missingAdvice(
      refs,
    )}`;
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
      `The ${axleLabel.toLowerCase()} roll centre needs a complete hardpoint set. Measure the missing point on Geometry.`,
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
      `The ${axleLabel.toLowerCase()} camber gain needs a complete hardpoint set. Measure the missing point on Geometry.`,
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
    const reason = `The ${axleLabel.toLowerCase()} hinge needs both inner pivot screws. Measure them on Geometry.`;
    span = {
      id: 'span',
      label: 'Span between the screws',
      value: null,
      unit: LENGTH_UNIT,
      provenance: 'missing',
      band: null,
      bandReason: 'there is no number to compare',
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
            bandReason: 'there is no number to compare',
            reason: 'The two inner screws share the same fore-aft position, so there is no span to divide. Separate them on Geometry.',
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
          bandReason: 'there is no number to compare',
          reason: `The ${axleLabel.toLowerCase()} shim needs both inner pivot screws. Measure them on Geometry.`,
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
      bandReason: 'there is no number to compare',
      reason: `The ${axleLabel.toLowerCase()} hinge angle needs both inner pivot screws. Measure them on Geometry.`,
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
      bandReason: 'there is no number to compare',
      reason: 'The two inner screws share the same fore-aft position, so there is no hinge axis to tilt. Separate them on Geometry.',
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
            bandReason: 'there is no number to compare',
            reason: 'The hinge angle has no finite answer for this span. Check the two inner screws on Geometry.',
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

  const innerPivots = GEOMETRY_INNER_HARDPOINTS.map((definition) =>
    buildHardpointRow(model, baseline, axleLabel, cornerKey, definition),
  );
  const outboardPoints = GEOMETRY_OUTBOARD_HARDPOINTS.map((definition) =>
    buildHardpointRow(model, baseline, axleLabel, cornerKey, definition),
  );

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
    innerPivots,
    outboardPoints,
    hub: buildHub(model, axleLabel, cornerKey),
    refusal,
  };
}
