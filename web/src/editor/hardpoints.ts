import type { CornerKey, CornerPointKey } from '@setuplab/data';

export type Axle = 'front' | 'rear';

export interface HardpointRow {
  readonly key: CornerPointKey;
  readonly label: string;
}

const BASE_ROWS: readonly HardpointRow[] = [
  { key: 'lca_in_a', label: 'Lower arm inner (hinge point)' },
  { key: 'lca_out', label: 'Lower ball joint' },
  { key: 'uca_in', label: 'Upper link inner' },
  { key: 'uca_out', label: 'Upper ball stud' },
  { key: 'wc', label: 'Wheel centre' },
];

const STEERING_ROWS: readonly HardpointRow[] = [
  { key: 'tie_in', label: 'Tie rod inner' },
  { key: 'tie_out', label: 'Tie rod outer' },
];

/** Both ends have a tie link: the front rack and the rear toe link. */
export const FRONT_HARDPOINT_ROWS: readonly HardpointRow[] = [...BASE_ROWS, ...STEERING_ROWS];
export const REAR_HARDPOINT_ROWS: readonly HardpointRow[] = [...BASE_ROWS, ...STEERING_ROWS];

/**
 * fields.yaml `meta.units_guard.coordinate_abs_max_mm`: every hardpoint
 * coordinate is limited to ±3000 mm. The point rows themselves carry no
 * narrower plausible range, so this is the bound the editor enforces.
 */
export const HARDPOINT_LIMIT_MM = 3000;

export function cornerKeyForAxle(axle: Axle): CornerKey {
  return axle === 'front' ? 'LF' : 'LR';
}

export function hardpointRowsForAxle(axle: Axle): readonly HardpointRow[] {
  return axle === 'front' ? FRONT_HARDPOINT_ROWS : REAR_HARDPOINT_ROWS;
}

export type HardpointCheck =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly message: string };

export function checkHardpointMm(text: string): HardpointCheck {
  const trimmed = text.trim();
  const value = Number(trimmed);
  if (trimmed === '' || !Number.isFinite(value)) {
    return { ok: false, message: 'Enter a number in millimetres.' };
  }
  if (Math.abs(value) > HARDPOINT_LIMIT_MM) {
    return {
      ok: false,
      message: `Must be between -${HARDPOINT_LIMIT_MM} and ${HARDPOINT_LIMIT_MM} mm; fields.yaml limits a coordinate to ±${HARDPOINT_LIMIT_MM} mm.`,
    };
  }
  return { ok: true, value };
}
