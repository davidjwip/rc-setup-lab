import type {
  FrontViewScene as FrontViewSceneData,
  HardpointId,
  SceneRay,
  SceneReason,
} from '@setuplab/physics';

export interface SceneLabels {
  readonly rollCentreValue: string;
  readonly rollCentreBand: string;
  readonly instantCentre: string | null;
  readonly description: string;
  /** Optional motion-ratio annotation drawn beside the damper, e.g. `MR 0.565`. */
  readonly damperLabel?: string | null;
}

interface FrontViewSceneProps {
  readonly scene: FrontViewSceneData;
  readonly labels: SceneLabels;
  /** Ground is below the chassis-plate datum: the line is derived, not stored. */
  readonly groundLabel?: string;
  /**
   * When false the drawing is a static image: no in-drawing glossary links and
   * no focusable hardpoint groups. The Analysis pages keep the default because
   * they use the drawing as an editing surface; a read-only Monitor page does
   * not need ten dead stops in the tab order.
   */
  readonly interactive?: boolean;
}

const VIEW_WIDTH = 340;
const VIEW_HEIGHT = 132;

const DERIVED_NOTICE = 'rear geometry derived from the front — not measured';
const MODELLED_NOTICE = 'rear geometry modelled — not measured';

const HARDPOINT_LABELS: Record<HardpointId, string> = {
  lca_in: 'Lower arm inner',
  lca_out: 'Lower arm outer',
  uca_in: 'Upper link inner',
  uca_out: 'Upper link outer',
  tie_in: 'Tie rod inner',
  tie_out: 'Tie rod outer',
  damper_lo: 'Lower damper eye',
  damper_up: 'Upper damper eye',
  wheel_centre: 'Wheel centre',
  contact_patch: 'Contact patch',
};

const REASON_TEXT: Partial<Record<SceneReason, string>> = {
  parallelLinks: 'parallel links',
  degenerateGeometry: 'degenerate geometry',
  outOfTravel: 'out of travel',
  incompleteModel: 'incomplete model',
  noIntersection: 'no intersection',
};

function reasonText(reason: SceneReason): string {
  return REASON_TEXT[reason] ?? reason;
}

export function FrontViewScene({
  scene,
  labels,
  groundLabel = 'ground',
  interactive = true,
}: FrontViewSceneProps) {
  const { clip } = scene;
  const xOf = (x: number): number => ((x - clip.minX) / (clip.maxX - clip.minX)) * VIEW_WIDTH;
  const yOf = (y: number): number => ((clip.maxY - y) / (clip.maxY - clip.minY)) * VIEW_HEIGHT;
  const scale = VIEW_WIDTH / (clip.maxX - clip.minX);

  const note =
    scene.instantCentre.kind === 'undefined'
      ? `Instant centre not drawn: ${reasonText(scene.instantCentre.reason)}.`
      : scene.instantCentre.kind === 'outsideClip'
        ? 'Instant centre beyond the clip; rays are clipped.'
        : null;

  const rays: readonly SceneRay[] = [
    scene.lowerArmRay,
    scene.upperLinkRay,
    scene.rollCentreRay,
  ];

  const geometryNotice = scene.derivedGeometry
    ? DERIVED_NOTICE
    : scene.modelledGeometry
      ? MODELLED_NOTICE
      : null;

  const accessibleDescription =
    geometryNotice === null ? labels.description : `${labels.description} ${geometryNotice}`;

  const showInstantCentre = scene.instantCentre.kind === 'visible';
  const damperLabel =
    scene.damper === null || labels.damperLabel === undefined || labels.damperLabel === null
      ? null
      : {
          text: labels.damperLabel,
          x: Math.min(
            xOf((scene.damper.from.x + scene.damper.to.x) / 2) + 5,
            VIEW_WIDTH - 48,
          ),
          y: Math.max(
            10,
            Math.min(
              yOf((scene.damper.from.y + scene.damper.to.y) / 2) - 4,
              VIEW_HEIGHT - 4,
            ),
          ),
        };

  return (
    <figure className="scene-figure">
      <div className="scene-well">
        <svg
          className="scene-svg"
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          role="img"
          aria-label={accessibleDescription}
          data-scene="front-view"
        >
          <title>{accessibleDescription}</title>

          {geometryNotice === null ? null : (
            <g
              className="scene-derived-badge"
              data-field={scene.derivedGeometry ? 'derived_geometry' : 'modelled_geometry'}
            >
              <rect x={6} y={6} width={VIEW_WIDTH - 12} height={18} rx={4} />
              <text x={VIEW_WIDTH / 2} y={18} textAnchor="middle">
                {geometryNotice}
              </text>
            </g>
          )}

          <line
            className="scene-ground"
            x1={0}
            y1={yOf(0)}
            x2={VIEW_WIDTH}
            y2={yOf(0)}
          />
          <line
            className="scene-centreline"
            x1={xOf(0)}
            y1={0}
            x2={xOf(0)}
            y2={VIEW_HEIGHT}
          />
          <text className="scene-axis-label" x={4} y={yOf(0) - 3}>
            {groundLabel}
          </text>
          <text className="scene-axis-label" x={xOf(0) + 3} y={10}>
            CL
          </text>

          {rays.map((ray) =>
            ray.kind === 'drawn' ? (
              <line
                key={ray.segment.id}
                className="scene-construction"
                data-field={ray.segment.id}
                x1={xOf(ray.segment.from.x)}
                y1={yOf(ray.segment.from.y)}
                x2={xOf(ray.segment.to.x)}
                y2={yOf(ray.segment.to.y)}
              />
            ) : null,
          )}

          <circle
            className="scene-wheel"
            cx={xOf(scene.wheel.centre.x)}
            cy={yOf(scene.wheel.centre.y)}
            r={scene.wheel.radius * scale}
          />

          <polygon
            className="scene-carrier"
            points={scene.carrier.points
              .map((point) => `${xOf(point.x)},${yOf(point.y)}`)
              .join(' ')}
          />

          <line
            className="scene-arm"
            x1={xOf(scene.lowerArm.from.x)}
            y1={yOf(scene.lowerArm.from.y)}
            x2={xOf(scene.lowerArm.to.x)}
            y2={yOf(scene.lowerArm.to.y)}
          />
          <line
            className="scene-link"
            x1={xOf(scene.upperLink.from.x)}
            y1={yOf(scene.upperLink.from.y)}
            x2={xOf(scene.upperLink.to.x)}
            y2={yOf(scene.upperLink.to.y)}
          />

          {scene.tieRod === null ? null : (
            <line
              className="scene-tie"
              data-field="tie_rod"
              x1={xOf(scene.tieRod.from.x)}
              y1={yOf(scene.tieRod.from.y)}
              x2={xOf(scene.tieRod.to.x)}
              y2={yOf(scene.tieRod.to.y)}
            />
          )}

          {scene.damper === null ? null : (
            <>
              <line
                className="scene-damper"
                data-field="damper"
                x1={xOf(scene.damper.from.x)}
                y1={yOf(scene.damper.from.y)}
                x2={xOf(scene.damper.to.x)}
                y2={yOf(scene.damper.to.y)}
              />
              {damperLabel === null ? null : (
                <text
                  className="scene-damper-label"
                  data-field="damper-motion-ratio"
                  x={damperLabel.x}
                  y={damperLabel.y}
                >
                  {damperLabel.text}
                </text>
              )}
            </>
          )}

          {scene.instantCentre.kind === 'visible' ? (
            <g data-field="instant_centre" className="scene-instant">
              <title>Instant centre</title>
              <circle
                cx={xOf(scene.instantCentre.x)}
                cy={yOf(scene.instantCentre.y)}
                r={4}
              />
              <text
                className="scene-label"
                x={xOf(scene.instantCentre.x) + 7}
                y={yOf(scene.instantCentre.y) - 4}
              >
                {labels.instantCentre ?? 'instant centre'}
              </text>
            </g>
          ) : null}

          {scene.rollCentre.kind === 'defined' ? (
            <g data-field="roll_centre" className="scene-roll-centre">
              <title>Roll centre</title>
              <circle cx={xOf(scene.rollCentre.x)} cy={yOf(scene.rollCentre.y)} r={4} />
              <text
                className="scene-label scene-value-label"
                x={xOf(scene.rollCentre.x) - 8}
                y={yOf(scene.rollCentre.y) - 6}
                textAnchor="end"
              >
                {labels.rollCentreValue}
              </text>
              <text
                className="scene-label scene-band-label"
                x={xOf(scene.rollCentre.x) - 8}
                y={yOf(scene.rollCentre.y) + 4}
                textAnchor="end"
              >
                {labels.rollCentreBand}
              </text>
            </g>
          ) : null}

          {scene.hardpoints.map((hardpoint) => {
            const x = xOf(hardpoint.point.x);
            const y = yOf(hardpoint.point.y);
            const name = HARDPOINT_LABELS[hardpoint.id];

            if (hardpoint.id === 'contact_patch') {
              return (
                <g
                  key={hardpoint.id}
                  data-field={hardpoint.id}
                  className="scene-hardpoint scene-contact"
                >
                  <title>{name}</title>
                  <path
                    className="scene-contact-mark"
                    d={`M ${x - 4} ${y} H ${x + 4} M ${x} ${y - 4} V ${y + 4}`}
                  />
                  <text className="scene-hardpoint-label" x={x + 6} y={y + 10}>
                    {name}
                  </text>
                </g>
              );
            }

            return (
              <g
                key={hardpoint.id}
                data-field={hardpoint.id}
                className="scene-hardpoint"
              >
                <title>{name}</title>
                <circle className="scene-hardpoint-hit" cx={x} cy={y} r={8} />
                <circle className="scene-hardpoint-dot" cx={x} cy={y} r={2.6} />
                <text className="scene-hardpoint-label" x={x + 6} y={y - 5}>
                  {name}
                </text>
              </g>
            );
          })}

          {note === null ? null : (
            <text className="scene-note" x={VIEW_WIDTH - 6} y={12} textAnchor="end">
              {note}
            </text>
          )}
        </svg>
      </div>
      <figcaption className="scene-legend">
        <ul className="sr-only" data-hardpoint-list>
          {scene.hardpoints.map((hardpoint) => (
            <li key={hardpoint.id} data-hardpoint-name={hardpoint.id}>
              {HARDPOINT_LABELS[hardpoint.id]}
            </li>
          ))}
        </ul>
        {/*
          The glossary links live outside the SVG on purpose: the drawing is a
          picture, so anything focusable inside it becomes a dead tab stop for a
          keyboard user. They are ordinary text links here, always present, and
          they do not depend on `interactive` - which now only governs whether
          hardpoints carry hover/focus affordances.
        */}
        <span className="scene-glossary-links">
          {showInstantCentre ? (
            <a className="text-link" href="#glossary/instant-centre">
              Instant centre
            </a>
          ) : null}
          <a className="text-link" href="#glossary/roll-centre">
            Roll centre
          </a>
        </span>
        {geometryNotice === null ? null : (
          <span className="scene-derived-note">{geometryNotice}</span>
        )}
        <span>Solid lines — lower arm and upper link.</span>
        <span>Dash-dot line — tie rod (front rack or rear toe link).</span>
        <span>Short-dash line — Damper, lower eye to upper eye.</span>
        <span>
          {showInstantCentre
            ? 'Dashed lines — construction lines to the instant centre and roll centre.'
            : 'Dashed line — construction line to the roll centre.'}
        </span>
        <span>Filled dot — roll centre, value and band beside it.</span>
        <span>
          {showInstantCentre
            ? 'Hollow dot — instant centre. Cross — contact patch.'
            : 'Cross — contact patch.'}
        </span>
        <span>Circle — wheel at the contact-patch radius.</span>
        <span>
          z is measured from the top of the chassis plate; the ground line is derived, not stored.
        </span>
      </figcaption>
    </figure>
  );
}
