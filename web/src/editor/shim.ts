import { HARDPOINT_LIMIT_MM } from './hardpoints.js';

/** A shim is entered to a tenth of a millimetre; the band is half the last digit. */
export const SHIM_STEP_MM = 0.1;
export const SHIM_BAND_MM = SHIM_STEP_MM / 2;

export interface HingeAngleBand {
  readonly low: number;
  readonly high: number;
}

/**
 * `atan(shim / span)`, in degrees. Positive means the aft screw is higher.
 * A zero or missing span has no hinge axis to tilt, so it returns null rather
 * than an infinity.
 */
export function hingeAngleDegrees(shimMm: number, spanMm: number): number | null {
  if (!Number.isFinite(shimMm) || !Number.isFinite(spanMm) || spanMm <= 0) return null;
  return (Math.atan2(shimMm, spanMm) * 180) / Math.PI;
}

/**
 * Propagate the shim's entry band through `atan`. The interval is not symmetric
 * around the angle, so the caller prints its half-width as the `±`.
 */
export function hingeAngleBandDegrees(
  shimMm: number,
  spanMm: number,
  bandMm = SHIM_BAND_MM,
): HingeAngleBand | null {
  if (
    !Number.isFinite(shimMm) ||
    !Number.isFinite(spanMm) ||
    !Number.isFinite(bandMm) ||
    spanMm <= 0 ||
    bandMm < 0
  ) {
    return null;
  }
  const low = (Math.atan((shimMm - bandMm) / spanMm) * 180) / Math.PI;
  const high = (Math.atan((shimMm + bandMm) / spanMm) * 180) / Math.PI;
  return { low: Math.min(low, high), high: Math.max(low, high) };
}

/** The two screw heights either side of the current midpoint. */
export function screwHeights(
  baseMidpointMm: number,
  shimMm: number,
): { readonly a: number; readonly b: number } {
  return {
    a: baseMidpointMm - shimMm / 2,
    b: baseMidpointMm + shimMm / 2,
  };
}

export type ShimCheck =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly message: string };

/**
 * Validate on commit, not on every keystroke. The bound is the document's own
 * coordinate limit: half the shim moves each screw, so a shim cannot push either
 * screw outside ±3000 mm.
 */
export function checkShimText(text: string, baseMidpointMm: number): ShimCheck {
  const trimmed = text.trim();
  const value = Number(trimmed);
  if (trimmed === '' || !Number.isFinite(value)) {
    return { ok: false, message: 'Enter a shim in millimetres.' };
  }
  const heights = screwHeights(baseMidpointMm, value);
  if (
    Math.abs(heights.a) > HARDPOINT_LIMIT_MM ||
    Math.abs(heights.b) > HARDPOINT_LIMIT_MM
  ) {
    return {
      ok: false,
      message: `Half the shim moves each screw, so this value would put a screw outside the model's ±${HARDPOINT_LIMIT_MM} mm coordinate limit.`,
    };
  }
  return { ok: true, value };
}
