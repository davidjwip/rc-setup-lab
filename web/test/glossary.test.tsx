import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFrontViewInput, parseCarModel } from '@setuplab/data';
import { buildFrontViewScene, solveFrontView } from '@setuplab/physics';
import rawModel from '../../assets/models/reference-touring-car.json';
import { App } from '../src/app.js';
import { GlossaryView } from '../src/glossary/GlossaryView.js';
import { filterEntries, glossaryEntries } from '../src/glossary/entries.js';
import { routeFromHash } from '../src/route.js';
import { FrontViewScene } from '../src/scene/FrontViewScene.js';

function renderWithHash(hash: string): string {
  vi.stubGlobal('location', { hash });
  try {
    return renderToStaticMarkup(createElement(App));
  } finally {
    vi.unstubAllGlobals();
  }
}

function renderReferenceScene(): string {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error('reference model did not parse');
  const input = buildFrontViewInput(parsed.value, 'LF');
  if (!input.ok) throw new Error('reference LF corner did not build');
  const result = solveFrontView(input.value);

  return renderToStaticMarkup(
    createElement(FrontViewScene, {
      scene: buildFrontViewScene(input.value, result, { includeInstantCentre: true }),
      labels: {
        rollCentreValue: '9.97 mm',
        rollCentreBand: '±1.0 mm',
        instantCentre: '-435.69 mm, 60.51 mm',
        description: 'Front-view elevation of the left-front corner.',
      },
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('glossary', () => {
  it('renders every entry, including the instant centre', () => {
    const html = renderWithHash('#glossary');

    expect(glossaryEntries).toHaveLength(9);
    for (const entry of glossaryEntries) {
      expect(html).toContain(`data-glossary-id="${entry.id}"`);
      expect(html).toContain(`<dt>${entry.term}</dt>`);
    }
    expect(html).toContain('data-glossary-id="instant-centre"');
    expect(html).toContain('Instant centre');
  });

  it('uses a definition list with dt terms and dd definitions', () => {
    const html = renderWithHash('#glossary');

    expect(html).toContain('<dl class="glossary-list">');
    expect(html).toContain('<dt>Roll centre</dt>');
    expect(html).toContain('<dd>');
  });

  it('filters by term and body text, and clearing shows every entry again', () => {
    const byTerm = filterEntries(glossaryEntries, 'damping ratio');
    expect(byTerm.map((entry) => entry.id)).toEqual(['damping-ratio']);

    const byBody = filterEntries(glossaryEntries, 'camber link');
    expect(byBody.map((entry) => entry.id)).toContain('instant-centre');

    expect(filterEntries(glossaryEntries, '')).toHaveLength(glossaryEntries.length);

    const filtered = renderToStaticMarkup(
      createElement(GlossaryView, { initialQuery: 'damping ratio' }),
    );
    expect(filtered).toContain('data-glossary-id="damping-ratio"');
    expect(filtered).not.toContain('data-glossary-id="droop"');
  });

  it('shows a nothing-matched state that can return to the full list', () => {
    const html = renderToStaticMarkup(
      createElement(GlossaryView, { initialQuery: 'not-a-term' }),
    );

    expect(html).toContain('Nothing matched');
    expect(html).toContain('Show all entries');
    expect(html).not.toContain('data-glossary-id="instant-centre"');
  });

  it('deep-links #glossary to the glossary on first load', () => {
    expect(routeFromHash('#glossary')).toEqual({ view: 'glossary' });
    expect(routeFromHash('#glossary/instant-centre')).toEqual({
      view: 'glossary',
      entryId: 'instant-centre',
    });
    expect(routeFromHash('')).toEqual({ view: 'analysis' });

    const html = renderWithHash('#glossary');
    expect(html).toContain('<h1>Glossary</h1>');
    expect(html).toContain('href="#analysis"');
    expect(html).not.toContain('Hardpoints');
  });

  it('marks the deep-linked entry as the active one', () => {
    const html = renderWithHash('#glossary/instant-centre');

    expect(html).toContain('data-glossary-id="instant-centre" data-active="true"');
    expect(html).toContain('data-glossary-id="roll-centre" data-active="false"');
  });

  it('links the drawing labels to their glossary entries', () => {
    const html = renderReferenceScene();

    expect(html).toContain('href="#glossary/roll-centre"');
    expect(html).toContain('href="#glossary/instant-centre"');
  });
});
