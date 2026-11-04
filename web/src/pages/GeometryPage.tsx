import { useEffect, useState } from 'react';
import { checkShimText } from '../editor/shim.js';
import { LENGTH_UNIT, formatSignedNumber } from '../format/format.js';
import { CamberGainChart } from '../scene/CamberGainChart.js';
import { FrontViewScene } from '../scene/FrontViewScene.js';
import { ToeGainChart } from '../scene/ToeGainChart.js';
import { useSetupStore, type SetupStore } from '../state/setupStore.js';
import { InstantCentreToggle } from '../view/EndPanels.js';
import { Value } from '../view/Value.js';
import { buildGeometryColumn, type GeometryColumn, type GeometryValue } from './geometryData.js';
import type { PageProps } from './PageShell.js';

function GeometryReading({ reading }: { readonly reading: GeometryValue }) {
  return (
    <Value
      value={reading.value}
      unit={reading.unit}
      provenance={reading.provenance}
      band={reading.band}
      {...(reading.bandReason === undefined ? {} : { bandReason: reading.bandReason })}
      validation={reading.value === null ? 'not_validatable' : 'unvalidated'}
      accessibleName={reading.accessibleName}
      size={reading.size}
      {...(reading.reason === undefined ? {} : { reason: reading.reason })}
    />
  );
}

function Row({ label, reading }: { readonly label: string; readonly reading: GeometryValue }) {
  return (
    <div className="settings-row" data-row={reading.id}>
      <span className="settings-label">{label}</span>
      <GeometryReading reading={reading} />
    </div>
  );
}

function ShimRow({
  column,
  store,
}: {
  readonly column: GeometryColumn;
  readonly store: SetupStore;
}) {
  const { valueMm, baseMidpointMm } = column.shimInput;
  const [text, setText] = useState(formatSignedNumber(valueMm, 1));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(formatSignedNumber(valueMm, 1));
  }, [valueMm]);

  const disabled = baseMidpointMm === null;
  const fieldId = `shim-${column.axle}`;
  const helpId = `shim-help-${column.axle}`;

  const commit = () => {
    if (disabled || baseMidpointMm === null) return;
    const checked = checkShimText(text, baseMidpointMm);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    const refusal = store.commitAxleShim(column.axle, checked.value);
    if (refusal !== null) {
      setError(refusal);
      return;
    }
    setError(null);
    setText(formatSignedNumber(checked.value, 1));
  };

  return (
    <div className="settings-row shim-row" data-row="shim">
      <label className="settings-label" htmlFor={fieldId}>
        Shim
      </label>
      <div className="shim-control">
        <input
          id={fieldId}
          className="shim-input"
          type="text"
          inputMode="decimal"
          pattern="-?\d{0,3}(\.\d{0,2})?"
          value={text}
          disabled={disabled}
          aria-label={`${column.axle === 'front' ? 'Front' : 'Rear'} lower-arm shim in ${LENGTH_UNIT}`}
          aria-describedby={helpId}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        <span className="shim-unit">{LENGTH_UNIT}</span>
        <GeometryReading reading={column.shim} />
      </div>
      <p className="shim-help" id={helpId}>
        Positive raises the aft screw and lowers the fore screw by half the shim. The midpoint stays
        put, so the front-view numbers do not move. The ± is half the 0.1 mm entry step, not a
        physical shim tolerance.
      </p>
      {error === null ? null : (
        <p className="editor-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function GeometryColumnView({
  column,
  store,
  includeInstantCentre,
}: {
  readonly column: GeometryColumn;
  readonly store: SetupStore;
  readonly includeInstantCentre: boolean;
}) {
  const label = column.axle === 'front' ? 'Front' : 'Rear';
  const axisName = column.axle === 'front' ? 'anti-dive' : 'anti-squat';
  const signSentence =
    column.axle === 'front'
      ? 'A positive shim (aft screw higher) reads as a negative anti-dive percentage — pro-dive — on Transfer.'
      : 'A positive shim (aft screw higher) reads as a negative anti-squat percentage — pro-squat — on Transfer.';

  return (
    <article className="geometry-column" data-axle={column.axle}>
      <header className="geometry-column-heading">
        <h2>{label}</h2>
        <p className="hint">One setup for the axle, mirrored left to right.</p>
      </header>

      <section
        className="geometry-drawing"
        data-block="drawing"
        aria-label={`${label} drawing`}
      >
        {column.scene !== null && column.labels !== null ? (
          <FrontViewScene scene={column.scene} labels={column.labels} interactive={false} />
        ) : (
          <p className="no-answer">{column.refusal ?? 'The drawing needs a solved corner.'}</p>
        )}
        <InstantCentreToggle value={includeInstantCentre} onToggle={store.toggleInstantCentre} />
        <div className="geometry-headline" aria-label={`${label} headline numbers`}>
          <div className="headline-item">
            <span className="headline-label">Roll-centre height</span>
            <GeometryReading reading={column.rollCentre} />
          </div>
          <div className="headline-item">
            <span className="headline-label">Camber gain</span>
            <GeometryReading reading={column.camberGain} />
          </div>
          <div className="headline-item">
            <span className="headline-label">Toe gain</span>
            <GeometryReading reading={column.toeGain} />
          </div>
        </div>
      </section>

      <section className="geometry-charts" data-block="charts" aria-label={`${label} gain curves`}>
        {column.camber === null ? (
          <p className="no-answer">Camber-gain curve not computable.</p>
        ) : (
          <CamberGainChart view={column.camber} />
        )}
        {column.toe === null ? (
          <p className="no-answer">Toe-gain curve not computable.</p>
        ) : (
          <ToeGainChart view={column.toe} />
        )}
      </section>

      <section className="geometry-settings" data-block="settings" aria-label={`${label} settings`}>
        <h3>Settings</h3>
        <Row label="Span between the screws" reading={column.span} />
        <ShimRow column={column} store={store} />
        <Row label="Hinge angle" reading={column.hingeAngle} />
        <p className="hinge-explainer">
          The shim tilts the hinge axis; the tilt sets the side-view instant centre, and that is what
          produces {axisName}. {signSentence}{' '}
          <a className="text-link" href="#transfer">
            See the {axisName} percentage on Transfer
          </a>
          .
        </p>
      </section>
    </article>
  );
}

export function GeometryPage({ store }: PageProps) {
  const snapshot = useSetupStore(store);
  const columns = [
    buildGeometryColumn(
      snapshot.model,
      'front',
      snapshot.includeInstantCentre,
      snapshot.editedCorners.has('LF'),
    ),
    buildGeometryColumn(
      snapshot.model,
      'rear',
      snapshot.includeInstantCentre,
      snapshot.editedCorners.has('LR'),
    ),
  ];

  return (
    <main className="shell geometry-page" data-page="geometry">
      <header className="masthead">
        <p className="eyebrow">Setup Lab</p>
        <h1 className="page-title">Geometry</h1>
        <p className="lede">
          Front and rear on one screen: the drawing, the gain curves, then the shim that sets the
          hinge angle.
        </p>
      </header>

      <div className="geometry-columns">
        {columns.map((column) => (
          <GeometryColumnView
            key={column.axle}
            column={column}
            store={store}
            includeInstantCentre={snapshot.includeInstantCentre}
          />
        ))}
      </div>
    </main>
  );
}
