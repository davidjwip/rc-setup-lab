import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFrontViewInput, parseCarModel } from '@setuplab/data';
import { buildFrontViewScene, solveFrontView } from '@setuplab/physics';
import rawModel from '../../assets/models/reference-touring-car.json';
import { FrontViewScene } from '../src/scene/FrontViewScene.js';
import {
  INSTANT_CENTRE_STORAGE_KEY,
  readInstantCentrePreference,
  toggleInstantCentre,
  writeInstantCentrePreference,
  type PreferenceStorage,
} from '../src/scene/instantCentrePreference.js';
import { createSetupStore, type StorageLike } from '../src/state/setupStore.js';
import { buildSceneLabels } from '../src/view/endSummary.js';
import { InstantCentreToggle } from '../src/view/EndPanels.js';

function memoryStorage(
  initial: Record<string, string> = {},
): PreferenceStorage & { readonly values: Map<string, string> } {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function referenceModel() {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function sceneWith(includeInstantCentre: boolean): string {
  const model = referenceModel();
  const input = buildFrontViewInput(model, 'LF');
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  const result = solveFrontView(input.value);
  const scene = buildFrontViewScene(input.value, result, { includeInstantCentre });
  const labels = buildSceneLabels(model, 'front', scene, result, false);
  return renderToStaticMarkup(createElement(FrontViewScene, { scene, labels }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('instant centre preference', () => {
  it('defaults to off when nothing is stored', () => {
    expect(readInstantCentrePreference(memoryStorage())).toBe(false);
    expect(readInstantCentrePreference(null)).toBe(false);
  });

  it('round-trips the choice under one key', () => {
    const storage = memoryStorage();
    writeInstantCentrePreference(true, storage);
    expect(storage.values.get(INSTANT_CENTRE_STORAGE_KEY)).toBe('on');
    expect(readInstantCentrePreference(storage)).toBe(true);

    writeInstantCentrePreference(false, storage);
    expect(storage.values.get(INSTANT_CENTRE_STORAGE_KEY)).toBe('off');
    expect(readInstantCentrePreference(storage)).toBe(false);
  });

  it('flips both ways', () => {
    expect(toggleInstantCentre(false)).toBe(true);
    expect(toggleInstantCentre(true)).toBe(false);
  });

  it('survives a remount by reading the stored choice into the store', () => {
    const storage = memoryStorage();
    writeInstantCentrePreference(true, storage);
    vi.stubGlobal('localStorage', storage);

    const store = createSetupStore({
      baseline: referenceModel(),
      storage: memoryStorage() as unknown as StorageLike,
    });
    expect(store.getSnapshot().includeInstantCentre).toBe(true);
  });

  it('offers a native, keyboard-operable toggle that defaults to off', () => {
    const html = renderToStaticMarkup(
      createElement(InstantCentreToggle, { value: false, onToggle: () => undefined }),
    );
    expect(html).toContain('type="button" aria-pressed="false">Instant centre');
    expect(html).toContain('>off</span>');
  });

  it('announces only the drawn state in the scene aria-label', () => {
    expect(sceneWith(false)).not.toContain('Instant centre at');
    expect(sceneWith(true)).toContain('Instant centre at');
  });
});
