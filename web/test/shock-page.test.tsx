import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseCarModel } from '@setuplab/data';
import rawModel from '../../assets/models/reference-touring-car.json';
import { rateSnapshot } from '../src/editor/rates.js';
import { ShockPage } from '../src/pages/ShockPage.js';
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

function renderShock(store: SetupStore): string {
  return renderToStaticMarkup(createElement(ShockPage, { store }));
}

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return match?.[1] ?? null;
}

function columnHtml(html: string, axle: 'front' | 'rear'): string {
  const start = html.indexOf(`data-axle="${axle}"`);
  if (start < 0) return '';
  const end = html.indexOf('</article>', start);
  return end < 0 ? html.slice(start) : html.slice(start, end);
}

/** The numeral inside the `<Value>` whose accessible name is exactly `name`. */
function valueText(html: string, name: string): string {
  const at = html.indexOf(`data-accessible-name="${name}"`);
  if (at < 0) return '';
  const rest = html.slice(at);
  const match = /<span[^>]*class="value-number[^"]*"[^>]*>([^<]*)<\/span>/.exec(rest);
  return match?.[1] ?? '';
}

function lineTag(html: string, field: string): string {
  return new RegExp(`<line[^>]*data-field="${field}"[^>]*>`).exec(html)?.[0] ?? '';
}

describe('Shock page', () => {
  it('shows both axles as Front and Rear with one setup each and no left/right split', () => {
    const html = renderShock(makeStore());

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

    // M10: nothing focusable inside the drawing. The glossary links beside it are ordinary
    // text links on purpose - the picture stays a picture, and the terms stay reachable.
    const svgMarkup = html.slice(html.indexOf('<svg'), html.indexOf('</svg>'));
    expect(svgMarkup).not.toContain('href="#glossary/');
    expect(html).toContain('href="#glossary/roll-centre"');
    expect(html).not.toContain('tabindex="0"');
    expect(html).toContain('aria-label="Instant centre overlay"');
    expect(html).toContain('aria-pressed="false"');
  });

  it('puts the drawing, headlines, settings and derived detail in that order per column', () => {
    const html = renderShock(makeStore());

    for (const axle of ['front', 'rear'] as const) {
      const column = columnHtml(html, axle);
      const drawing = column.indexOf('data-block="drawing"');
      const headlines = column.indexOf('data-block="headlines"');
      const settings = column.indexOf('data-block="settings"');
      const derived = column.indexOf('data-block="derived"');

      expect(drawing).toBeGreaterThanOrEqual(0);
      expect(headlines).toBeGreaterThan(drawing);
      expect(settings).toBeGreaterThan(headlines);
      expect(derived).toBeGreaterThan(settings);
    }
  });

  it('shows one numLarge headline row and the derived detail per column', () => {
    const html = renderShock(makeStore());
    const front = columnHtml(html, 'front');

    expect(front).toContain('Wheel rate');
    expect(front).toContain('Ride frequency');
    expect(front).toContain('Damping ratio');
    expect(front).toContain('data-size="large"');
    expect(front).toContain('data-size="medium"');
    expect(front).toContain('Motion ratio');
    expect(front).toContain('Critical damping');
    expect(front).toContain('ARB wheel rate');
    expect(front).toContain('Axle roll stiffness');

    expect(html).toMatch(/<h1[^>]*class="[^"]*page-title/);
    expect(html).not.toContain('value-block--hero');
    expect(html).not.toContain('numHero');
  });

  it('enumerates every rendered value and proves provenance never lies', () => {
    const html = renderShock(makeStore());
    const tags = [...html.matchAll(/<span[^>]*data-value[^>]*>/g)].map((match) => match[0]);

    expect(tags.length).toBeGreaterThanOrEqual(14);
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

    const front = columnHtml(html, 'front');
    const rear = columnHtml(html, 'rear');
    expect(front).toMatch(
      /data-provenance="computed"[^>]*data-accessible-name="Front wheel rate/,
    );
    expect(rear).toMatch(
      /data-provenance="(inferred|modelled|estimated)"[^>]*data-accessible-name="Rear wheel rate/,
    );
    expect(html).not.toContain('computed ·');
  });

  it('keeps the rate goldens and the front roll-stiffness share', () => {
    const store = makeStore();
    const snapshot = rateSnapshot(store.getSnapshot().model, 'front');
    const rear = rateSnapshot(store.getSnapshot().model, 'rear');

    expect(snapshot.wheelRateNmm).toBeCloseTo(1.11851, 4);
    expect(snapshot.rideFrequencyHz).toBeCloseTo(10.781, 2);
    expect(snapshot.criticalDamping).toBeCloseTo(33.023, 2);
    expect(snapshot.dampingRatio).toBeCloseTo(0.3634, 3);
    expect(snapshot.dampingLow).toBeCloseTo(0.1817, 3);
    expect(snapshot.dampingHigh).toBeCloseTo(0.5451, 3);
    expect(snapshot.arbWheelRateNmm).toBeCloseTo(0.70067, 4);
    expect(snapshot.frontShare).toBeCloseTo(0.621, 3);
    expect(rear.wheelRateNmm).toBeCloseTo(1.23501, 3);
    expect(rear.rideFrequencyHz).toBeCloseTo(10.025, 2);

    const html = renderShock(store);
    const front = columnHtml(html, 'front');
    expect(front).toContain('1.12');
    expect(front).toContain('10.8');
    expect(front).toContain('33.02');
    expect(front).toContain('0.36');
    expect(front).toContain('0.18');
    expect(front).toContain('0.55');
    expect(front).toContain('0.701');
    expect(html).toContain('62.1');
  });

  it('shows the stated-default damper coefficient as an editable setting', () => {
    const store = makeStore();
    const before = columnHtml(renderShock(store), 'front');
    const input =
      /<input[^>]*aria-label="Damper coefficient in N·s\/m"[^>]*>/.exec(before)?.[0] ?? '';

    expect(input).toContain('value="12.0"');
    expect(input).not.toContain('disabled');

    expect(store.commitRateChange('front', { kind: 'damper', valueNsPerM: 18 })).toBeNull();
    const after = columnHtml(renderShock(store), 'front');
    expect(after).toContain('value="18.0"');
  });

  it('keeps spring, bar and damper effects independent', () => {
    const store = makeStore();
    const before = rateSnapshot(store.getSnapshot().model, 'front');

    expect(store.commitRateChange('front', { kind: 'spring', valueNmm: 4.0 })).toBeNull();
    const spring = rateSnapshot(store.getSnapshot().model, 'front');
    expect(spring.wheelRateNmm).not.toBe(before.wheelRateNmm);
    expect(spring.rideFrequencyHz).not.toBe(before.rideFrequencyHz);
    expect(spring.dampingRatio).not.toBe(before.dampingRatio);
    expect(spring.arbWheelRateNmm).toBe(before.arbWheelRateNmm);

    const afterSpring = rateSnapshot(store.getSnapshot().model, 'front');
    expect(
      store.commitRateChange('front', {
        kind: 'arbValue',
        field: 'bar_diameter',
        valueMm: 1.6,
      }),
    ).toBeNull();
    const bar = rateSnapshot(store.getSnapshot().model, 'front');
    expect(bar.arbWheelRateNmm).not.toBe(afterSpring.arbWheelRateNmm);
    expect(bar.axleRollStiffness).not.toBe(afterSpring.axleRollStiffness);
    expect(bar.rideFrequencyHz).toBe(afterSpring.rideFrequencyHz);
    expect(bar.wheelRateNmm).toBe(afterSpring.wheelRateNmm);

    const afterBar = rateSnapshot(store.getSnapshot().model, 'front');
    expect(store.commitRateChange('front', { kind: 'damper', valueNsPerM: 18 })).toBeNull();
    const damper = rateSnapshot(store.getSnapshot().model, 'front');
    expect(damper.dampingRatio).not.toBe(afterBar.dampingRatio);
    expect(damper.wheelRateNmm).toBe(afterBar.wheelRateNmm);
    expect(damper.rideFrequencyHz).toBe(afterBar.rideFrequencyHz);
    expect(damper.arbWheelRateNmm).toBe(afterBar.arbWheelRateNmm);
    expect(damper.axleRollStiffness).toBe(afterBar.axleRollStiffness);
  });

  it('editing the front leaves the rear column byte-identical', () => {
    const store = makeStore();
    const before = columnHtml(renderShock(store), 'rear');

    expect(store.commitRateChange('front', { kind: 'spring', valueNmm: 4.0 })).toBeNull();
    const after = columnHtml(renderShock(store), 'rear');

    expect(after).toBe(before);
  });

  it('derives the motion ratio live from a damper mount move and moves the drawn damper', () => {
    const store = makeStore();
    const beforeHtml = renderShock(store);
    const beforeFront = columnHtml(beforeHtml, 'front');
    const beforeRatio = valueText(beforeFront, 'Front motion ratio');
    const beforeWheelRate = valueText(beforeFront, 'Front wheel rate');
    const beforeDamper = lineTag(beforeFront, 'damper');

    expect(beforeRatio).toBe('0.565');
    expect(beforeFront).toContain('MR 0.565');
    expect(store.commitDamperMountShim('front', 'up', 5)).toBeNull();

    const model = store.getSnapshot().model;
    expect(model.corners.LF?.points.damper_up?.value[1]).toBeCloseTo(49, 12);

    const afterFront = columnHtml(renderShock(store), 'front');
    expect(valueText(afterFront, 'Front motion ratio')).not.toBe(beforeRatio);
    expect(valueText(afterFront, 'Front wheel rate')).not.toBe(beforeWheelRate);
    expect(lineTag(afterFront, 'damper')).not.toBe(beforeDamper);
    expect(afterFront).toContain('MR 0.587');
    expect(afterFront).toContain('+5.0');

    const ratio = rateSnapshot(model, 'front');
    expect(ratio.wheelRateNmm).toBeCloseTo(3.5 * 0.586537 ** 2, 4);
  });

  it('shows how the motion ratio is derived and names both damper eyes', () => {
    const html = renderShock(makeStore());
    const front = columnHtml(html, 'front');

    expect(front).toMatch(/lower damper eye/i);
    expect(front).toMatch(/upper damper eye/i);
    expect(front).toContain('not a stored constant');
    expect(front).toMatch(/lower damper eye/i);
    expect(lineTag(front, 'damper')).not.toBe('');
    expect(front).toContain('data-field="damper_lo"');
    expect(front).toContain('data-field="damper_up"');
  });

  it('lets a blade bar accept a blade count even when the model stores none', () => {
    const store = makeStore();
    expect(store.commitRateChange('front', { kind: 'arbType', value: 'blade' })).toBeNull();

    const before = columnHtml(renderShock(store), 'front');
    const blades =
      /<input[^>]*aria-label="ARB blades"[^>]*>/.exec(before)?.[0] ?? '';
    expect(blades).not.toContain('disabled');
    expect(blades).toContain('placeholder="1 default"');

    expect(store.commitArbBlades('front', 2)).toBeNull();
    const after = columnHtml(renderShock(store), 'front');
    expect(after).toMatch(/<input[^>]*aria-label="ARB blades"[^>]*value="2"/);
    expect(store.getSnapshot().model.axles.front.arb?.blades?.value).toBe(2);
  });

  it('hides the bar geometry rows when the bar is none and keeps the spring-only roll stiffness', () => {
    const store = makeStore();
    const before = columnHtml(renderShock(store), 'front');
    const beforeRoll = Number(valueText(before, 'Front axle roll stiffness'));

    expect(store.commitRateChange('front', { kind: 'arbType', value: 'none' })).toBeNull();
    const after = columnHtml(renderShock(store), 'front');

    expect(after).not.toContain('ARB bar diameter');
    expect(after).not.toContain('ARB span');
    expect(after).not.toContain('ARB arm length');
    expect(after).not.toContain('ARB blades');
    expect(after).toContain('spring-only contribution');

    const afterRoll = Number(valueText(after, 'Front axle roll stiffness'));
    expect(Number.isFinite(afterRoll)).toBe(true);
    expect(afterRoll).toBeLessThan(beforeRoll);
    expect(valueText(after, 'Front ARB wheel rate')).toBe('0.000');
  });

  it('carries the damping estimate badge, its ±50 % band and the direction note', () => {
    const html = renderShock(makeStore());
    const front = columnHtml(html, 'front');

    expect(front).toMatch(/data-provenance="estimated"[^>]*data-accessible-name="Front damping ratio/);
    expect(front).toContain('±50 %');
    expect(front).toContain('[0.18, 0.55]');
    expect(front).toContain('estimate');
    expect(front).toMatch(/heavier oil/i);
    expect(front).toMatch(/standing the shock up/i);
    expect(front).not.toContain('better');
    expect(front).not.toContain('understeer');
    expect(front).not.toContain('oversteer');
  });
});
