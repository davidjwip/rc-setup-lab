import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  parseCarModel,
  updateAxleArbType,
  type CarModelDocument,
} from '@setuplab/data';
import rawModel from '../../assets/models/reference-touring-car.json';
import { RatesEditor } from '../src/editor/RatesEditor.js';

function referenceModel(): CarModelDocument {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function noneModel(): CarModelDocument {
  const parsed = updateAxleArbType(referenceModel(), 'front', 'none');
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function inputTag(html: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.match(new RegExp(`<input[^>]*aria-label="${escaped}"[^>]*>`))?.[0] ?? '';
}

function renderRates(axle: 'front' | 'rear'): string {
  return renderToStaticMarkup(
    createElement(RatesEditor, {
      model: referenceModel(),
      axle,
      edited: false,
      solverRefusal: null,
      changeNote: null,
      onCommit: () => null,
      onReset: () => undefined,
    }),
  );
}

describe('rates editor follows the selected axle', () => {
  it('renders the rear spring rate and rear outputs when Rear is selected', () => {
    const html = renderRates('rear');
    expect(inputTag(html, 'Spring rate in N/mm')).toContain('value="2.6"');
    expect(html).toContain('Rates · rear-left');
    expect(html).toContain('10.0 Hz');
    expect(html).toContain('39.21 N·s/m');
    expect(html).toContain('Damping ratio');
    expect(html).toContain('estimated');
  });

  it('shows the computed outputs and the provenance of a model value', () => {
    const html = renderRates('front');
    expect(inputTag(html, 'Spring rate in N/mm')).toContain('value="3.5"');
    expect(inputTag(html, 'Damper coefficient in N·s/m')).toContain('value="12"');
    expect(html).toContain('Rates · front-left');
    expect(html).toContain('ARB wheel rate');
    expect(html).toContain('Axle roll stiffness');
    expect(html).toContain('Front share');
    expect(html).toContain('modelled · not measured');
  });

  it('disables the bar geometry rows instead of zeroing them when the bar is none', () => {
    const html = renderToStaticMarkup(
      createElement(RatesEditor, {
        model: noneModel(),
        axle: 'front',
        edited: false,
        solverRefusal: null,
        changeNote: null,
        onCommit: () => null,
        onReset: () => undefined,
      }),
    );

    expect(inputTag(html, 'ARB bar diameter in mm')).toContain('disabled');
    expect(inputTag(html, 'ARB span in mm')).toContain('disabled');
    expect(inputTag(html, 'ARB arm length in mm')).toContain('disabled');
    expect(inputTag(html, 'ARB bar diameter in mm')).toContain('value="1.5"');
  });

  it('offers a reset that is separate from the hardpoint reset', () => {
    const html = renderToStaticMarkup(
      createElement(RatesEditor, {
        model: referenceModel(),
        axle: 'front',
        edited: true,
        solverRefusal: null,
        changeNote: null,
        onCommit: () => null,
        onReset: () => undefined,
      }),
    );
    expect(html).toContain('Reset this axle');
    expect(html).toContain('Hardpoint reset is separate');
  });
});
