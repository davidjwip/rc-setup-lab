import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app.js';

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

describe('Setup Lab shell', () => {
  it('starts on Home with the model and baseline panels', () => {
    const html = renderWithHash('#home');

    expect(html).toContain('<h1>Home</h1>');
    expect(html).toContain('Select model');
    expect(html).toContain('Settings — the baseline');
    expect(html).toContain('Reference touring car — front corner');
    expect(html).toContain('Ride height');
  });

  it('does not render the old single-page result cards', () => {
    const html = renderWithHash('#home');

    expect(html).not.toContain('Roll-centre height');
    expect(html).not.toContain('Camber gain');
    expect(html).not.toContain('Show the maths');
    expect(html).not.toContain('Front-view drawing');
  });

  it('routes Geometry, Shock and Transfer to their real pages', () => {
    expect(renderWithHash('#geometry')).toContain('data-axle="front"');
    expect(renderWithHash('#geometry')).not.toContain('coming in the next slice');
    expect(renderWithHash('#shock')).toContain('data-axle="front"');
    expect(renderWithHash('#shock')).toContain('data-axle="rear"');
    expect(renderWithHash('#shock')).not.toContain('coming in the next slice');
    expect(renderWithHash('#transfer')).toContain('data-axle="front"');
    expect(renderWithHash('#transfer')).toContain('data-axle="rear"');
    expect(renderWithHash('#transfer')).not.toContain('coming in the next slice');
  });
});
