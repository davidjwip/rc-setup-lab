import { FrontViewScene } from '../scene/FrontViewScene.js';
import type { EndPanelData } from './endSummary.js';

export function InstantCentreToggle({
  value,
  onToggle,
}: {
  readonly value: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <div className="axle-toggle" role="group" aria-label="Instant centre overlay">
      <button type="button" aria-pressed={value} onClick={onToggle}>
        Instant centre <span className="toggle-state">{value ? 'on' : 'off'}</span>
      </button>
    </div>
  );
}

export function BothEndPanel({
  end,
  editing,
  groundLabel,
  onSelect,
}: {
  readonly end: EndPanelData;
  readonly editing: boolean;
  readonly groundLabel: string;
  readonly onSelect: () => void;
}) {
  const title = end.axle === 'front' ? 'Front-view drawing' : 'Rear-view drawing';
  const corner = end.axle === 'front' ? 'left-front corner' : 'left-rear corner';
  const badge =
    end.scene === null
      ? 'no drawing'
      : end.scene.derivedGeometry
        ? 'derived · not measured'
        : end.scene.modelledGeometry
          ? 'modelled · not measured'
          : 'measured · live';

  return (
    <article
      className={`card scene-card both-end${editing ? ' is-editing' : ''}`}
      data-end={end.axle}
      data-editing={editing ? 'true' : 'false'}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest('a, button') !== null) {
          return;
        }
        onSelect();
      }}
    >
      <div className="card-heading">
        <div>
          <h2>{title}</h2>
          <p className="hint">
            {corner} · {editing ? 'editing this end' : 'click the panel to edit this end'}
          </p>
        </div>
        <div className="both-end-actions">
          <span className="pill">{badge}</span>
          <button
            type="button"
            className="panel-edit"
            aria-pressed={editing}
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
          >
            {editing ? 'Editing this end' : 'Edit this end'}
          </button>
        </div>
      </div>
      {end.scene !== null && end.labels !== null ? (
        <FrontViewScene scene={end.scene} labels={end.labels} groundLabel={groundLabel} />
      ) : (
        <p className="no-answer">{end.error ?? 'The drawing needs a solved corner.'}</p>
      )}
      {end.strip.length === 0 ? null : (
        <dl className="end-strip" aria-label={`${corner} summary`}>
          {end.strip.map((entry) => (
            <div key={entry.id} className="end-strip-item">
              <dt>{entry.label}</dt>
              <dd>
                <span className="end-strip-value">{entry.value}</span>
                <span className="end-strip-band">{entry.band}</span>
                <span className="end-strip-badge">{entry.state}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
