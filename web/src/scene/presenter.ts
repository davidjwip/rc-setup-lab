import type {
  AntiDiveCurve,
  CamberInSteerSeries,
  CamberSeries,
  ToeSeries,
} from '@setuplab/physics';
import {
  formatAngleDegrees,
  formatAntiDivePercent,
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

export interface AntiDiveChartView {
  readonly antiDivePoints: readonly ChartPoint[];
  readonly antiSquatPoints: readonly ChartPoint[];
  readonly xTicks: readonly ChartTick[];
  readonly yTicks: readonly ChartTick[];
  readonly domain: ChartDomain;
  readonly zeroY: number;
  readonly xAxisLabel: string;
  readonly yAxisLabel: string;
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

/**
 * Anti-dive on the braking side (negative a_x) and anti-squat on the
 * acceleration side (positive a_x), as one curve against longitudinal g.
 */
export interface CamberSteerLine {
  readonly label: string;
  readonly role: 'inside' | 'outside';
  readonly points: readonly ChartPoint[];
}

export interface CamberSteerChartView {
  readonly lines: readonly CamberSteerLine[];
  readonly xTicks: readonly ChartTick[];
  readonly yTicks: readonly ChartTick[];
  readonly domain: ChartDomain;
  readonly xAxisLabel: string;
  readonly yAxisLabel: string;
  readonly description: string;
  readonly atTwentyLabel: string;
}

/**
 * Two wheels on one plot. At a positive steer angle the car turns left, so the
 * left wheel is inside and the right wheel is outside; the series themselves
 * are per-wheel and keep their sign convention.
 */
export function buildCamberSteerChart(
  left: CamberInSteerSeries,
  right: CamberInSteerSeries,
): CamberSteerChartView {
  const lines: CamberSteerLine[] = [
    {
      label: 'inside (LF)',
      role: 'inside',
      points: left.samples.map((sample) => ({ x: sample.steer_rad, y: sample.camber_rad })),
    },
    {
      label: 'outside (RF)',
      role: 'outside',
      points: right.samples.map((sample) => ({ x: sample.steer_rad, y: sample.camber_rad })),
    },
  ];
  const values = lines.flatMap((line) => line.points.map((point) => point.y));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max((rawMax - rawMin) * 0.12, 0.002);
  const minY = rawMin - padding;
  const maxY = rawMax + padding;
  const middleY = (minY + maxY) / 2;
  const minX = left.samples[0]?.steer_rad ?? 0;
  const last = left.samples[left.samples.length - 1];
  const maxX = last?.steer_rad ?? 0;

  const at = (series: CamberInSteerSeries, degrees: number): CamberInSteerSeries['samples'][number] | undefined =>
    series.samples.find(
      (sample) => Math.abs((sample.steer_rad * 180) / Math.PI - degrees) < 1e-9,
    );
  const leftTwenty = at(left, 20);
  const rightTwenty = at(right, 20);
  const atTwentyLabel =
    leftTwenty === undefined || rightTwenty === undefined
      ? '20° steer not sampled'
      : `at 20°: inside ${formatAngleDegrees(leftTwenty.camber_rad)}, outside ${formatAngleDegrees(
          rightTwenty.camber_rad,
        )}`;

  return {
    lines,
    xTicks: [0, 10, 20, 30].map((degrees) => ({
      value: (degrees * Math.PI) / 180,
      label: `${degrees}°`,
    })),
    yTicks: [minY, middleY, maxY].map((value) => ({
      value,
      label: formatAngleDegrees(value, 1),
    })),
    domain: { minX, maxX, minY, maxY },
    xAxisLabel: 'steer (°, + = left)',
    yAxisLabel: 'camber change (°)',
    description: `Camber change against steer for both front wheels, from 0 to 30 degrees. Positive steer turns the car left, so LF is the inside wheel and RF is outside. Positive camber is top outboard. ${atTwentyLabel}.`,
    atTwentyLabel,
  };
}

export function buildAntiDiveChart(curve: AntiDiveCurve): AntiDiveChartView {
  const antiDivePoints: ChartPoint[] = [];
  const antiSquatPoints: ChartPoint[] = [];
  for (const sample of curve.samples) {
    if (sample.acceleration_mps2 <= 0 && sample.antiDivePercent.kind === 'defined') {
      antiDivePoints.push({
        x: sample.acceleration_mps2,
        y: sample.antiDivePercent.value,
      });
    }
    if (sample.acceleration_mps2 >= 0 && sample.antiSquatPercent.kind === 'defined') {
      antiSquatPoints.push({
        x: sample.acceleration_mps2,
        y: sample.antiSquatPercent.value,
      });
    }
  }

  const values = [...antiDivePoints, ...antiSquatPoints].map((point) => point.y);
  const rawMin = values.length === 0 ? 0 : Math.min(...values);
  const rawMax = values.length === 0 ? 0 : Math.max(...values);
  const padding = Math.max((rawMax - rawMin) * 0.1, 1);
  const minY = rawMin - padding;
  const maxY = rawMax + padding;
  const middleY = (minY + maxY) / 2;
  const minX = curve.minAcceleration_mps2;
  const maxX = curve.maxAcceleration_mps2;
  const g = 9.81;

  return {
    antiDivePoints,
    antiSquatPoints,
    xTicks: [minX, minX / 2, 0, maxX / 2, maxX].map((value) => ({
      value,
      label: `${(value / g).toFixed(1)} g`,
    })),
    yTicks: [minY, middleY, maxY].map((value) => ({
      value,
      label: formatAntiDivePercent(value, 0),
    })),
    domain: { minX, maxX, minY, maxY },
    zeroY: 0,
    xAxisLabel: 'longitudinal acceleration (g, + = accelerating)',
    yAxisLabel: 'anti-dive / anti-squat (%)',
    description:
      'Anti-dive on the braking side and anti-squat on the acceleration side, plotted against longitudinal acceleration. Evaluated at the traction limit; caster enters through the upper link, not as a separate axis term.',
  };
}
