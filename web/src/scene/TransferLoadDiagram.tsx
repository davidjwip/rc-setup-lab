export interface LoadDiagramWheel {
  readonly key: 'LF' | 'RF' | 'LR' | 'RR';
  readonly label: string;
  readonly position: 'left' | 'right';
  readonly role: 'inner' | 'outer';
  /** Already formatted, e.g. `3.49 N`; the component only places it. */
  readonly loadText: string;
  /** Already formatted, e.g. `117.1 %`; the component only places it. */
  readonly shareText: string;
}

export interface LoadDiagramAxle {
  readonly axle: 'front' | 'rear';
  readonly label: string;
  readonly wheels: readonly [LoadDiagramWheel, LoadDiagramWheel];
}

export interface LoadDiagramView {
  /** The lateral acceleration the picture is drawn at, e.g. `1.0 g`. */
  readonly gLabel: string;
  readonly axles: readonly [LoadDiagramAxle, LoadDiagramAxle];
  readonly note: string;
  readonly description: string;
}

const WIDTH = 720;
const HEIGHT = 260;
const AXLE_LEFT = [16, 372] as const;
const AXLE_WIDTH = 332;
const PATCH_WIDTH = 120;
const PATCH_HEIGHT = 86;

function wheelX(index: number, wheelIndex: 0 | 1): number {
  const panel = AXLE_LEFT[index] ?? 0;
  return panel + (wheelIndex === 0 ? 34 : 178);
}

export function TransferLoadDiagram({ view }: { readonly view: LoadDiagramView }) {
  return (
    <figure className="transfer-diagram" data-block="load-diagram">
      <figcaption className="transfer-diagram-caption">
        <strong>Per-wheel load at {view.gLabel}</strong>
        <span>{view.note}</span>
      </figcaption>
      <svg
        className="transfer-diagram-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={view.description}
      >
        <title>{view.description}</title>

        <line
          className="transfer-diagram-axis"
          x1={WIDTH / 2}
          y1={22}
          x2={WIDTH / 2}
          y2={HEIGHT - 18}
        />

        {view.axles.map((axle, index) => (
          <g
            key={axle.axle}
            data-axle={axle.axle}
            aria-label={`${axle.label} axle`}
          >
            <text
              className="transfer-diagram-axle-label"
              x={(AXLE_LEFT[index] ?? 0) + AXLE_WIDTH / 2}
              y={24}
              textAnchor="middle"
            >
              {axle.label}
            </text>
            {axle.wheels.map((wheel, wheelIndex) => {
              const x = wheelX(index, wheelIndex as 0 | 1);
              return (
                <g
                  key={wheel.key}
                  data-wheel={wheel.key}
                  data-position={wheel.position}
                  data-role={wheel.role}
                >
                  <text
                    className="transfer-diagram-wheel-label"
                    x={x + PATCH_WIDTH / 2}
                    y={44}
                    textAnchor="middle"
                  >
                    {wheel.label}
                  </text>
                  <rect
                    className={`transfer-patch transfer-patch--${wheel.role}`}
                    x={x}
                    y={54}
                    width={PATCH_WIDTH}
                    height={PATCH_HEIGHT}
                    rx={10}
                  />
                  <text
                    className="transfer-diagram-load"
                    x={x + PATCH_WIDTH / 2}
                    y={88}
                    textAnchor="middle"
                  >
                    {wheel.loadText}
                  </text>
                  <text
                    className="transfer-diagram-share"
                    x={x + PATCH_WIDTH / 2}
                    y={108}
                    textAnchor="middle"
                  >
                    {wheel.shareText}
                  </text>
                  <text
                    className="transfer-diagram-wheel-key"
                    x={x + PATCH_WIDTH / 2}
                    y={158}
                    textAnchor="middle"
                  >
                    {wheel.key} · {wheel.role}
                  </text>
                </g>
              );
            })}
          </g>
        ))}

        <line
          className="transfer-diagram-axis"
          x1={WIDTH / 2 - 56}
          y1={HEIGHT - 28}
          x2={WIDTH / 2 + 56}
          y2={HEIGHT - 28}
        />
        <text
          className="transfer-diagram-direction"
          x={WIDTH / 2}
          y={HEIGHT - 8}
          textAnchor="middle"
        >
          +y is left · load moves to the right wheels at positive g
        </text>
      </svg>
    </figure>
  );
}
