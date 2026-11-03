import { Fragment, useMemo, useState } from 'react';
import {
  buildFrontViewInput,
  buildLoadTransferInput,
  buildRatesInput,
  buildRollStiffnessInput,
  gravitiesToMetresPerSecondSquared,
  parseCarModel,
  updateCornerPointMm,
  type CarModelDocument,
  type CornerPointKey,
  type DataError,
} from '@setuplab/data';
import {
  solveFrontView,
  solveLoadTransfer,
  solveRates,
  solveRollStiffness,
  type Solved,
} from '@setuplab/physics';
import rawModel from '../../assets/models/reference-touring-car.json';
import {
  ANGLE_UNIT,
  CAMBER_GAIN_UNIT,
  FORCE_UNIT,
  FRONT_SHARE_UNIT,
  LATERAL_G_UNIT,
  LENGTH_UNIT,
  RIDE_FREQUENCY_UNIT,
  ROLL_STIFFNESS_UNIT,
  WHEEL_RATE_UNIT,
  formatAngleDegrees,
  formatBandFromMetres,
  formatBandFromNpm,
  formatCamberGain,
  formatCgRoute,
  formatCriticalDamping,
  formatForce,
  formatForceBand,
  formatFrontShare,
  formatInstallationRatio,
  formatLateralG,
  formatLengthFromMetres,
  formatLengthMm,
  formatNumber,
  formatPercent,
  formatPercentagePointBand,
  formatRideFrequency,
  formatRollCentreHeight,
  formatRollStiffness,
  formatRollStiffnessSi,
  formatSlope,
  formatSpringRateFromNpm,
  formatTorsionalStiffness,
  formatWheelRateFromNpm,
} from './format/format.js';

interface FieldRow {
  readonly key: CornerPointKey;
  readonly label: string;
}

const FIELD_ROWS: readonly FieldRow[] = [
  { key: 'lca_in_a', label: 'Lower arm inner (hinge point)' },
  { key: 'lca_out', label: 'Lower ball joint' },
  { key: 'uca_in', label: 'Upper link inner' },
  { key: 'uca_out', label: 'Upper ball stud' },
  { key: 'wc', label: 'Wheel centre' },
];

const initialParse = parseCarModel(rawModel);

function stateLabel(value: Solved<unknown>): string {
  switch (value.kind) {
    case 'defined':
      return `computed · ${value.tier} · not yet validated`;
    case 'notMeasured':
      return `not measured · ${value.missing.join(', ')}`;
    case 'undefined':
      return `undefined · ${value.reason}`;
  }
}

function numberFromInput(text: string): number | null {
  const value = Number.parseFloat(text);
  return Number.isFinite(value) ? value : null;
}

function ParseErrors({ errors }: { readonly errors: readonly DataError[] }) {
  return (
    <main className="shell">
      <h1>Setup Lab</h1>
      <section className="card error-card">
        <h2>That model did not load</h2>
        <ul>
          {errors.map((error) => (
            <li key={`${error.code}:${error.path}`}>
              <code>{error.path || 'document'}</code>: {error.message}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export function App() {
  const [model, setModel] = useState<CarModelDocument | null>(
    initialParse.ok ? initialParse.value : null,
  );
  const [lateralG, setLateralG] = useState(1.0);

  const inputResult = useMemo(
    () => (model === null ? null : buildFrontViewInput(model, 'LF')),
    [model],
  );
  const result = useMemo(
    () => (inputResult !== null && inputResult.ok ? solveFrontView(inputResult.value) : null),
    [inputResult],
  );
  const ratesInputResult = useMemo(
    () => (model === null ? null : buildRatesInput(model, 'LF')),
    [model],
  );
  const ratesResult = useMemo(
    () =>
      ratesInputResult !== null && ratesInputResult.ok ? solveRates(ratesInputResult.value) : null,
    [ratesInputResult],
  );
  const rollInputResult = useMemo(
    () => (model === null ? null : buildRollStiffnessInput(model)),
    [model],
  );
  const rollResult = useMemo(
    () =>
      rollInputResult !== null && rollInputResult.ok
        ? solveRollStiffness(rollInputResult.value)
        : null,
    [rollInputResult],
  );
  const transferInputResult = useMemo(
    () =>
      model === null
        ? null
        : buildLoadTransferInput(
            model,
            gravitiesToMetresPerSecondSquared(lateralG),
          ),
    [model, lateralG],
  );
  const transferResult = useMemo(
    () =>
      transferInputResult !== null && transferInputResult.ok
        ? solveLoadTransfer(transferInputResult.value)
        : null,
    [transferInputResult],
  );

  if (!initialParse.ok) return <ParseErrors errors={initialParse.errors} />;
  if (model === null || inputResult === null || result === null) {
    return <ParseErrors errors={[{ code: 'invalidDocument', path: '', message: 'no model' }]} />;
  }
  if (!inputResult.ok) return <ParseErrors errors={inputResult.errors} />;

  const corner = model.corners.LF;
  if (corner === undefined) {
    return <ParseErrors errors={[{ code: 'missingField', path: 'corners.LF', message: 'missing' }]} />;
  }

  const update = (pointKey: CornerPointKey, axis: 1 | 2, text: string) => {
    const value = numberFromInput(text);
    if (value === null) return;
    const edited = updateCornerPointMm(model, 'LF', pointKey, axis, value);
    if (edited.ok) setModel(edited.value);
  };

  const lowerInner = corner.points.lca_in_a?.value;
  const lowerOuter = corner.points.lca_out?.value;
  const upperInner = corner.points.uca_in?.value;
  const upperOuter = corner.points.uca_out?.value;
  const working = result.working;
  const springRateNpm =
    ratesInputResult !== null && ratesInputResult.ok
      ? ratesInputResult.value.springRate_Npm.value
      : null;

  return (
    <main className="shell">
      <header className="masthead">
        <p className="eyebrow">Setup Lab · Slice 0</p>
        <h1>Front-view kinematics</h1>
        <p className="lede">
          {model.name}. Left-front corner, ISO 8855: x forward, y left, z up. Move a hardpoint and
          the roll centre and camber gain recompute.
        </p>
      </header>

      <section className="grid">
        <div className="card input-card">
          <div className="card-heading">
            <h2>Hardpoints</h2>
            <span className="pill">millimetres</span>
          </div>
          <p className="hint">
            Every value below is stored with its source. Editing one revalidates the document before
            the solve.
          </p>
          <table className="fields">
            <thead>
              <tr>
                <th scope="col">Point</th>
                <th scope="col">y ({LENGTH_UNIT})</th>
                <th scope="col">z ({LENGTH_UNIT})</th>
              </tr>
            </thead>
            <tbody>
              {FIELD_ROWS.map((row) => {
                const point = corner.points[row.key];
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
                        step="0.1"
                        value={point.value[1]}
                        onChange={(event) => update(row.key, 1, event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`${row.label} z in ${LENGTH_UNIT}`}
                        type="number"
                        step="0.1"
                        value={point.value[2]}
                        onChange={(event) => update(row.key, 2, event.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="footnote">
            Arm type: {corner.armType.lower} / {corner.armType.upper}. Track is derived from the wheel
            centre, so moving it moves the contact patch too.
          </p>
        </div>

        <div className="outputs">
          <article className="card result-card">
            <div className="card-heading">
              <h2>Roll-centre height</h2>
              <span className="pill">{stateLabel(result.rollCentreHeight)}</span>
            </div>
            {result.rollCentreHeight.kind === 'defined' ? (
              <div className="value-row">
                <span className="value">{formatRollCentreHeight(result.rollCentreHeight.value)}</span>
                <span className="band">
                  {result.rollCentreHeight.band === null
                    ? 'no band'
                    : formatBandFromMetres(result.rollCentreHeight.band)}
                </span>
              </div>
            ) : (
              <p className="no-answer">{stateLabel(result.rollCentreHeight)}</p>
            )}
            <p className="hint">
              About 10 {LENGTH_UNIT} on the reference car, with the model's ±1 {LENGTH_UNIT} band
              stated rather than hidden.
            </p>
          </article>

          <article className="card result-card">
            <div className="card-heading">
              <h2>Camber gain</h2>
              <span className="pill">{stateLabel(result.camberGain)}</span>
            </div>
            {result.camberGain.kind === 'defined' ? (
              <div className="value-row">
                <span className="value">{formatCamberGain(result.camberGain.value)}</span>
                <span className="band">per wheel</span>
              </div>
            ) : (
              <p className="no-answer">{stateLabel(result.camberGain)}</p>
            )}
            <p className="hint">
              Negative κ means the wheel gains negative camber in bump. The global-frame value is{' '}
              {result.camberGainGlobal.kind === 'defined'
                ? formatCamberGain(result.camberGainGlobal.value)
                : stateLabel(result.camberGainGlobal)}
              .
            </p>
          </article>

          {ratesResult !== null ? (
            <article className="card result-card">
              <div className="card-heading">
                <h2>Wheel rate</h2>
                <span className="pill">{stateLabel(ratesResult.wheelRate)}</span>
              </div>
              {ratesResult.wheelRate.kind === 'defined' ? (
                <div className="value-row">
                  <span className="value">
                    {formatWheelRateFromNpm(ratesResult.wheelRate.value)}
                  </span>
                  <span className="band">
                    {ratesResult.wheelRate.band === null
                      ? 'no band'
                      : formatBandFromNpm(ratesResult.wheelRate.band)}
                  </span>
                </div>
              ) : (
                <p className="no-answer">{stateLabel(ratesResult.wheelRate)}</p>
              )}
              <p className="hint">
                Spring{' '}
                {springRateNpm === null ? 'not set' : formatSpringRateFromNpm(springRateNpm)} · IR{' '}
                {ratesResult.installationRatio.kind === 'defined'
                  ? formatInstallationRatio(ratesResult.installationRatio.value)
                  : stateLabel(ratesResult.installationRatio)}{' '}
                → ride frequency{' '}
                {ratesResult.rideFrequency.kind === 'defined'
                  ? formatRideFrequency(ratesResult.rideFrequency.value)
                  : stateLabel(ratesResult.rideFrequency)}
                ; critical damping{' '}
                {ratesResult.criticalDamping.kind === 'defined'
                  ? formatCriticalDamping(ratesResult.criticalDamping.value)
                  : stateLabel(ratesResult.criticalDamping)}
                .
              </p>
              <p className="footnote">
                No band is printed because the schema stores no per-field tolerance yet, and the
                app does not invent one (physics/00 §11).
              </p>
            </article>
          ) : (
            <article className="card result-card">
              <div className="card-heading">
                <h2>Wheel rate</h2>
                <span className="pill">not computable</span>
              </div>
              <p className="no-answer">
                {ratesInputResult !== null && !ratesInputResult.ok
                  ? ratesInputResult.errors.map((error) => error.path).join(', ')
                  : 'no model'}
              </p>
            </article>
          )}

          <article className="card result-card">
            <div className="card-heading">
              <h2>Roll stiffness</h2>
              <span className="pill">
                {rollResult === null ? 'not computable' : stateLabel(rollResult.frontShare)}
              </span>
            </div>
            {rollResult !== null && rollResult.frontShare.kind === 'defined' ? (
              <div className="value-row">
                <span className="value">{formatFrontShare(rollResult.frontShare.value)}</span>
                <span className="band">front share</span>
              </div>
            ) : (
              <p className="no-answer">
                {rollResult === null
                  ? rollInputResult !== null && !rollInputResult.ok
                    ? rollInputResult.errors.map((error) => error.path).join(', ')
                    : 'no model'
                  : stateLabel(rollResult.frontShare)}
              </p>
            )}
            {rollResult === null ? null : (
              <p className="hint">
                Front{' '}
                {rollResult.front.rollStiffness.kind === 'defined'
                  ? formatRollStiffness(rollResult.front.rollStiffness.value)
                  : stateLabel(rollResult.front.rollStiffness)}{' '}
                · rear{' '}
                {rollResult.rear.rollStiffness.kind === 'defined'
                  ? formatRollStiffness(rollResult.rear.rollStiffness.value)
                  : stateLabel(rollResult.rear.rollStiffness)}
                .
              </p>
            )}
            <p className="hint">
              A higher front share sends more lateral load transfer to the front axle in the steady
              state, which biases the car toward understeer.
            </p>
            <p className="footnote">
              Torsion bars use k_θ = G·π·d⁴/(32·L), the arm conversion and the ARB pickup's motion
              ratio; no bar is a defined zero contribution.
            </p>
          </article>

          <article className="card result-card">
            <div className="card-heading">
              <h2>Balance</h2>
              <span className="pill">
                {transferResult === null ? 'not computable' : stateLabel(transferResult.balance)}
              </span>
            </div>
            <label className="slider-row">
              <span>Lateral acceleration</span>
              <input
                aria-label="Lateral acceleration in g"
                type="range"
                min="0.1"
                max="2.5"
                step="0.1"
                value={lateralG}
                onChange={(event) => setLateralG(Number.parseFloat(event.target.value))}
              />
              <output>{formatLateralG(lateralG)}</output>
            </label>
            {transferResult !== null && transferResult.balance.kind === 'defined' ? (
              <>
                <div className="value-row">
                  <span className="value">
                    {formatFrontShare(transferResult.balance.value, 2)}
                  </span>
                  <span className="band">
                    {transferResult.balance.band === null
                      ? 'no band'
                      : formatPercentagePointBand(transferResult.balance.band)}
                  </span>
                </div>
                <p className="hint">
                  Total lateral load transfer{' '}
                  {transferResult.totalLateralLoadTransfer.kind === 'defined'
                    ? formatForce(transferResult.totalLateralLoadTransfer.value)
                    : stateLabel(transferResult.totalLateralLoadTransfer)}{' '}
                  at {formatLateralG(lateralG)}
                  {transferResult.totalLateralLoadTransfer.kind === 'defined' &&
                  transferResult.totalLateralLoadTransfer.band !== null
                    ? ` (${formatForceBand(transferResult.totalLateralLoadTransfer.band)})`
                    : ''}
                  ; roll angle{' '}
                  {transferResult.rollAngle.kind === 'defined'
                    ? formatAngleDegrees(transferResult.rollAngle.value)
                    : stateLabel(transferResult.rollAngle)}
                  .
                </p>
                <p className="hint">
                  Front outer{' '}
                  {transferResult.frontWheel.outerShareOfStatic.kind === 'defined'
                    ? formatPercent(transferResult.frontWheel.outerShareOfStatic.value)
                    : stateLabel(transferResult.frontWheel.outerShareOfStatic)}{' '}
                  / inner{' '}
                  {transferResult.frontWheel.innerShareOfStatic.kind === 'defined'
                    ? formatPercent(transferResult.frontWheel.innerShareOfStatic.value)
                    : stateLabel(transferResult.frontWheel.innerShareOfStatic)}{' '}
                  · rear outer{' '}
                  {transferResult.rearWheel.outerShareOfStatic.kind === 'defined'
                    ? formatPercent(transferResult.rearWheel.outerShareOfStatic.value)
                    : stateLabel(transferResult.rearWheel.outerShareOfStatic)}{' '}
                  / inner{' '}
                  {transferResult.rearWheel.innerShareOfStatic.kind === 'defined'
                    ? formatPercent(transferResult.rearWheel.innerShareOfStatic.value)
                    : stateLabel(transferResult.rearWheel.innerShareOfStatic)}
                  .
                </p>
                <p className="hint">
                  CG height{' '}
                  {transferResult.working.cgHeight_m === null
                    ? 'not established'
                    : `${formatLengthFromMetres(transferResult.working.cgHeight_m, 1)} via ${formatCgRoute(transferResult.cgRoute)}`}
                  . The TLLT and roll-angle bands are the CG-height uncertainty; the balance band
                  is ±0.13 pp because both axles share the same h.
                </p>
              </>
            ) : (
              <p className="no-answer">
                {transferResult === null
                  ? transferInputResult !== null && !transferInputResult.ok
                    ? transferInputResult.errors.map((error) => error.path).join(', ')
                    : 'no model'
                  : stateLabel(transferResult.balance)}
              </p>
            )}
            <p className="hint">
              A higher front share moves more of the load change onto the front tyres, which biases
              the car toward understeer — all else equal. The lateral-g input changes the loads,
              not the balance: the front share is invariant to a_y.
            </p>
            <p className="footnote">
              Total transfer is mass × CG height ÷ mean track. Springs and bars do not change it;
              they move it between the axles, and the split is reported as elastic, geometric and
              unsprung contributions.
            </p>
          </article>

          <article className="card maths-card">
            <details>
              <summary>Show the maths</summary>
              <p className="hint">
                The roll-centre height is the contact-patch-to-instant-centre line evaluated at the
                centreline. The substituted values are the ones above.
              </p>
              {lowerInner !== undefined &&
              lowerOuter !== undefined &&
              upperInner !== undefined &&
              upperOuter !== undefined ? (
                <ol className="maths">
                  <li>
                    <span>
                      m₁ = (Lₒ.z − Lᵢ.z) / (Lₒ.y − Lᵢ.y) = ({formatLengthMm(lowerOuter[2])} −{' '}
                      {formatLengthMm(lowerInner[2])}) / ({formatLengthMm(lowerOuter[1])} −{' '}
                      {formatLengthMm(lowerInner[1])}) ={' '}
                      {working.lowerSlope === null ? 'undefined' : formatSlope(working.lowerSlope)}
                    </span>
                  </li>
                  <li>
                    <span>
                      m₂ = (Uₒ.z − Uᵢ.z) / (Uₒ.y − Uᵢ.y) = ({formatLengthMm(upperOuter[2])} −{' '}
                      {formatLengthMm(upperInner[2])}) / ({formatLengthMm(upperOuter[1])} −{' '}
                      {formatLengthMm(upperInner[1])}) ={' '}
                      {working.upperSlope === null ? 'undefined' : formatSlope(working.upperSlope)}
                    </span>
                  </li>
                  <li>
                    <span>
                      IC = (y, z) = (
                      {working.instantCentreY_m === null
                        ? 'undefined'
                        : formatLengthFromMetres(working.instantCentreY_m)}
                      ,{' '}
                      {working.instantCentreZ_m === null
                        ? 'undefined'
                        : formatLengthFromMetres(working.instantCentreZ_m)}
                      )
                    </span>
                  </li>
                  <li>
                    <span>
                      m = z_IC / (y_IC − y_cp) ={' '}
                      {working.rollCentreSlope === null
                        ? 'undefined'
                        : formatSlope(working.rollCentreSlope)}
                    </span>
                  </li>
                  <li>
                    <span>
                      z_rc = 0 + m(0 − y_cp) ={' '}
                      {result.rollCentreHeight.kind === 'defined'
                        ? formatLengthFromMetres(result.rollCentreHeight.value)
                        : stateLabel(result.rollCentreHeight)}
                    </span>
                  </li>
                  <li>
                    <span>
                      κ = [γ(+0.5 {LENGTH_UNIT}) − γ(−0.5 {LENGTH_UNIT})] / (2 × 0.5 {LENGTH_UNIT}) ={' '}
                      {result.camberGain.kind === 'defined'
                        ? formatCamberGain(result.camberGain.value)
                        : stateLabel(result.camberGain)}
                    </span>
                  </li>
                  {ratesResult !== null && ratesResult.installationRatio.kind === 'defined' ? (
                    <>
                      <li>
                        <span>
                          IR = −[L(+{formatLengthFromMetres(ratesResult.working.bumpStep_m, 1)}) − L(−
                          {formatLengthFromMetres(ratesResult.working.bumpStep_m, 1)})] / (2 ×{' '}
                          {formatLengthFromMetres(ratesResult.working.bumpStep_m, 1)}) ={' '}
                          {ratesResult.working.damperLengthHigh_m === null ||
                          ratesResult.working.damperLengthLow_m === null
                            ? 'undefined'
                            : `−[${formatLengthFromMetres(
                                ratesResult.working.damperLengthHigh_m,
                                3,
                              )} − ${formatLengthFromMetres(
                                ratesResult.working.damperLengthLow_m,
                                3,
                              )}] / ${formatLengthFromMetres(
                                2 * ratesResult.working.bumpStep_m,
                                1,
                              )} = ${formatInstallationRatio(
                                ratesResult.installationRatio.value,
                                3,
                              )}`}
                        </span>
                      </li>
                      <li>
                        <span>
                          k_w = k_s × IR² ={' '}
                          {springRateNpm === null
                            ? 'not set'
                            : formatSpringRateFromNpm(springRateNpm)}{' '}
                          × ({formatInstallationRatio(ratesResult.installationRatio.value, 3)})² ={' '}
                          {ratesResult.wheelRate.kind === 'defined'
                            ? formatWheelRateFromNpm(ratesResult.wheelRate.value)
                            : stateLabel(ratesResult.wheelRate)}
                        </span>
                      </li>
                      {ratesResult.rideFrequency.kind === 'defined' &&
                      ratesResult.working.sprungMass_kg !== null ? (
                        <>
                          <li>
                            <span>
                              f = (1/2π)·√(k_w / m_s) = (1/2π)·√(
                              {(ratesResult.working.wheelRate_Npm ?? 0).toFixed(2)} N/m ÷{' '}
                              {ratesResult.working.sprungMass_kg.toFixed(5)} kg) ={' '}
                              {formatRideFrequency(ratesResult.rideFrequency.value)}
                            </span>
                          </li>
                          <li>
                            <span>
                              c_crit = 2·√(k_w · m_s) ={' '}
                              {ratesResult.criticalDamping.kind === 'defined'
                                ? formatCriticalDamping(ratesResult.criticalDamping.value)
                                : stateLabel(ratesResult.criticalDamping)}
                            </span>
                          </li>
                        </>
                      ) : null}
                    </>
                  ) : null}
                  {rollResult !== null ? (
                    <>
                      {(['front', 'rear'] as const).map((axleKey) => {
                        const axle = rollResult[axleKey];
                        const bar = axle.working.antiRollBar;
                        const suffix = axleKey === 'front' ? 'f' : 'r';
                        if (
                          bar.torsionalStiffness_NmPerRad === null ||
                          bar.armLength_m === null ||
                          bar.motionRatio === null ||
                          bar.rateAtLink_Npm === null ||
                          bar.wheelRate_Npm === null
                        ) {
                          return (
                            <li key={`bar-${axleKey}`}>
                              <span>
                                k_bar,{suffix} = {stateLabel(axle.antiRollBar.wheelRate)}
                              </span>
                            </li>
                          );
                        }
                        return (
                          <Fragment key={`bar-${axleKey}`}>
                            <li>
                              <span>
                                k_θ,{suffix} = G·π·d⁴/(32·L) ={' '}
                                {formatTorsionalStiffness(bar.torsionalStiffness_NmPerRad)}
                              </span>
                            </li>
                            <li>
                              <span>
                                k_bar,link,{suffix} = k_θ/a² ={' '}
                                {formatTorsionalStiffness(bar.torsionalStiffness_NmPerRad)} ÷ (
                                {formatLengthFromMetres(bar.armLength_m, 1)})² ={' '}
                                {formatWheelRateFromNpm(bar.rateAtLink_Npm)}
                              </span>
                            </li>
                            <li>
                              <span>
                                k_bar,wheel,{suffix} = k_bar,link × IR_arm² ={' '}
                                {formatWheelRateFromNpm(bar.rateAtLink_Npm)} × (
                                {formatInstallationRatio(bar.motionRatio, 3)})² ={' '}
                                {formatWheelRateFromNpm(bar.wheelRate_Npm)}
                              </span>
                            </li>
                            {axle.rollStiffness.kind === 'defined' &&
                            axle.working.springWheelRate_Npm !== null &&
                            axle.working.track_m !== null ? (
                              <li>
                                <span>
                                  k_φ,{suffix} = (k_w/2 + k_bar,wheel) × t² = (
                                  {formatWheelRateFromNpm(axle.working.springWheelRate_Npm / 2)} +{' '}
                                  {formatWheelRateFromNpm(bar.wheelRate_Npm)}) × (
                                  {formatLengthFromMetres(axle.working.track_m, 1)})² ={' '}
                                  {formatRollStiffnessSi(axle.rollStiffness.value)}
                                </span>
                              </li>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </>
                  ) : null}
                  {transferResult !== null &&
                  transferResult.working.cgHeight_m !== null &&
                  transferResult.working.meanTrack_m !== null &&
                  transferResult.totalLateralLoadTransfer.kind === 'defined' ? (
                    <li>
                      <span>
                        TLLT = m·a_y·h / t̄ = {transferResult.working.totalMass_kg.toFixed(3)} kg ×{' '}
                        {transferResult.working.lateralAcceleration_mps2.toFixed(3)} m/s² ×{' '}
                        {transferResult.working.cgHeight_m.toFixed(3)} m ÷{' '}
                        {transferResult.working.meanTrack_m.toFixed(3)} m ={' '}
                        {formatForce(transferResult.totalLateralLoadTransfer.value)}
                      </span>
                    </li>
                  ) : null}
                  {transferResult !== null &&
                  transferResult.front.total.kind === 'defined' &&
                  transferResult.rear.total.kind === 'defined' &&
                  transferResult.balance.kind === 'defined' ? (
                    <li>
                      <span>
                        balance = ΔW_f/(ΔW_f + ΔW_r) ={' '}
                        {formatForce(transferResult.front.total.value)} / (
                        {formatForce(transferResult.front.total.value)} +{' '}
                        {formatForce(transferResult.rear.total.value)}) ={' '}
                        {formatFrontShare(transferResult.balance.value, 2)}
                      </span>
                    </li>
                  ) : null}
                </ol>
              ) : (
                <p className="no-answer">The maths is unavailable while a hardpoint is missing.</p>
              )}
              <p className="footnote">
                κ is a derivative: the app reports {formatNumber(working.rollCentreSlope ?? 0, 6)} for
                the roll-centre slope and the secant at ±0.5 {LENGTH_UNIT} for camber, so a two-point
                secant elsewhere need not equal κ × that step.
              </p>
            </details>
          </article>
        </div>
      </section>

      <footer className="footer">
        <span>
          Units: {LENGTH_UNIT}, {CAMBER_GAIN_UNIT}, {WHEEL_RATE_UNIT}, {RIDE_FREQUENCY_UNIT},{' '}
          {ROLL_STIFFNESS_UNIT}, {FRONT_SHARE_UNIT}, {FORCE_UNIT}, {LATERAL_G_UNIT},{' '}
          {ANGLE_UNIT}.
        </span>
        <span>Pure TypeScript physics · no DOM in the solver · one conversion site.</span>
      </footer>
    </main>
  );
}
