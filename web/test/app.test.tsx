import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app.js';

describe('R0 screen', () => {
  it('renders the reference roll-centre height with its band and camber gain', () => {
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('Roll-centre height');
    expect(html).toContain('9.97 mm');
    expect(html).toContain('±1.0 mm');
    expect(html).toContain('Camber gain');
    expect(html).toContain('-0.11 °/mm');
    expect(html).toContain('Show the maths');
  });

  it('prints the substituted roll-centre arithmetic', () => {
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('-435.69 mm');
    expect(html).toContain('-0.115987');
  });

  it('renders the wheel rate, ride frequency and the k_w substitution', () => {
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('Wheel rate');
    expect(html).toContain('1.12 N/mm');
    expect(html).toContain('10.8 Hz');
    expect(html).toContain('k_w = k_s × IR²');
    expect(html).toContain('33.02 N·s/m');
  });
});
