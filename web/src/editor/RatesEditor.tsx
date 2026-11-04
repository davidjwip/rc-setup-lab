import { useEffect, useRef, useState } from 'react';
import type { ArbTypeDocument, CarModelDocument } from '@setuplab/data';
import {
  formatFrontShare,
  formatRollStiffness,
} from '../format/format.js';
import {
  checkRateValue,
  RATE_RANGES,
  rateSnapshot,
  type ArbGeometryField,
  type RateAxle,
  type RateChange,
} from './rates.js';

export const RATE_EDIT_DEBOUNCE_MS = 80;

export interface RatesEditorProps {
  readonly model: CarModelDocument;
  readonly axle: RateAxle;
  readonly edited: boolean;
  readonly solverRefusal: string | null;
  readonly changeNote: string | null;
  readonly lateralG?: number;
  readonly onCommit: (change: RateChange) => string | null;
  readonly onReset: () => void;
}

const CORNER_NAMES: Readonly<Record<RateAxle, string>> = {
  front: 'front-left',
  rear: 'rear-left',
};

const ARB_TYPE_OPTIONS: readonly { value: ArbTypeDocument; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'torsion_bar', label: 'Torsion bar' },
  { value: 'blade', label: 'Blade' },
];

function display(value: number | null, digits: number, unit: string): string {
  return value === null ? 'not computable' : `${value.toFixed(digits)} ${unit}`;
}

export function RatesEditor({
  model,
  axle,
  edited,
  solverRefusal,
  changeNote,
  lateralG = 1,
  onCommit,
  onReset,
}: RatesEditorProps) {
  const [error, setError] = useState<string | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const snapshot = rateSnapshot(model, axle, lateralG);
  const arbType = snapshot.arbType;
  const cornerField = axle === 'front' ? 'LF' : 'LR';
  const geometryDisabled = arbType !== 'torsion_bar';

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const commit = (change: RateChange) => {
    setError(onCommit(change));
  };

  const schedule = (id: string, change: RateChange) => {
    const existing = timers.current.get(id);
    if (existing !== undefined) clearTimeout(existing);
    const timer = setTimeout(() => {
      timers.current.delete(id);
      commit(change);
    }, RATE_EDIT_DEBOUNCE_MS);
    timers.current.set(id, timer);
  };

  const commitNow = (id: string, change: RateChange) => {
    const existing = timers.current.get(id);
    if (existing !== undefined) {
      clearTimeout(existing);
      timers.current.delete(id);
    }
    commit(change);
  };

  const commitNumber = (
    id: string,
    text: string,
    range: (typeof RATE_RANGES)[keyof typeof RATE_RANGES],
    immediate: boolean,
    make: (value: number) => RateChange,
  ) => {
    const checked = checkRateValue(text, range);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    if (immediate) commitNow(id, make(checked.value));
    else schedule(id, make(checked.value));
  };

  const commitArbField = (
    field: ArbGeometryField,
    text: string,
    range: (typeof RATE_RANGES)[keyof typeof RATE_RANGES],
    immediate: boolean,
  ) => {
    commitNumber(`arb:${field}`, text, range, immediate, (valueMm) => ({
      kind: 'arbValue',
      field,
      valueMm,
    }));
  };

  return (
    <div className="card input-card rates-card">
      <div className="card-heading">
        <div>
          <h2>Rates · {CORNER_NAMES[axle]}</h2>
          <p className="hint">
            Springs, damper and bar for the selected axle. Every edit revalidates the document
            before the solve; the other axle and the hardpoints are not touched.
          </p>
        </div>
        <span className="pill">{edited ? 'edited this session' : 'modelled · not measured'}</span>
      </div>

      {edited ? (
        <p className="edit-note" role="status">
          These rates are user-edited this session. Provenance stays the model's; a typed value is
          never reported as measured.
        </p>
      ) : null}

      <table className="fields">
        <tbody>
          <tr>
            <th scope="row">
              Spring rate
              <span className="field-unit">{RATE_RANGES.spring.unit}</span>
            </th>
            <td>
              <input
                aria-label="Spring rate in N/mm"
                type="number"
                inputMode="decimal"
                min={RATE_RANGES.spring.min}
                max={RATE_RANGES.spring.max}
                step={RATE_RANGES.spring.step}
                defaultValue={snapshot.springRateNmm ?? ''}
                onChange={(event) =>
                  commitNumber('spring', event.target.value, RATE_RANGES.spring, false, (valueNmm) => ({
                    kind: 'spring',
                    valueNmm,
                  }))
                }
                onBlur={(event) =>
                  commitNumber('spring', event.target.value, RATE_RANGES.spring, true, (valueNmm) => ({
                    kind: 'spring',
                    valueNmm,
                  }))
                }
              />
            </td>
          </tr>

          <tr>
            <th scope="row">
              Damper coefficient
              <span className="field-unit">{RATE_RANGES.damper.unit}</span>
            </th>
            <td>
              <input
                aria-label="Damper coefficient in N·s/m"
                type="number"
                inputMode="decimal"
                min={RATE_RANGES.damper.min}
                max={RATE_RANGES.damper.max}
                step={RATE_RANGES.damper.step}
                defaultValue={snapshot.damperCoefficient ?? ''}
                onChange={(event) =>
                  commitNumber('damper', event.target.value, RATE_RANGES.damper, false, (valueNsPerM) => ({
                    kind: 'damper',
                    valueNsPerM,
                  }))
                }
                onBlur={(event) =>
                  commitNumber('damper', event.target.value, RATE_RANGES.damper, true, (valueNsPerM) => ({
                    kind: 'damper',
                    valueNsPerM,
                  }))
                }
              />
            </td>
          </tr>

          <tr>
            <th scope="row">
              ARB type
              <span className="field-unit">none · torsion bar · blade</span>
            </th>
            <td>
              <select
                aria-label="ARB type"
                value={arbType}
                onChange={(event) => {
                  const value = event.target.value as ArbTypeDocument;
                  setError(onCommit({ kind: 'arbType', value }));
                }}
              >
                {ARB_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </td>
          </tr>

          <tr className={geometryDisabled ? 'rate-row-disabled' : undefined}>
            <th scope="row">
              ARB bar diameter
              <span className="field-unit">{RATE_RANGES.barDiameter.unit}</span>
            </th>
            <td>
              <input
                aria-label="ARB bar diameter in mm"
                type="number"
                inputMode="decimal"
                min={RATE_RANGES.barDiameter.min}
                max={RATE_RANGES.barDiameter.max}
                step={RATE_RANGES.barDiameter.step}
                disabled={geometryDisabled}
                defaultValue={snapshot.arbDiameterMm ?? ''}
                onChange={(event) =>
                  commitArbField('bar_diameter', event.target.value, RATE_RANGES.barDiameter, false)
                }
                onBlur={(event) =>
                  commitArbField('bar_diameter', event.target.value, RATE_RANGES.barDiameter, true)
                }
              />
            </td>
          </tr>

          <tr className={geometryDisabled ? 'rate-row-disabled' : undefined}>
            <th scope="row">
              ARB span
              <span className="field-unit">{RATE_RANGES.span.unit}</span>
            </th>
            <td>
              <input
                aria-label="ARB span in mm"
                type="number"
                inputMode="decimal"
                min={RATE_RANGES.span.min}
                max={RATE_RANGES.span.max}
                step={RATE_RANGES.span.step}
                disabled={geometryDisabled}
                defaultValue={snapshot.arbSpanMm ?? ''}
                onChange={(event) =>
                  commitArbField('span', event.target.value, RATE_RANGES.span, false)
                }
                onBlur={(event) =>
                  commitArbField('span', event.target.value, RATE_RANGES.span, true)
                }
              />
            </td>
          </tr>

          <tr className={geometryDisabled ? 'rate-row-disabled' : undefined}>
            <th scope="row">
              ARB arm length
              <span className="field-unit">{RATE_RANGES.armLength.unit}</span>
            </th>
            <td>
              <input
                aria-label="ARB arm length in mm"
                type="number"
                inputMode="decimal"
                min={RATE_RANGES.armLength.min}
                max={RATE_RANGES.armLength.max}
                step={RATE_RANGES.armLength.step}
                disabled={geometryDisabled}
                defaultValue={snapshot.arbArmLengthMm ?? ''}
                onChange={(event) =>
                  commitArbField('arm_length', event.target.value, RATE_RANGES.armLength, false)
                }
                onBlur={(event) =>
                  commitArbField('arm_length', event.target.value, RATE_RANGES.armLength, true)
                }
              />
            </td>
          </tr>
        </tbody>
      </table>

      {arbType === 'none' ? (
        <p className="edit-note">
          No bar: the diameter, span and arm rows are disabled and keep their values. The bar's
          contribution is exactly zero, not a small number.
        </p>
      ) : null}
      {arbType === 'blade' ? (
        <p className="edit-note">
          A blade bar uses `arb.rate_at_link`, which this slice does not edit. Its geometry rows
          are disabled; roll stiffness refuses until that rate is present.
        </p>
      ) : null}

      <dl className="rates-summary">
        <div>
          <dt>Wheel rate</dt>
          <dd>{display(snapshot.wheelRateNmm, 2, 'N/mm')}</dd>
        </div>
        <div>
          <dt>Ride frequency</dt>
          <dd>{display(snapshot.rideFrequencyHz, 1, 'Hz')}</dd>
        </div>
        <div>
          <dt>Critical damping</dt>
          <dd>{display(snapshot.criticalDamping, 2, 'N·s/m')}</dd>
        </div>
        <div>
          <dt>
            Damping ratio <span className="estimate-badge">estimated</span>
          </dt>
          <dd>
            {snapshot.dampingRatio === null
              ? 'not computable'
              : `${snapshot.dampingRatio.toFixed(2)} [${snapshot.dampingLow?.toFixed(
                  2,
                )}, ${snapshot.dampingHigh?.toFixed(2)}]`}
          </dd>
        </div>
        <div>
          <dt>ARB wheel rate</dt>
          <dd>{display(snapshot.arbWheelRateNmm, 3, 'N/mm')}</dd>
        </div>
        <div>
          <dt>Axle roll stiffness</dt>
          <dd>
            {snapshot.axleRollStiffness === null
              ? 'not computable'
              : formatRollStiffness(snapshot.axleRollStiffness)}
          </dd>
        </div>
        <div>
          <dt>Front share</dt>
          <dd>
            {snapshot.frontShare === null ? 'not computable' : formatFrontShare(snapshot.frontShare)}
          </dd>
        </div>
        <div>
          <dt>Balance</dt>
          <dd>
            {snapshot.balance === null ? 'not computable' : formatFrontShare(snapshot.balance, 2)}
          </dd>
        </div>
      </dl>

      <p className="rate-change" role="status">
        {changeNote ?? 'Change a rate to see which outputs moved and which way.'}
      </p>
      <p className="footnote damping-note">
        The wheel-level damper coefficient is stored at{' '}
        <code>corners.{cornerField}.damper.c_post</code>. The damping ratio is an estimate: the
        coefficient carries a ±50 % band (D-13) and the direction between two edits is the reliable
        part. It is never marked measured.
      </p>

      {error === null ? null : (
        <p className="editor-error" role="alert">
          {error}
        </p>
      )}
      {solverRefusal === null ? null : (
        <p className="editor-error" role="alert">
          The solver refuses this rate set: {solverRefusal}.
        </p>
      )}

      <div className="editor-actions">
        {edited ? (
          <button type="button" className="reset-button" onClick={onReset}>
            Reset this axle
          </button>
        ) : null}
        <span className="edit-scope">
          Hardpoint reset is separate: this clears only the selected axle's rate edits.
        </span>
      </div>
    </div>
  );
}
