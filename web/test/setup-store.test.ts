import { describe, expect, it } from 'vitest';
import { parseCarModel } from '@setuplab/data';
import rawModel from '../../assets/models/reference-touring-car.json';
import { routeFromHash } from '../src/route.js';
import {
  MODEL_STORAGE_KEY,
  createSetupStore,
  serialiseDocument,
  type StorageLike,
} from '../src/state/setupStore.js';

function reference() {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

describe('setup document store', () => {
  it('keeps a rear-spring edit through the glossary and back (B1)', () => {
    const store = createSetupStore({ baseline: reference(), storage: memoryStorage() });
    expect(store.commitRateChange('rear', { kind: 'spring', valueNmm: 3.3 })).toBeNull();

    const edited = serialiseDocument(store.getSnapshot().model);
    expect(store.getSnapshot().model.axles.rear?.springRate?.value).toBe(3.3);

    expect(routeFromHash('#glossary').view).toBe('glossary');
    const geometry = routeFromHash('#geometry');
    expect(geometry.view).toBe('page');
    if (geometry.view !== 'page') return;
    expect(geometry.page).toBe('geometry');
    for (const hash of ['#glossary', '#geometry', '#shock', '#transfer', '#home']) {
      routeFromHash(hash);
      expect(serialiseDocument(store.getSnapshot().model)).toBe(edited);
    }

    expect(store.getSnapshot().model.axles.rear?.springRate?.value).toBe(3.3);
    expect(store.getSnapshot().edited).toBe(true);
  });

  it('leaves the document byte-identical while visiting all four pages', () => {
    const store = createSetupStore({ baseline: reference(), storage: memoryStorage() });
    store.commitBaseline('ride_height', 6);
    const before = serialiseDocument(store.getSnapshot().model);

    for (const page of ['home', 'geometry', 'shock', 'transfer', 'home'] as const) {
      const route = routeFromHash(`#${page}`);
      expect(route.view).toBe('page');
      if (route.view === 'page') expect(route.page).toBe(page);
      expect(serialiseDocument(store.getSnapshot().model)).toBe(before);
    }
  });

  it('survives a reload and reverts to the loaded baseline', () => {
    const storage = memoryStorage();
    const first = createSetupStore({ baseline: reference(), storage });
    first.commitBaseline('ride_height', 6.0);
    first.commitRateChange('rear', { kind: 'spring', valueNmm: 3.3 });

    expect(storage.getItem(MODEL_STORAGE_KEY)).not.toBeNull();

    const reloaded = createSetupStore({ baseline: reference(), storage });
    expect(reloaded.getSnapshot().model.referenceRideHeight?.value).toBe(6);
    expect(reloaded.getSnapshot().model.axles.rear?.springRate?.value).toBe(3.3);
    expect(reloaded.getSnapshot().edited).toBe(true);

    reloaded.revertAll();
    expect(reloaded.getSnapshot().model.referenceRideHeight?.value).toBe(5);
    expect(reloaded.getSnapshot().model.axles.rear?.springRate?.value).toBe(2.6);
    expect(reloaded.getSnapshot().edited).toBe(false);
    expect(storage.getItem(MODEL_STORAGE_KEY)).toBeNull();
  });

  it('ignores a corrupt persisted document instead of failing to load', () => {
    const storage = memoryStorage();
    storage.setItem(MODEL_STORAGE_KEY, '{not json');
    const store = createSetupStore({ baseline: reference(), storage });
    expect(store.getSnapshot().model.name).toBe('Reference touring car — front corner');
    expect(store.getSnapshot().edited).toBe(false);
  });
});
