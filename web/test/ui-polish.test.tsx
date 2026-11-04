import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseCarModel } from '@setuplab/data';
import rawModel from '../../assets/models/reference-touring-car.json';
import { GeometryPage } from '../src/pages/GeometryPage.js';
import { HomePage } from '../src/pages/HomePage.js';
import { ShockPage } from '../src/pages/ShockPage.js';
import { TransferPage } from '../src/pages/TransferPage.js';
import {
  createSetupStore,
  type SetupStore,
  type StorageLike,
} from '../src/state/setupStore.js';
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

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

function render(page: typeof HomePage | typeof GeometryPage | typeof ShockPage | typeof TransferPage): string {
  return renderToStaticMarkup(createElement(page, { store: makeStore() }));
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rootBlock(): string {
  return /:root\s*\{([\s\S]*?)\}/.exec(styles)?.[1] ?? '';
}

function token(name: string): string {
  const raw = new RegExp(`${escape(name)}\\s*:\\s*([^;]+);`).exec(rootBlock())?.[1]?.trim() ?? '';
  if (raw.startsWith('var(')) {
    const inner = /var\((--[^)]+)\)/.exec(raw)?.[1];
    return inner === undefined ? raw : token(inner);
  }
  return raw;
}

function cssBlock(selector: string): string {
  const pattern = new RegExp(
    `(?:^|\\n)\\s*${escape(selector)}\\s*\\{([^}]*)\\}`,
  );
  return pattern.exec(styles)?.[1] ?? '';
}

function px(value: string): number {
  return Number.parseFloat(value);
}

function resolveFontSize(raw: string, viewport: number): number | null {
  const value = raw.trim();
  if (value === '' || value === 'inherit' || value === 'initial') return null;

  const clamp = /^clamp\(([^,]+),\s*([^,]+),\s*(.+)\)$/.exec(value);
  if (clamp !== null) {
    const minimum = resolveFontSize(clamp[1] ?? '', viewport);
    const preferred = resolveFontSize(clamp[2] ?? '', viewport);
    const maximum = resolveFontSize(clamp[3] ?? '', viewport);
    if (minimum === null || preferred === null || maximum === null) return null;
    return Math.max(minimum, Math.min(preferred, maximum));
  }

  if (value.startsWith('var(')) {
    const name = /var\((--[^)]+)\)/.exec(value)?.[1];
    return name === undefined ? null : resolveFontSize(token(name), viewport);
  }
  if (value.endsWith('rem')) return Number.parseFloat(value) * 16;
  if (value.endsWith('px')) return Number.parseFloat(value);
  if (value.endsWith('vw')) return (Number.parseFloat(value) * viewport) / 100;
  return null;
}

function luminance(hex: string): number {
  const cleaned = hex.replace('#', '').trim();
  const expanded =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : cleaned;
  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(expanded.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function svgFor(html: string): string {
  return /<svg[^>]*data-scene="front-view"[\s\S]*?<\/svg>/.exec(html)?.[0] ?? '';
}

function figureFor(html: string): string {
  return /<figure class="scene-figure">[\s\S]*?<\/figure>/.exec(html)?.[0] ?? '';
}

function order(html: string, markers: readonly string[]): number[] {
  return markers.map((marker) => html.indexOf(marker));
}

describe('UI polish — measured CSS tokens', () => {
  it('M1 sets 44 px touch and 32 px desktop target tokens and uses them', () => {
    const touch = px(token('--control-min-touch'));
    const desktop = px(token('--control-min-desktop'));

    console.log(`M1 target size — desktop ${desktop}px, touch ${touch}px`);
    expect(desktop).toBeGreaterThanOrEqual(32);
    expect(touch).toBeGreaterThanOrEqual(44);

    const targetSelectors = [
      'button',
      'input',
      'select',
      '.text-link',
      '.page-nav a',
      '.panel-edit',
      '.reset-button',
      '.glossary-clear',
    ];
    const baseTargets = new RegExp(
      `([^{}]*?)\\{(?=[^}]*min-height:\\s*var\\(--control-min-desktop\\))`,
      'g',
    );
    const baseSelectorText = [...styles.matchAll(baseTargets)]
      .map((match) => match[1] ?? '')
      .join(',');
    for (const selector of targetSelectors) expect(baseSelectorText).toContain(selector);

    const touchRule =
      /@media\s*\(max-width:\s*768px\)(?:,\s*\(pointer:\s*coarse\))?\s*\{([\s\S]*?)\n\}/.exec(
        styles,
      )?.[1] ?? '';
    expect(touchRule).toContain('min-height: var(--control-min-touch)');
    for (const selector of targetSelectors) expect(touchRule).toContain(selector);
  });

  it('M2 computes every meaningful non-text boundary at 3:1 or better', () => {
    const outline = token('--outline');
    const pairs: readonly { readonly name: string; readonly background: string }[] = [
      { name: 'card (panel)', background: token('--panel') },
      { name: 'page (bg)', background: token('--bg') },
      { name: 'input well', background: token('--well') },
      { name: 'raised control', background: token('--panel-raised') },
    ];

    const rows = pairs.map((pair) => ({
      pair: pair.name,
      ratio: contrast(outline, pair.background),
    }));
    console.log('M2 non-text contrast — outline ' + outline);
    for (const row of rows) {
      console.log(`  ${row.pair}: ${row.ratio.toFixed(2)} : 1`);
    }

    for (const row of rows) expect(row.ratio).toBeGreaterThanOrEqual(3);
    expect(cssBlock('.card')).toContain('border: 1px solid var(--outline)');
    expect(cssBlock('.scene-ground')).toContain('stroke: var(--outline)');
    expect(cssBlock('.scene-wheel')).toContain('stroke: var(--outline)');
    expect(cssBlock('.fields input')).toContain('border: 1px solid var(--outline)');
    expect(cssBlock('.shim-input')).toContain('border: 1px solid var(--outline)');
  });

  it('M3/N2 resolves every CSS font-size to at least 11 px at 390 px', () => {
    const sizes = [...styles.matchAll(/font-size:\s*([^;]+);/g)]
      .map((match) => (match[1] ?? '').trim())
      .map((raw) => ({ raw, resolved: resolveFontSize(raw, 390) }))
      .filter((entry): entry is { raw: string; resolved: number } => entry.resolved !== null);

    const failures = sizes.filter((entry) => entry.resolved < 11);
    console.log(
      `M3/N2 font sizes at 390 px — ${sizes.length} declarations, smallest ${Math.min(
        ...sizes.map((entry) => entry.resolved),
      ).toFixed(2)} px`,
    );
    expect(failures.map((entry) => `${entry.raw} → ${entry.resolved.toFixed(2)}px`)).toEqual([]);
  });

  it('M3 scales diagram labels with the viewBox so 390 px text stays at 11 px or more', () => {
    const svgLabel = px(token('--svg-label'));
    const sceneRendered = svgLabel * (304 / 340);
    const chartRendered = svgLabel * (330 / 340);

    console.log(
      `M3 diagram labels — ${svgLabel}px user units → ${sceneRendered.toFixed(
        2,
      )}px drawing, ${chartRendered.toFixed(2)}px chart at 390 px`,
    );
    expect(sceneRendered).toBeGreaterThanOrEqual(11);
    expect(chartRendered).toBeGreaterThanOrEqual(11);
  });

  it('M6 keeps amber for refusals and gives bands and estimates their own neutrals', () => {
    const band = cssBlock('.band');
    const stripBand = cssBlock('.end-strip-band');
    const estimate = cssBlock('.estimate-badge');

    expect(band).not.toContain('var(--warn)');
    expect(stripBand).not.toContain('var(--warn)');
    expect(band).toMatch(/var\(--(muted|line|panel-raised|outline)\)/);
    expect(estimate).toContain('var(--estimate)');
    expect(estimate).not.toContain('var(--warn)');
    expect(cssBlock('.no-answer')).toContain('var(--warn)');
    expect(cssBlock('.value-provenance--missing')).toContain('var(--warn)');
  });

  it('N3 removes the decorative gradient and shadow', () => {
    expect(styles).not.toMatch(/gradient/i);
    expect(styles).not.toContain('box-shadow');
  });

  it('N4 removes every left accent rail', () => {
    expect(styles).not.toMatch(/border-left\s*:/);
  });

  it('N5 makes every inherited number tabular, including the read-only column', () => {
    expect(styles).toMatch(/body\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
    for (const selector of ['.value-number', '.value-unit', '.band', '.pill', '.end-strip-badge']) {
      expect(cssBlock(selector)).toContain('font-variant-numeric: tabular-nums');
    }
  });

  it('N12 builds one non-wrapping provenance badge per value', () => {
    expect(cssBlock('.value-provenance')).toContain('white-space: nowrap');

    const html = render(GeometryPage);
    const values = (html.match(/data-value/g) ?? []).length;
    const badges = (html.match(/class="value-provenance value-provenance--/g) ?? []).length;
    console.log(`N12 provenance — ${badges} badges for ${values} values`);
    expect(badges).toBe(values);
    expect(html).not.toContain('not yet validated');
  });
});

describe('UI polish — mobile layout and drawing semantics', () => {
  it('M8 stacks drawing → charts → settings on Geometry at 390 px', () => {
    const html = render(GeometryPage);
    for (const axle of ['front', 'rear'] as const) {
      const start = html.indexOf(`data-axle="${axle}"`);
      const end = axle === 'front' ? html.indexOf('data-axle="rear"') : html.length;
      const column = html.slice(start, end < 0 ? html.length : end);
      const [drawing, charts, settings] = order(column, [
        'data-block="drawing"',
        'data-block="charts"',
        'data-block="settings"',
      ]);
      expect(drawing).toBeGreaterThanOrEqual(0);
      expect(charts).toBeGreaterThan(drawing ?? -1);
      expect(settings).toBeGreaterThan(charts ?? -1);
    }

    expect(styles).toMatch(
      /@media\s*\(max-width:\s*768px\)[\s\S]*?\.home-grid\s*\{[^}]*grid-template-columns:\s*1fr/,
    );
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*768px\)[\s\S]*?\.geometry-charts\s*\{[^}]*grid-template-columns:\s*1fr/,
    );
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*768px\)[\s\S]*?\.settings-row\s*\{[^}]*flex-direction:\s*column/,
    );
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*768px\)[\s\S]*?\.fields\s*\{[^}]*display:\s*block/,
    );
  });

  it('M8 stacks each page in reading order at 390 px', () => {
    const shock = render(ShockPage);
    const transfer = render(TransferPage);
    const geometry = render(GeometryPage);
    const home = render(HomePage);

    for (const [html, markers] of [
      [geometry, ['data-block="drawing"', 'data-block="charts"', 'data-block="settings"']],
      [shock, ['data-block="drawing"', 'data-block="headlines"', 'data-block="settings"']],
      [transfer, ['data-block="hero"', 'data-block="lateral-g"', 'data-block="load-diagram"']],
    ] as const) {
      const positions = order(html, markers);
      for (const position of positions) expect(position).toBeGreaterThanOrEqual(0);
      for (let index = 1; index < positions.length; index += 1) {
        expect(positions[index]).toBeGreaterThan(positions[index - 1] ?? -1);
      }
    }

    expect(home).toContain('data-page="home"');
    expect(home).toContain('class="home-grid"');
    expect(home).not.toContain('role="table"');
  });

  it('M10 leaves no dead tab stops inside the drawing and lists the same points', () => {
    for (const page of [GeometryPage, ShockPage] as const) {
      const html = render(page);
      const svg = svgFor(html);
      const figure = figureFor(html);

      expect(svg).not.toBe('');
      expect(svg).not.toMatch(/<a\s/i);
      expect(svg).not.toMatch(/tabindex=/i);

      const known = new Set([
        'lca_in',
        'lca_out',
        'uca_in',
        'uca_out',
        'tie_in',
        'tie_out',
        'damper_lo',
        'damper_up',
        'wheel_centre',
        'contact_patch',
      ]);
      const drawn = [...svg.matchAll(/data-field="([^"]+)"/g)]
        .map((match) => match[1] ?? '')
        .filter((id) => known.has(id));
      const listed = [...figure.matchAll(/data-hardpoint-name="([^"]+)"/g)].map(
        (match) => match[1] ?? '',
      );

      console.log(
        `M10 ${page.name} — ${new Set(drawn).size} drawn points, ${new Set(listed).size} listed`,
      );
      expect([...new Set(listed)].sort()).toEqual([...new Set(drawn)].sort());
    }
  });
});
