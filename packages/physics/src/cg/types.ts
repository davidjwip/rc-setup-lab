import type { Sourced } from '../frontView/types.js';
import type { Band, Solved } from '../result/solved.js';

/** Which end of the car was raised for the measurement. */
export type RaisedEnd = 'front' | 'rear';

/**
 * Inputs the raised-axle, two-scale procedure produces. Lengths are metres and
 * masses kilograms inside the package. `axleWeightLevel`/`axleWeightRaised` are
 * the axle **opposite** the raised end: Bob raises the rear and re-weighs the
 * front. `weighingTolerance` is the repeat-reading spread of one scale, in kg.
 */
export interface RaiseAndWeighInput {
  readonly wheelbase_m: Sourced<number>;
  readonly totalMass_kg: Sourced<number>;
  readonly raisedEnd: RaisedEnd;
  readonly raiseHeight_m: Sourced<number>;
  readonly axleWeightLevel_kg: Sourced<number>;
  readonly axleWeightRaised_kg: Sourced<number>;
  readonly wheelRadius_m: Sourced<number>;
  readonly weighingTolerance_kg?: Sourced<number> | null;
}

/** The substituted arithmetic for the measured CG card. */
export interface RaiseAndWeighWorking {
  readonly raisedEnd: RaisedEnd;
  readonly theta_rad: number | null;
  readonly tanTheta: number | null;
  /** Difference of the two weighings, kg. Positive when the raised end lifts weight off the measured axle. */
  readonly deltaWeight_kg: number | null;
  /** L / tan θ, metres. */
  readonly lever_m: number | null;
  readonly wheelRadius_m: number | null;
}

export interface RaiseAndWeighResult {
  /** Height of the whole-car CG above the ground, metres. */
  readonly cgHeight_m: Solved<number>;
  /** Half-width from the repeat-reading tolerance, metres, or null when no tolerance is stated. */
  readonly band_m: Band | null;
  readonly working: RaiseAndWeighWorking;
}
