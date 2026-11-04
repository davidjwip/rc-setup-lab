import { useEffect, useState } from 'react';
import { commitHardpointText } from '../editor/hardpointCommit.js';
import { checkHardpointMm } from '../editor/hardpoints.js';
import { checkShimText } from '../editor/shim.js';
import {
  LENGTH_UNIT,
  formatFixedNumber,
  formatSignedNumber,
} from '../format/format.js';
import { CamberGainChart } from '../scene/CamberGainChart.js';
import { FrontViewScene } from '../scene/FrontViewScene.js';
import { ToeGainChart } from '../scene/ToeGainChart.js';
import { useSetupStore, type SetupStore } from '../state/setupStore.js';
import { attachDeltas } from '../view/delta.js';
import { InstantCentreToggle } from '../view/EndPanels.js';
import { Value } from '../view/Value.js';
import {
  buildGeometryColumn,
  type GeometryColumn,
  type GeometryHardpointAxis,
  type GeometryHardpointRow,
  type GeometryValue,
} from './geometryData.js';
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
      {...(reading.delta === undefined || reading.delta === null ? {} : { delta: reading.delta })}
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

function entryText(value: number | null): string {
  return value === null ? '' : String(value);
}

function HardpointAxisRow({
  axis,
  row,
  axle,
  axleLabel,
  cornerKey,
  store,
}: {
  readonly axis: GeometryHardpointAxis;
  readonly row: GeometryHardpointRow;
  readonly axle: GeometryColumn['axle'];
  readonly axleLabel: string;
  readonly cornerKey: GeometryColumn['cornerKey'];
  readonly store: SetupStore;
}) {
  const [text, setText] = useState(entryText(axis.editValueMm));
  const [error, setError] = useState<string | null>(null);
  const fieldId = `hardpoint-${axle}-${row.key}-${axis.axisName}`;
  const helpId = `${fieldId}-help`;
  const shim = row.group === 'outboard';

  useEffect(() => {
    setText(entryText(axis.editValueMm));
  }, [axis.editValueMm]);

  const commit = () => {
    if (axis.editValueMm === null) return;
    const checked = checkHardpointMm(text);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    const refusal = commitHardpointText(
      store,
      {
        cornerKey,
        pointKey: row.key,
        axis: axis.axis,
        baseMm: axis.baseMm,
        shim,
      },
      text,
    );
    if (refusal !== null) {
      setError(refusal);
      return;
    }
    setError(null);
  };

  const inputLabel = `${axleLabel} ${row.label}${shim ? ' shim' : ''} ${axis.axisName} in ${LENGTH_UNIT}`;

  return (
    <div
      className="settings-row hardpoint-row"
      data-row={`${row.key}-${axis.axisName}`}
      data-point={row.key}
      data-axis={axis.axisName}
      data-group={row.group}
    >
      <label className="settings-label" htmlFor={fieldId}>
        {row.label}
        {shim ? ' shim' : ''} {axis.axisName}
      </label>
      <div className="shim-control">
        <input
          id={fieldId}
          className="shim-input"
          type="text"
          inputMode="decimal"
          value={text}
          disabled={axis.editValueMm === null}
          aria-label={inputLabel}
          aria-describedby={helpId}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        <span className="shim-unit">{LENGTH_UNIT}</span>
        <GeometryReading reading={axis.value} />
        {shim ? (
          <span className="hardpoint-absolute" data-role="composed">
            <span className="shim-unit">absolute {axis.axisName}</span>
            <GeometryReading reading={axis.absolute} />
          </span>
        ) : null}
      </div>
      {shim ? (
        <span className="hardpoint-direction" data-role="direction">
          {axis.direction}
        </span>
      ) : null}
      {axis.edited ? (
        <span className="pill" data-edited="true">
          edited this session
        </span>
      ) : null}
      <p className="shim-help" id={helpId}>
        {shim
          ? `Shim offset from the model mount: ${axis.direction} The composed absolute position is shown beside it.`
          : `${row.key.startsWith('lca_in') ? `x stays fixed at ${formatFixedNumber(row.xMm ?? 0, 1)} mm. ` : ''}Positive y is outboard; positive z is up.`}
      </p>
      {error === null ? null : (
        <p className="editor-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function HardpointBlock({
  title,
  block,
  description,
  rows,
  axle,
  axleLabel,
  cornerKey,
  store,
}: {
  readonly title: string;
  readonly block: string;
  readonly description: string;
  readonly rows: readonly GeometryHardpointRow[];
  readonly axle: GeometryColumn['axle'];
  readonly axleLabel: string;
  readonly cornerKey: GeometryColumn['cornerKey'];
  readonly store: SetupStore;
}) {
  return (
    <div className="geometry-hardpoints" data-block={block} aria-label={`${axleLabel} ${title.toLowerCase()}`}>
      <h4>{title}</h4>
      <p className="shim-help">{description}</p>
      {rows.map((row) => (
        <div key={row.key} data-hardpoint={row.key}>
          {row.axes.map((axis) => (
            <HardpointAxisRow
              key={`${row.key}-${axis.axisName}`}
              axis={axis}
              row={row}
              axle={axle}
              axleLabel={axleLabel}
              cornerKey={cornerKey}
              store={store}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function HubBlock({
  column,
  axleLabel,
}: {
  readonly column: GeometryColumn;
  readonly axleLabel: string;
}) {
  return (
    <div className="geometry-hub" data-block="hub" aria-label={`${axleLabel} wheel centre and hub`}>
      <h4>Wheel centre / hub</h4>
      <div className="settings-row" data-row="hub-y">
        <span className="settings-label">Hub y</span>
        <GeometryReading reading={column.hub.y} />
      </div>
      <div className="settings-row" data-row="hub-z">
        <span className="settings-label">Hub z</span>
        <GeometryReading reading={column.hub.z} />
      </div>
      <p className="shim-help">
        Read-only. Derived on Home from the ride height, plate thickness and wheel diameter;
        never editable here.
      </p>
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
  const axisName = column.axle === 'front' ? 'anti-dive' : 'anti-squat';

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
        Shim · {axisName}
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
          <p className="no-answer">
            {column.refusal ?? 'The drawing needs a complete corner. Measure the missing points on Geometry.'}
          </p>
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
          <p className="no-answer">
            Camber-gain curve not computable. Measure the missing points on Geometry.
          </p>
        ) : (
          <CamberGainChart view={column.camber} />
        )}
        {column.toe === null ? (
          <p className="no-answer">
            Toe-gain curve not computable. Add the tie-rod points on Geometry.
          </p>
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

        <HardpointBlock
          title="Inner pivots"
          block="inner-pivots"
          description="Chassis-fixed. y and z are editable in millimetres; each inner pivot keeps its fore/aft x."
          rows={column.innerPivots}
          axle={column.axle}
          axleLabel={label}
          cornerKey={column.cornerKey}
          store={store}
        />
        <HardpointBlock
          title="Outboard points"
          block="outboard-points"
          description="Hub-fixed, entered as signed shim offsets from the model mount. The composed absolute point is read-only."
          rows={column.outboardPoints}
          axle={column.axle}
          axleLabel={label}
          cornerKey={column.cornerKey}
          store={store}
        />
        <HubBlock column={column} axleLabel={label} />
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
      snapshot.baseline,
    ),
    buildGeometryColumn(
      snapshot.model,
      'rear',
      snapshot.includeInstantCentre,
      snapshot.editedCorners.has('LR'),
      snapshot.baseline,
    ),
  ];
  const columnsWithDeltas = snapshot.edited
    ? attachDeltas(columns, [
        buildGeometryColumn(
          snapshot.baseline,
          'front',
          snapshot.includeInstantCentre,
          false,
          snapshot.baseline,
        ),
        buildGeometryColumn(
          snapshot.baseline,
          'rear',
          snapshot.includeInstantCentre,
          false,
          snapshot.baseline,
        ),
      ])
    : columns;

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
        {columnsWithDeltas.map((column) => (
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
