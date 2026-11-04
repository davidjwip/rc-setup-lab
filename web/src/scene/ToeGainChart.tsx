import type { ToeChartView } from './presenter.js';

interface ToeGainChartProps {
  readonly view: ToeChartView;
}

const WIDTH = 340;
const HEIGHT = 160;
const PADDING = { left: 52, right: 12, top: 12, bottom: 30 };

export function ToeGainChart({ view }: ToeGainChartProps) {
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const spanX = view.domain.maxX - view.domain.minX;
  const spanY = view.domain.maxY - view.domain.minY;

  const xOf = (x: number): number => PADDING.left + ((x - view.domain.minX) / spanX) * plotWidth;
  const yOf = (y: number): number =>
    PADDING.top + ((view.domain.maxY - y) / spanY) * plotHeight;

  const polyline = view.points
    .map((point) => `${xOf(point.x)},${yOf(point.y)}`)
    .join(' ');

  return (
    <figure className="camber-figure">
      <figcaption className="camber-caption">
        <span>Toe gain</span>
        <span>
          {view.gainLabel} · {view.directionLabel}
        </span>
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

        {view.xTicks.map((tick) => (
          <g key={`x-${tick.label}`}>
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
          <g key={`y-${tick.label}`}>
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

        <polyline className="camber-line" points={polyline} />

        <circle
          className="camber-static"
          cx={xOf(view.staticPoint.x)}
          cy={yOf(view.staticPoint.y)}
          r={3.5}
        />
        <text
          className="camber-static-label"
          x={xOf(view.staticPoint.x) + 6}
          y={yOf(view.staticPoint.y) - 5}
        >
          static {view.staticLabel}
        </text>
      </svg>
    </figure>
  );
}
