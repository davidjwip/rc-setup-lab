import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Value, type ValueProps } from '../src/view/Value.js';

function render(props: Partial<ValueProps>): string {
  return renderToStaticMarkup(
    createElement(Value, {
      value: '9.97',
      unit: 'mm',
      provenance: 'computed',
      band: '±1.0 mm',
      validation: 'unvalidated',
      accessibleName: 'Roll-centre height, front',
      ...props,
    }),
  );
}

describe('Value', () => {
  it('renders the number, unit, provenance, band, ring and accessible name once', () => {
    const html = render({});

    expect(html).toContain('9.97');
    expect(html).toContain('mm');
    expect(html).toContain('computed');
    expect(html).toContain('±1.0 mm');
    expect(html).toContain('value-ring--unvalidated');
    expect(html).toContain('data-value');
    expect(html).toContain('data-provenance="computed"');
    expect(html).toContain('data-has-band="true"');
    expect(html).toContain(
      'aria-label="Roll-centre height, front, 9.97 mm, ±1.0 mm, computed, unvalidated"',
    );
  });

  it('never lets an inferred value carry a computed badge', () => {
    const html = render({
      provenance: 'inferred',
      accessibleName: 'Camber gain, rear',
    });

    expect(html).toContain('data-provenance="inferred"');
    expect(html).toContain('data-badge="inferred"');
    expect(html).not.toContain('value-provenance--computed');
    expect(html).not.toContain('data-badge="computed"');
  });

  it('never lets an estimated value carry a computed badge', () => {
    const html = render({
      provenance: 'estimated',
      accessibleName: 'Shim, front',
    });

    expect(html).toContain('data-provenance="estimated"');
    expect(html).toContain('data-badge="estimated"');
    expect(html).not.toContain('data-badge="computed"');
  });

  it('prints no band with its reason rather than inventing a tolerance', () => {
    const html = render({
      value: '-0.11',
      unit: '°/mm',
      band: null,
      bandReason: 'the solve stores no camber-gain tolerance',
    });

    expect(html).toContain('data-has-band="false"');
    expect(html).toContain('no band');
    expect(html).toContain('the solve stores no camber-gain tolerance');
    expect(html).not.toContain('±');
  });

  it('uses the refusal copy, not solver codes, when a value has no numeral', () => {
    const missing = render({
      value: null,
      provenance: 'missing',
      band: null,
      bandReason: 'the upper inner pivot height is missing',
      accessibleName: 'Roll-centre height, front',
      reason: 'Roll centre needs the front upper inner pivot height.',
    });
    const undefinedValue = render({
      value: null,
      provenance: 'undefined',
      band: null,
      bandReason: 'the links are parallel',
      accessibleName: 'Instant centre, front',
      reason: 'The front upper and lower links are parallel in front view.',
    });

    expect(missing).toContain('Not computable yet');
    expect(missing).not.toMatch(/>9\.97</);
    expect(missing).not.toContain('parallelLinks');
    expect(missing).not.toContain('lca_in');
    expect(undefinedValue).toContain('Undefined for this geometry');
    expect(undefinedValue).not.toContain('parallelLinks');
  });
});
