import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app.js';
import { GlossaryView } from '../src/glossary/GlossaryView.js';
import { routeFromHash } from '../src/route.js';

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

describe('page navigation', () => {
  it('deep-links home, geometry, shock, transfer and the glossary', () => {
    expect(routeFromHash('')).toEqual({ view: 'page', page: 'home' });
    expect(routeFromHash('#home')).toEqual({ view: 'page', page: 'home' });
    expect(routeFromHash('#geometry')).toEqual({ view: 'page', page: 'geometry' });
    expect(routeFromHash('#shock')).toEqual({ view: 'page', page: 'shock' });
    expect(routeFromHash('#transfer')).toEqual({ view: 'page', page: 'transfer' });
    expect(routeFromHash('#glossary')).toEqual({ view: 'glossary' });
  });

  it('marks exactly the current destination with aria-current', () => {
    for (const page of ['home', 'geometry', 'shock', 'transfer'] as const) {
      const html = renderWithHash(`#${page}`);
      expect(html).toMatch(new RegExp(`href="#${page}"[^>]*aria-current="page"`));
      expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    }
  });

  it('keeps a glossary deep link and lets the shell choose the back page', () => {
    const html = renderWithHash('#glossary/instant-centre');
    expect(html).toContain('<h1>Glossary</h1>');
    expect(html).toContain('data-glossary-id="instant-centre" data-active="true"');
    expect(html).toContain('href="#home"');
  });

  it('accepts the exact page that opened the glossary as the back target', () => {
    const html = renderToStaticMarkup(
      createElement(GlossaryView, { backHref: '#geometry' }),
    );
    expect(html).toContain('href="#geometry"');
  });
});
