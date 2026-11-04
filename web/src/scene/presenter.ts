import type { CamberSeries, ToeSeries } from '@setuplab/physics';
import {
  formatAngleDegrees,
  formatLengthFromMetres,
  formatToeGain,
} from '../format/format.js';

/** Chart coordinates stay SI: metres on x, radians on y. Labels carry the display units. */
export interface ChartPoint {
  readonly x: number;
  readonly y: number;
}

export interface ChartTick {
  readonly value: number;
  readonly label: string;
}

export interface ChartDomain {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface ToeChartView {
  readonly points: readonly ChartPoint[];
  readonly staticPoint: ChartPoint;
  readonly staticLabel: string;
  readonly xTicks: readonly ChartTick[];
  readonly yTicks: readonly ChartTick[];
  readonly domain: ChartDomain;
  readonly xAxisLabel: string;
  readonly yAxisLabel: string;
  readonly gainLabel: string;
  readonly directionLabel: string;
  readonly description: string;
}

export interface CamberChartView {
  readonly points: readonly ChartPoint[];
  readonly staticPoint: ChartPoint;
  readonly staticLabel: string;
  readonly xTicks: readonly ChartTick[];
  readonly yTicks: readonly ChartTick[];
  readonly domain: ChartDomain;
  readonly xAxisLabel: string;
  readonly yAxisLabel: string;
  readonly description: string;
}

function lengthTicks(min: number, max: number): readonly ChartTick[] {
  const middle = (min + max) / 2;
  return [min, middle, max].map((value) => ({
    value,
    label: formatLengthFromMetres(value, 0),
  }));
}

/**
 * Convert the solver's SI series into chart furniture: tick labels are strings
 * from `web/src/format/`, geometry stays in SI. The component maps numbers to
 * the viewBox and nothing else.
 */
export function buildCamberChart(series: CamberSeries): CamberChartView {
  const camberValues = series.samples.map((sample) => sample.camber_rad);
  const minCamber = Math.min(...camberValues);
  const maxCamber = Math.max(...camberValues);
  const padding = Math.max((maxCamber - minCamber) * 0.1, 0.001);

  const minY = minCamber - padding;
  const maxY = maxCamber + padding;
  const middleY = (minY + maxY) / 2;

  const points = series.samples.map((sample) => ({
    x: sample.bump_m,
    y: sample.camber_rad,
  }));

  const staticPoint = {
    x: series.staticSample.bump_m,
    y: series.staticSample.camber_rad,
  };

  return {
    points,
    staticPoint,
    staticLabel: formatAngleDegrees(series.staticSample.camber_rad, 2),
    xTicks: lengthTicks(series.bumpRange_m.min, series.bumpRange_m.max),
    yTicks: [minY, middleY, maxY].map((value) => ({
      value,
      label: formatAngleDegrees(value, 1),
    })),
    domain: {
      minX: series.bumpRange_m.min,
      maxX: series.bumpRange_m.max,
      minY,
      maxY,
    },
    xAxisLabel: 'wheel travel (mm)',
    yAxisLabel: 'camber (°)',
    description: `Camber against wheel travel, from ${formatLengthFromMetres(
      series.bumpRange_m.min,
      0,
    )} to ${formatLengthFromMetres(series.bumpRange_m.max, 0)}; static camber ${formatAngleDegrees(
      series.staticSample.camber_rad,
      2,
    )}.`,
  };
}

export function buildToeChart(series: ToeSeries): ToeChartView {
  const toeValues = series.samples.map((sample) => sample.toe_rad);
  const minToe = Math.min(...toeValues);
  const maxToe = Math.max(...toeValues);
  const padding = Math.max((maxToe - minToe) * 0.1, 0.0005);

  const minY = minToe - padding;
  const maxY = maxToe + padding;
  const middleY = (minY + maxY) / 2;

  const points = series.samples.map((sample) => ({
    x: sample.bump_m,
    y: sample.toe_rad,
  }));

  const staticPoint = {
    x: series.staticSample.bump_m,
    y: series.staticSample.toe_rad,
  };

  const gainLabel =
    series.gain_radPerM.kind === 'defined'
      ? formatToeGain(series.gain_radPerM.value)
      : 'gain not defined';
  const directionLabel =
    series.direction === 'toe-in'
      ? 'toe-in in compression'
      : series.direction === 'toe-out'
        ? 'toe-out in compression'
        : 'no change across travel';

  return {
    points,
    staticPoint,
    staticLabel: formatAngleDegrees(series.staticSample.toe_rad, 2),
    xTicks: lengthTicks(series.bumpRange_m.min, series.bumpRange_m.max),
    yTicks: [minY, middleY, maxY].map((value) => ({
      value,
      label: formatAngleDegrees(value, 2),
    })),
    domain: {
      minX: series.bumpRange_m.min,
      maxX: series.bumpRange_m.max,
      minY,
      maxY,
    },
    xAxisLabel: 'wheel travel (mm)',
    yAxisLabel: 'toe (°, + = toe-in)',
    gainLabel,
    directionLabel,
    description: `Toe against wheel travel, from ${formatLengthFromMetres(
      series.bumpRange_m.min,
      0,
    )} to ${formatLengthFromMetres(series.bumpRange_m.max, 0)}. Positive toe is toe-in. ${gainLabel}; ${directionLabel}.`,
  };
}
