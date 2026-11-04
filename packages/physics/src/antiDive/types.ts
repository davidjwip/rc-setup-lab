import type { Sourced } from '../frontView/types.js';
import type { Vec3 } from '../geometry/vec3.js';
import type { Band, Solved } from '../result/solved.js';

/**
 * One axle's side-view geometry in the ground frame (x forward, z up, ground at
 * z = 0). `lowerInnerA` and `lowerInnerB` are the two chassis-fixed pivot screws
 * (fore and aft); `lowerOuter` is the ball joint on the upright. The upper link
 * is the single line `upperInner → upperOuter`.
 */
export interface SideViewAxleInput {
  readonly lowerInnerA_m: Sourced<Vec3>;
  readonly lowerInnerB_m: Sourced<Vec3>;
  readonly lowerOuter_m: Sourced<Vec3>;
  readonly upperInner_m: Sourced<Vec3>;
  readonly upperOuter_m: Sourced<Vec3>;
  /** Contact-patch x in the ground frame, metres. Its z is always 0. */
  readonly contactPatchX_m: Sourced<number>;
}

/**
 * Anti-dive / anti-squat input. All lengths are metres, masses kilograms and
 * acceleration m/s². `longitudinalAcceleration_mps2` is signed: braking is
 * negative, acceleration positive. The axle shares are evaluated at the
 * traction limit from the dynamic axle load (no brake bias or torque split).
 */
export interface AntiDiveInput {
  readonly front: SideViewAxleInput;
  readonly rear: SideViewAxleInput;
  readonly wheelbase_m: Sourced<number>;
  /** Whole-car CG height above ground, metres; null refuses the output. */
  readonly cgHeight_m: Sourced<number> | null;
  /** The band on the CG height, when the route carries one (D-18/D-26). */
  readonly cgHeightBand_m?: Band | null;
  readonly totalMass_kg: Sourced<number>;
  /** Front share of static mass, a fraction (0.45 = 45 % front). */
  readonly frontMassShare: Sourced<number>;
  readonly longitudinalAcceleration_mps2: number;
  /** Defaults to the module-6 constant, 9.81 m/s². */
  readonly gravity_mps2?: number;
}

/** The substituted arithmetic behind one axle's percentage. */
export interface AntiDiveAxleWorking {
  /** Lower arm side-view slope dz/dx, from the two inner screws. */
  readonly lowerSlope: number | null;
  /** Upper link side-view slope dz/dx. */
  readonly upperSlope: number | null;
  readonly instantCentreX_m: number | null;
  readonly instantCentreZ_m: number | null;
  /** tan θ from the contact patch to the side-view instant centre. */
  readonly tanTheta: number | null;
  readonly staticAxleLoad_N: number | null;
  readonly longitudinalTransfer_N: number | null;
  readonly dynamicAxleLoad_N: number | null;
  /** Fz_axle(a) / m, m/s². */
  readonly axleLoadPerMass_mps2: number | null;
}

/** One axle's anti-dive (front) or anti-squat (rear) result, already in percent. */
export interface AntiDiveAxleResult {
  readonly percent: Solved<number>;
  readonly tanTheta: Solved<number>;
  readonly dynamicAxleLoad_N: Solved<number>;
  readonly axleLoadPerMass_mps2: Solved<number>;
  readonly working: AntiDiveAxleWorking;
}

export interface AntiDiveWorking {
  readonly wheelbase_m: number | null;
  readonly cgHeight_m: number | null;
  readonly totalMass_kg: number | null;
  readonly frontMassShare: number | null;
  readonly longitudinalAcceleration_mps2: number;
  readonly gravity_mps2: number;
}

export interface AntiDiveResult {
  readonly front: AntiDiveAxleResult;
  readonly rear: AntiDiveAxleResult;
  readonly working: AntiDiveWorking;
}

/** One point on the percentage-versus-acceleration curve. */
export interface AntiDiveSample {
  readonly acceleration_mps2: number;
  readonly antiDivePercent: Solved<number>;
  readonly antiSquatPercent: Solved<number>;
}

export interface AntiDiveCurve {
  readonly samples: readonly AntiDiveSample[];
  readonly minAcceleration_mps2: number;
  readonly maxAcceleration_mps2: number;
  readonly front: SideViewAxleInput;
  readonly rear: SideViewAxleInput;
}
