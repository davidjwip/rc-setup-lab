import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnalysisView } from '../src/app.js';

function renderMode(mode: 'front' | 'rear' | 'both'): string {
  return renderToStaticMarkup(createElement(AnalysisView, { initialMode: mode }));
}

describe('caster and steering-axis card', () => {
  it('shows caster, KPI, scrub and trail with the reference values and their signs', () => {
    for (const mode of ['front', 'both'] as const) {
      const html = renderMode(mode);
      expect(html.match(/<h2>Caster and steering-axis geometry<\/h2>/g)).toHaveLength(1);
      expect(html).toContain('7.70 °');
      expect(html).toContain('8.00 °');
      expect(html).toContain('7.02 mm');
      expect(html).toContain('2.95 mm');
      expect(html).toContain('positive = axis top rearward');
      expect(html).toContain('positive = axis top inboard');
      expect(html).toContain('positive = axis meets the road inboard');
      expect(html).toContain('positive = axis meets the road ahead of the patch');
    }
  });

  it('does not render on the rear corner, which has no steering axis', () => {
    const html = renderMode('rear');
    expect(html).not.toContain('Caster and steering-axis geometry');
    expect(html).not.toContain('Camber in steer');
  });

  it('shows the camber-in-steer series and the split anti-dive contributions', () => {
    const html = renderMode('front');
    expect(html).toContain('Camber in steer');
    expect(html).toContain('at 20°: inside');
    expect(html).toContain('outside');
    expect(html).toContain('camber-line-inside');
    expect(html).toContain('camber-line-outside');
    expect(html).toContain('Positive steer turns the car left');
    expect(html).toContain('positive camber is top outboard');
    expect(html).toContain('Anti-dive split at braking');
    expect(html).toContain('steering axis: not modelled (TODO)');
  });
});
