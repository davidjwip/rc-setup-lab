import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseCarModel } from '@setuplab/data';
import rawModel from '../../assets/models/reference-touring-car.json';
import { GeometryPage } from '../src/pages/GeometryPage.js';
import {
  createSetupStore,
  type SetupStore,
  type StorageLike,
} from '../src/state/setupStore.js';

function reference() {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

function makeStore(): SetupStore {
  return createSetupStore({ baseline: reference(), storage: memoryStorage() });
}

function renderGeometry(store: SetupStore): string {
  return renderToStaticMarkup(createElement(GeometryPage, { store }));
}

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return match?.[1] ?? null;
}

function columnHtml(html: string, axle: 'front' | 'rear'): string {
  const start = html.indexOf(`data-axle="${axle}"`);
  if (start < 0) return '';
  if (axle === 'front') {
    const end = html.indexOf('data-axle="rear"');
    return end < 0 ? html.slice(start) : html.slice(start, end);
  }
  return html.slice(start);
}

function screwPair(model: ReturnType<typeof reference>, corner: 'LF' | 'LR') {
  const a = model.corners[corner]?.points.lca_in_a;
  const b = model.corners[corner]?.points.lca_in_b;
  if (a === undefined || b === undefined) throw new Error('missing screws');
  return { a: a.value[2], b: b.value[2] };
}

function rearSnapshot(model: ReturnType<typeof reference>): string {
  return JSON.stringify({
    LR: model.corners.LR,
    RR: model.corners.RR,
    rear: model.axles.rear,
  });
}

describe('Geometry page', () => {
  it('shows both axles as Front and Rear with no left/right setup split', () => {
    const html = renderGeometry(makeStore());

    expect(html).toContain('data-axle="front"');
    expect(html).toContain('data-axle="rear"');
    expect(html).toMatch(/<h2[^>]*>Front<\/h2>/);
    expect(html).toMatch(/<h2[^>]*>Rear<\/h2>/);

    const settings = [
      ...html.matchAll(/<section[^>]*data-block="settings"[^>]*>([\s\S]*?)<\/section>/g),
    ].map((match) => match[1] ?? '');
    expect(settings).toHaveLength(2);
    for (const section of settings) {
      expect(section).not.toMatch(/\b(left|right|LF|RF)\b/i);
    }

    expect(html).not.toContain('href="#glossary/');
    expect(html).not.toContain('tabindex="0"');
  });

  it('puts the drawing before the charts before the settings in each column', () => {
    const html = renderGeometry(makeStore());

    for (const axle of ['front', 'rear'] as const) {
      const column = columnHtml(html, axle);
      const drawing = column.indexOf('data-block="drawing"');
      const charts = column.indexOf('data-block="charts"');
      const settings = column.indexOf('data-block="settings"');

      expect(drawing).toBeGreaterThanOrEqual(0);
      expect(charts).toBeGreaterThan(drawing);
      expect(settings).toBeGreaterThan(charts);
    }
  });

  it('uses a displaySmall title and one row of numLarge headline values per column', () => {
    const html = renderGeometry(makeStore());

    expect(html).toMatch(/<h1[^>]*class="[^"]*page-title/);
    expect(html).toContain('Roll-centre height');
    expect(html).toContain('Camber gain');
    expect(html).toContain('Toe gain');
    expect(html).toContain('data-size="large"');
    expect(html).not.toContain('value-block--hero');
    expect(html).not.toContain('numHero');
  });

  it('renders the front and rear goldens', () => {
    const html = renderGeometry(makeStore());

    const front = columnHtml(html, 'front');
    const rear = columnHtml(html, 'rear');

    expect(front).toContain('9.97');
    expect(rear).toContain('17.90');
    expect(front).toContain('-0.11');
    expect(front).toMatch(/-0\.16/);
    expect(rear).toMatch(/\+0\.05/);
  });

  it('enumerates every rendered value and proves provenance never lies', () => {
    const html = renderGeometry(makeStore());
    const tags = [...html.matchAll(/<span[^>]*data-value[^>]*>/g)].map((match) => match[0]);

    expect(tags.length).toBeGreaterThanOrEqual(6);
    for (const tag of tags) {
      const provenance = attr(tag, 'data-provenance');
      const badge = attr(tag, 'data-badge');
      const hasBand = attr(tag, 'data-has-band');
      const band = attr(tag, 'data-band') ?? '';

      expect(provenance).not.toBeNull();
      if (provenance === 'inferred' || provenance === 'estimated') {
        expect(badge).not.toBe('computed');
      }
      if (provenance === 'missing' || provenance === 'undefined') {
        expect(band).toContain('no band');
      } else if (hasBand === 'true') {
        expect(band).toContain('±');
      } else {
        expect(band).toContain('no band');
      }
    }

    expect(tags.some((tag) => attr(tag, 'data-provenance') === 'computed')).toBe(true);
    expect(
      tags.some((tag) => {
        const provenance = attr(tag, 'data-provenance');
        return provenance === 'inferred' || provenance === 'modelled';
      }),
    ).toBe(true);

    const front = columnHtml(html, 'front');
    const rear = columnHtml(html, 'rear');
    expect(front).toMatch(/data-provenance="computed"[^>]*data-accessible-name="Front roll-centre height/);
    expect(rear).toMatch(/data-provenance="modelled"[^>]*data-accessible-name="Rear roll-centre height/);
  });

  it('shows a read-only span, a zero shim and the derived hinge angle', () => {
    const html = renderGeometry(makeStore());

    expect(html).toContain('Span between the screws');
    expect(html).toContain('34.0');
    expect(html).toContain('Shim');
    expect(html).toContain('0.00');
    expect(html).toContain('Hinge angle');
    expect(html).toContain('positive raises the aft screw');
    expect(html).toContain('href="#transfer"');
    expect(html).toContain('anti-dive');
    expect(html).toContain('anti-squat');
  });

  it('writes a front shim once, leaves the rear byte-identical and shows 3.37 degrees', () => {
    const store = makeStore();
    const before = screwPair(store.getSnapshot().model, 'LF');
    const rearBefore = rearSnapshot(store.getSnapshot().model);

    const error = store.commitAxleShim('front', 2);
    expect(error).toBeNull();

    const afterModel = store.getSnapshot().model;
    const after = screwPair(afterModel, 'LF');
    expect((before.a + before.b) / 2).toBeCloseTo((after.a + after.b) / 2, 12);
    expect(after.b - after.a).toBeCloseTo(2, 12);
    expect(rearSnapshot(afterModel)).toBe(rearBefore);

    const html = renderGeometry(store);
    expect(html).toContain('+3.37');
    expect(html).toContain('+2.0');
    expect(columnHtml(html, 'front')).toContain('9.97');
  });

  it('keeps the level-screw goldens when the shim is zero', () => {
    const store = makeStore();
    expect(store.commitAxleShim('front', 0)).toBeNull();
    const html = renderGeometry(store);

    expect(html).toContain('0.00');
    expect(columnHtml(html, 'front')).toContain('9.97');
    expect(columnHtml(html, 'rear')).toContain('17.90');
  });
});
