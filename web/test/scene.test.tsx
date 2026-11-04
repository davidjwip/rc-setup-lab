import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildFrontViewInput, parseCarModel } from '@setuplab/data';
import { buildFrontViewScene, solveFrontView } from '@setuplab/physics';
import rawModel from '../../assets/models/reference-touring-car.json';
import { FrontViewScene } from '../src/scene/FrontViewScene.js';

function sceneFor(corner: 'LF' | 'LR', includeInstantCentre = false) {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error('reference model did not parse');
  const input = buildFrontViewInput(parsed.value, corner);
  if (!input.ok) throw new Error(`reference ${corner} corner did not build`);
  const result = solveFrontView(input.value);
  return buildFrontViewScene(input.value, result, { includeInstantCentre });
}

function referenceScene(includeInstantCentre = false) {
  return sceneFor('LF', includeInstantCentre);
}

describe('FrontViewScene', () => {
  it('renders the roll-centre value with its band as text', () => {
    const html = renderToStaticMarkup(
      createElement(FrontViewScene, {
        scene: referenceScene(),
        labels: {
          rollCentreValue: '9.97 mm',
          rollCentreBand: '±1.0 mm',
          instantCentre: '-435.69 mm, 60.51 mm',
          description:
            'Front-view elevation of the left-front corner, roll centre 9.97 millimetres.',
        },
      }),
    );

    expect(html).toContain('9.97 mm');
    expect(html).toContain('±1.0 mm');
    expect(html).toContain(
      'aria-label="Front-view elevation of the left-front corner, roll centre 9.97 millimetres."',
    );
  });

  it('exposes each hardpoint as a node with its scene field id', () => {
    const html = renderToStaticMarkup(
      createElement(FrontViewScene, {
        scene: referenceScene(),
        labels: {
          rollCentreValue: '9.97 mm',
          rollCentreBand: '±1.0 mm',
          instantCentre: null,
          description: 'Front-view elevation.',
        },
      }),
    );

    expect(html).toContain('data-field="lca_in"');
    expect(html).toContain('data-field="lca_out"');
    expect(html).toContain('data-field="uca_in"');
    expect(html).toContain('data-field="uca_out"');
    expect(html).toContain('data-field="wheel_centre"');
    expect(html).toContain('data-field="contact_patch"');
    expect(html).toContain('data-field="roll_centre"');
  });

  it('renders the modelled rear badge and names it in the aria-label', () => {
    const front = renderToStaticMarkup(
      createElement(FrontViewScene, {
        scene: referenceScene(),
        labels: {
          rollCentreValue: '9.97 mm',
          rollCentreBand: '±1.0 mm',
          instantCentre: null,
          description: 'Front-view elevation of the left-front corner.',
        },
      }),
    );
    const rear = renderToStaticMarkup(
      createElement(FrontViewScene, {
        scene: sceneFor('LR'),
        labels: {
          rollCentreValue: '9.97 mm',
          rollCentreBand: '±1.0 mm',
          instantCentre: null,
          description: 'Rear-view elevation of the left-rear corner.',
        },
      }),
    );

    const notice = 'rear geometry modelled — not measured';
    expect(rear).toContain(notice);
    expect(rear).toContain('data-field="modelled_geometry"');
    expect(rear).toContain(
      `aria-label="Rear-view elevation of the left-rear corner. ${notice}"`,
    );
    expect(front).not.toContain(notice);
    expect(front).not.toContain('data-field="modelled_geometry"');
    expect(front).toContain('aria-label="Front-view elevation of the left-front corner."');
    expect(front).not.toBe(rear);
  });

  it('does not let colour alone carry the legend', () => {
    const html = renderToStaticMarkup(
      createElement(FrontViewScene, {
        scene: referenceScene(true),
        labels: {
          rollCentreValue: '9.97 mm',
          rollCentreBand: '±1.0 mm',
          instantCentre: null,
          description: 'Front-view elevation.',
        },
      }),
    );

    expect(html).toContain('Solid lines');
    expect(html).toContain('Dashed lines');
    expect(html).toContain('Contact patch');
    expect(html).toContain('Instant centre');
    expect(html).toContain('Damper');
    expect(html).toContain('lower eye to upper eye');
  });

  it('draws the damper at both ends and exposes both eyes', () => {
    for (const corner of ['LF', 'LR'] as const) {
      const html = renderToStaticMarkup(
        createElement(FrontViewScene, {
          scene: sceneFor(corner),
          labels: {
            rollCentreValue: '9.97 mm',
            rollCentreBand: '±1.0 mm',
            instantCentre: null,
            description: `${corner} elevation.`,
          },
        }),
      );
      expect(html).toContain('data-field="damper"');
      expect(html).toContain('data-field="damper_lo"');
      expect(html).toContain('data-field="damper_up"');
    }
  });
});

describe('FrontViewScene instant-centre overlay', () => {
  function render(includeInstantCentre: boolean): string {
    return renderToStaticMarkup(
      createElement(FrontViewScene, {
        scene: referenceScene(includeInstantCentre),
        labels: {
          rollCentreValue: '9.97 mm',
          rollCentreBand: '±1.0 mm',
          instantCentre: includeInstantCentre ? '-435.69 mm, 60.51 mm' : null,
          description: includeInstantCentre
            ? 'Front-view elevation. Instant centre at -435.69 millimetres, 60.51 millimetres.'
            : 'Front-view elevation. Roll centre 9.97 millimetres with band ±1.0 millimetres.',
        },
      }),
    );
  }

  it('draws no instant-centre primitive or label when the overlay is off', () => {
    const html = render(false);

    expect(html).not.toContain('data-field="instant_centre"');
    expect(html).not.toContain('href="#glossary/instant-centre"');
    expect(html).not.toContain('data-field="lower-arm-ray"');
    expect(html).not.toContain('data-field="upper-link-ray"');
    expect(html).toContain('data-field="roll-centre-ray"');
    expect(html).toContain('data-field="roll_centre"');
    expect(html).toContain('9.97 mm');
    expect(html).toContain('±1.0 mm');
  });

  it('draws the instant-centre primitive, label and rays when the overlay is on', () => {
    const html = render(true);

    expect(html).toContain('data-field="instant_centre"');
    expect(html).toContain('href="#glossary/instant-centre"');
    expect(html).toContain('data-field="lower-arm-ray"');
    expect(html).toContain('data-field="upper-link-ray"');
    expect(html).toContain('-435.69 mm, 60.51 mm');
  });

  it('describes only what is drawn in its aria-label', () => {
    const off = render(false);
    const on = render(true);

    expect(off).toContain('aria-label="Front-view elevation. Roll centre 9.97 millimetres');
    expect(off).not.toContain('aria-label="Front-view elevation. Instant centre');
    expect(on).toContain('aria-label="Front-view elevation. Instant centre');
  });
});
