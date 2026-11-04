import type { ChassisValueField } from '@setuplab/data';

export interface ChassisRange {
  readonly min: number;
  readonly max: number;
  readonly unit: string;
  readonly step: number;
}

/**
 * fields.yaml ranges: `body.reference_ride_height` is 1–30 mm,
 * `body.chassis.thickness` is 0.5–5.0 mm and `axles.<axle>.tyre_radius` is
 * 15–60 mm (a 30–120 mm diameter). The editor refuses outside them rather than
 * clamping, matching the hardpoint and rates editors.
 */
export const CHASSIS_RANGES: Readonly<Record<ChassisValueField, ChassisRange>> = {
  ride_height: { min: 1, max: 30, unit: 'mm', step: 0.1 },
  thickness: { min: 0.5, max: 5.0, unit: 'mm', step: 0.1 },
  front_wheel_diameter: { min: 30, max: 120, unit: 'mm', step: 0.1 },
  rear_wheel_diameter: { min: 30, max: 120, unit: 'mm', step: 0.1 },
};

export type ChassisCheck =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly message: string };

export function checkChassisValue(text: string, range: ChassisRange): ChassisCheck {
  const trimmed = text.trim();
  const value = Number(trimmed);
  if (trimmed === '' || !Number.isFinite(value)) {
    return { ok: false, message: `Enter a number in ${range.unit}.` };
  }
  if (value < range.min || value > range.max) {
    return {
      ok: false,
      message: `Must be between ${range.min} and ${range.max} ${range.unit}; fields.yaml sets that range.`,
    };
  }
  return { ok: true, value };
}
