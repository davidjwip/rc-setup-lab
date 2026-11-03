import type { Sourced } from '../frontView/types.js';
import type { Band, Solved } from '../result/solved.js';

/**
 * How `body.cg.height` was obtained. It is never measured (D-14): either the
 * component-mass first moment (§4.5 Route A) or the stated 28.0 mm default
 * (D-18). A future plumb-line route adds a third value; the two-hang procedure
 * is not implemented in this slice.
 */
export type CgRoute = 'component_mass_moment' | 'stated_default';

/**
 * One component in the §4.5 component-mass table. `mass_kg` is kilograms and
 * `height_m` is the component's z position in metres (SI inside the package).
 */
export interface CgComponentInput {
  readonly mass_kg: Sourced<number>;
  readonly height_m: Sourced<number>;
}

/**
 * The CG-height inference inputs. `defaultHeight_m` is the stated default from
 * D-18 (0.028 m when omitted); it is used only when the component table is
 * absent. `components` may be null or empty, both meaning "unavailable".
 */
export interface CgInferenceInput {
  readonly totalMass_kg: Sourced<number>;
  readonly unsprungMass_kg: Sourced<number>;
  readonly unsprungHeight_m: Sourced<number>;
  readonly components: readonly CgComponentInput[] | null;
  readonly defaultHeight_m?: Sourced<number> | null;
}

export interface CgHeightResult {
  readonly height_m: Solved<number>;
  readonly route: CgRoute;
}

/**
 * Load-transfer inputs in SI: masses kg, lengths m, stiffness N·m/rad and
 * lateral acceleration m/s². `frontMassShare` is a fraction (0.45 = 45 % front),
 * not a percentage.
 */
export interface LoadTransferInput {
  readonly totalMass_kg: Sourced<number>;
  readonly frontMassShare: Sourced<number>;
  readonly unsprungFront_kg: Sourced<number>;
  readonly unsprungRear_kg: Sourced<number>;
  readonly unsprungHeight_m: Sourced<number>;
  readonly cgComponents: readonly CgComponentInput[] | null;
  readonly cgDefaultHeight_m?: Sourced<number> | null;
  readonly wheelbase_m: Sourced<number>;
  readonly trackFront_m: Sourced<number>;
  readonly trackRear_m: Sourced<number>;
  readonly rollCentreFront_m: Sourced<number>;
  readonly rollCentreRear_m: Sourced<number>;
  readonly rollStiffnessFront_NmPerRad: Solved<number>;
  readonly rollStiffnessRear_NmPerRad: Solved<number>;
  readonly lateralAcceleration_mps2: number;
}

/** One axle's transfer in newtons: elastic (rolled) + geometric (instant) + unsprung. */
export interface AxleTransfer {
  readonly elastic: Solved<number>;
  readonly geometric: Solved<number>;
  readonly unsprung: Solved<number>;
  readonly total: Solved<number>;
}

/**
 * One axle's two wheels. `outer`/`inner` are newtons (outer = the loaded side);
 * `outerShareOfStatic`/`innerShareOfStatic` are fractions of the static corner
 * load, so 1.202 is the "120.2 %" a racer reads.
 */
export interface WheelLoad {
  readonly outer: Solved<number>;
  readonly inner: Solved<number>;
  readonly outerShareOfStatic: Solved<number>;
  readonly innerShareOfStatic: Solved<number>;
}

/**
 * The substituted arithmetic behind the result, for the UI's "Show the maths".
 * Lengths are metres; `rollAngle_rad` is radians (degrees at the boundary).
 * A null is a value that could not be established, never a zero stand-in.
 */
export interface LoadTransferWorking {
  readonly cgRoute: CgRoute;
  readonly cgHeight_m: number | null;
  readonly totalMass_kg: number;
  readonly unsprungMass_kg: number | null;
  readonly sprungMass_kg: number | null;
  readonly sprungCgHeight_m: number | null;
  readonly frontMassShare: number;
  readonly wheelbase_m: number | null;
  readonly cgLongitudinal_m: number | null;
  readonly trackFront_m: number | null;
  readonly trackRear_m: number | null;
  readonly meanTrack_m: number | null;
  readonly rollCentreFront_m: number | null;
  readonly rollCentreRear_m: number | null;
  readonly rollAxisHeight_m: number | null;
  readonly rollStiffnessFront_NmPerRad: number | null;
  readonly rollStiffnessRear_NmPerRad: number | null;
  readonly lateralAcceleration_mps2: number;
}

/**
 * Load-transfer result. SI inside: forces N, moments N·m, heights m, roll angle
 * rad, `balance` a dimensionless front fraction. Bands are absolute bounds in
 * the same unit as the value.
 */
export interface LoadTransferResult {
  readonly cgHeight: Solved<number>;
  readonly cgRoute: CgRoute;
  readonly cgHeightBand: Band | null;
  readonly staticFrontCorner: Solved<number>;
  readonly staticRearCorner: Solved<number>;
  readonly totalLateralLoadTransfer: Solved<number>;
  readonly rollAxisHeight: Solved<number>;
  readonly rollMoment: Solved<number>;
  readonly rollAngle: Solved<number>;
  readonly front: AxleTransfer;
  readonly rear: AxleTransfer;
  readonly balance: Solved<number>;
  readonly frontWheel: WheelLoad;
  readonly rearWheel: WheelLoad;
  readonly residual: Solved<number>;
  readonly working: LoadTransferWorking;
}
