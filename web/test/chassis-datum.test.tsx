import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildFrontViewInput, parseCarModel } from '@setuplab/data';
import { buildFrontViewScene, solveFrontView } from '@setuplab/physics';
import rawModel from '../../assets/models/reference-touring-car.json';
import { HardpointEditor } from '../src/editor/HardpointEditor.js';
import { FrontViewScene } from '../src/scene/FrontViewScene.js';

function referenceModel() {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

describe('chassis datum in the UI', () => {
  it('names the top of the chassis plate as the datum in the editor panel', () => {
    const model = referenceModel();
    const html = renderToStaticMarkup(
      createElement(HardpointEditor, {
        model,
        axle: 'front',
        cornerKey: 'LF',
        edited: false,
        solverRefusal: null,
        onCommit: () => null,
        onReset: () => undefined,
      }),
    );
    expect(html).toContain('top surface of the chassis plate');
    expect(html).toContain('The ground plane is derived below it');
    expect(html).toContain('z / offset z (mm)');
  });

  it('draws the ground line as derived and keeps the datum note visible', () => {
    const input = buildFrontViewInput(referenceModel(), 'LF');
    if (!input.ok) throw new Error(JSON.stringify(input.errors));
    const scene = buildFrontViewScene(input.value, solveFrontView(input.value));

    const html = renderToStaticMarkup(
      createElement(FrontViewScene, {
        scene,
        labels: {
          rollCentreValue: '9.97 mm',
          rollCentreBand: '±1.0 mm',
          instantCentre: null,
          description: 'Front-view elevation.',
        },
        groundLabel: 'ground (derived, z -7.0 mm)',
      }),
    );

    expect(html).toContain('ground (derived, z -7.0 mm)');
    expect(html).toContain('the ground line is derived, not stored');
  });
});
