import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnalysisView } from '../src/app.js';

function renderMode(mode: 'front' | 'rear' | 'both'): string {
  return renderToStaticMarkup(createElement(AnalysisView, { initialMode: mode }));
}

describe('anti-dive and anti-squat card', () => {
  it('is present in all three views and states the two-screw input and caster caveat', () => {
    for (const html of [renderMode('front'), renderMode('rear'), renderMode('both')]) {
      expect(html.match(/<h2>Anti-dive and anti-squat<\/h2>/g)).toHaveLength(1);
      expect(html).toContain('two inner pivot screws');
      expect(html).toContain('front view uses their midpoint');
      expect(html).toContain('Caster is not modelled');
      expect(html).toContain('modelled');
      expect(html).toContain('Anti-dive');
      expect(html).toContain('Anti-squat');
    }
  });

  it('reports exactly 0.0 % at both ends for the level reference screws at ±1.0 g', () => {
    const html = renderMode('front');
    expect(html).toContain('±1.0 g');
    expect(html.match(/0\.0 %/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('traction limit');
    expect(html).toContain('conservative');
  });
});
