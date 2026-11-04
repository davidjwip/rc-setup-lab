import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseCarModel, updateAxleSpringRate, type CarModelDocument } from '@setuplab/data';
import rawModel from '../../assets/models/reference-touring-car.json';
import { AnalysisView } from '../src/app.js';
import { InterpreterPanel } from '../src/interpreter/InterpreterPanel.js';
import { interpret } from '../src/interpreter/interpreter.js';

function referenceModel(): CarModelDocument {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

describe('interpreter panel', () => {
  it('sits in the analysis page and is silent on the unedited model', () => {
    const html = renderToStaticMarkup(createElement(AnalysisView));
    expect(html).toContain('What this change does');
    expect(html).toContain('roll sensitivity');
    expect(html).toContain('unchanged');
    expect(html).not.toContain('interpreter-line');
  });

  it('renders the headline, phase, mechanism and confidence for a change', () => {
    const base = referenceModel();
    const edited = updateAxleSpringRate(base, 'front', 4.0);
    if (!edited.ok) throw new Error(JSON.stringify(edited.errors));

    const html = renderToStaticMarkup(
      createElement(InterpreterPanel, { interpretation: interpret(base, edited.value) }),
    );

    expect(html).toContain('roll sensitivity');
    expect(html).toContain('from baseline');
    expect(html).toContain('mid');
    expect(html).toContain('reliable');
    expect(html).toContain('front share of roll resistance');
    expect(html).toContain('4.00');
    expect(html).toContain('Grip is inferred');
  });
});
