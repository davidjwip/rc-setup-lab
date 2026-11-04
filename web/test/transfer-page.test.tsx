import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseCarModel } from '@setuplab/data';
import rawModel from '../../assets/models/reference-touring-car.json';
import { buildGeometryColumn } from '../src/pages/geometryData.js';
import { GeometryPage } from '../src/pages/GeometryPage.js';
import { TransferPage } from '../src/pages/TransferPage.js';
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

function renderTransfer(store: SetupStore): string {
  return renderToStaticMarkup(createElement(TransferPage, { store }));
}

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return match?.[1] ?? null;
}

/** The `<Value>` tag whose accessible name is exactly `name`. */
function valueTag(html: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    new RegExp(`<span[^>]*data-accessible-name="${escaped}"[^>]*>`).exec(html)?.[0] ?? ''
  );
}

/** The numeral inside the `<Value>` whose accessible name is exactly `name`. */
function valueText(html: string, name: string): string {
  const tag = valueTag(html, name);
  if (tag === '') return '';
  const at = html.indexOf(tag);
  const rest = html.slice(at);
  const match = /<span[^>]*class="value-number[^"]*"[^>]*>([^<]*)<\/span>/.exec(rest);
  return match?.[1] ?? '';
}

function geometrySnapshots(store: SetupStore): string {
  const snapshot = store.getSnapshot();
  return JSON.stringify({
    front: buildGeometryColumn(
      snapshot.model,
      'front',
      false,
      false,
      snapshot.baseline,
    ),
    rear: buildGeometryColumn(
      snapshot.model,
      'rear',
      false,
      false,
      snapshot.baseline,
    ),
  });
}

describe('Transfer page', () => {
  it('has exactly one hero, and it is the front load-transfer share', () => {
    const html = renderTransfer(makeStore());

    expect(html.match(/numHero/g) ?? []).toHaveLength(1);
    expect(html.match(/data-size="hero"/g) ?? []).toHaveLength(1);
    expect(valueTag(html, 'Front load-transfer share')).toContain('numHero');
    expect(valueText(html, 'Front load-transfer share')).toBe('47.46');
    expect(valueTag(html, 'Front load-transfer share')).toMatch(
      /data-provenance="(inferred|estimated)"/,
    );
    expect(valueTag(html, 'Front load-transfer share')).toContain('data-band="±0.13 pp"');
    expect(html).toContain('front carries this share of the total transfer');
    expect(html).not.toMatch(/understeer|oversteer|faster setup|better setup/i);
  });

  it('enumerates every rendered value and proves provenance never lies', () => {
    const html = renderTransfer(makeStore());
    const tags = [...html.matchAll(/<span[^>]*data-value[^>]*>/g)].map((match) => match[0]);

    expect(tags.length).toBeGreaterThanOrEqual(20);
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
        return provenance === 'inferred' || provenance === 'modelled' || provenance === 'estimated';
      }),
    ).toBe(true);
    expect(html).not.toContain('computed ·');
  });

  it('is live from 1.0 g to 2.0 g and leaves geometry-derived quantities bit-identical', () => {
    const store = makeStore();
    store.setLateralG(1);
    const geometryBefore = geometrySnapshots(store);
    const one = Number(valueText(renderTransfer(store), 'Total load transfer (TLLT)'));
    const wheelNames = [
      'Front left wheel load',
      'Front right wheel load',
      'Rear left wheel load',
      'Rear right wheel load',
    ] as const;
    const wheelSeries = new Map<string, number[]>(wheelNames.map((name) => [name, []]));

    for (const lateralG of [0.1, 0.5, 1, 1.5, 2, 2.5]) {
      store.setLateralG(lateralG);
      const html = renderTransfer(store);
      for (const name of wheelNames) {
        wheelSeries.get(name)?.push(Number(valueText(html, name)));
      }
    }

    store.setLateralG(2);
    const atTwo = renderTransfer(store);
    const two = Number(valueText(atTwo, 'Total load transfer (TLLT)'));
    expect(valueText(atTwo, 'Lateral acceleration')).toBe('2.0');
    expect(atTwo).toContain('Per-wheel load at 2.0 g');
    expect(Number.isFinite(one)).toBe(true);
    expect(Number.isFinite(two)).toBe(true);
    expect(Math.abs(two - 2 * one) / (2 * one)).toBeLessThan(0.143);
    expect(Math.abs(two - 2 * one)).toBeLessThanOrEqual(0.02);

    for (const [name, values] of wheelSeries) {
      const increases = name.includes('right');
      for (let index = 1; index < values.length; index += 1) {
        const before = values[index - 1] ?? 0;
        const after = values[index] ?? 0;
        if (increases) {
          expect(after).toBeGreaterThan(before);
        } else {
          expect(after).toBeLessThan(before);
        }
      }
    }

    expect(geometrySnapshots(store)).toBe(geometryBefore);
  });

  it('reads the roll sensitivity and the arm at 1.0 g with the stated bands', () => {
    const store = makeStore();
    store.setLateralG(1);
    const html = renderTransfer(store);
    const sensitivity = valueTag(html, 'Chassis roll sensitivity');
    const arm = valueTag(html, 'Roll moment arm');

    expect(valueText(html, 'Chassis roll sensitivity')).toBe('0.2');
    expect(valueText(html, 'Roll moment arm')).toBe('15.397');
    expect(sensitivity).toContain('data-has-band="true"');
    expect(attr(sensitivity, 'data-band')).toMatch(/±.*°\/g/);
    expect(arm).toContain('data-has-band="true"');
    expect(attr(arm, 'data-band')).toMatch(/±.*mm/);
  });

  it('agrees with the Geometry shim row: level 0.00 %, +2 mm aft −60.16 %', () => {
    const store = makeStore();
    const level = renderTransfer(store);
    expect(valueText(level, 'Front anti-dive')).toBe('0.00');

    expect(store.commitAxleShim('front', 2)).toBeNull();
    const shimmed = renderTransfer(store);
    const geometry = renderToStaticMarkup(createElement(GeometryPage, { store }));

    expect(valueText(shimmed, 'Front anti-dive')).toBe('-60.16');
    expect(geometry).toContain('value="+2.0"');
    expect(geometry).toContain('+2.0');
  });

  it('puts both axles and four labelled wheels on the diagram, with no left/right setup split', () => {
    const html = renderTransfer(makeStore());

    for (const key of ['LF', 'RF', 'LR', 'RR']) {
      expect(html).toContain(`data-wheel="${key}"`);
    }
    expect(html).toContain('Front left');
    expect(html).toContain('Front right');
    expect(html).toContain('Rear left');
    expect(html).toContain('Rear right');
    expect(html).toContain('data-axle="front"');
    expect(html).toContain('data-axle="rear"');

    const inputs = html.match(/<input[^>]*>/g) ?? [];
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toContain('type="range"');
    expect(html).not.toMatch(/left setup|right setup/i);
  });

  it('sets the slider range and puts the blocks in hero → slider → diagram → groups order', () => {
    const html = renderTransfer(makeStore());
    const slider = /<input[^>]*type="range"[^>]*>/.exec(html)?.[0] ?? '';

    expect(slider).toContain('min="0.1"');
    expect(slider).toContain('max="2.5"');
    expect(slider).toContain('aria-label="Lateral acceleration in g"');
    expect(valueText(html, 'Lateral acceleration')).toBe('1.0');

    const order = [
      'data-block="hero"',
      'data-block="lateral-g"',
      'data-block="load-diagram"',
      'data-block="loads"',
      'data-block="roll"',
      'data-block="longitudinal"',
      'data-block="cg"',
    ].map((marker) => html.indexOf(marker));

    for (const index of order) expect(index).toBeGreaterThanOrEqual(0);
    for (let index = 1; index < order.length; index += 1) {
      expect(order[index]).toBeGreaterThan(order[index - 1] ?? -1);
    }
  });
});
