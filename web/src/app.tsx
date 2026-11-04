import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  absoluteCornerPointMm,
  buildAntiDiveInput,
  buildAxleRates,
  buildCasterInput,
  buildFrontViewInput,
  buildLoadTransferInput,
  buildRollStiffnessInput,
  buildToeInput,
  chassisDatum,
  gravitiesToMetresPerSecondSquared,
  parseCarModel,
  reportedRollCentreHeightM,
  resetAxleRates,
  resetCornerPointsMm,
  updateAxleArbType,
  updateAxleArbValue,
  updateAxleDamperCoefficient,
  updateAxleSpringRate,
  updateChassisValue,
  updateCornerPointMm,
  type CarModelDocument,
  type ChassisValueField,
  type CornerKey,
  type CornerPointKey,
  type DataError,
} from '@setuplab/data';
import {
  buildCamberInSteerSeries,
  buildCamberSeries,
  buildFrontViewScene,
  buildToeSeries,
  solveAntiDive,
  solveAntiDiveCurve,
  solveFrontView,
  solveLoadTransfer,
  solveRollStiffness,
  solveSteeringAxis,
} from '@setuplab/physics';
import rawModel from '../../assets/models/reference-touring-car.json';
import { ChassisEditor } from './editor/ChassisEditor.js';
import { HardpointEditor } from './editor/HardpointEditor.js';
import { cornerKeyForAxle, type Axle } from './editor/hardpoints.js';
import { RatesEditor } from './editor/RatesEditor.js';
import { describeRateChange, rateSnapshot, type RateChange } from './editor/rates.js';
import { AntiDiveChart } from './scene/AntiDiveChart.js';
import { CamberGainChart } from './scene/CamberGainChart.js';
import { CasterChart } from './scene/CasterChart.js';
import { FrontViewScene } from './scene/FrontViewScene.js';
import { ToeGainChart } from './scene/ToeGainChart.js';
import {
  readInstantCentrePreference,
  toggleInstantCentre,
  writeInstantCentrePreference,
} from './scene/instantCentrePreference.js';
import {
  buildAntiDiveChart,
  buildCamberChart,
  buildCamberSteerChart,
  buildToeChart,
} from './scene/presenter.js';
import {
  ANGLE_UNIT,
  CAMBER_GAIN_UNIT,
  FORCE_UNIT,
  FRONT_SHARE_UNIT,
  LATERAL_G_UNIT,
  LENGTH_UNIT,
  MOMENT_UNIT,
  RIDE_FREQUENCY_UNIT,
  ROLL_SENSITIVITY_UNIT,
  ROLL_STIFFNESS_UNIT,
  WHEEL_RATE_UNIT,
  formatAngleBand,
  formatAngleDegrees,
  formatAntiDiveBand,
  formatAntiDivePercent,
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
  formatMoment,
  formatMomentBand,
  formatNumber,
  formatPercent,
  formatPercentagePointBand,
  formatRideFrequency,
  formatRollCentreHeight,
  formatRollSensitivity,
  formatRollSensitivityBand,
  formatRollStiffness,
  formatRollStiffnessSi,
  formatSlope,
  formatSpringRateFromNpm,
  formatSymmetricG,
  formatTorsionalStiffness,
  formatToeChange,
  formatToeGain,
  formatWheelRateFromNpm,
} from './format/format.js';
import { GlossaryView } from './glossary/GlossaryView.js';
import { currentHash, routeFromHash, type Route } from './route.js';
import { buildEndPanel, buildSceneLabels, stateLabel } from './view/endSummary.js';
import { BothEndPanel, InstantCentreToggle } from './view/EndPanels.js';
import { ViewModeControl } from './view/ViewModeControl.js';
import { writeAnalysisModeHash, type AnalysisMode } from './view/viewMode.js';

const initialParse = parseCarModel(rawModel);

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

export function AnalysisView({
  initialAxle = 'front',
  initialMode,
}: {
  readonly initialAxle?: Axle;
  readonly initialMode?: AnalysisMode | undefined;
}) {
  const [model, setModel] = useState<CarModelDocument | null>(
    initialParse.ok ? initialParse.value : null,
  );
  const [lateralG, setLateralG] = useState(1.0);
  const [longitudinalG, setLongitudinalG] = useState(1.0);
  const [mode, setMode] = useState<AnalysisMode>(initialMode ?? initialAxle);
  const [axle, setAxle] = useState<Axle>(
    initialMode === 'both' ? initialAxle : (initialMode ?? initialAxle),
  );
  const [includeInstantCentre, setIncludeInstantCentre] = useState<boolean>(() =>
    readInstantCentrePreference(),
  );
  const [editedCorners, setEditedCorners] = useState<ReadonlySet<CornerKey>>(
    () => new Set<CornerKey>(),
  );
  const [editedRateAxles, setEditedRateAxles] = useState<ReadonlySet<Axle>>(
    () => new Set<Axle>(),
  );
  const [editedChassis, setEditedChassis] = useState(false);
  const [rateNote, setRateNote] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const editorModel = useRef<CarModelDocument | null>(model);
  const cornerKey: CornerKey = cornerKeyForAxle(axle);
  const edited = editedCorners.has(cornerKey);
  const baseline = initialParse.ok ? initialParse.value : null;
  const datum = useMemo(() => (model === null ? null : chassisDatum(model)), [model]);

  useEffect(() => {
    writeInstantCentrePreference(includeInstantCentre);
  }, [includeInstantCentre]);

  useEffect(() => {
    writeAnalysisModeHash(mode);
  }, [mode]);

  useEffect(() => {
    if (initialMode === undefined) return;
    setMode((current) => (current === initialMode ? current : initialMode));
    if (initialMode !== 'both') setAxle(initialMode);
  }, [initialMode]);

  const selectMode = (next: AnalysisMode) => {
    if (next === mode) return;
    setMode(next);
    if (next !== 'both') setAxle(next);
    setRateNote(null);
    setEditorKey((value) => value + 1);
  };

  const selectAxle = (next: Axle) => {
    if (next === axle) return;
    setAxle(next);
    setRateNote(null);
    setEditorKey((value) => value + 1);
  };

  const inputResult = useMemo(
    () => (model === null ? null : buildFrontViewInput(model, cornerKey)),
    [model, cornerKey],
  );
  const result = useMemo(
    () => (inputResult !== null && inputResult.ok ? solveFrontView(inputResult.value) : null),
    [inputResult],
  );
  const axleRatesResult = useMemo(
    () => (model === null ? null : buildAxleRates(model, axle)),
    [model, axle],
  );
  const ratesResult = useMemo(
    () => (axleRatesResult !== null && axleRatesResult.ok ? axleRatesResult.value : null),
    [axleRatesResult],
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
  const antiDiveInputResult = useMemo(
    () =>
      model === null
        ? null
        : buildAntiDiveInput(model, -gravitiesToMetresPerSecondSquared(longitudinalG)),
    [model, longitudinalG],
  );
  const antiSquatInputResult = useMemo(
    () =>
      model === null
        ? null
        : buildAntiDiveInput(model, gravitiesToMetresPerSecondSquared(longitudinalG)),
    [model, longitudinalG],
  );
  const antiDiveResult = useMemo(
    () =>
      antiDiveInputResult !== null && antiDiveInputResult.ok
        ? solveAntiDive(antiDiveInputResult.value)
        : null,
    [antiDiveInputResult],
  );
  const antiSquatResult = useMemo(
    () =>
      antiSquatInputResult !== null && antiSquatInputResult.ok
        ? solveAntiDive(antiSquatInputResult.value)
        : null,
    [antiSquatInputResult],
  );
  const antiDiveCurve = useMemo(() => {
    if (model === null) return null;
    const curveInput = buildAntiDiveInput(model, 0);
    return curveInput.ok ? solveAntiDiveCurve(curveInput.value) : null;
  }, [model]);
  const antiDiveChart = useMemo(
    () => (antiDiveCurve === null ? null : buildAntiDiveChart(antiDiveCurve)),
    [antiDiveCurve],
  );
  const casterLeftInput = useMemo(
    () => (model === null ? null : buildCasterInput(model, 'LF')),
    [model],
  );
  const casterRightInput = useMemo(
    () => (model === null ? null : buildCasterInput(model, 'RF')),
    [model],
  );
  const casterLeft = useMemo(
    () =>
      casterLeftInput !== null && casterLeftInput.ok
        ? solveSteeringAxis(casterLeftInput.value)
        : null,
    [casterLeftInput],
  );
  const casterRight = useMemo(
    () =>
      casterRightInput !== null && casterRightInput.ok
        ? solveSteeringAxis(casterRightInput.value)
        : null,
    [casterRightInput],
  );
  const camberSteerLeft = useMemo(
    () =>
      casterLeftInput !== null && casterLeftInput.ok
        ? buildCamberInSteerSeries(casterLeftInput.value)
        : null,
    [casterLeftInput],
  );
  const camberSteerRight = useMemo(
    () =>
      casterRightInput !== null && casterRightInput.ok
        ? buildCamberInSteerSeries(casterRightInput.value)
        : null,
    [casterRightInput],
  );
  const casterChart = useMemo(
    () =>
      camberSteerLeft !== null &&
      camberSteerLeft.kind === 'series' &&
      camberSteerRight !== null &&
      camberSteerRight.kind === 'series'
        ? buildCamberSteerChart(camberSteerLeft, camberSteerRight)
        : null,
    [camberSteerLeft, camberSteerRight],
  );
  const scene = useMemo(
    () =>
      inputResult !== null && inputResult.ok && result !== null
        ? buildFrontViewScene(inputResult.value, result, { includeInstantCentre })
        : null,
    [inputResult, result, includeInstantCentre],
  );
  const camberSeries = useMemo(
    () => (inputResult !== null && inputResult.ok ? buildCamberSeries(inputResult.value) : null),
    [inputResult],
  );
  const camberChart = useMemo(
    () =>
      camberSeries !== null && camberSeries.kind === 'series'
        ? buildCamberChart(camberSeries)
        : null,
    [camberSeries],
  );
  const toeInputResult = useMemo(
    () => (model === null ? null : buildToeInput(model, cornerKey)),
    [model, cornerKey],
  );
  const toeSeries = useMemo(
    () => (toeInputResult !== null && toeInputResult.ok ? buildToeSeries(toeInputResult.value) : null),
    [toeInputResult],
  );
  const toeChart = useMemo(
    () => (toeSeries !== null && toeSeries.kind === 'series' ? buildToeChart(toeSeries) : null),
    [toeSeries],
  );
  const sceneLabels = useMemo(
    () =>
      model === null || scene === null || result === null
        ? null
        : buildSceneLabels(model, axle, scene, result, edited),
    [model, scene, result, axle, edited],
  );
  const bothEnds = useMemo(
    () =>
      mode !== 'both' || model === null
        ? null
        : [
            buildEndPanel(model, 'front', includeInstantCentre, editedCorners.has('LF')),
            buildEndPanel(model, 'rear', includeInstantCentre, editedCorners.has('LR')),
          ],
    [mode, model, includeInstantCentre, editedCorners],
  );

  const reportedRollCentre =
    model === null || result === null ? null : reportedRollCentreHeightM(model, result);
  const antiDivePercent =
    antiDiveResult !== null && antiDiveResult.front.percent.kind === 'defined'
      ? antiDiveResult.front.percent
      : null;
  const antiSquatPercent =
    antiSquatResult !== null && antiSquatResult.rear.percent.kind === 'defined'
      ? antiSquatResult.rear.percent
      : null;
  const antiDiveContributions = antiDiveResult?.front.contributions ?? null;

  if (!initialParse.ok) return <ParseErrors errors={initialParse.errors} />;
  if (model === null || inputResult === null || result === null) {
    return <ParseErrors errors={[{ code: 'invalidDocument', path: '', message: 'no model' }]} />;
  }
  if (!inputResult.ok) return <ParseErrors errors={inputResult.errors} />;

  const editorCorner = model.corners[cornerKey];
  if (editorCorner === undefined) {
    return (
      <ParseErrors
        errors={[{ code: 'missingField', path: `corners.${cornerKey}`, message: 'missing' }]}
      />
    );
  }
  const commitChassis = (field: ChassisValueField, valueMm: number): string | null => {
    const current = editorModel.current;
    if (current === null) return 'No model is loaded.';
    const edited = updateChassisValue(current, field, valueMm);
    if (!edited.ok) {
      return edited.errors.map((item) => `${item.path}: ${item.message}`).join('; ');
    }
    editorModel.current = edited.value;
    setModel(edited.value);
    setEditedChassis(true);
    return null;
  };

  const commitHardpoint = (
    pointKey: CornerPointKey,
    axis: 1 | 2,
    valueMm: number,
  ): string | null => {
    const current = editorModel.current;
    if (current === null) return 'No model is loaded.';
    const edited = updateCornerPointMm(current, cornerKey, pointKey, axis, valueMm);
    if (!edited.ok) {
      return edited.errors.map((item) => `${item.path}: ${item.message}`).join('; ');
    }
    editorModel.current = edited.value;
    setModel(edited.value);
    setEditedCorners((previous) => {
      if (previous.has(cornerKey)) return previous;
      const next = new Set(previous);
      next.add(cornerKey);
      return next;
    });
    return null;
  };

  const resetCorner = () => {
    const current = editorModel.current;
    if (current === null || baseline === null) return;
    const reset = resetCornerPointsMm(current, baseline, cornerKey);
    if (!reset.ok) return;
    editorModel.current = reset.value;
    setModel(reset.value);
    setEditedCorners((previous) => {
      if (!previous.has(cornerKey)) return previous;
      const next = new Set(previous);
      next.delete(cornerKey);
      return next;
    });
    setEditorKey((value) => value + 1);
  };

  const commitRateChange = (change: RateChange): string | null => {
    const current = editorModel.current;
    if (current === null) return 'No model is loaded.';
    const before = rateSnapshot(current, axle, lateralG);
    let edited;
    switch (change.kind) {
      case 'spring':
        edited = updateAxleSpringRate(current, axle, change.valueNmm);
        break;
      case 'damper':
        edited = updateAxleDamperCoefficient(current, axle, change.valueNsPerM);
        break;
      case 'arbType':
        edited = updateAxleArbType(current, axle, change.value);
        break;
      case 'arbValue':
        edited = updateAxleArbValue(current, axle, change.field, change.valueMm);
        break;
    }
    if (!edited.ok) {
      return edited.errors.map((item) => `${item.path}: ${item.message}`).join('; ');
    }
    const after = rateSnapshot(edited.value, axle, lateralG);
    editorModel.current = edited.value;
    setModel(edited.value);
    setEditedRateAxles((previous) => {
      if (previous.has(axle)) return previous;
      const next = new Set(previous);
      next.add(axle);
      return next;
    });
    setRateNote(describeRateChange(change, axle, before, after));
    return null;
  };

  const resetRateAxle = () => {
    const current = editorModel.current;
    if (current === null || baseline === null) return;
    const reset = resetAxleRates(current, baseline, axle);
    if (!reset.ok) return;
    editorModel.current = reset.value;
    setModel(reset.value);
    setEditedRateAxles((previous) => {
      if (!previous.has(axle)) return previous;
      const next = new Set(previous);
      next.delete(axle);
      return next;
    });
    setRateNote(null);
    setEditorKey((value) => value + 1);
  };

  const solverRefusal =
    result.rollCentreHeight.kind === 'defined' ? null : stateLabel(result.rollCentreHeight);

  const lowerInner = absoluteCornerPointMm(model, cornerKey, 'lca_in_a')?.value;
  const lowerOuter = absoluteCornerPointMm(model, cornerKey, 'lca_out')?.value;
  const upperInner = absoluteCornerPointMm(model, cornerKey, 'uca_in')?.value;
  const upperOuter = absoluteCornerPointMm(model, cornerKey, 'uca_out')?.value;
  const working = result.working;
  const springRateNpm =
    ratesResult !== null && ratesResult.working.springRate_Npm > 0
      ? ratesResult.working.springRate_Npm
      : null;
  const ratesRefusal =
    ratesResult === null
      ? axleRatesResult !== null && !axleRatesResult.ok
        ? axleRatesResult.errors.map((error) => error.path).join(', ')
        : 'no model'
      : ratesResult.wheelRate.kind === 'defined'
        ? rollResult !== null && rollResult[axle].rollStiffness.kind !== 'defined'
          ? stateLabel(rollResult[axle].rollStiffness)
          : null
        : stateLabel(ratesResult.wheelRate);

  return (
    <main className="shell">
      <header className="masthead">
        <div className="masthead-row">
          <p className="eyebrow">Setup Lab · Slice 14</p>
          <a className="text-link" href="#glossary">
            Glossary
          </a>
        </div>
        <h1>Front- and rear-view kinematics</h1>
        <div className="view-bar">
          <ViewModeControl value={mode} onChange={selectMode} />
        </div>
        <p className="lede">
          {model.name}. Left-front and left-rear corners, ISO 8855: x forward, y left, z up from
          the top surface of the chassis plate. The selected axle drives the drawing, the hardpoint
          editor and the rates editor. Moving a hardpoint recomputes that end's roll centre and
          camber gain; changing a spring, damper or bar recomputes rates, roll stiffness and balance.
          The chassis panel edits ride height, plate thickness and wheel diameter; the hub is
          derived from them and every outboard point is stored as a shim offset from that hub.
          The rear corner is modelled from plausible rear geometry, not measured, and says so.
        </p>
      </header>

      <section className="grid">
        <div className="inputs">
          <ChassisEditor model={model} edited={editedChassis} onCommit={commitChassis} />
          <HardpointEditor
            key={`${cornerKey}:${editorKey}`}
            model={model}
            axle={axle}
            cornerKey={cornerKey}
            edited={edited}
            solverRefusal={solverRefusal}
            installationRatio={ratesResult?.installationRatio ?? null}
            onCommit={commitHardpoint}
            onReset={resetCorner}
          />
          <RatesEditor
            key={`rates:${cornerKey}:${editorKey}`}
            model={model}
            axle={axle}
            edited={editedRateAxles.has(axle)}
            solverRefusal={ratesRefusal}
            changeNote={rateNote}
            lateralG={lateralG}
            onCommit={commitRateChange}
            onReset={resetRateAxle}
          />
        </div>

        <div className="outputs">
          {mode === 'both' && bothEnds !== null ? (
            <>
              <div className="both-toolbar">
                <p className="hint">
                  Both ends drawn. Click a panel to choose which end the editors change; the cards
                  below stay global and read that end.
                </p>
                <InstantCentreToggle
                  value={includeInstantCentre}
                  onToggle={() => setIncludeInstantCentre(toggleInstantCentre)}
                />
              </div>
              {bothEnds.map((end) => (
                <BothEndPanel
                  key={end.axle}
                  end={end}
                  editing={end.axle === axle}
                  groundLabel={
                    datum === null
                      ? 'ground (derived)'
                      : `ground (derived, z ${formatLengthMm(datum.groundPlaneMm, 1)})`
                  }
                  onSelect={() => selectAxle(end.axle)}
                />
              ))}
            </>
          ) : (
            <article className="card scene-card">
              <div className="card-heading">
                <div>
                  <h2>{axle === 'front' ? 'Front' : 'Rear'}-view drawing</h2>
                  <div className="scene-controls">
                    <InstantCentreToggle
                      value={includeInstantCentre}
                      onToggle={() => setIncludeInstantCentre(toggleInstantCentre)}
                    />
                  </div>
                </div>
                <span className="pill">
                  {scene !== null && scene.derivedGeometry
                    ? 'derived · not measured'
                    : scene !== null && scene.modelledGeometry
                      ? 'modelled · not measured'
                      : 'left front · live'}
                </span>
              </div>
              {scene !== null && sceneLabels !== null ? (
                <FrontViewScene
                  scene={scene}
                  labels={sceneLabels}
                  groundLabel={
                    datum === null
                      ? 'ground (derived)'
                      : `ground (derived, z ${formatLengthMm(datum.groundPlaneMm, 1)})`
                  }
                />
              ) : (
                <p className="no-answer">The drawing needs a solved corner.</p>
              )}
              {camberChart !== null ? (
                <CamberGainChart view={camberChart} />
              ) : (
                <p className="no-answer">The camber curve needs a solved corner.</p>
              )}
              {toeChart !== null ? (
                <ToeGainChart view={toeChart} />
              ) : (
                <p className="no-answer">
                  The toe curve needs a solved tie-rod geometry and the stored static toe.
                </p>
              )}
              <p className="footnote">
                The drawing renders the solver's numbers. It does not re-solve the geometry: the
                roll-centre marker is the value in the card below, and the dashed lines are the
                construction lines that produced it.
              </p>
            </article>
          )}

          <article className="card result-card">
            <div className="card-heading">
              <h2>Roll-centre height</h2>
              <span className="pill">{stateLabel(result.rollCentreHeight)}</span>
            </div>
            {result.rollCentreHeight.kind === 'defined' && reportedRollCentre !== null ? (
              <div className="value-row">
                <span className="value">{formatRollCentreHeight(reportedRollCentre)}</span>
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

          <article className="card result-card">
            <div className="card-heading">
              <h2>Toe gain · {axle}</h2>
              <span className="pill">
                {toeSeries === null
                  ? 'not computable'
                  : toeSeries.kind === 'series'
                    ? stateLabel(toeSeries.gain_radPerM)
                    : `undefined · ${toeSeries.reason}`}
              </span>
            </div>
            {toeSeries !== null && toeSeries.kind === 'series' ? (
              toeSeries.gain_radPerM.kind === 'defined' ? (
                <>
                  <div className="value-row">
                    <span className="value">{formatToeGain(toeSeries.gain_radPerM.value)}</span>
                    <span className="band">per wheel · positive = toe-in</span>
                  </div>
                  <p className="hint">
                    Total across the drawing&apos;s ±5 mm:{' '}
                    {toeSeries.totalAcrossRange_rad.kind === 'defined'
                      ? formatToeChange(toeSeries.totalAcrossRange_rad.value)
                      : stateLabel(toeSeries.totalAcrossRange_rad)}{' '}
                    ·{' '}
                    {toeSeries.direction === 'toe-in'
                      ? 'toe-in in compression'
                      : toeSeries.direction === 'toe-out'
                        ? 'toe-out in compression'
                        : 'no change across travel'}
                    . Positive toe is toe-in. The rear toe link is solved the same way as the
                    front tie rod; there is no rack input.
                  </p>
                </>
              ) : (
                <p className="no-answer">{stateLabel(toeSeries.gain_radPerM)}</p>
              )
            ) : (
              <p className="no-answer">
                {toeSeries === null
                  ? toeInputResult !== null && !toeInputResult.ok
                    ? toeInputResult.errors.map((error) => error.path).join(', ')
                    : 'no model'
                  : `${toeSeries.reason}; the geometry has no tie-rod solution.`}
              </p>
            )}
            <p className="footnote">
              Standard rigid-upright solve: the lower ball joint rides the arm, the upper ball joint
              is held by its link length, and the tie-rod length fixes the steer angle. Positive toe
              is toe-in (D-17).
            </p>
          </article>

          {axle === 'front' && casterLeft !== null ? (
            <article className="card result-card caster-card">
              <div className="card-heading">
                <h2>Caster and steering-axis geometry</h2>
                <span className="pill">derived · front only</span>
              </div>
              {casterLeft.caster_rad.kind === 'defined' ? (
                <div className="value-row">
                  <span className="value">{formatAngleDegrees(casterLeft.caster_rad.value)}</span>
                  <span className="band">
                    caster · positive = axis top rearward
                    {casterLeft.caster_rad.band === null
                      ? ''
                      : ` · band ${formatAngleBand(casterLeft.caster_rad.band)}`}
                  </span>
                </div>
              ) : (
                <p className="no-answer">{stateLabel(casterLeft.caster_rad)}</p>
              )}
              {casterLeft.kpi_rad.kind === 'defined' ? (
                <div className="value-row">
                  <span className="value">{formatAngleDegrees(casterLeft.kpi_rad.value)}</span>
                  <span className="band">
                    KPI · positive = axis top inboard
                    {casterLeft.kpi_rad.band === null
                      ? ''
                      : ` · band ${formatAngleBand(casterLeft.kpi_rad.band)}`}
                  </span>
                </div>
              ) : (
                <p className="no-answer">{stateLabel(casterLeft.kpi_rad)}</p>
              )}
              {casterLeft.scrub_m.kind === 'defined' ? (
                <div className="value-row">
                  <span className="value">
                    {formatLengthFromMetres(casterLeft.scrub_m.value, 2)}
                  </span>
                  <span className="band">
                    scrub radius · positive = axis meets the road inboard
                    {casterLeft.scrub_m.band === null
                      ? ''
                      : ` · band ${formatBandFromMetres(casterLeft.scrub_m.band)}`}
                  </span>
                </div>
              ) : (
                <p className="no-answer">{stateLabel(casterLeft.scrub_m)}</p>
              )}
              {casterLeft.trail_m.kind === 'defined' ? (
                <div className="value-row">
                  <span className="value">
                    {formatLengthFromMetres(casterLeft.trail_m.value, 2)}
                  </span>
                  <span className="band">
                    trail · positive = axis meets the road ahead of the patch
                    {casterLeft.trail_m.band === null
                      ? ''
                      : ` · band ${formatBandFromMetres(casterLeft.trail_m.band)}`}
                  </span>
                </div>
              ) : (
                <p className="no-answer">{stateLabel(casterLeft.trail_m)}</p>
              )}
              <p className="hint">
                The axis is the line through the two ball joints already modelled: no new
                measurement. Caster and KPI are angles of that line, so they depend on the stored
                hub offsets and are unchanged by ride height or wheel diameter; scrub and trail are
                where the same line meets the road. The right corner is the mirror: caster and trail
                are identical, KPI and scrub keep their per-wheel sign.
              </p>
              {casterChart !== null ? (
                <CasterChart view={casterChart} />
              ) : (
                <p className="no-answer">
                  The camber-in-steer curve needs both front corners and a steering axis.
                </p>
              )}
              <p className="hint">
                Camber is read by rotating the rigid upright about the real kingpin axis, not from
                a caster × sin δ approximation. The series isolates caster: it is the rotated
                upright minus the same upright with caster zeroed, so zero caster is exactly zero at
                every angle. Positive steer turns the car left, so the left wheel is inside and the
                right wheel outside; positive camber is top outboard.
              </p>
              {antiDiveContributions !== null ? (
                <p className="hint">
                  Anti-dive split at braking: links{' '}
                  {antiDiveContributions.links.kind === 'defined'
                    ? formatAntiDivePercent(antiDiveContributions.links.value)
                    : stateLabel(antiDiveContributions.links)}{' '}
                  · steering axis: not modelled (TODO) · total{' '}
                  {antiDiveContributions.total.kind === 'defined'
                    ? formatAntiDivePercent(antiDiveContributions.total.value)
                    : stateLabel(antiDiveContributions.total)}. A double-wishbone&apos;s kingpin
                  axis is not a chassis force path; the ball joints are carried by the arms, so a
                  separate axis term would be a strut model and would double-count the upper link.
                </p>
              ) : null}
              <p className="footnote">
                Provenance: derived from <code>lca_out</code>, <code>uca_out</code> and the derived
                wheel centre. Bands are the V5 setup-station pass marks (±0.3°, ±1 mm), not
                propagated tolerances.
              </p>
            </article>
          ) : null}

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
                {axleRatesResult !== null && !axleRatesResult.ok
                  ? axleRatesResult.errors.map((error) => error.path).join(', ')
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

          <article className="card result-card anti-dive-card">
            <div className="card-heading">
              <h2>Anti-dive and anti-squat</h2>
              <span className="pill">modelled · evaluated at the traction limit</span>
            </div>
            <label className="slider-row">
              <span>Longitudinal acceleration</span>
              <input
                aria-label="Longitudinal acceleration in g"
                type="range"
                min="0.1"
                max="2.5"
                step="0.1"
                value={longitudinalG}
                onChange={(event) => setLongitudinalG(Number.parseFloat(event.target.value))}
              />
              <output>{formatSymmetricG(longitudinalG)}</output>
            </label>
            {antiDivePercent !== null && antiSquatPercent !== null ? (
              <>
                <div className="value-row">
                  <span className="value">{formatAntiDivePercent(antiDivePercent.value)}</span>
                  <span className="band">
                    Anti-dive · braking at -{formatSymmetricG(longitudinalG).replace('±', '')}
                    {antiDivePercent.band === null
                      ? ''
                      : ` · band ${formatAntiDiveBand(antiDivePercent.band)}`}
                  </span>
                </div>
                <div className="value-row">
                  <span className="value">{formatAntiDivePercent(antiSquatPercent.value)}</span>
                  <span className="band">
                    Anti-squat · acceleration at +{formatSymmetricG(longitudinalG).replace('±', '')}
                    {antiSquatPercent.band === null
                      ? ''
                      : ` · band ${formatAntiDiveBand(antiSquatPercent.band)}`}
                  </span>
                </div>
              </>
            ) : (
              <p className="no-answer">
                {antiDiveInputResult !== null && !antiDiveInputResult.ok
                  ? antiDiveInputResult.errors.map((error) => error.path).join(', ')
                  : antiDiveResult !== null && antiDiveResult.front.percent.kind === 'undefined'
                    ? `anti-dive: ${antiDiveResult.front.percent.reason}`
                    : 'anti-dive needs a solved side-view geometry and CG height'}
                {antiSquatResult !== null && antiSquatResult.rear.percent.kind === 'undefined'
                  ? ` · anti-squat: ${antiSquatResult.rear.percent.reason}`
                  : ''}
              </p>
            )}
            <p className="hint">
              The two inner pivot screws are the input. Raising one end of the hinge axis tilts it
              and creates the side-view instant centre; the front view uses their midpoint, so a
              level pair leaves roll centre, camber gain and motion ratio unchanged. The side view
              uses the difference.
            </p>
            <p className="hint">
              The axle share is the dynamic axle load at the traction limit, not a brake-bias or
              torque-split control: a single motor drives and brakes all four wheels. These are
              percentages of longitudinal load transfer carried by the links, not handling
              verdicts.
            </p>
            {antiDiveChart !== null ? (
              <AntiDiveChart view={antiDiveChart} />
            ) : (
              <p className="no-answer">The longitudinal curve needs a solved corner.</p>
            )}
            <p className="footnote">
              Provenance: modelled. Caster is not a separate term here: a double-wishbone&apos;s
              kingpin axis is not a chassis force path, and caster already enters through the upper
              link&apos;s x. The angle comes from a 2D side-view projection of a real 3D linkage; the
              band is the CG-height uncertainty, not a claim of measured accuracy.
            </p>
          </article>

          <article className="card result-card roll-moment-card">
            <div className="card-heading">
              <h2>Chassis roll sensitivity</h2>
              <span className="pill">
                {transferResult === null
                  ? 'not computable'
                  : stateLabel(transferResult.rollSensitivity_degPerG)}
              </span>
            </div>
            {transferResult !== null &&
            transferResult.rollSensitivity_degPerG.kind === 'defined' ? (
              <>
                <div className="value-row">
                  <span className="value">
                    {formatRollSensitivity(transferResult.rollSensitivity_degPerG.value)}
                  </span>
                  <span className="band">
                    {transferResult.rollSensitivity_degPerG.band === null
                      ? 'no band'
                      : formatRollSensitivityBand(
                          transferResult.rollSensitivity_degPerG.band,
                        )}
                  </span>
                </div>
                <p className="hint">
                  Roll moment arm{' '}
                  {transferResult.rollMomentArm.kind === 'defined'
                    ? formatLengthFromMetres(transferResult.rollMomentArm.value, 2)
                    : stateLabel(transferResult.rollMomentArm)}{' '}
                  {transferResult.rollMomentArm.kind === 'defined' &&
                  transferResult.rollMomentArm.band !== null
                    ? `(${formatBandFromMetres(transferResult.rollMomentArm.band)})`
                    : ''}
                  {' '}· {stateLabel(transferResult.rollMomentArm)}
                  {transferResult.rollMomentArm.kind === 'defined' &&
                  transferResult.rollMomentArm.provenance.size > 0
                    ? ` · from ${[...transferResult.rollMomentArm.provenance].join(', ')}`
                    : ''}
                  .
                </p>
                <p className="hint">
                  At {formatLateralG(lateralG)}, roll moment{' '}
                  {transferResult.rollMoment.kind === 'defined'
                    ? formatMoment(transferResult.rollMoment.value)
                    : stateLabel(transferResult.rollMoment)}
                  {transferResult.rollMoment.kind === 'defined' &&
                  transferResult.rollMoment.band !== null
                    ? ` (${formatMomentBand(transferResult.rollMoment.band)})`
                    : ''}
                  {' '}· {stateLabel(transferResult.rollMoment)}.
                </p>
                <p className="hint">
                  CG above ground{' '}
                  {transferResult.working.cgHeight_m === null
                    ? 'not established'
                    : `${formatLengthFromMetres(transferResult.working.cgHeight_m, 1)} via ${formatCgRoute(transferResult.cgRoute)}`}
                  ; roll axis{' '}
                  {transferResult.rollAxisHeight.kind === 'defined'
                    ? formatLengthFromMetres(transferResult.rollAxisHeight.value, 2)
                    : stateLabel(transferResult.rollAxisHeight)}
                  . The arm is the <strong>sprung</strong> CG above the roll axis, not the
                  whole-car CG above the ground.
                  {transferResult.rollSensitivity_degPerG.kind === 'defined' &&
                  transferResult.rollSensitivity_degPerG.provenance.size > 0
                    ? ` Sensitivity from ${[...transferResult.rollSensitivity_degPerG.provenance].join(', ')}.`
                    : ''}
                </p>
              </>
            ) : (
              <p className="no-answer">
                {transferResult === null
                  ? transferInputResult !== null && !transferInputResult.ok
                    ? transferInputResult.errors.map((error) => error.path).join(', ')
                    : 'no model'
                  : stateLabel(transferResult.rollSensitivity_degPerG)}
              </p>
            )}
            <p className="footnote">
              Roll moment = sprung mass × lateral g × arm; roll sensitivity = roll moment ÷ total
              roll stiffness, in degrees per g. This is Bob Wright&apos;s chassis roll sensitivity:
              what the springs and bars must resist, levered from the CG above the roll axis.
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
                      {ratesResult.working.bumpStep_m > 0 ? (
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
                      ) : (
                        <li>
                          <span>
                            IR = {formatInstallationRatio(ratesResult.installationRatio.value, 4)}{' '}
                            (assumed input; rear spring hardpoints are not wired yet)
                          </span>
                        </li>
                      )}
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
          {ROLL_STIFFNESS_UNIT}, {FRONT_SHARE_UNIT}, {FORCE_UNIT}, {MOMENT_UNIT},{' '}
          {LATERAL_G_UNIT}, {ROLL_SENSITIVITY_UNIT}, {ANGLE_UNIT}.
        </span>
        <span>Pure TypeScript physics · no DOM in the solver · one conversion site.</span>
      </footer>
    </main>
  );
}

export function App() {
  const [route, setRoute] = useState<Route>(() => routeFromHash(currentHash()));

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash(currentHash()));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (route.view === 'glossary') {
    return <GlossaryView entryId={route.entryId} />;
  }

  return route.mode === undefined ? <AnalysisView /> : <AnalysisView initialMode={route.mode} />;
}
