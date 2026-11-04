import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCarModel } from '@setuplab/data';
import rawModel from '../../assets/models/reference-touring-car.json';
import { App } from '../src/app.js';
import { GeometryPage } from '../src/pages/GeometryPage.js';
import { HomePage } from '../src/pages/HomePage.js';
import { ShockPage } from '../src/pages/ShockPage.js';
import { TransferPage } from '../src/pages/TransferPage.js';
import { routeFromHash } from '../src/route.js';
import {
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
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

function store() {
  return createSetupStore({ baseline: reference(), storage: memoryStorage() });
}

function renderWithHash(hash: string): string {
  vi.stubGlobal('location', { hash });
  try {
    return renderToStaticMarkup(createElement(App));
  } finally {
    vi.unstubAllGlobals();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('page shell routes', () => {
  it('deep-links every page and defaults to home', () => {
    expect(routeFromHash('')).toEqual({ view: 'page', page: 'home' });
    expect(routeFromHash('#home')).toEqual({ view: 'page', page: 'home' });
    expect(routeFromHash('#geometry')).toEqual({ view: 'page', page: 'geometry' });
    expect(routeFromHash('#shock')).toEqual({ view: 'page', page: 'shock' });
    expect(routeFromHash('#transfer')).toEqual({ view: 'page', page: 'transfer' });
    expect(routeFromHash('#glossary')).toEqual({ view: 'glossary' });
    expect(routeFromHash('#glossary/instant-centre')).toEqual({
      view: 'glossary',
      entryId: 'instant-centre',
    });
    expect(routeFromHash('#not-a-page')).toEqual({ view: 'page', page: 'home' });
  });

  it('renders each route on first load', () => {
    expect(renderWithHash('#home')).toContain('<h1>Home</h1>');
    expect(renderWithHash('#geometry')).toMatch(/<h1[^>]*>Geometry<\/h1>/);
    expect(renderWithHash('#shock')).toMatch(/<h1[^>]*>Shock<\/h1>/);
    expect(renderWithHash('#transfer')).toMatch(/<h1[^>]*>Transfer<\/h1>/);
  });

  it('has a keyboard-operable top nav with aria-current on the current page', () => {
    const html = renderWithHash('#shock');

    for (const page of ['home', 'geometry', 'shock', 'transfer', 'glossary']) {
      expect(html).toContain(`href="#${page}"`);
    }
    expect(html).toMatch(/href="#shock"[^>]*aria-current="page"/);
    expect(html).not.toMatch(/href="#home"[^>]*aria-current="page"/);
    expect(html).toContain('<nav class="page-nav" aria-label="Setup Lab pages">');
  });

  it('renders the home page as a model picker and a baseline settings panel', () => {
    const html = renderToStaticMarkup(createElement(HomePage, { store: store() }));

    expect(html).toContain('Select model');
    expect(html).toContain('Reference touring car — front corner');
    expect(html).toContain('1/10 touring car');
    expect(html).toMatch(/measured/);
    expect(html).toMatch(/modelled/);
    expect(html).toMatch(/assumed/);
    expect(html).toContain('This build includes one car');
    expect(html).toContain('Settings — the baseline');
    expect(html).toContain('The car as loaded');
    expect(html).toContain('Ride height');
    expect(html).toContain('Plate thickness');
    expect(html).toContain('Wheelbase');
    expect(html).toContain('Total mass');
    expect(html).toContain('unsprung mass');
    expect(html).toContain('CG height');
    expect(html).toContain('Front mass share');
    expect(html).toContain('track');
    expect(html).toContain('value="5"');
    expect(html).toContain('value="257"');
    expect(html).toContain('value="1350"');
    expect(html).toContain('value="21"');
    expect(html).toContain('value="45"');
    expect(html).toContain('value="172"');
    expect(html).toContain('value="174"');
    expect(html).toContain('stated default');
  });

  it('keeps the old view radiogroup out of every page', () => {
    const html = [
      renderToStaticMarkup(createElement(HomePage, { store: store() })),
      renderToStaticMarkup(createElement(GeometryPage, { store: store() })),
      renderToStaticMarkup(createElement(ShockPage, { store: store() })),
      renderToStaticMarkup(createElement(TransferPage, { store: store() })),
      renderWithHash('#glossary'),
    ].join('\n');

    expect(html).not.toContain('role="radiogroup"');
    expect(html).not.toMatch(/>Front<\/button>/);
    expect(html).not.toMatch(/>Rear<\/button>/);
    expect(html).not.toMatch(/>Both<\/button>/);
  });

  it('renders every page from one document without mutating it', () => {
    const shared = store();
    shared.commitBaseline('ride_height', 6);
    const before = serialiseDocument(shared.getSnapshot().model);

    for (const Page of [HomePage, GeometryPage, ShockPage, TransferPage]) {
      renderToStaticMarkup(createElement(Page, { store: shared }));
      expect(serialiseDocument(shared.getSnapshot().model)).toBe(before);
    }
  });

  it('renders the real Geometry, Shock and Transfer pages', () => {
    for (const Page of [GeometryPage, ShockPage, TransferPage]) {
      const html = renderToStaticMarkup(createElement(Page, { store: store() }));
      expect(html).not.toContain('coming in the next slice');
      expect(html).toContain('data-axle="front"');
      expect(html).toContain('data-axle="rear"');
    }
  });
});
