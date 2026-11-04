import type {
  CarModelDocument,
  CornerKey,
  CornerPointKey,
  MeasuredPoint,
  Point3Mm,
} from './model.js';

/** A point screwed to the upright: stored as an offset from the wheel centre. */
export const HUB_FIXED_POINT_KEYS = ['lca_out', 'uca_out', 'tie_out'] as const;
export type HubFixedPointKey = (typeof HUB_FIXED_POINT_KEYS)[number];

/** A point screwed to the chassis: stored absolute in the chassis frame. */
export const CHASSIS_FIXED_POINT_KEYS = [
  'lca_in_a',
  'lca_in_b',
  'uca_in',
  'uca_in_a',
  'uca_in_b',
  'tie_in',
  'damper_lo',
  'damper_up',
  'arb_drop',
] as const;
export type ChassisFixedPointKey = (typeof CHASSIS_FIXED_POINT_KEYS)[number];

export type StoredCornerPointKey = HubFixedPointKey | ChassisFixedPointKey;

const HUB_FIXED: ReadonlySet<string> = new Set(HUB_FIXED_POINT_KEYS);

export function isHubFixedPointKey(key: CornerPointKey): key is HubFixedPointKey {
  return HUB_FIXED.has(key);
}

const SIDE_SIGN: Readonly<Record<CornerKey, 1 | -1>> = {
  LF: 1,
  RF: -1,
  LR: 1,
  RR: -1,
};

export type AxleKey = 'front' | 'rear';

export function axleForCorner(cornerKey: CornerKey): AxleKey {
  return cornerKey === 'LF' || cornerKey === 'RF' ? 'front' : 'rear';
}

function finite(value: { readonly value: number } | null): number | null {
  return value !== null && Number.isFinite(value.value) ? value.value : null;
}

/** The wheel centre in the chassis frame. It is derived, never stored. */
export interface HubCentre {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * The derived hub centre in the chassis frame:
 *
 * ```text
 * z_ground = -(chassis_thickness + ride_height)
 * hub.z    = z_ground + wheel_radius
 * hub.y    = side * track / 2
 * hub.x    = 0 at the rear axle, wheelbase at the front
 * ```
 */
export function hubCentreMm(model: CarModelDocument, cornerKey: CornerKey): HubCentre | null {
  const axleKey = axleForCorner(cornerKey);
  const axle = model.axles[axleKey];
  const radiusMm = finite(axle?.tyreRadius ?? null);
  const thicknessMm = finite(model.chassisThickness);
  const rideHeightMm = finite(model.referenceRideHeight);
  if (axle === null || radiusMm === null || thicknessMm === null || rideHeightMm === null) {
    return null;
  }

  let xMm = 0;
  if (axleKey === 'front') {
    const wheelbaseMm = finite(model.wheelbase);
    if (wheelbaseMm === null) return null;
    xMm = wheelbaseMm;
  }

  return {
    x: xMm,
    y: (SIDE_SIGN[cornerKey] * axle.track.value) / 2,
    z: radiusMm - (thicknessMm + rideHeightMm),
  };
}

/**
 * The hub as a measured point, carrying the wheel radius's provenance. The
 * value is derived; it is never written back to the document.
 */
export function hubCentreMeasured(
  model: CarModelDocument,
  cornerKey: CornerKey,
): MeasuredPoint | null {
  const centre = hubCentreMm(model, cornerKey);
  const axle = model.axles[axleForCorner(cornerKey)];
  const radius = axle?.tyreRadius ?? null;
  if (centre === null || radius === null) return null;
  return {
    value: [centre.x, centre.y, centre.z],
    source: radius.source,
    confidence: radius.confidence,
  };
}

/**
 * Compose a stored point into the chassis frame. Chassis-fixed points are
 * already absolute; hub-fixed points are offsets from the derived wheel
 * centre. `wc` is always the derived hub.
 */
export function absoluteCornerPointMm(
  model: CarModelDocument,
  cornerKey: CornerKey,
  pointKey: CornerPointKey,
): MeasuredPoint | null {
  if (pointKey === 'wc') return hubCentreMeasured(model, cornerKey);
  const stored = model.corners[cornerKey]?.points[pointKey];
  if (stored === undefined) return null;
  if (!isHubFixedPointKey(pointKey)) return stored;

  const hub = hubCentreMm(model, cornerKey);
  if (hub === null) return null;
  const value: Point3Mm = [
    hub.x + stored.value[0],
    hub.y + stored.value[1],
    hub.z + stored.value[2],
  ];
  return { value, source: stored.source, confidence: stored.confidence };
}

export interface WheelSize {
  readonly radiusMm: number;
  readonly diameterMm: number;
  /** By construction this equals the radius; the hub is placed from the radius. */
  readonly heightAboveGroundMm: number;
  /** The hub's z in the chassis frame: `radius - (thickness + ride_height)`. */
  readonly hubZMm: number;
}

/** The stored wheel radius/diameter supplied by `axles.<axle>.tyre_radius`. */
export function wheelSize(model: CarModelDocument, axle: AxleKey): WheelSize | null {
  const radiusMm = finite(model.axles[axle]?.tyreRadius ?? null);
  const thicknessMm = finite(model.chassisThickness);
  const rideHeightMm = finite(model.referenceRideHeight);
  if (radiusMm === null || thicknessMm === null || rideHeightMm === null) return null;
  return {
    radiusMm,
    diameterMm: radiusMm * 2,
    heightAboveGroundMm: radiusMm,
    hubZMm: radiusMm - (thicknessMm + rideHeightMm),
  };
}
