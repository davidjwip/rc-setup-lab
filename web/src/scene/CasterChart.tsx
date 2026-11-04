import type { CamberSteerChartView } from './presenter.js';

interface CasterChartProps {
  readonly view: CamberSteerChartView;
}

const WIDTH = 340;
const HEIGHT = 175;
const PADDING = { left: 52, right: 12, top: 12, bottom: 38 };

export function CasterChart({ view }: CasterChartProps) {
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const spanX = view.domain.maxX - view.domain.minX;
  const spanY = view.domain.maxY - view.domain.minY;

  const xOf = (x: number): number => PADDING.left + ((x - view.domain.minX) / spanX) * plotWidth;
  const yOf = (y: number): number =>
    PADDING.top + ((view.domain.maxY - y) / spanY) * plotHeight;

  const line = (points: readonly { readonly x: number; readonly y: number }[]): string =>
    points.map((point) => `${xOf(point.x)},${yOf(point.y)}`).join(' ');

  return (
    <figure className="camber-figure">
      <figcaption className="camber-caption">
        <span>Camber in steer</span>
        <span>{view.atTwentyLabel}</span>
      </figcaption>
      <svg
        className="camber-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={view.description}
      >
        <title>{view.description}</title>

        <line
          className="camber-axis"
          x1={PADDING.left}
          y1={PADDING.top}
          x2={PADDING.left}
          y2={PADDING.top + plotHeight}
        />
        <line
          className="camber-axis"
          x1={PADDING.left}
          y1={PADDING.top + plotHeight}
          x2={PADDING.left + plotWidth}
          y2={PADDING.top + plotHeight}
        />
        <line
          className="camber-axis"
          x1={PADDING.left}
          y1={yOf(0)}
          x2={PADDING.left + plotWidth}
          y2={yOf(0)}
        />

        {view.xTicks.map((tick) => (
          <g key={`x-${tick.value}`}>
            <line
              className="camber-tick"
              x1={xOf(tick.value)}
              y1={PADDING.top + plotHeight}
              x2={xOf(tick.value)}
              y2={PADDING.top + plotHeight + 4}
            />
            <text
              className="camber-tick-label"
              x={xOf(tick.value)}
              y={PADDING.top + plotHeight + 15}
              textAnchor="middle"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {view.yTicks.map((tick) => (
          <g key={`y-${tick.value}`}>
            <line
              className="camber-tick"
              x1={PADDING.left - 4}
              y1={yOf(tick.value)}
              x2={PADDING.left}
              y2={yOf(tick.value)}
            />
            <text
              className="camber-tick-label"
              x={PADDING.left - 7}
              y={yOf(tick.value) + 3}
              textAnchor="end"
            >
              {tick.label}
            </text>
          </g>
        ))}

        <text
          className="camber-axis-label"
          x={PADDING.left + plotWidth / 2}
          y={HEIGHT - 4}
          textAnchor="middle"
        >
          {view.xAxisLabel}
        </text>
        <text
          className="camber-axis-label"
          x={10}
          y={PADDING.top + plotHeight / 2}
          transform={`rotate(-90 10 ${PADDING.top + plotHeight / 2})`}
          textAnchor="middle"
        >
          {view.yAxisLabel}
        </text>

        {view.lines.map((lineView) => (
          <polyline
            key={lineView.label}
            className={`camber-line camber-line-${lineView.role}`}
            points={line(lineView.points)}
          />
        ))}
      </svg>
      <p className="scene-legend">
        {view.lines.map((lineView) => (
          <span key={lineView.label}>{lineView.label}</span>
        ))}
        <span>positive camber = top outboard · positive steer = left</span>
      </p>
    </figure>
  );
}
