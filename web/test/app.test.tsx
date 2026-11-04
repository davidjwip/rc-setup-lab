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

  it('offers a front/rear toggle and starts on the measured front view', () => {
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('aria-label="Axle"');
    expect(html).toContain('aria-pressed="true">Front</button>');
    expect(html).toContain('aria-pressed="false">Rear</button>');
    expect(html).toContain('Front-view drawing');
    expect(html).not.toContain('rear geometry mirrored from the front');
    expect(html).not.toContain('rear geometry modelled');
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

  it('renders the roll-stiffness card with the front share as the headline', () => {
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('Roll stiffness');
    expect(html).toContain('61.1 %');
    expect(html).toContain('front share');
    expect(html).toContain('higher front share');
    expect(html).toContain('0.65 N·m/deg');
  });

  it('prints the anti-roll bar rate chain in the maths', () => {
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('k_θ');
    expect(html).toContain('k_bar');
    expect(html).toContain('0.438 N·m/rad');
    expect(html).toContain('IR_arm');
  });

  it('renders the balance card with the front share, TLLT, per-wheel loads and CG route', () => {
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('Balance');
    expect(html).toContain('Lateral acceleration');
    expect(html).toContain('47.01 %');
    expect(html).toContain('2.143 N');
    expect(html).toContain('116.9 %');
    expect(html).toContain('83.1 %');
    expect(html).toContain('stated default (D-18)');
    expect(html).toContain('±0.13 pp');
    expect(html).toContain('front share moves more');
  });

  it('prints the substituted TLLT arithmetic in the maths', () => {
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('TLLT = m·a_y·h / t̄');
    expect(html).toContain('balance = ΔW_f/(ΔW_f + ΔW_r)');
  });
});
