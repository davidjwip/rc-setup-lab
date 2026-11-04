import { useSyncExternalStore } from 'react';
import {
  parseCarModel,
  resetAxleRates,
  resetCornerPointsMm,
  restoreCornerPointMm,
  updateAxleArbBlades,
  updateAxleArbType,
  updateAxleArbValue,
  updateAxleDamperCoefficient,
  updateAxleLowerInnerShimMm,
  updateAxleSpringRate,
  updateAxleTrack,
  updateBodyWheelbase,
  updateDamperMountLateralMm,
  updateCgFrontMassShare,
  updateCgHeight,
  updateChassisValue,
  updateCornerPointMm,
  updateMassTotal,
  updateUnsprungMass,
  type CarModelDocument,
  type ChassisValueField,
  type CornerKey,
  type CornerPointKey,
  type DataResult,
} from '@setuplab/data';
import rawModel from '../../../assets/models/reference-touring-car.json';
import {
  describeRateChange,
  rateSnapshot,
  type RateChange,
  type RateAxle,
} from '../editor/rates.js';
import {
  readInstantCentrePreference,
  toggleInstantCentre,
  writeInstantCentrePreference,
} from '../scene/instantCentrePreference.js';

/** The two damper eyes, in the page's words. Positive shims move outboard. */
export type DamperMountShim = 'lo' | 'up';

export const MODEL_STORAGE_KEY = 'setup-lab:model:v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type BaselineField =
  | ChassisValueField
  | 'wheelbase'
  | 'mass_total'
  | 'unsprung_front'
  | 'unsprung_rear'
  | 'cg_height'
  | 'front_mass_share'
  | 'track_front'
  | 'track_rear';

export interface SetupSnapshot {
  readonly model: CarModelDocument;
  readonly baseline: CarModelDocument;
  readonly edited: boolean;
  readonly rateNote: string | null;
  readonly lateralG: number;
  readonly longitudinalG: number;
  readonly includeInstantCentre: boolean;
  readonly editedCorners: ReadonlySet<CornerKey>;
  readonly editedRateAxles: ReadonlySet<RateAxle>;
}

export interface SetupStore {
  getSnapshot(): SetupSnapshot;
  subscribe(listener: () => void): () => void;
  commitBaseline(field: BaselineField, value: number): string | null;
  commitHardpoint(
    cornerKey: CornerKey,
    pointKey: CornerPointKey,
    axis: 1 | 2,
    valueMm: number,
  ): string | null;
  resetCorner(cornerKey: CornerKey): void;
  commitRateChange(axle: RateAxle, change: RateChange): string | null;
  commitArbBlades(axle: RateAxle, count: number): string | null;
  resetRateAxle(axle: RateAxle): void;
  commitAxleShim(axle: RateAxle, shimMm: number): string | null;
  commitDamperMountShim(
    axle: RateAxle,
    mount: DamperMountShim,
    offsetMm: number,
  ): string | null;
  revertAll(): void;
  setLateralG(value: number): void;
  setLongitudinalG(value: number): void;
  toggleInstantCentre(): void;
}

export interface CreateSetupStoreOptions {
  readonly baseline?: CarModelDocument | undefined;
  readonly storage?: StorageLike | null | undefined;
}

const CORNER_KEYS: readonly CornerKey[] = ['LF', 'RF', 'LR', 'RR'];
const RATE_AXLES: readonly RateAxle[] = ['front', 'rear'];

const parsedReference = parseCarModel(rawModel);

function referenceBaseline(): CarModelDocument {
  if (!parsedReference.ok) {
    throw new Error(parsedReference.errors.map((error) => error.message).join('; '));
  }
  return parsedReference.value;
}

export function resolveStorage(): StorageLike | null {
  try {
    const candidate = (globalThis as { localStorage?: StorageLike }).localStorage;
    return candidate ?? null;
  } catch {
    return null;
  }
}

export function serialiseDocument(model: CarModelDocument): string {
  return JSON.stringify(model.raw);
}

export function documentsMatch(left: CarModelDocument, right: CarModelDocument): boolean {
  return serialiseDocument(left) === serialiseDocument(right);
}

export function loadStoredDocument(
  baseline: CarModelDocument,
  storage: StorageLike | null,
): CarModelDocument {
  if (storage === null) return baseline;
  try {
    const text = storage.getItem(MODEL_STORAGE_KEY);
    if (text === null) return baseline;
    const parsed = parseCarModel(JSON.parse(text));
    return parsed.ok ? parsed.value : baseline;
  } catch {
    return baseline;
  }
}

export function persistDocument(model: CarModelDocument, storage: StorageLike | null): void {
  if (storage === null) return;
  try {
    storage.setItem(MODEL_STORAGE_KEY, serialiseDocument(model));
  } catch {
    // Persistence is best-effort; the in-memory document stays authoritative.
  }
}

export function clearStoredDocument(storage: StorageLike | null): void {
  if (storage === null) return;
  try {
    storage.removeItem(MODEL_STORAGE_KEY);
  } catch {
    // Nothing to recover: the caller is already back on the baseline.
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function signature(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function editedCorners(model: CarModelDocument, baseline: CarModelDocument): ReadonlySet<CornerKey> {
  const current = asRecord(asRecord(model.raw)?.['corners']);
  const original = asRecord(asRecord(baseline.raw)?.['corners']);
  return new Set(
    CORNER_KEYS.filter((key) => signature(current?.[key]) !== signature(original?.[key])),
  );
}

function editedRateAxles(
  model: CarModelDocument,
  baseline: CarModelDocument,
): ReadonlySet<RateAxle> {
  const currentAxles = asRecord(asRecord(model.raw)?.['axles']);
  const originalAxles = asRecord(asRecord(baseline.raw)?.['axles']);
  const currentCorners = asRecord(asRecord(model.raw)?.['corners']);
  const originalCorners = asRecord(asRecord(baseline.raw)?.['corners']);
  return new Set(
    RATE_AXLES.filter((axle) => {
      if (signature(currentAxles?.[axle]) !== signature(originalAxles?.[axle])) return true;
      const corner = axle === 'front' ? 'LF' : 'LR';
      return (
        signature(asRecord(currentCorners?.[corner])?.['damper']) !==
        signature(asRecord(originalCorners?.[corner])?.['damper'])
      );
    }),
  );
}

function errorsOf(result: DataResult<CarModelDocument>): string {
  return result.ok
    ? ''
    : result.errors.map((error) => `${error.path}: ${error.message}`).join('; ');
}

export function createSetupStore(options: CreateSetupStoreOptions = {}): SetupStore {
  const baseline = options.baseline ?? referenceBaseline();
  const storage = options.storage === undefined ? resolveStorage() : options.storage;

  let model = loadStoredDocument(baseline, storage);
  let rateNote: string | null = null;
  let lateralG = 1.0;
  let longitudinalG = 1.0;
  let includeInstantCentre = readInstantCentrePreference();
  const listeners = new Set<() => void>();

  const buildSnapshot = (): SetupSnapshot => ({
    model,
    baseline,
    edited: !documentsMatch(model, baseline),
    rateNote,
    lateralG,
    longitudinalG,
    includeInstantCentre,
    editedCorners: editedCorners(model, baseline),
    editedRateAxles: editedRateAxles(model, baseline),
  });

  let snapshot = buildSnapshot();

  const publish = (): void => {
    snapshot = buildSnapshot();
    for (const listener of listeners) listener();
  };

  const apply = (result: DataResult<CarModelDocument>): string | null => {
    if (!result.ok) return errorsOf(result);
    model = result.value;
    persistDocument(model, storage);
    publish();
    return null;
  };

  const store: SetupStore = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    commitBaseline: (field, value) => {
      switch (field) {
        case 'ride_height':
        case 'thickness':
        case 'front_wheel_diameter':
        case 'rear_wheel_diameter':
          return apply(updateChassisValue(model, field, value));
        case 'wheelbase':
          return apply(updateBodyWheelbase(model, value));
        case 'mass_total':
          return apply(updateMassTotal(model, value));
        case 'unsprung_front':
          return apply(updateUnsprungMass(model, 'front', value));
        case 'unsprung_rear':
          return apply(updateUnsprungMass(model, 'rear', value));
        case 'cg_height':
          return apply(updateCgHeight(model, value));
        case 'front_mass_share':
          return apply(updateCgFrontMassShare(model, value));
        case 'track_front':
          return apply(updateAxleTrack(model, 'front', value));
        case 'track_rear':
          return apply(updateAxleTrack(model, 'rear', value));
      }
    },
    commitHardpoint: (cornerKey, pointKey, axis, valueMm) =>
      apply(updateCornerPointMm(model, cornerKey, pointKey, axis, valueMm)),
    resetCorner: (cornerKey) => {
      const result = resetCornerPointsMm(model, baseline, cornerKey);
      if (result.ok) {
        model = result.value;
        persistDocument(model, storage);
        publish();
      }
    },
    commitRateChange: (axle, change) => {
      const before = rateSnapshot(model, axle, lateralG);
      let result: DataResult<CarModelDocument>;
      switch (change.kind) {
        case 'spring':
          result = updateAxleSpringRate(model, axle, change.valueNmm);
          break;
        case 'damper':
          result = updateAxleDamperCoefficient(model, axle, change.valueNsPerM);
          break;
        case 'arbType':
          result = updateAxleArbType(model, axle, change.value);
          break;
        case 'arbValue':
          result = updateAxleArbValue(model, axle, change.field, change.valueMm);
          break;
      }
      if (!result.ok) return errorsOf(result);
      const after = rateSnapshot(result.value, axle, lateralG);
      model = result.value;
      rateNote = describeRateChange(change, axle, before, after);
      persistDocument(model, storage);
      publish();
      return null;
    },
    commitArbBlades: (axle, count) => apply(updateAxleArbBlades(model, axle, count)),
    resetRateAxle: (axle) => {
      const result = resetAxleRates(model, baseline, axle);
      if (result.ok) {
        model = result.value;
        rateNote = null;
        persistDocument(model, storage);
        publish();
      }
    },
    commitAxleShim: (axle, shimMm) => apply(updateAxleLowerInnerShimMm(model, axle, shimMm)),
    commitDamperMountShim: (axle, mount, offsetMm) => {
      const cornerKey = axle === 'front' ? 'LF' : 'LR';
      const pointKey = mount === 'lo' ? 'damper_lo' : 'damper_up';
      const eyeName = mount === 'lo' ? 'lower damper eye' : 'upper damper eye';
      if (offsetMm === 0) {
        return apply(restoreCornerPointMm(model, baseline, cornerKey, pointKey));
      }
      const base = baseline.corners[cornerKey]?.points[pointKey];
      if (base === undefined) {
        return `The ${axle} ${eyeName} is not in the model, so it cannot be shimmed.`;
      }
      return apply(
        updateDamperMountLateralMm(model, axle, pointKey, base.value[1] + offsetMm),
      );
    },
    revertAll: () => {
      model = baseline;
      rateNote = null;
      clearStoredDocument(storage);
      publish();
    },
    setLateralG: (value) => {
      lateralG = value;
      publish();
    },
    setLongitudinalG: (value) => {
      longitudinalG = value;
      publish();
    },
    toggleInstantCentre: () => {
      includeInstantCentre = toggleInstantCentre(includeInstantCentre);
      writeInstantCentrePreference(includeInstantCentre);
      publish();
    },
  };

  return store;
}

export function useSetupStore(store: SetupStore): SetupSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
