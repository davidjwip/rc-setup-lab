import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnalysisView } from '../src/app.js';

function renderMode(mode: 'front' | 'rear' | 'both'): string {
  return renderToStaticMarkup(createElement(AnalysisView, { initialMode: mode }));
}

describe('chassis roll sensitivity card', () => {
  it('is present in all three views and reads the same values', () => {
    const front = renderMode('front');
    const rear = renderMode('rear');
    const both = renderMode('both');

    for (const html of [front, rear, both]) {
      expect(html.match(/<h2>Chassis roll sensitivity<\/h2>/g)).toHaveLength(1);
      expect(html).toContain('Roll moment arm');
      expect(html).toContain('15.40 mm');
      expect(html).toContain('0.16 °/g');
      expect(html).toContain('0.168 N·m');
      expect(html).toContain('sprung');
    }

    const card = (html: string): string => {
      const start = html.indexOf('<h2>Chassis roll sensitivity</h2>');
      const end = html.indexOf('</article>', start);
      return html.slice(start, end);
    };
    expect(card(front)).toBe(card(rear));
    expect(card(front)).toBe(card(both));
  });
});
