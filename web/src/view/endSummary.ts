import {
  buildAxleRates,
  buildFrontViewInput,
  buildToeInput,
  reportedRollCentreHeightM,
  type CarModelDocument,
  type CornerKey,
} from '@setuplab/data';
import {
  buildFrontViewScene,
  buildToeSeries,
  solveFrontView,
  type Band,
  type FrontViewResult,
  type FrontViewScene,
  type RatesResult,
  type Solved,
  type ToeSeriesResult,
} from '@setuplab/physics';
import { cornerKeyForAxle, type Axle } from '../editor/hardpoints.js';
import {
  formatBandFromMetres,
  formatBandFromNpm,
  formatCamberGain,
  formatLengthFromMetres,
  formatRideFrequency,
  formatRollCentreHeight,
  formatToeGain,
  formatWheelRateFromNpm,
} from '../format/format.js';
import type { SceneLabels } from '../scene/FrontViewScene.js';

export interface EndStripEntry {
  readonly id: 'roll-centre' | 'camber-gain' | 'toe-gain' | 'wheel-rate' | 'ride-frequency';
  readonly label: string;
  readonly value: string;
  readonly band: string;
}

export interface EndPanelData {
  readonly axle: Axle;
  readonly cornerKey: CornerKey;
  readonly scene: FrontViewScene | null;
  readonly labels: SceneLabels | null;
  readonly strip: readonly EndStripEntry[];
  readonly error: string | null;
}

export function buildSceneLabels(
  model: CarModelDocument,
  axle: Axle,
  scene: FrontViewScene,
  result: FrontViewResult,
  edited: boolean,
  options: { readonly axleOnly?: boolean } = {},
): SceneLabels {
  const rollCentre = result.rollCentreHeight;
  const instantCentre = result.instantCentre;
  const reportedRollCentre = reportedRollCentreHeightM(model, result);
  const rollCentreValue =
    rollCentre.kind === 'defined' && reportedRollCentre !== null
      ? formatRollCentreHeight(reportedRollCentre)
      : 'not defined';
  const rollCentreBand =
    rollCentre.kind === 'defined' && rollCentre.band !== null
      ? formatBandFromMetres(rollCentre.band)
      : 'no band';
  const instantCentreText =
    instantCentre.kind === 'defined' && scene.instantCentre.kind === 'visible'
      ? `y ${formatLengthFromMetres(instantCentre.value.y)}, z ${formatLengthFromMetres(
          instantCentre.value.z,
        )}`
      : null;
  const side = scene.side === 1 ? 'left' : 'right';
  const axleName = axle === 'front' ? 'front' : 'rear';
  const descriptionParts = [
    options.axleOnly === true
      ? `${axle === 'front' ? 'Front' : 'Rear'}-view elevation of the ${axleName} axle.`
      : `${axle === 'front' ? 'Front' : 'Rear'}-view elevation of the ${side}-${axleName} corner.`,
    `Roll centre ${rollCentreValue} with band ${rollCentreBand}.`,
  ];
  if (scene.instantCentre.kind !== 'hidden') {
    descriptionParts.push(
      instantCentreText === null
        ? 'Instant centre not drawn.'
        : `Instant centre at ${instantCentreText}.`,
    );
  }
  if (edited) {
    descriptionParts.push('The hardpoint values are user-edited this session.');
  }

  return {
    rollCentreValue,
    rollCentreBand,
    instantCentre: instantCentreText,
    description: descriptionParts.join(' '),
  };
}

function bandFor(value: Solved<number>, format: (band: Band) => string): string {
  return value.kind === 'defined' && value.band !== null ? format(value.band) : 'no band';
}

function camberBand(band: Band): string {
  const halfWidth = (((band.high - band.low) / 2) * 180) / Math.PI / 1000;
  return `±${halfWidth.toFixed(2)} °/mm`;
}

function frequencyBand(band: Band): string {
  const halfWidth = (band.high - band.low) / 2;
  return `±${halfWidth.toFixed(2)} Hz`;
}

export function buildEndStrip(
  result: FrontViewResult,
  ratesResult: RatesResult | null,
  reportedRollCentre: number | null,
  toeSeries: ToeSeriesResult | null = null,
): readonly EndStripEntry[] {
  const rollCentre = result.rollCentreHeight;
  const camberGain = result.camberGain;
  const wheelRate = ratesResult?.wheelRate;
  const rideFrequency = ratesResult?.rideFrequency;
  const toeGain = toeSeries?.kind === 'series' ? toeSeries.gain_radPerM : null;

  return [
    {
      id: 'roll-centre',
      label: 'Roll-centre height',
      value:
        rollCentre.kind === 'defined' && reportedRollCentre !== null
          ? formatRollCentreHeight(reportedRollCentre)
          : '—',
      band: bandFor(rollCentre, formatBandFromMetres),
    },
    {
      id: 'camber-gain',
      label: 'Camber gain',
      value: camberGain.kind === 'defined' ? formatCamberGain(camberGain.value) : '—',
      band: bandFor(camberGain, camberBand),
    },
    {
      id: 'toe-gain',
      label: 'Toe gain',
      value: toeGain !== null && toeGain.kind === 'defined' ? formatToeGain(toeGain.value) : '—',
      band: 'no band',
    },
    {
      id: 'wheel-rate',
      label: 'Wheel rate',
      value: wheelRate?.kind === 'defined' ? formatWheelRateFromNpm(wheelRate.value) : '—',
      band: wheelRate === undefined ? 'no band' : bandFor(wheelRate, formatBandFromNpm),
    },
    {
      id: 'ride-frequency',
      label: 'Ride frequency',
      value: rideFrequency?.kind === 'defined' ? formatRideFrequency(rideFrequency.value) : '—',
      band:
        rideFrequency === undefined ? 'no band' : bandFor(rideFrequency, frequencyBand),
    },
  ];
}

export function buildEndPanel(
  model: CarModelDocument,
  axle: Axle,
  includeInstantCentre: boolean,
  edited: boolean,
): EndPanelData {
  const cornerKey = cornerKeyForAxle(axle);
  const inputResult = buildFrontViewInput(model, cornerKey);
  if (!inputResult.ok) {
    return {
      axle,
      cornerKey,
      scene: null,
      labels: null,
      strip: [],
      error: inputResult.errors.map((error) => `${error.path}: ${error.message}`).join('; '),
    };
  }

  const result = solveFrontView(inputResult.value);
  const scene = buildFrontViewScene(inputResult.value, result, { includeInstantCentre });
  const ratesResult = buildAxleRates(model, axle);
  const rates = ratesResult.ok ? ratesResult.value : null;
  const toeInput = buildToeInput(model, cornerKey);
  const toeSeries = toeInput.ok ? buildToeSeries(toeInput.value) : null;

  return {
    axle,
    cornerKey,
    scene,
    labels: buildSceneLabels(model, axle, scene, result, edited),
    strip: buildEndStrip(
      result,
      rates,
      reportedRollCentreHeightM(model, result),
      toeSeries,
    ),
    error: null,
  };
}
