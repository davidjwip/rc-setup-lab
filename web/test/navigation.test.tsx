import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCarModel, updateCornerPointMm } from '@setuplab/data';
import rawModel from '../../assets/models/reference-touring-car.json';
import { AnalysisView, App } from '../src/app.js';
import { routeFromHash } from '../src/route.js';
import { buildEndPanel } from '../src/view/endSummary.js';
import { nextRadioIndex, writeAnalysisModeHash } from '../src/view/viewMode.js';

function renderWithHash(hash: string): string {
  vi.stubGlobal('location', { hash });
  try {
    return renderToStaticMarkup(createElement(App));
  } finally {
    vi.unstubAllGlobals();
  }
}

function referenceModel() {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('view mode navigation', () => {
  it('deep-links front, rear and both through the same hash mechanism as the glossary', () => {
    expect(routeFromHash('#both')).toEqual({ view: 'analysis', mode: 'both' });
    expect(routeFromHash('#rear')).toEqual({ view: 'analysis', mode: 'rear' });
    expect(routeFromHash('#front')).toEqual({ view: 'analysis', mode: 'front' });
    expect(routeFromHash('')).toEqual({ view: 'analysis' });
    expect(routeFromHash('#glossary')).toEqual({ view: 'glossary' });
  });

  it('exposes three radio options with the selected one checked', () => {
    const html = renderWithHash('#rear');

    expect(html).toContain('role="radiogroup"');
    expect(html).toMatch(/role="radio"[^>]*aria-checked="false"[^>]*>Front<\/button>/);
    expect(html).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>Rear<\/button>/);
    expect(html).toMatch(/role="radio"[^>]*aria-checked="false"[^>]*>Both<\/button>/);
  });

  it('moves the radio selection with the arrow, Home and End keys', () => {
    expect(nextRadioIndex(0, 'ArrowRight', 3)).toBe(1);
    expect(nextRadioIndex(1, 'ArrowDown', 3)).toBe(2);
    expect(nextRadioIndex(2, 'ArrowRight', 3)).toBe(0);
    expect(nextRadioIndex(0, 'ArrowLeft', 3)).toBe(2);
    expect(nextRadioIndex(1, 'ArrowUp', 3)).toBe(0);
    expect(nextRadioIndex(1, 'Home', 3)).toBe(0);
    expect(nextRadioIndex(1, 'End', 3)).toBe(2);
    expect(nextRadioIndex(1, 'Tab', 3)).toBe(1);
  });

  it('writes the selected mode to the URL without adding a history entry', () => {
    const replaceState = vi.fn();
    writeAnalysisModeHash('both', { history: { replaceState } });
    expect(replaceState).toHaveBeenCalledWith(null, '', '#both');

    const location = { hash: '' };
    writeAnalysisModeHash('rear', { location });
    expect(location.hash).toBe('#rear');
  });

  it('renders both ends as two labelled drawings on a #both deep link', () => {
    const html = renderWithHash('#both');

    expect(html.match(/data-scene="front-view"/g)).toHaveLength(2);
    expect(html.match(/role="img"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Front-view elevation of the left-front corner.');
    expect(html).toContain('aria-label="Rear-view elevation of the left-rear corner.');
    expect(html).toContain('Hardpoints · front-left');
    expect(html).toContain('Rates · front-left');
    expect(html).toContain('Editing this end');
    expect(html).toContain('Edit this end');
  });

  it('switches the edit target without duplicating the editors', () => {
    const front = renderToStaticMarkup(createElement(AnalysisView, { initialMode: 'both' }));
    const rear = renderToStaticMarkup(
      createElement(AnalysisView, { initialMode: 'both', initialAxle: 'rear' }),
    );

    expect(front).toContain('Hardpoints · front-left');
    expect(front.match(/Hardpoints ·/g)).toHaveLength(1);
    expect(rear).toContain('Hardpoints · rear-left');
    expect(rear.match(/Hardpoints ·/g)).toHaveLength(1);
    expect(rear.match(/data-scene="front-view"/g)).toHaveLength(2);
  });

  it('keeps the badge and band on every strip value', () => {
    const front = buildEndPanel(referenceModel(), 'front', false, false);

    expect(front.strip.map((entry) => entry.id)).toEqual([
      'roll-centre',
      'camber-gain',
      'toe-gain',
      'wheel-rate',
      'ride-frequency',
    ]);
    for (const entry of front.strip) {
      expect(entry.state).not.toBe('');
      expect(entry.band).not.toBe('');
    }
    expect(front.strip[0]?.band).toBe('±1.0 mm');
  });

  it('keeps the front strip bit-identical when only the rear corner is edited', () => {
    const baseline = referenceModel();
    const edited = updateCornerPointMm(baseline, 'LR', 'uca_in', 2, 46);
    if (!edited.ok) throw new Error(JSON.stringify(edited.errors));

    const frontBefore = buildEndPanel(baseline, 'front', false, false);
    const frontAfter = buildEndPanel(edited.value, 'front', false, false);
    const rearBefore = buildEndPanel(baseline, 'rear', false, false);
    const rearAfter = buildEndPanel(edited.value, 'rear', false, false);

    expect(frontAfter.strip).toEqual(frontBefore.strip);
    expect(frontAfter.scene).toEqual(frontBefore.scene);
    expect(rearAfter.strip).not.toEqual(rearBefore.strip);
  });

  it('does not fork the whole-car balance across the three views', () => {
    for (const mode of ['front', 'rear', 'both'] as const) {
      const html = renderToStaticMarkup(createElement(AnalysisView, { initialMode: mode }));
      expect(html.match(/<h2>Balance<\/h2>/g)).toHaveLength(1);
      expect(html).toContain('47.01 %');
    }
  });
});
