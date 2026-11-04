import type { FrontViewResult } from '@setuplab/physics';
import type { CarModelDocument, CornerKey, MeasuredPoint, MeasuredValue } from './model.js';

/**
 * The chassis datum is the **top surface of the chassis plate**. `z = 0` is
 * there, at the rear axle centre-line on the vehicle centre-line, and the ground
 * plane is derived below it:
 *
 * ```text
 * z_ground        = -(chassis_thickness + ride_height)
 * z_contact_patch = z_ground
 * ```
 *
 * `reference_ride_height` keeps its old meaning — the clearance under the
 * **bottom** of the plate — and is no longer the datum. `packages/physics` still
 * works in the ground frame; this module is the one place the two frames meet.
 */

/** A disagreement above this is surfaced; at or below it the values agree. */
export const RIDE_HEIGHT_MISMATCH_TOLERANCE_MM = 0.5;

export type AxleKey = 'front' | 'rear';

const LENGTH_UNIT = 'mm';

export interface ChassisDatum {
  readonly thicknessMm: number;
  readonly rideHeightMm: number;
  /** `thickness + ride_height`: add this to a chassis-frame z for the ground frame. */
  readonly groundOffsetMm: number;
  /** `-(thickness + ride_height)`: the plate-derived ground plane in the chassis frame. */
  readonly groundPlaneMm: number;
  /** `wc.z - tyre_radius`: the road under the tyres, also in the chassis frame. */
  readonly wheelGroundPlaneMm: number | null;
  readonly tyreRadiusMm: number | null;
  readonly wheelCentreZMm: number | null;
  /** `wc.z - z_ground`: the wheel-centre height the plate datum implies. */
  readonly wheelCentreHeightMm: number | null;
  /** The radius the wheel centre height implies; compared with the stored radius. */
  readonly impliedTyreRadiusMm: number | null;
  /** `implied_tyre_radius - stored_radius`; positive means the centre sits too high. */
  readonly radiusMismatchMm: number | null;
  readonly radiusMismatchMessage: string | null;
  readonly impliedRideHeightMm: number | null;
  readonly mismatchMm: number | null;
  readonly mismatchMessage: string | null;
}

function finite(value: MeasuredValue<number> | null): number | null {
  return value !== null && Number.isFinite(value.value) ? value.value : null;
}

function wheelCorner(model: CarModelDocument): {
  readonly cornerKey: CornerKey;
  readonly tyreRadius: MeasuredValue<number> | null;
  readonly wheelCentre: MeasuredPoint | null;
} | null {
  const candidates: readonly { corner: CornerKey; rear: boolean }[] = [
    { corner: 'LF', rear: false },
    { corner: 'LR', rear: true },
  ];
  for (const candidate of candidates) {
    const corner = model.corners[candidate.corner];
    const wheelCentre = corner?.points.wc ?? null;
    if (wheelCentre === null) continue;
    const axle = candidate.rear ? model.axles.rear : model.axles.front;
    return {
      cornerKey: candidate.corner,
      tyreRadius: axle?.tyreRadius ?? null,
      wheelCentre,
    };
  }
  return null;
}

function mismatchText(storedMm: number, impliedMm: number): string {
  return `Ride height says ${storedMm.toFixed(1)} ${LENGTH_UNIT}, the wheel centre and tyre size imply ${impliedMm.toFixed(1)} ${LENGTH_UNIT} — check which you measured.`;
}

function radiusMismatchText(heightMm: number, storedRadiusMm: number): string {
  const deltaMm = heightMm - storedRadiusMm;
  const magnitude = Math.abs(deltaMm).toFixed(1).replace(/\.0$/, '');
  const rideHeightCause = deltaMm > 0 ? 'higher' : 'lower';
  const wheelCentreCause = deltaMm > 0 ? 'low' : 'high';
  return `Wheel centre sits ${heightMm.toFixed(1)} ${LENGTH_UNIT} above the ground; that is ${(heightMm * 2).toFixed(1)} ${LENGTH_UNIT} across, but the model records ${(storedRadiusMm * 2).toFixed(1)} ${LENGTH_UNIT} — either the ride height is ${magnitude} ${LENGTH_UNIT} ${rideHeightCause} than measured or the wheel centre is ${magnitude} ${LENGTH_UNIT} ${wheelCentreCause}; check the wheel centre height or the ride height.`;
}

function axleCorner(axle: AxleKey): CornerKey {
  return axle === 'front' ? 'LF' : 'LR';
}

/** The stored wheel centre's z in the chassis frame, or null when it is absent. */
function wheelCentreZMm(model: CarModelDocument, axle: AxleKey): number | null {
  const wheelCentre = model.corners[axleCorner(axle)]?.points.wc ?? null;
  return wheelCentre === null ? null : wheelCentre.value[2];
}

/** `wc.z - z_ground`, the wheel-centre height above the plate-derived ground. */
export function wheelCentreHeightAboveGroundMm(
  model: CarModelDocument,
  axle: AxleKey,
): number | null {
  const offsetMm = groundOffsetMm(model);
  const centreZMm = wheelCentreZMm(model, axle);
  return offsetMm === null || centreZMm === null ? null : centreZMm + offsetMm;
}

export interface InferredWheel {
  readonly axle: AxleKey;
  /** `wc.z - z_ground`: the wheel centre's height above the derived ground. */
  readonly heightAboveGroundMm: number | null;
  /** The radius the wheel centre height implies; the ground plane is its origin. */
  readonly inferredRadiusMm: number | null;
  readonly inferredDiameterMm: number | null;
  /** The radius recorded on the axle, shown for comparison only. */
  readonly storedTyreRadiusMm: number | null;
  readonly mismatchMm: number | null;
  readonly consistencyMessage: string | null;
}

/**
 * The wheel diameter the plate-derived ground plane and the stored wheel centre
 * imply. It is never read from `tyre_radius`: the stored radius is compared
 * against it, and a disagreement above 0.5 mm names both numbers. The ground
 * plane is never moved to make the two agree.
 */
export function inferredWheel(model: CarModelDocument, axle: AxleKey): InferredWheel {
  const heightAboveGroundMm = wheelCentreHeightAboveGroundMm(model, axle);
  const storedTyreRadiusMm = finite(model.axles[axle]?.tyreRadius ?? null);
  const inferredRadiusMm = heightAboveGroundMm;
  const inferredDiameterMm = inferredRadiusMm === null ? null : inferredRadiusMm * 2;
  const mismatchMm =
    inferredRadiusMm === null || storedTyreRadiusMm === null
      ? null
      : inferredRadiusMm - storedTyreRadiusMm;
  return {
    axle,
    heightAboveGroundMm,
    inferredRadiusMm,
    inferredDiameterMm,
    storedTyreRadiusMm,
    mismatchMm,
    consistencyMessage:
      mismatchMm !== null && Math.abs(mismatchMm) > RIDE_HEIGHT_MISMATCH_TOLERANCE_MM
        ? radiusMismatchText(inferredRadiusMm as number, storedTyreRadiusMm as number)
        : null,
  };
}

export interface TyreRadiusConsistency {
  readonly axle: AxleKey;
  readonly storedRadiusMm: number | null;
  readonly wheelCentreHeightMm: number | null;
  readonly mismatchMm: number | null;
  readonly message: string | null;
}

/** The same check as `inferredWheel`, named for the stored-radius comparison. */
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
 * Resolve the datum for a model. Returns null when the conversion cannot be
 * made, i.e. either `body.chassis.thickness` or
 * `body.reference_ride_height` is absent.
 */
export function chassisDatum(model: CarModelDocument): ChassisDatum | null {
  const thicknessMm = finite(model.chassisThickness);
  const rideHeightMm = finite(model.referenceRideHeight);
  if (thicknessMm === null || rideHeightMm === null) return null;

  const groundOffsetMm = thicknessMm + rideHeightMm;
  const wheel = wheelCorner(model);
  const tyreRadiusMm = finite(wheel?.tyreRadius ?? null);
  const wheelCentreZMm =
    wheel === null || wheel.wheelCentre === null ? null : wheel.wheelCentre.value[2];

  const impliedRideHeightMm =
    tyreRadiusMm === null || wheelCentreZMm === null
      ? null
      : -thicknessMm - (wheelCentreZMm - tyreRadiusMm);

  const mismatchMm =
    impliedRideHeightMm === null ? null : impliedRideHeightMm - rideHeightMm;
  const mismatchMessage =
    mismatchMm !== null && Math.abs(mismatchMm) > RIDE_HEIGHT_MISMATCH_TOLERANCE_MM
      ? mismatchText(rideHeightMm, impliedRideHeightMm as number)
      : null;

  const wheelCentreHeightMm =
    wheelCentreZMm === null ? null : wheelCentreZMm + groundOffsetMm;
  const impliedTyreRadiusMm = wheelCentreHeightMm;
  const radiusMismatchMm =
    impliedTyreRadiusMm === null || tyreRadiusMm === null
      ? null
      : impliedTyreRadiusMm - tyreRadiusMm;
  const radiusMismatchMessage =
    radiusMismatchMm !== null && Math.abs(radiusMismatchMm) > RIDE_HEIGHT_MISMATCH_TOLERANCE_MM
      ? radiusMismatchText(impliedTyreRadiusMm as number, tyreRadiusMm as number)
      : null;

  return {
    thicknessMm,
    rideHeightMm,
    groundOffsetMm,
    groundPlaneMm: -groundOffsetMm,
    wheelGroundPlaneMm:
      tyreRadiusMm === null || wheelCentreZMm === null ? null : wheelCentreZMm - tyreRadiusMm,
    tyreRadiusMm,
    wheelCentreZMm,
    wheelCentreHeightMm,
    impliedTyreRadiusMm,
    radiusMismatchMm,
    radiusMismatchMessage,
    impliedRideHeightMm,
    mismatchMm,
    mismatchMessage,
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

/**
 * The road under the tyres in the chassis frame: `wc.z - tyre_radius`. It moves
 * when the tyre radius changes and never rewrites a stored hardpoint.
 */
export function wheelGroundPlaneMm(model: CarModelDocument): number | null {
  return chassisDatum(model)?.wheelGroundPlaneMm ?? null;
}

/**
 * The ride height implied by the stored wheel centre and tyre radius:
 * `-(thickness) - (wc.z - tyre_radius)`, in the chassis frame.
 */
export function impliedRideHeightMm(model: CarModelDocument): number | null {
  return chassisDatum(model)?.impliedRideHeightMm ?? null;
}

/**
 * Compare the stored reference ride height with the one the wheel centre and
 * tyre imply. The message is null at or below the 0.5 mm tolerance.
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
 * app reports against the chassis datum. At a consistent datum this is the
 * solver value unchanged. If the plate and the wheel disagree about where the
 * ground is, the datum offset is applied to the height instead of being hidden
 * in the wheel-centre arithmetic — which is why a 0.5 mm plate change moves the
 * reported roll-centre height by exactly 0.5 mm.
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
