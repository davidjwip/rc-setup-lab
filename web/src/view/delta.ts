/**
 * Attaches a signed change from baseline to every value-shaped object. The
 * current and baseline trees must have the same shape; values are compared by
 * their formatted strings so the delta carries exactly the precision shown.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValueLike(value: unknown): value is {
  readonly id: string;
  readonly value: string | null;
  readonly unit: string;
  readonly provenance: string;
} {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['unit'] === 'string' &&
    typeof value['provenance'] === 'string' &&
    Object.prototype.hasOwnProperty.call(value, 'value')
  );
}

function decimals(text: string): number {
  const match = /\.(\d+)/.exec(text);
  return match?.[1]?.length ?? 0;
}

export function deltaText(
  current: string | null,
  baseline: string | null,
  unit: string,
): string | null {
  if (current === null || baseline === null) return null;
  const after = Number(current);
  const before = Number(baseline);
  if (!Number.isFinite(after) || !Number.isFinite(before)) return null;

  const digits = Math.max(decimals(current), decimals(baseline));
  const rounded = Number((after - before).toFixed(digits));
  if (rounded === 0) return null;

  const magnitude = Math.abs(rounded).toFixed(digits);
  const signed = `${rounded > 0 ? '+' : '−'}${magnitude}`;
  return `Δ ${signed}${unit === '' ? '' : ` ${unit}`}`;
}

function walk(current: unknown, baseline: unknown): unknown {
  if (Array.isArray(current)) {
    return current.map((item, index) =>
      walk(item, Array.isArray(baseline) ? baseline[index] : undefined),
    );
  }
  if (!isRecord(current)) return current;
  if (!isRecord(baseline)) return current;

  if (isValueLike(current) && isValueLike(baseline)) {
    return {
      ...current,
      delta: deltaText(current.value, baseline.value, current.unit),
    };
  }

  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(current)) {
    next[key] = walk(value, baseline[key]);
  }
  return next;
}

export function attachDeltas<T>(current: T, baseline: T): T {
  return walk(current, baseline) as T;
}
