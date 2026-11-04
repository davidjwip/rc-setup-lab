import { useEffect, useRef, useState } from 'react';
import {
  absoluteCornerPointMm,
  hubCentreMm,
  isHubFixedPointKey,
  type CarModelDocument,
  type CornerKey,
  type CornerPointKey,
} from '@setuplab/data';
import type { Solved } from '@setuplab/physics';
import { LENGTH_UNIT, formatInstallationRatio, formatLengthMm } from '../format/format.js';
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
  readonly installationRatio?: Solved<number> | null;
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
  installationRatio = null,
  onCommit,
  onReset,
}: HardpointEditorProps) {
  const [error, setError] = useState<string | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const corner = model.corners[cornerKey];
  const hub = hubCentreMm(model, cornerKey);

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
            height). The hub is derived at ({hub === null ? 'not computable' : `${formatLengthMm(hub.y, 1)}, ${formatLengthMm(hub.z, 1)}`}) mm;
            it is never stored and it carries every outboard point with it.
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
            <th scope="col">y / offset y ({LENGTH_UNIT})</th>
            <th scope="col">z / offset z ({LENGTH_UNIT})</th>
            <th scope="col">Composed absolute (y, z)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const point = corner?.points[row.key];
            if (point === undefined) {
              return (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  <td colSpan={3}>not measured</td>
                </tr>
              );
            }
            const isHub = isHubFixedPointKey(row.key);
            const absolute = isHub
              ? absoluteCornerPointMm(model, cornerKey, row.key)
              : point;
            return (
              <tr key={row.key} data-point={row.key} data-kind={row.kind}>
                <th scope="row">
                  {row.label}
                  {isHub ? <span className="field-unit">shim offset</span> : null}
                </th>
                <td>
                  <input
                    aria-label={`${row.label} ${isHub ? 'offset ' : ''}y in ${LENGTH_UNIT}`}
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
                    aria-label={`${row.label} ${isHub ? 'offset ' : ''}z in ${LENGTH_UNIT}`}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    defaultValue={point.value[2]}
                    onChange={(event) => schedule(row.key, 2, event.target.value)}
                    onBlur={(event) => commitNow(row.key, 2, event.target.value)}
                  />
                </td>
                <td className="readonly-point">
                  {absolute === null
                    ? 'not computable'
                    : `${formatLengthMm(absolute.value[1], 1)}, ${formatLengthMm(
                        absolute.value[2],
                        1,
                      )}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="edit-note">
        Upright rows edit the <strong>shim offset</strong> from the derived wheel centre. For the y
        offset, <strong>+</strong> means a shim inboard of the ball stud (the stud moves outboard),
        and <strong>−</strong> moves the stud inboard. For z, <strong>+</strong> is up. The composed
        absolute point shown beside each row is what the solver consumes; it is read-only here.
      </p>

      <div className="motion-ratio" role="status">
        <span className="motion-ratio-label">Derived damper motion ratio</span>
        {installationRatio !== null && installationRatio.kind === 'defined' ? (
          <>
            <strong className="motion-ratio-value">
              {formatInstallationRatio(installationRatio.value, 3)}
            </strong>
            <span className="motion-ratio-band">
              {installationRatio.band === null
                ? 'no band'
                : `across ±5 mm: ${formatInstallationRatio(
                    installationRatio.band.low,
                    3,
                  )}–${formatInstallationRatio(installationRatio.band.high, 3)}`}
            </span>
          </>
        ) : (
          <span className="motion-ratio-band">
            {installationRatio === null
              ? 'not computable'
              : installationRatio.kind === 'undefined'
                ? `undefined · ${installationRatio.reason}`
                : `not measured · ${installationRatio.missing.join(', ')}`}
          </span>
        )}
        <span className="motion-ratio-note">
          The damper is rotated about the lower-arm hinge; on a coilover this is also the spring installation ratio. A separately mounted spring would be kept distinct, not conflated.
        </span>
      </div>

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
        Arm type: {corner?.armType.lower} / {corner?.armType.upper}. Track is derived from the hub,
        so moving it moves the contact patch too.
      </p>
    </div>
  );
}
