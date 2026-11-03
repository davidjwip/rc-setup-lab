import { describe, expect, it } from 'vitest';

const SCENE_SOURCES = import.meta.glob('../src/scene/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const TRIGONOMETRY = /\bMath\.(atan2|atan|asin|acos|sin|cos|tan|hypot)\b/;

describe('web/src/scene', () => {
  it('contains no trigonometric call: the drawing renders the solver, it does not re-solve it', () => {
    const entries = Object.entries(SCENE_SOURCES);

    expect(entries.length).toBeGreaterThan(0);

    for (const [file, source] of entries) {
      expect(source, file).not.toMatch(TRIGONOMETRY);
    }
  });
});
