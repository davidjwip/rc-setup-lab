import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildFrontViewInput, parseCarModel } from '@setuplab/data';
import { buildFrontViewScene, solveFrontView } from '@setuplab/physics';
import rawModel from '../../assets/models/reference-touring-car.json';
import { FrontViewScene } from '../src/scene/FrontViewScene.js';

function sceneFor(corner: 'LF' | 'LR') {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error('reference model did not parse');
  const input = buildFrontViewInput(parsed.value, corner);
  if (!input.ok) throw new Error(`reference ${corner} corner did not build`);
  const result = solveFrontView(input.value);
  return buildFrontViewScene(input.value, result);
}

function referenceScene() {
  return sceneFor('LF');
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

  it('renders the derived rear badge and names it in the aria-label', () => {
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

    const notice = 'rear geometry mirrored from the front — not measured';
    expect(rear).toContain(notice);
    expect(rear).toContain(
      `aria-label="Rear-view elevation of the left-rear corner. ${notice}"`,
    );
    expect(front).not.toContain(notice);
    expect(front).toContain('aria-label="Front-view elevation of the left-front corner."');
    expect(front).not.toBe(rear);
  });

  it('does not let colour alone carry the legend', () => {
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

    expect(html).toContain('Solid lines');
    expect(html).toContain('Dashed lines');
    expect(html).toContain('Contact patch');
    expect(html).toContain('Instant centre');
  });
});
