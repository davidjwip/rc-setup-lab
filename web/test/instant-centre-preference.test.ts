import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app.js';
import {
  INSTANT_CENTRE_STORAGE_KEY,
  readInstantCentrePreference,
  toggleInstantCentre,
  writeInstantCentrePreference,
  type PreferenceStorage,
} from '../src/scene/instantCentrePreference.js';

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

  it('survives a remount by reading the stored choice', () => {
    const storage = memoryStorage();
    writeInstantCentrePreference(true, storage);
    vi.stubGlobal('localStorage', storage);

    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('type="button" aria-pressed="true">Instant centre');
    expect(html).toContain('>on</span>');
  });

  it('offers a native, keyboard-operable toggle that defaults to off', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('type="button" aria-pressed="false">Instant centre');
    expect(html).toContain('>off</span>');
    expect(html).not.toContain('data-field="instant_centre"');
  });

  it('announces only the drawn state in the scene aria-label', () => {
    vi.stubGlobal('localStorage', memoryStorage({ [INSTANT_CENTRE_STORAGE_KEY]: 'off' }));
    const off = renderToStaticMarkup(createElement(App));
    expect(off).not.toContain('Instant centre at');

    vi.stubGlobal('localStorage', memoryStorage({ [INSTANT_CENTRE_STORAGE_KEY]: 'on' }));
    const on = renderToStaticMarkup(createElement(App));
    expect(on).toContain('Instant centre at');
    expect(on).toContain('data-field="instant_centre"');
  });
});
