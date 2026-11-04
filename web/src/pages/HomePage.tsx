import type { Confidence } from '@setuplab/physics';
import { serialiseDocument, type BaselineField, type SetupSnapshot } from '../state/setupStore.js';
import type { PageProps } from './PageShell.js';

type Badge = 'computed' | 'estimated' | 'inherited' | 'missing' | 'undefined';

interface BaselineRow {
  readonly field: BaselineField;
  readonly label: string;
  readonly unit: string;
  readonly value: number | null;
  readonly confidence: Confidence | null;
  readonly source: string | null;
  readonly note?: string;
}

interface ProvenanceCounts {
  measured: number;
  modelled: number;
  assumed: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function countProvenance(model: SetupSnapshot['model']): ProvenanceCounts {
  const counts: ProvenanceCounts = { measured: 0, modelled: 0, assumed: 0 };
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const record = asRecord(node);
    if (record === null) return;
    const sourceId = record['source'];
    if (typeof sourceId === 'string' && Object.prototype.hasOwnProperty.call(record, 'value')) {
      const confidence = model.sources[sourceId]?.type;
      if (confidence === 'measured' || confidence === 'derived') counts.measured += 1;
      else if (confidence === 'modelled') counts.modelled += 1;
      else if (
        confidence === 'estimated' ||
        confidence === 'assumed' ||
        confidence === 'manufacturer' ||
        confidence === 'library'
      ) {
        counts.assumed += 1;
      }
    }
    for (const child of Object.values(record)) walk(child);
  };
  walk(model.raw);
  return counts;
}

function badgeFor(confidence: Confidence | null): Badge {
  switch (confidence) {
    case 'measured':
    case 'derived':
      return 'computed';
    case 'manufacturer':
    case 'library':
      return 'inherited';
    case 'modelled':
    case 'estimated':
    case 'assumed':
      return 'estimated';
    default:
      return 'missing';
  }
}

function confidences(
  model: SetupSnapshot['model'],
  source: string | null | undefined,
): Confidence | null {
  if (source === null || source === undefined) return null;
  return model.sources[source]?.type ?? null;
}

function cgRouteLabel(model: SetupSnapshot['model']): string {
  if (model.cg.raiseAndWeigh !== null) return 'measured · raise-and-weigh';
  if (model.cg.components !== null && model.cg.components.length > 0) {
    return 'estimated · component-mass';
  }
  return 'stated default';
}

function modelClass(model: SetupSnapshot['model']): string {
  const value = asRecord(model.raw)?.['class'];
  if (value === 'touring_car_1_10') return '1/10 touring car';
  return typeof value === 'string' ? value : 'class not stated';
}

function sourceLabel(model: SetupSnapshot['model'], source: string | null): string {
  if (source === null) return 'source not recorded';
  const record = model.sources[source];
  switch (record?.type) {
    case 'measured':
      return 'measured on the reference car';
    case 'derived':
      return 'derived from measured weights';
    case 'estimated':
    case 'assumed':
      return 'estimated, not measured';
    case 'modelled':
      return 'modelled, not measured';
    case 'manufacturer':
    case 'library':
      return 'from another car';
    default:
      return 'source recorded';
  }
}

function baselineRows(model: SetupSnapshot['model']): readonly BaselineRow[] {
  return [
    {
      field: 'ride_height',
      label: 'Ride height',
      unit: 'mm',
      value: model.referenceRideHeight?.value ?? null,
      confidence: confidences(model, model.referenceRideHeight?.source),
      source: model.referenceRideHeight?.source ?? null,
    },
    {
      field: 'thickness',
      label: 'Plate thickness',
      unit: 'mm',
      value: model.chassisThickness?.value ?? null,
      confidence: confidences(model, model.chassisThickness?.source),
      source: model.chassisThickness?.source ?? null,
    },
    {
      field: 'front_wheel_diameter',
      label: 'Front wheel diameter',
      unit: 'mm',
      value: model.axles.front.tyreRadius === null ? null : model.axles.front.tyreRadius.value * 2,
      confidence: confidences(model, model.axles.front.tyreRadius?.source),
      source: model.axles.front.tyreRadius?.source ?? null,
    },
    {
      field: 'rear_wheel_diameter',
      label: 'Rear wheel diameter',
      unit: 'mm',
      value:
        model.axles.rear?.tyreRadius === null || model.axles.rear === null
          ? null
          : model.axles.rear.tyreRadius.value * 2,
      confidence: confidences(model, model.axles.rear?.tyreRadius?.source),
      source: model.axles.rear?.tyreRadius?.source ?? null,
    },
    {
      field: 'wheelbase',
      label: 'Wheelbase',
      unit: 'mm',
      value: model.wheelbase?.value ?? null,
      confidence: confidences(model, model.wheelbase?.source),
      source: model.wheelbase?.source ?? null,
    },
    {
      field: 'mass_total',
      label: 'Total mass',
      unit: 'g',
      value: model.mass.total?.value ?? null,
      confidence: confidences(model, model.mass.total?.source),
      source: model.mass.total?.source ?? null,
    },
    {
      field: 'unsprung_front',
      label: 'Front unsprung mass',
      unit: 'g',
      value: model.mass.unsprungFront?.value ?? null,
      confidence: confidences(model, model.mass.unsprungFront?.source),
      source: model.mass.unsprungFront?.source ?? null,
    },
    {
      field: 'unsprung_rear',
      label: 'Rear unsprung mass',
      unit: 'g',
      value: model.mass.unsprungRear?.value ?? null,
      confidence: confidences(model, model.mass.unsprungRear?.source),
      source: model.mass.unsprungRear?.source ?? null,
    },
    {
      field: 'cg_height',
      label: 'CG height',
      unit: 'mm',
      value: model.cg.height?.value ?? null,
      confidence: confidences(model, model.cg.height?.source),
      source: model.cg.height?.source ?? null,
      note: `Route: ${cgRouteLabel(model)}`,
    },
    {
      field: 'front_mass_share',
      label: 'Front mass share',
      unit: '%',
      value: model.cg.frontMassShare?.value ?? null,
      confidence: confidences(model, model.cg.frontMassShare?.source),
      source: model.cg.frontMassShare?.source ?? null,
    },
    {
      field: 'track_front',
      label: 'Front track',
      unit: 'mm',
      value: model.axles.front.track.value,
      confidence: confidences(model, model.axles.front.track.source),
      source: model.axles.front.track.source,
    },
    {
      field: 'track_rear',
      label: 'Rear track',
      unit: 'mm',
      value: model.axles.rear?.track.value ?? null,
      confidence: confidences(model, model.axles.rear?.track.source),
      source: model.axles.rear?.track.source ?? null,
    },
  ];
}

function BaselineValue({
  store,
  row,
}: {
  readonly store: PageProps['store'];
  readonly row: BaselineRow;
}) {
  const id = `baseline-${row.field}`;
  const badge = badgeFor(row.confidence);
  return (
    <div className="baseline-row" data-field={row.field}>
      <label htmlFor={id}>{row.label}</label>
      <div className="baseline-control">
        {row.value === null ? (
          <span className="no-answer">
            Not computable yet. Measure it on Home, or add it to the car file.
          </span>
        ) : (
          <>
            <input
              id={id}
              aria-label={`${row.label} in ${row.unit}`}
              type="number"
              inputMode="decimal"
              step="0.1"
              defaultValue={row.value}
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) store.commitBaseline(row.field, next);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
            />
            <span className="baseline-unit">{row.unit}</span>
          </>
        )}
        <span className={`value-badge value-badge-${badge}`}>{badge}</span>
        <span className="value-band">
          {row.confidence === null ? 'source not recorded' : 'no tolerance recorded'}
        </span>
      </div>
      <p className="baseline-source">
        {sourceLabel(store.getSnapshot().model, row.source)}
        {row.note === undefined ? null : ` · ${row.note}`}
      </p>
    </div>
  );
}

export function HomePage({ store }: PageProps) {
  const snapshot = store.getSnapshot();
  const counts = countProvenance(snapshot.model);
  const rows = baselineRows(snapshot.model);

  return (
    <main className="shell" data-page="home">
      <header className="masthead">
        <p className="eyebrow">Setup Lab</p>
        <h1>Home</h1>
        <p className="lede">
          Choose the car and set the baseline. The car as loaded is the baseline every edit is
          compared against. The values below define the vehicle.
        </p>
      </header>

      <section className="home-grid">
        <article className="card model-card" aria-labelledby="select-model-heading">
          <div className="card-heading">
            <h2 id="select-model-heading">Select model</h2>
          </div>
          <div className="model-choice" data-model-id={snapshot.model.id}>
            <p className="model-name">{snapshot.model.name}</p>
            <p className="model-class">{modelClass(snapshot.model)}</p>
            <p className="model-provenance">
              {counts.measured} measured · {counts.modelled} modelled · {counts.assumed} assumed
            </p>
          </div>
          <p className="hint">
            This build includes one car, so it is selected. Your garage will list more when you add
            them.
          </p>
          <p className="footnote">
            Each value keeps its source. Changing it does not turn it into a measurement.
          </p>
        </article>

        <article className="card baseline-card" aria-labelledby="baseline-heading">
          <div className="card-heading">
            <div>
              <h2 id="baseline-heading">Settings — the baseline</h2>
              <p className="hint">
                The car as loaded. These vehicle-level values are what every edit is compared
                against; setup values live on their own pages.
              </p>
            </div>
          </div>
          <div className="baseline-list" key={serialiseDocument(snapshot.model)}>
            {rows.map((row) => (
              <BaselineValue key={row.field} store={store} row={row} />
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
