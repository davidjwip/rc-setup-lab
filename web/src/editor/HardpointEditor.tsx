import { useEffect, useRef, useState } from 'react';
import type { CarModelDocument, CornerKey, CornerPointKey } from '@setuplab/data';
import { LENGTH_UNIT } from '../format/format.js';
import {
  checkHardpointMm,
  hardpointRowsForAxle,
  type Axle,
} from './hardpoints.js';

export const EDIT_DEBOUNCE_MS = 80;

export interface HardpointEditorProps {
  readonly model: CarModelDocument;
  readonly axle: Axle;
  readonly cornerKey: CornerKey;
  readonly edited: boolean;
  readonly solverRefusal: string | null;
  readonly onCommit: (pointKey: CornerPointKey, axis: 1 | 2, valueMm: number) => string | null;
  readonly onReset: () => void;
}

const CORNER_NAMES: Readonly<Record<CornerKey, string>> = {
  LF: 'front-left',
  RF: 'front-right',
  LR: 'rear-left',
  RR: 'rear-right',
};

export function HardpointEditor({
  model,
  axle,
  cornerKey,
  edited,
  solverRefusal,
  onCommit,
  onReset,
}: HardpointEditorProps) {
  const [error, setError] = useState<string | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const corner = model.corners[cornerKey];

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const commit = (pointKey: CornerPointKey, axis: 1 | 2, text: string) => {
    const checked = checkHardpointMm(text);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    setError(onCommit(pointKey, axis, checked.value));
  };

  const schedule = (pointKey: CornerPointKey, axis: 1 | 2, text: string) => {
    const id = `${pointKey}:${axis}`;
    const existing = timers.current.get(id);
    if (existing !== undefined) clearTimeout(existing);
    const timer = setTimeout(() => {
      timers.current.delete(id);
      commit(pointKey, axis, text);
    }, EDIT_DEBOUNCE_MS);
    timers.current.set(id, timer);
  };

  const commitNow = (pointKey: CornerPointKey, axis: 1 | 2, text: string) => {
    const id = `${pointKey}:${axis}`;
    const existing = timers.current.get(id);
    if (existing !== undefined) {
      clearTimeout(existing);
      timers.current.delete(id);
    }
    commit(pointKey, axis, text);
  };

  const rows = hardpointRowsForAxle(axle);

  return (
    <div className="card input-card">
      <div className="card-heading">
        <div>
          <h2>Hardpoints · {CORNER_NAMES[cornerKey]}</h2>
          <p className="hint">
            One selection drives the drawing and this editor. Values are stored with their source;
            editing one revalidates the document before the solve.
          </p>
          <p className="edit-note">
            z is measured from the <strong>top surface of the chassis plate</strong> at the rear axle
            centre-line. The ground plane is derived below it, at z = −(plate thickness + ride
            height); it is not the datum.
          </p>
        </div>
        <span className="pill">{edited ? 'edited this session' : 'millimetres'}</span>
      </div>

      {edited ? (
        <p className="edit-note" role="status">
          This corner is user-edited this session. Provenance stays{' '}
          {corner?.points.uca_in?.confidence ?? 'modelled'}; it is not reported as measured.
        </p>
      ) : null}

      <table className="fields">
        <thead>
          <tr>
            <th scope="col">Point</th>
            <th scope="col">y ({LENGTH_UNIT})</th>
            <th scope="col">z ({LENGTH_UNIT}, plate top)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const point = corner?.points[row.key];
            if (point === undefined) {
              return (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  <td colSpan={2}>not measured</td>
                </tr>
              );
            }
            return (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td>
                  <input
                    aria-label={`${row.label} y in ${LENGTH_UNIT}`}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    defaultValue={point.value[1]}
                    onChange={(event) => schedule(row.key, 1, event.target.value)}
                    onBlur={(event) => commitNow(row.key, 1, event.target.value)}
                  />
                </td>
                <td>
                  <input
                    aria-label={`${row.label} z in ${LENGTH_UNIT}`}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    defaultValue={point.value[2]}
                    onChange={(event) => schedule(row.key, 2, event.target.value)}
                    onBlur={(event) => commitNow(row.key, 2, event.target.value)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {error === null ? null : (
        <p className="editor-error" role="alert">
          {error}
        </p>
      )}
      {solverRefusal === null ? null : (
        <p className="editor-error" role="alert">
          The solver refuses this geometry: {solverRefusal}.
        </p>
      )}

      <div className="editor-actions">
        {edited ? (
          <button type="button" className="reset-button" onClick={onReset}>
            Reset this corner
          </button>
        ) : null}
        <span className="edit-scope">
          Fore/aft (x) positions are modelled and are not editable in this slice.
        </span>
      </div>

      <p className="footnote">
        Arm type: {corner?.armType.lower} / {corner?.armType.upper}. Track is derived from the wheel
        centre, so moving it moves the contact patch too.
      </p>
    </div>
  );
}
