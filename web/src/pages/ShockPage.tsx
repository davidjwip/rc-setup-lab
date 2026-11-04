import { useEffect, useState } from 'react';
import type { ArbTypeDocument } from '@setuplab/data';
import {
  RATE_RANGES,
  checkBladeCount,
  checkDamperOffsetText,
  checkRateValue,
  type ArbGeometryField,
  type RateCheck,
  type RateChange,
  type RateRange,
} from '../editor/rates.js';
import { LENGTH_UNIT, formatSignedNumber } from '../format/format.js';
import { FrontViewScene } from '../scene/FrontViewScene.js';
import { useSetupStore, type DamperMountShim, type SetupStore } from '../state/setupStore.js';
import { InstantCentreToggle } from '../view/EndPanels.js';
import { Value } from '../view/Value.js';
import type { PageProps } from './PageShell.js';
import {
  buildShockPage,
  type ShockColumn,
  type ShockSettings,
  type ShockValue,
} from './shockData.js';

function ShockReading({ reading }: { readonly reading: ShockValue }) {
  const validation =
    reading.value === null || reading.id === 'damping-ratio'
      ? 'not_validatable'
      : 'unvalidated';
  return (
    <Value
      value={reading.value}
      unit={reading.unit}
      provenance={reading.provenance}
      band={reading.band}
      {...(reading.bandReason === undefined ? {} : { bandReason: reading.bandReason })}
      validation={validation}
      accessibleName={reading.accessibleName}
      size={reading.size}
      {...(reading.reason === undefined ? {} : { reason: reading.reason })}
    />
  );
}

function Row({ label, reading }: { readonly label: string; readonly reading: ShockValue }) {
  return (
    <div className="settings-row" data-row={reading.id}>
      <span className="settings-label">{label}</span>
      <ShockReading reading={reading} />
    </div>
  );
}

const ARB_TYPE_OPTIONS: readonly { value: ArbTypeDocument; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'torsion_bar', label: 'Torsion bar' },
  { value: 'blade', label: 'Blade' },
];

function SettingField({
  id,
  label,
  unit,
  value,
  format,
  check,
  ariaLabel,
  disabled = false,
  help,
  allowEmpty = false,
  placeholder,
  onCommit,
}: {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly value: number | null;
  readonly format: (value: number) => string;
  readonly check: (text: string) => RateCheck;
  readonly ariaLabel: string;
  readonly disabled?: boolean | undefined;
  readonly help?: string | undefined;
  readonly allowEmpty?: boolean | undefined;
  readonly placeholder?: string | undefined;
  readonly onCommit: (value: number) => string | null;
}) {
  const [text, setText] = useState(value === null ? '' : format(value));
  const [error, setError] = useState<string | null>(null);
  const fieldId = `shock-${id}`;
  const helpId = `${fieldId}-help`;
  const unavailable = disabled || (value === null && allowEmpty !== true);

  useEffect(() => {
    setText(value === null ? '' : format(value));
  }, [value]);

  const commit = () => {
    if (unavailable) return;
    const checked = check(text);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    const refusal = onCommit(checked.value);
    if (refusal !== null) {
      setError(refusal);
      return;
    }
    setError(null);
    setText(format(checked.value));
  };

  return (
    <div className="settings-row shim-row" data-row={id}>
      <label className="settings-label" htmlFor={fieldId}>
        {label}
      </label>
      <div className="shim-control">
        <input
          id={fieldId}
          className="shim-input"
          type="text"
          inputMode="decimal"
          pattern="-?\d{0,4}(\.\d{0,3})?"
          value={text}
          disabled={unavailable}
          aria-label={ariaLabel}
          {...(placeholder === undefined ? {} : { placeholder })}
          {...(help === undefined ? {} : { 'aria-describedby': helpId })}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        {unit === '' ? null : <span className="shim-unit">{unit}</span>}
      </div>
      {help === undefined ? null : (
        <p className="shim-help" id={helpId}>
          {help}
        </p>
      )}
      {error === null ? null : (
        <p className="editor-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function SettingSelect({
  settings,
  onCommit,
}: {
  readonly settings: ShockSettings;
  readonly onCommit: (change: RateChange) => string | null;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="settings-row" data-row="arb-type">
      <label className="settings-label" htmlFor="shock-arb-type">
        ARB type
      </label>
      <div className="shim-control">
        <select
          id="shock-arb-type"
          className="shock-select"
          aria-label="ARB type"
          value={settings.arbType}
          onChange={(event) => {
            setError(onCommit({ kind: 'arbType', value: event.target.value as ArbTypeDocument }));
          }}
        >
          {ARB_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <p className="shim-help">none · torsion bar · blade</p>
      {error === null ? null : (
        <p className="editor-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function rateRangeCheck(range: RateRange): (text: string) => RateCheck {
  return (text) => checkRateValue(text, range);
}

function damperCheck(text: string): RateCheck {
  return checkRateValue(text, RATE_RANGES.damper);
}

function arbFieldChange(
  field: ArbGeometryField,
  valueMm: number,
): RateChange {
  return { kind: 'arbValue', field, valueMm };
}

function ShockColumnView({
  column,
  store,
  includeInstantCentre,
}: {
  readonly column: ShockColumn;
  readonly store: SetupStore;
  readonly includeInstantCentre: boolean;
}) {
  const label = column.axle === 'front' ? 'Front' : 'Rear';
  const { settings } = column;
  const torsion = settings.arbType === 'torsion_bar';
  const blade = settings.arbType === 'blade';
  const commit = (change: RateChange) => store.commitRateChange(column.axle, change);
  const damperCommit = (mount: DamperMountShim) => (offsetMm: number) =>
    store.commitDamperMountShim(column.axle, mount, offsetMm);

  return (
    <article className="geometry-column shock-column" data-axle={column.axle}>
      <header className="geometry-column-heading">
        <h2>{label}</h2>
        <p className="hint">One setup for the axle, mirrored left to right.</p>
        {column.edited ? <span className="pill">edited this session</span> : null}
      </header>

      <section className="geometry-drawing" data-block="drawing" aria-label={`${label} drawing`}>
        {column.scene !== null && column.labels !== null ? (
          <FrontViewScene
            scene={column.scene}
            labels={column.labels}
            interactive={false}
          />
        ) : (
          <p className="no-answer">
            {column.refusal ?? 'The drawing needs a solved corner.'}
          </p>
        )}
        <InstantCentreToggle value={includeInstantCentre} onToggle={store.toggleInstantCentre} />
        <p className="shock-drawing-note">
          The short-dash line is the damper, lower eye to upper eye. Its motion ratio is
          annotated beside it.
        </p>
      </section>

      <section
        className="geometry-headline shock-headlines"
        data-block="headlines"
        aria-label={`${label} headline numbers`}
      >
        <div className="headline-item">
          <span className="headline-label">Wheel rate</span>
          <ShockReading reading={column.wheelRate} />
        </div>
        <div className="headline-item">
          <span className="headline-label">Ride frequency</span>
          <ShockReading reading={column.rideFrequency} />
        </div>
        <div className="headline-item">
          <span className="headline-label">Damping ratio</span>
          <ShockReading reading={column.dampingRatio} />
        </div>
        <p className="shock-note">
          <strong>estimate</strong> — the wheel-level coefficient carries a ±50 % band
          (D-13). Heavier oil → more damping; standing the shock up → more wheel-level
          damping.
        </p>
      </section>

      <section
        className="geometry-settings shock-settings"
        data-block="settings"
        aria-label={`${label} settings`}
      >
        <h3>Settings</h3>
        <SettingField
          id={`spring-${column.axle}`}
          label="Spring rate"
          unit={RATE_RANGES.spring.unit}
          value={settings.springRateNmm}
          format={(value) => value.toFixed(2)}
          check={rateRangeCheck(RATE_RANGES.spring)}
          ariaLabel="Spring rate in N/mm"
          onCommit={(valueNmm) => commit({ kind: 'spring', valueNmm })}
        />
        <SettingField
          id={`damper-${column.axle}`}
          label="Damper coefficient"
          unit={RATE_RANGES.damper.unit}
          value={settings.damperCoefficientNsPerM}
          format={(value) => value.toFixed(1)}
          check={damperCheck}
          ariaLabel="Damper coefficient in N·s/m"
          help={
            settings.damperCoefficientIsStatedDefault
              ? 'The model stores no coefficient, so the stated default is shown. Editing it makes it a session estimate, never measured.'
              : 'A higher coefficient is more damping at the wheel.'
          }
          onCommit={(valueNsPerM) => commit({ kind: 'damper', valueNsPerM })}
        />
        <SettingSelect settings={settings} onCommit={commit} />

        {settings.arbType === 'none' ? (
          <p className="shim-help shock-none-note">
            No bar. The diameter, span, arm and blade rows are hidden. The axle roll
            stiffness below is the spring-only contribution, not zero.
          </p>
        ) : (
          <>
            <SettingField
              id={`arb-diameter-${column.axle}`}
              label="ARB bar diameter"
              unit={RATE_RANGES.barDiameter.unit}
              value={settings.arbDiameterMm}
              format={(value) => value.toFixed(2)}
              check={rateRangeCheck(RATE_RANGES.barDiameter)}
              ariaLabel="ARB bar diameter in mm"
              disabled={!torsion}
              help={torsion ? undefined : 'A blade bar uses its rate at the link, not this geometry.'}
              onCommit={(valueMm) => commit(arbFieldChange('bar_diameter', valueMm))}
            />
            <SettingField
              id={`arb-span-${column.axle}`}
              label="ARB span"
              unit={RATE_RANGES.span.unit}
              value={settings.arbSpanMm}
              format={(value) => value.toFixed(1)}
              check={rateRangeCheck(RATE_RANGES.span)}
              ariaLabel="ARB span in mm"
              disabled={!torsion}
              help={torsion ? undefined : 'A blade bar uses its rate at the link, not this geometry.'}
              onCommit={(valueMm) => commit(arbFieldChange('span', valueMm))}
            />
            <SettingField
              id={`arb-arm-${column.axle}`}
              label="ARB arm length"
              unit={RATE_RANGES.armLength.unit}
              value={settings.arbArmLengthMm}
              format={(value) => value.toFixed(1)}
              check={rateRangeCheck(RATE_RANGES.armLength)}
              ariaLabel="ARB arm length in mm"
              disabled={!torsion}
              help={torsion ? undefined : 'A blade bar uses its rate at the link, not this geometry.'}
              onCommit={(valueMm) => commit(arbFieldChange('arm_length', valueMm))}
            />
            <SettingField
              id={`arb-blades-${column.axle}`}
              label="ARB blades"
              unit=""
              value={settings.arbBlades}
              format={(value) => value.toFixed(0)}
              check={checkBladeCount}
              ariaLabel="ARB blades"
              disabled={!blade}
              allowEmpty={blade}
              placeholder={blade ? '1 default' : undefined}
              help={
                blade
                  ? 'Identical blades in parallel; the bar rate is n × one blade. Absent means the rate of the bar as fitted.'
                  : 'Blades apply to a blade bar only.'
              }
              onCommit={(count) => store.commitArbBlades(column.axle, count)}
            />
          </>
        )}

        <SettingField
          id={`damper-lo-${column.axle}`}
          label="Lower damper eye shim"
          unit={LENGTH_UNIT}
          value={settings.damperLoOffsetMm}
          format={(value) => formatSignedNumber(value, 1)}
          check={checkDamperOffsetText}
          ariaLabel={`${label} lower damper eye shim in ${LENGTH_UNIT}`}
          help="Positive moves the eye outboard by this many millimetres. Zero is the model's measured mount."
          onCommit={damperCommit('lo')}
        />
        <SettingField
          id={`damper-up-${column.axle}`}
          label="Upper damper eye shim"
          unit={LENGTH_UNIT}
          value={settings.damperUpOffsetMm}
          format={(value) => formatSignedNumber(value, 1)}
          check={checkDamperOffsetText}
          ariaLabel={`${label} upper damper eye shim in ${LENGTH_UNIT}`}
          help="Positive moves the eye outboard by this many millimetres. Zero is the model's measured mount."
          onCommit={damperCommit('up')}
        />
      </section>

      <section
        className="geometry-settings shock-derived"
        data-block="derived"
        aria-label={`${label} derived detail`}
      >
        <h3>Derived detail</h3>
        <Row label="Motion ratio" reading={column.motionRatio} />
        <p className="shim-help">
          Read from the lower damper eye and the upper damper eye, not a stored
          constant. The band is the ratio at ±5 mm of wheel travel.
        </p>
        <Row label="Critical damping" reading={column.criticalDamping} />
        <Row label="ARB wheel rate" reading={column.arbWheelRate} />
        <Row label="Axle roll stiffness" reading={column.axleRollStiffness} />
        {column.refusal === null ? null : <p className="no-answer">{column.refusal}</p>}
      </section>
    </article>
  );
}

export function ShockPage({ store }: PageProps) {
  const snapshot = useSetupStore(store);
  const data = buildShockPage(
    snapshot.model,
    snapshot.baseline,
    snapshot.includeInstantCentre,
    snapshot.editedCorners,
    snapshot.editedRateAxles,
  );

  return (
    <main className="shell geometry-page shock-page" data-page="shock">
      <header className="masthead">
        <p className="eyebrow">Setup Lab</p>
        <h1 className="page-title">Shock</h1>
        <p className="lede">
          Front and rear on one screen: the damper drawing, the wheel rate, ride
          frequency and damping ratio, then the springs, dampers and bars that set them.
        </p>
      </header>

      <div className="geometry-columns">
        {data.columns.map((column) => (
          <ShockColumnView
            key={column.axle}
            column={column}
            store={store}
            includeInstantCentre={snapshot.includeInstantCentre}
          />
        ))}
      </div>

      <section className="shock-summary" aria-label="Whole car">
        <h2>Whole car</h2>
        <div className="settings-row" data-row="front-share">
          <span className="settings-label">Front roll-stiffness share</span>
          <ShockReading reading={data.frontShare} />
        </div>
        <p className="shim-help">
          This is the roll-stiffness share, not the load-transfer share. They answer
          different questions.
        </p>
      </section>
    </main>
  );
}
