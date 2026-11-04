import { AntiDiveChart } from '../scene/AntiDiveChart.js';
import { TransferLoadDiagram } from '../scene/TransferLoadDiagram.js';
import { useSetupStore, type SetupStore } from '../state/setupStore.js';
import { Value } from '../view/Value.js';
import type { PageProps } from './PageShell.js';
import { buildTransferPage, type TransferValue } from './transferData.js';

function TransferReading({ reading }: { readonly reading: TransferValue }) {
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

function Row({ reading }: { readonly reading: TransferValue }) {
  return (
    <div className="settings-row" data-row={reading.id}>
      <span className="settings-label">{reading.label}</span>
      <TransferReading reading={reading} />
    </div>
  );
}

function Hero({ reading, lateralG }: { readonly reading: TransferValue; readonly lateralG: number }) {
  return (
    <section className="transfer-hero" data-block="hero" aria-labelledby="transfer-hero-heading">
      <p className="eyebrow">The answer</p>
      <h2 className="transfer-hero-heading" id="transfer-hero-heading">
        Front load-transfer share
      </h2>
      <TransferReading reading={reading} />
      <p className="transfer-hero-claim">
        At {lateralG.toFixed(1)} g, front carries this share of the total transfer.
      </p>
      <p className="transfer-hero-note">
        Total transfer is set by mass, CG height and track. Springs, bars and roll centres move
        where the transfer happens; they do not change the total.
      </p>
    </section>
  );
}

function LateralSlider({
  store,
  reading,
  lateralG,
}: {
  readonly store: SetupStore;
  readonly reading: TransferValue;
  readonly lateralG: number;
}) {
  return (
    <section
      className="card transfer-slider"
      data-block="lateral-g"
      aria-labelledby="lateral-g-heading"
    >
      <div className="transfer-slider-heading">
        <div>
          <h2 id="lateral-g-heading">Lateral acceleration</h2>
          <p className="hint">The analysis input. Everything below is drawn at this g.</p>
        </div>
        <TransferReading reading={reading} />
      </div>
      <input
        id="lateral-g"
        className="transfer-range"
        type="range"
        min={0.1}
        max={2.5}
        step={0.1}
        value={lateralG}
        aria-label="Lateral acceleration in g"
        aria-describedby="lateral-g-scale"
        onChange={(event) => store.setLateralG(Number(event.target.value))}
      />
      <div className="transfer-slider-scale" id="lateral-g-scale" aria-hidden="true">
        <span>0.1 g</span>
        <span>2.5 g</span>
      </div>
      <p className="shim-help">
        The balance percentage stays put as the slider moves; the loads and the roll moment scale
        with it.
      </p>
    </section>
  );
}

function LoadsGroup({
  loads,
  rollShare,
  sharesNote,
}: {
  readonly loads: readonly TransferValue[];
  readonly rollShare: TransferValue;
  readonly sharesNote: string;
}) {
  return (
    <section className="card transfer-group" data-block="loads" aria-labelledby="loads-heading">
      <h2 id="loads-heading">Loads</h2>
      {loads.map((reading) => (
        <Row key={reading.id} reading={reading} />
      ))}
      <Row reading={rollShare} />
      <p className="shim-help">{sharesNote}</p>
    </section>
  );
}

function RollGroup({ readings }: { readonly readings: readonly TransferValue[] }) {
  return (
    <section className="card transfer-group" data-block="roll" aria-labelledby="roll-heading">
      <h2 id="roll-heading">Roll</h2>
      {readings.map((reading) => (
        <Row key={reading.id} reading={reading} />
      ))}
      <p className="shim-help">
        The arm is the sprung CG above the roll axis. It uses that axis, not the whole-car CG above
        the ground.
      </p>
    </section>
  );
}

function LongitudinalGroup({
  longitudinal,
}: {
  readonly longitudinal: ReturnType<typeof buildTransferPage>['longitudinal'];
}) {
  return (
    <section
      className="card transfer-group transfer-longitudinal"
      data-block="longitudinal"
      aria-labelledby="longitudinal-heading"
    >
      <h2 id="longitudinal-heading">Longitudinal</h2>
      <Row reading={longitudinal.antiDive} />
      <Row reading={longitudinal.antiSquat} />
      <p className="shim-help">
        Evaluated at the traction limit. Braking is negative on the curve; acceleration is positive.
        The axle share comes from the dynamic axle load, not from a brake or torque split.
      </p>
      {longitudinal.chart === null ? (
        <p className="no-answer">
          {longitudinal.chartRefusal ?? 'The anti-dive curve is not computable.'}
        </p>
      ) : (
        <AntiDiveChart view={longitudinal.chart} />
      )}
      <p className="hinge-explainer">
        The front and rear percentages are set by the lower-arm inner screw pair on Geometry.{' '}
        <a className="text-link" href="#geometry">
          Set the front and rear shims on Geometry
        </a>
        .
      </p>
      <p className="shim-help">
        Caster is modelled, but its anti-dive contribution is not yet included, so the figure reads
        conservative.
      </p>
    </section>
  );
}

function CgGroup({
  height,
  route,
  routeDetail,
}: {
  readonly height: TransferValue;
  readonly route: string;
  readonly routeDetail: string;
}) {
  return (
    <section className="card transfer-group" data-block="cg" aria-labelledby="cg-heading">
      <h2 id="cg-heading">CG</h2>
      <Row reading={height} />
      <p className="shim-help">
        Route: {route}. {routeDetail}
      </p>
      <p className="hinge-explainer">
        <a className="text-link" href="#home">
          Set the CG height on Home
        </a>
        . Home also holds the ride height and plate thickness that locate the ground plane.
      </p>
    </section>
  );
}

export function TransferPage({ store }: PageProps) {
  const snapshot = useSetupStore(store);
  const data = buildTransferPage(snapshot.model, snapshot.lateralG, snapshot.longitudinalG);

  return (
    <main className="shell geometry-page transfer-page" data-page="transfer">
      <header className="masthead">
        <p className="eyebrow">Setup Lab</p>
        <h1 className="page-title">Transfer</h1>
        <p className="lede">
          The load picture at one lateral g: who carries the transfer, how far the body rolls, and
          what the links do under braking and acceleration.
        </p>
      </header>

      <Hero reading={data.hero} lateralG={data.lateralG} />

      <LateralSlider store={store} reading={data.lateralGValue} lateralG={data.lateralG} />

      <TransferLoadDiagram view={data.diagram} />

      <div className="transfer-groups">
        <LoadsGroup
          loads={data.loads}
          rollShare={data.rollShare}
          sharesNote={data.sharesNote}
        />
        <RollGroup readings={data.roll} />
        <LongitudinalGroup longitudinal={data.longitudinal} />
        <CgGroup
          height={data.cg.height}
          route={data.cg.route}
          routeDetail={data.cg.routeDetail}
        />
      </div>
    </main>
  );
}
