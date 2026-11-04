import { useEffect, useRef, useState } from 'react';
import {
  inferredWheel,
  type CarModelDocument,
  type ChassisValueField,
} from '@setuplab/data';
import { formatLengthMm } from '../format/format.js';
import { CHASSIS_RANGES, checkChassisValue, type ChassisRange } from './chassis.js';

export const CHASSIS_EDIT_DEBOUNCE_MS = 80;

export interface ChassisEditorProps {
  readonly model: CarModelDocument;
  readonly edited: boolean;
  readonly onCommit: (field: ChassisValueField, valueMm: number) => string | null;
}

function shown(value: number | null): string {
  return value === null ? 'not computable' : formatLengthMm(value, 1);
}

export function ChassisEditor({ model, edited, onCommit }: ChassisEditorProps) {
  const [error, setError] = useState<string | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const front = inferredWheel(model, 'front');
  const rear = inferredWheel(model, 'rear');
  const plateTopAboveGroundMm =
    model.chassisThickness !== null && model.referenceRideHeight !== null
      ? model.chassisThickness.value + model.referenceRideHeight.value
      : null;
  const groundPlaneMm =
    plateTopAboveGroundMm === null ? null : -plateTopAboveGroundMm;

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const commit = (field: ChassisValueField, text: string) => {
    const checked = checkChassisValue(text, CHASSIS_RANGES[field]);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    setError(onCommit(field, checked.value));
  };

  const schedule = (field: ChassisValueField, text: string) => {
    const existing = timers.current.get(field);
    if (existing !== undefined) clearTimeout(existing);
    const timer = setTimeout(() => {
      timers.current.delete(field);
      commit(field, text);
    }, CHASSIS_EDIT_DEBOUNCE_MS);
    timers.current.set(field, timer);
  };

  const commitNow = (field: ChassisValueField, text: string) => {
    const existing = timers.current.get(field);
    if (existing !== undefined) {
      clearTimeout(existing);
      timers.current.delete(field);
    }
    commit(field, text);
  };

  const rows: readonly {
    readonly field: ChassisValueField;
    readonly label: string;
    readonly range: ChassisRange;
    readonly value: number | null;
  }[] = [
    {
      field: 'ride_height',
      label: 'Ride height',
      range: CHASSIS_RANGES.ride_height,
      value: model.referenceRideHeight?.value ?? null,
    },
    {
      field: 'thickness',
      label: 'Plate thickness',
      range: CHASSIS_RANGES.thickness,
      value: model.chassisThickness?.value ?? null,
    },
  ];

  return (
    <div className="card input-card chassis-card">
      <div className="card-heading">
        <div>
          <h2>Chassis</h2>
          <p className="hint">
            Ride height and plate thickness locate the ground plane below the plate. They are
            per-vehicle, not per corner, so the same values apply to the front and rear views.
          </p>
        </div>
        <span className="pill">{edited ? 'edited this session' : 'millimetres'}</span>
      </div>

      <table className="fields">
        <tbody>
          {rows.map((row) => (
            <tr key={row.field} data-field={row.field}>
              <th scope="row">
                {row.label}
                <span className="field-unit">{row.range.unit}</span>
              </th>
              <td>
                <input
                  aria-label={`${row.label} in ${row.range.unit}`}
                  type="number"
                  inputMode="decimal"
                  min={row.range.min}
                  max={row.range.max}
                  step={row.range.step}
                  defaultValue={row.value ?? ''}
                  onChange={(event) => schedule(row.field, event.target.value)}
                  onBlur={(event) => commitNow(row.field, event.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="chassis-summary">
        <div>
          <dt>Plate top above ground</dt>
          <dd>{shown(plateTopAboveGroundMm)}</dd>
        </div>
        <div>
          <dt>Ground plane z (chassis frame)</dt>
          <dd>{shown(groundPlaneMm)}</dd>
        </div>
        {[
          { name: 'Front', wheel: front },
          { name: 'Rear', wheel: rear },
        ].map(({ name, wheel }) => (
          <div key={name} data-field={`${name.toLowerCase()}_wheel`}>
            <dt>{name} wheel centre above ground</dt>
            <dd>{shown(wheel.heightAboveGroundMm)}</dd>
            <dt>
              {name} wheel diameter{' '}
              <span className="estimate-badge">inferred</span>
            </dt>
            <dd data-field={`${name.toLowerCase()}_inferred_diameter`}>
              {shown(wheel.inferredDiameterMm)}
            </dd>
            {wheel.consistencyMessage === null ? null : (
              <p className="chassis-note" role="status">
                <strong>{name}:</strong> {wheel.consistencyMessage}
              </p>
            )}
          </div>
        ))}
      </dl>

      <p className="footnote">
        Wheel diameter is inferred from the wheel centre height and the ground plane
        (<code>2 × (wc.z − z_ground)</code>). It is never an input and it never rewrites the
        axle&apos;s recorded tyre radius.
      </p>

      {error === null ? null : (
        <p className="editor-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
