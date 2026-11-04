import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCarModel, updateAxleDamperCoefficient } from '@setuplab/data';
import rawModel from '../../assets/models/reference-touring-car.json';
import { GlossaryView } from '../src/glossary/GlossaryView.js';
import { InterpreterPanel } from '../src/interpreter/InterpreterPanel.js';
import {
  RULE_TIERS,
  interpret,
  type InterpreterLine,
} from '../src/interpreter/interpreter.js';
import { GeometryPage } from '../src/pages/GeometryPage.js';
import { HomePage } from '../src/pages/HomePage.js';
import { ShockPage } from '../src/pages/ShockPage.js';
import { TransferPage } from '../src/pages/TransferPage.js';
import {
  createSetupStore,
  type SetupStore,
  type StorageLike,
} from '../src/state/setupStore.js';
import { Value } from '../src/view/Value.js';
import {
  MISSING_REF_SAMPLES,
  UNDEFINED_REASON_COPY,
  missingRefusal,
  undefinedRefusal,
} from '../src/view/refusal.js';

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

function renderPage(page: typeof HomePage | typeof GeometryPage | typeof ShockPage | typeof TransferPage, store: SetupStore): string {
  return renderToStaticMarkup(createElement(page, { store }));
}

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const FORBIDDEN = [
  /incompleteModel/,
  /\bundefined\b/,
  /coincidentPoints/,
  /\b(?:corners|body|axles)\.[A-Za-z0-9_.]+/,
  /\b[a-z]+[A-Z][A-Za-z0-9]*\b/,
  /\b(?:lca|uca|tie|damper|arb)_[a-z_]+\b/,
];

const NEXT_STEP = /Home|Geometry|measure|accept the default/i;

function renderRefusal(
  provenance: 'missing' | 'undefined',
  reason: string,
): string {
  const html = renderToStaticMarkup(
    createElement(Value, {
      value: null,
      unit: 'mm',
      provenance,
      band: null,
      accessibleName: 'Roll-centre height, front',
      reason,
    }),
  );
  const sentence = /<span class="value-reason">([\s\S]*?)<\/span>/.exec(html)?.[1];
  return visibleText(sentence ?? html);
}

describe('refusal copy', () => {
  it('never shows an internal code or field path in a refusal', () => {
    const reasons = [
      ...Object.keys(UNDEFINED_REASON_COPY).map((reason) =>
        renderRefusal('undefined', undefinedRefusal('Roll-centre height', reason)),
      ),
      ...MISSING_REF_SAMPLES.map((refs) =>
        renderRefusal('missing', missingRefusal('Roll-centre height', refs)),
      ),
    ];

    expect(reasons.length).toBeGreaterThan(0);
    for (const text of reasons) {
      for (const pattern of FORBIDDEN) {
        expect(text).not.toMatch(pattern);
      }
    }
  });

  it('names the missing thing and a next step for every refusal', () => {
    for (const refs of MISSING_REF_SAMPLES) {
      const text = renderRefusal('missing', missingRefusal('Roll-centre height', refs));
      expect(text).toMatch(/missing|needs|no /i);
      expect(text).toMatch(NEXT_STEP);
    }

    for (const reason of Object.keys(UNDEFINED_REASON_COPY)) {
      const text = renderRefusal('undefined', undefinedRefusal('Roll-centre height', reason));
      expect(text.length).toBeGreaterThan(20);
      expect(text).toMatch(NEXT_STEP);
    }
  });

  it('does not leak codes on any rendered page', () => {
    const store = makeStore();
    for (const page of [HomePage, GeometryPage, ShockPage, TransferPage] as const) {
      const text = visibleText(renderPage(page, store));
      for (const pattern of FORBIDDEN) expect(text).not.toMatch(pattern);
    }
  });

  it('does not speak to the developer on any rendered page', () => {
    const store = makeStore();
    for (const page of [HomePage, GeometryPage, ShockPage, TransferPage] as const) {
      const text = visibleText(renderPage(page, store));
      expect(text).not.toMatch(/D-\d+|TODO|Slice \d+|input envelope|may be undefined|not modelled|`/i);
    }
  });
});

function valueTags(html: string): readonly string[] {
  return [...html.matchAll(/<span[^>]*data-value[^>]*>/g)].map((match) => match[0]);
}

function valueText(html: string, accessibleName: string): string {
  const at = html.indexOf(`data-accessible-name="${accessibleName}"`);
  if (at < 0) return '';
  const rest = html.slice(at);
  const match = /<span[^>]*class="value-number[^"]*"[^>]*>([^<]*)<\/span>/.exec(rest);
  return match?.[1] ?? '';
}

function deltaFor(html: string, accessibleName: string): string | null {
  const tag = new RegExp(
    `<span[^>]*data-accessible-name="${accessibleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`,
  ).exec(html)?.[0];
  if (tag === undefined) return null;
  return /data-delta="([^"]*)"/.exec(tag)?.[1] ?? null;
}

function pageFor(
  page: typeof GeometryPage | typeof ShockPage | typeof TransferPage,
  store: SetupStore,
): string {
  return renderPage(page, store);
}

describe('per-value deltas', () => {
  it('shows no delta anywhere at baseline', () => {
    for (const page of [GeometryPage, ShockPage, TransferPage] as const) {
      const html = pageFor(page, makeStore());
      expect(html).not.toContain('value-delta');
      expect(html).not.toMatch(/Δ/);
    }
  });

  it('shows a signed delta with its unit only on affected Shock values', () => {
    const store = makeStore();
    expect(store.commitRateChange('front', { kind: 'spring', valueNmm: 4.0 })).toBeNull();
    const html = pageFor(ShockPage, store);

    const frontDelta = deltaFor(html, 'Front wheel rate');
    const rearDelta = deltaFor(html, 'Rear wheel rate');

    expect(frontDelta).toMatch(/^Δ \+.*N\/mm$/);
    expect(rearDelta).toBeNull();
    expect(valueTags(html).some((tag) => tag.includes('data-delta='))).toBe(true);
  });

  it('shows the other sign when the edit goes the other way', () => {
    const store = makeStore();
    expect(store.commitRateChange('front', { kind: 'spring', valueNmm: 3.0 })).toBeNull();
    const html = pageFor(ShockPage, store);

    expect(deltaFor(html, 'Front wheel rate')).toMatch(/^Δ [−-].*N\/mm$/);
  });

  it('carries deltas on Geometry and Transfer too, and leaves the other end alone', () => {
    const store = makeStore();
    expect(store.commitHardpoint('LF', 'uca_in', 2, 39)).toBeNull();

    const geometry = pageFor(GeometryPage, store);
    expect(deltaFor(geometry, 'Front roll-centre height')).toMatch(/^Δ/);
    expect(deltaFor(geometry, 'Rear roll-centre height')).toBeNull();

    expect(store.commitRateChange('front', { kind: 'spring', valueNmm: 4.0 })).toBeNull();
    const transfer = pageFor(TransferPage, store);
    expect(deltaFor(transfer, 'Front load-transfer share')).toMatch(/^Δ/);
    expect(valueText(geometry, 'Front roll-centre height')).toBeTruthy();
  });
});

describe('interpreter tiers', () => {
  it('renders the same number of tiers the contract names', () => {
    const contract = readFileSync(
      new URL('../../docs/specs/interpreter-owner-answers.md', import.meta.url),
      'utf8',
    ).toLowerCase();
    expect(RULE_TIERS).toHaveLength(3);
    for (const tier of RULE_TIERS) expect(contract).toContain(tier);

    const base = reference();
    const edited = updateAxleDamperCoefficient(base, 'front', 14.0);
    if (!edited.ok) throw new Error(JSON.stringify(edited.errors));
    const result = interpret(base, edited.value);
    const lines: InterpreterLine[] = RULE_TIERS.map((confidence, index) => ({
      ruleId: `tier-${confidence}`,
      phase: index === 2 ? 'exit' : 'mid',
      mechanism: 'a mechanism',
      says: 'a reading',
      effect: 'an effect',
      confidence,
    }));
    const html = renderToStaticMarkup(
      createElement(InterpreterPanel, { interpretation: { ...result, lines } }),
    );

    for (const tier of RULE_TIERS) expect(html).toContain(`interpreter-line-${tier}`);
    expect(html.match(/interpreter-line-/g) ?? []).toHaveLength(RULE_TIERS.length);
  });

  it('uses the illustrative tier for entry and exit claims with no transient model', () => {
    const base = reference();
    const edited = updateAxleDamperCoefficient(base, 'front', 14.0);
    if (!edited.ok) throw new Error(JSON.stringify(edited.errors));
    const result = interpret(base, edited.value);

    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.lines.every((line) => line.confidence === 'illustrative')).toBe(true);
  });
});

describe('glossary search count', () => {
  it('announces the full count for an empty query and the filtered count for a query', () => {
    const full = visibleText(
      renderToStaticMarkup(createElement(GlossaryView, {})),
    );
    expect(full).toMatch(/9 entries/i);

    const filtered = visibleText(
      renderToStaticMarkup(createElement(GlossaryView, { initialQuery: 'damping ratio' })),
    );
    expect(filtered).toMatch(/1 entry/i);

    const none = visibleText(
      renderToStaticMarkup(createElement(GlossaryView, { initialQuery: 'not-a-term' })),
    );
    expect(none).toMatch(/0 entries/i);
  });

  it('quotes the reference-car numbers with provenance', () => {
    const text = visibleText(
      renderToStaticMarkup(createElement(GlossaryView, { initialQuery: 'instant centre' })),
    );
    expect(text).toContain('reference car');
    expect(text).toContain('435.7 mm');
    expect(text).toContain('60.5 mm');
  });
});

describe('missing values are words, never a dash', () => {
  it('leaves no standalone em dash in a value slot on any page', () => {
    const dashInValue =
      /<(?:span|dd)[^>]*(?:value-number|end-strip-value|data-value)[^>]*>\s*[—–-]\s*</;
    for (const page of [HomePage, GeometryPage, ShockPage, TransferPage] as const) {
      expect(renderPage(page, makeStore())).not.toMatch(dashInValue);
    }
  });

  it('prints not available for a missing end-strip value', () => {
    const text = renderRefusal('missing', missingRefusal('Roll-centre height', ['body.cg.height']));
    expect(text).not.toMatch(/^\s*—\s*$/);
    expect(text).toMatch(/not computable|not available/i);
  });
});
