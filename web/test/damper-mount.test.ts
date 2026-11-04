import { describe, expect, it } from 'vitest';
import { checkDamperOffsetText } from '../src/editor/rates.js';

describe('damper mount offset entry', () => {
  it('accepts a signed millimetre offset on commit', () => {
    expect(checkDamperOffsetText('+5.0')).toEqual({ ok: true, value: 5 });
    expect(checkDamperOffsetText('-2.5')).toEqual({ ok: true, value: -2.5 });
    expect(checkDamperOffsetText('0')).toEqual({ ok: true, value: 0 });
  });

  it('refuses an empty or non-finite entry in racer words', () => {
    expect(checkDamperOffsetText('').ok).toBe(false);
    expect(checkDamperOffsetText('outboard').ok).toBe(false);
  });

  it('refuses an offset outside the model coordinate limit', () => {
    const over = checkDamperOffsetText('3001');
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.message).toContain('3000');
    expect(over.message).not.toContain('damper_');
  });
});
