import type { FrontViewResult } from '@setuplab/physics';
import { hubCentreMm, wheelSize, type AxleKey } from './hub.js';
import type { CarModelDocument, MeasuredValue } from './model.js';

/**
 * The chassis datum is the **top surface of the chassis plate**. `z = 0` is
 * there, at the rear axle centre-line on the vehicle centre-line, and the ground
 * plane is derived below it:
 *
 * ```text
 * z_ground        = -(chassis_thickness + ride_height)
 * hub.z           = z_ground + wheel_radius
 * z_contact_patch = z_ground
 * ```
 *
 * The hub is derived from the wheel radius, track, wheelbase, plate thickness
 * and ride height. It is never stored, so the wheel centre is exactly one radius
 * above the derived ground at every ride height and every wheel size.
 */

export type { AxleKey } from './hub.js';

/** Retained for callers from the chassis-pinned slice; the new model cannot disagree. */
export const RIDE_HEIGHT_MISMATCH_TOLERANCE_MM = 0.5;

const LENGTH_UNIT = 'mm';

export interface ChassisDatum {
  readonly thicknessMm: number;
  readonly rideHeightMm: number;
  /** `thickness + ride_height`: add this to a chassis-frame z for the ground frame. */
  readonly groundOffsetMm: number;
  /** `-(thickness + ride_height)`: the plate-derived ground plane in the chassis frame. */
  readonly groundPlaneMm: number;
  /** The road under the tyres, also in the chassis frame. */
  readonly wheelGroundPlaneMm: number | null;
  readonly tyreRadiusMm: number | null;
  /** The derived hub's z in the chassis frame. */
  readonly wheelCentreZMm: number | null;
  /** The hub's height above the plate-derived ground; by construction this is the radius. */
  readonly wheelCentreHeightMm: number | null;
  readonly impliedTyreRadiusMm: number | null;
  /** Always zero in the hub-relative model; retained so old callers compile. */
  readonly radiusMismatchMm: number | null;
  readonly radiusMismatchMessage: string | null;
  readonly impliedRideHeightMm: number | null;
  readonly mismatchMm: number | null;
  readonly mismatchMessage: string | null;
}

function finite(value: MeasuredValue<number> | null): number | null {
  return value !== null && Number.isFinite(value.value) ? value.value : null;
}

function axleCorner(axle: AxleKey): 'LF' | 'LR' {
  return axle === 'front' ? 'LF' : 'LR';
}

function wheelCentreZMm(model: CarModelDocument, axle: AxleKey): number | null {
  return hubCentreMm(model, axleCorner(axle))?.z ?? null;
}

/** `wc.z - z_ground`; with the hub derived it is exactly the stored radius. */
export function wheelCentreHeightAboveGroundMm(
  model: CarModelDocument,
  axle: AxleKey,
): number | null {
  return finite(model.axles[axle]?.tyreRadius ?? null);
}

export interface InferredWheel {
  readonly axle: AxleKey;
  /** The hub's height above the derived ground. */
  readonly heightAboveGroundMm: number | null;
  /** The stored radius, placed by the derived hub. */
  readonly inferredRadiusMm: number | null;
  readonly inferredDiameterMm: number | null;
  /** The same single-sourced radius, shown for clarity. */
  readonly storedTyreRadiusMm: number | null;
  /** Always zero: the radius and the hub are the same input. */
  readonly mismatchMm: number | null;
  readonly consistencyMessage: string | null;
}

/**
 * The wheel size the model stores. The previous slice inferred a diameter from a
 * pinned wheel centre; with the hub derived, the stored radius is the input that
 * places it. The name is kept for callers, but there is no second value to
 * compare and therefore no consistency note.
 */
export function inferredWheel(model: CarModelDocument, axle: AxleKey): InferredWheel {
  const wheel = wheelSize(model, axle);
  const radiusMm = wheel?.radiusMm ?? finite(model.axles[axle]?.tyreRadius ?? null);
  return {
    axle,
    heightAboveGroundMm: wheel?.heightAboveGroundMm ?? null,
    inferredRadiusMm: radiusMm,
    inferredDiameterMm: wheel?.diameterMm ?? null,
    storedTyreRadiusMm: radiusMm,
    mismatchMm: radiusMm === null ? null : 0,
    consistencyMessage: null,
  };
}

export interface TyreRadiusConsistency {
  readonly axle: AxleKey;
  readonly storedRadiusMm: number | null;
  readonly wheelCentreHeightMm: number | null;
  readonly mismatchMm: number | null;
  readonly message: string | null;
}

/** Kept for old callers; in the hub-relative model the two values are one input. */
export function tyreRadiusConsistency(
  model: CarModelDocument,
  axle: AxleKey,
): TyreRadiusConsistency {
  const wheel = inferredWheel(model, axle);
  return {
    axle,
    storedRadiusMm: wheel.storedTyreRadiusMm,
    wheelCentreHeightMm: wheel.heightAboveGroundMm,
    mismatchMm: wheel.mismatchMm,
    message: wheel.consistencyMessage,
  };
}

/**
 * Resolve the datum for a model. Returns null when either
 * `body.chassis.thickness` or `body.reference_ride_height` is absent.
 */
export function chassisDatum(model: CarModelDocument): ChassisDatum | null {
  const thicknessMm = finite(model.chassisThickness);
  const rideHeightMm = finite(model.referenceRideHeight);
  if (thicknessMm === null || rideHeightMm === null) return null;

  const groundOffsetMm = thicknessMm + rideHeightMm;
  const radiusMm = finite(model.axles.front?.tyreRadius ?? null);
  const centreZMm = wheelCentreZMm(model, 'front');
  const wheelCentreHeightMm = radiusMm;

  return {
    thicknessMm,
    rideHeightMm,
    groundOffsetMm,
    groundPlaneMm: -groundOffsetMm,
    wheelGroundPlaneMm: -groundOffsetMm,
    tyreRadiusMm: radiusMm,
    wheelCentreZMm: centreZMm,
    wheelCentreHeightMm,
    impliedTyreRadiusMm: radiusMm,
    radiusMismatchMm: radiusMm === null ? null : 0,
    radiusMismatchMessage: null,
    impliedRideHeightMm: rideHeightMm,
    mismatchMm: 0,
    mismatchMessage: null,
  };
}

/** `thickness + ride_height` in millimetres, or null when it is not known. */
export function groundOffsetMm(model: CarModelDocument): number | null {
  return chassisDatum(model)?.groundOffsetMm ?? null;
}

/** The plate-derived ground plane's z in the chassis frame, in millimetres. */
export function derivedGroundPlaneMm(model: CarModelDocument): number | null {
  return chassisDatum(model)?.groundPlaneMm ?? null;
}

/** The road under the tyres in the chassis frame; it is the plate-derived ground. */
export function wheelGroundPlaneMm(model: CarModelDocument): number | null {
  return chassisDatum(model)?.wheelGroundPlaneMm ?? null;
}

/** The ride height is an input; the hub cannot imply a different one. */
export function impliedRideHeightMm(model: CarModelDocument): number | null {
  return chassisDatum(model)?.impliedRideHeightMm ?? null;
}

/**
 * Compare the stored reference ride height with the one the model implies. The
 * hub is placed from the radius, so the two always agree.
 */
export function rideHeightConsistency(model: CarModelDocument): {
  readonly storedMm: number | null;
  readonly impliedMm: number | null;
  readonly mismatchMm: number | null;
  readonly message: string | null;
} {
  const datum = chassisDatum(model);
  return {
    storedMm: datum?.rideHeightMm ?? finite(model.referenceRideHeight),
    impliedMm: datum?.impliedRideHeightMm ?? null,
    mismatchMm: datum?.mismatchMm ?? null,
    message: datum?.mismatchMessage ?? null,
  };
}

/**
 * Convert a solver roll-centre height (ground frame, metres) into the height the
 * app reports against the chassis datum. With the hub derived the two frames
 * agree, so this is the solver value unchanged.
 */
export function reportedRollCentreHeightM(
  model: CarModelDocument,
  result: FrontViewResult,
): number | null {
  if (result.rollCentreHeight.kind !== 'defined') return null;
  const rawM = result.rollCentreHeight.value;
  const datum = chassisDatum(model);
  if (datum === null || datum.tyreRadiusMm === null || datum.wheelCentreZMm === null) {
    return rawM;
  }
  const instantCentreZ = result.working.instantCentreZ_m;
  if (instantCentreZ === null || instantCentreZ === 0) return rawM;
  const k = rawM / instantCentreZ;
  if (!Number.isFinite(k)) return rawM;
  const wheelOffsetMm = datum.tyreRadiusMm - datum.wheelCentreZMm;
  const deltaM = (datum.groundOffsetMm - wheelOffsetMm) / 1000;
  return rawM + (1 - k) * deltaM;
}

/** Display label kept close to the datum it describes. */
export const GROUND_DATUM_UNIT = LENGTH_UNIT;
