import type { CornerKey, SideSign, Sourced } from '../frontView/types.js';
import type { Vec3 } from '../geometry/vec3.js';
import type { Solved, UndefinedReason } from '../result/solved.js';

/**
 * One front corner's steering-axis geometry. All points are already composed
 * into the ground frame by the adapter (D-25); the solver never reads a stored
 * wheel centre or a stored caster.
 *
 * The contact patch is taken as `(wheelCentre.x, wheelCentre.y, 0)`: static
 * camber is not part of this construction, so the patch sits directly below the
 * hub. Caster is a front-only quantity; a rear corner is refused.
 */
export interface CasterInput {
  readonly corner: CornerKey;
  readonly side: SideSign;
  readonly lowerBallJoint_m: Sourced<Vec3>;
  readonly upperBallJoint_m: Sourced<Vec3>;
  readonly wheelCentre_m: Sourced<Vec3>;
}

/** The substituted arithmetic behind one corner's steering-axis geometry. */
export interface SteeringAxisWorking {
  /** (Uₒ.x − Lₒ.x)/(Uₒ.z − Lₒ.z); null when the axis is horizontal. */
  readonly deltaXOverDeltaZ: number | null;
  /** (Uₒ.y − Lₒ.y)/(Uₒ.z − Lₒ.z); null when the axis is horizontal. */
  readonly deltaYOverDeltaZ: number | null;
  readonly axisGroundX_m: number | null;
  readonly axisGroundY_m: number | null;
  readonly contactPatchX_m: number | null;
  readonly contactPatchY_m: number | null;
}

/**
 * Caster positive = the axis top leans rearward. KPI positive = the axis top
 * leans inboard, per wheel. Trail positive = the axis meets the road ahead of
 * the patch. Scrub positive = the axis meets the road inboard of the patch.
 */
export interface SteeringAxisResult {
  readonly caster_rad: Solved<number>;
  readonly kpi_rad: Solved<number>;
  readonly scrub_m: Solved<number>;
  readonly trail_m: Solved<number>;
  readonly working: SteeringAxisWorking;
}

/** One point on the camber-in-steer curve, at a signed steer angle. */
export interface CamberInSteerSample {
  /** Global-frame steer angle, positive = the car turns left. */
  readonly steer_rad: number;
  /** Camber change from the static upright, per wheel, positive = top outboard. */
  readonly camber_rad: number;
}

export interface CamberInSteerSeries {
  readonly kind: 'series';
  readonly corner: CornerKey;
  readonly side: SideSign;
  readonly samples: readonly CamberInSteerSample[];
  /** Positive steer = left turn; the sign of `camber_rad` is stated above. */
  readonly steerSign: string;
  readonly camberSign: string;
  readonly source: string;
}

export interface CamberInSteerUnavailable {
  readonly kind: 'unavailable';
  readonly reason: UndefinedReason;
  readonly inputs: readonly string[];
  readonly source: string;
}

export type CamberInSteerResult = CamberInSteerSeries | CamberInSteerUnavailable;
