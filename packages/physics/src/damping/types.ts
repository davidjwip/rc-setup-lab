import type { Sourced } from '../frontView/types.js';
import type { Solved } from '../result/solved.js';

/**
 * A wheel-level damper coefficient and the critical damping it is compared with.
 * Both are SI: `wheelCoefficient_NsPerM` and `criticalDamping_NsPerM` are N·s/m.
 *
 * This is the direct wheel-coefficient path of physics/07 (7.2), not the
 * orifice model: the coefficient is already at the wheel, so no IR² transform
 * is applied here.
 */
export interface DampingRatioInput {
  readonly wheelCoefficient_NsPerM: Sourced<number>;
  readonly criticalDamping_NsPerM: Solved<number>;
}

/** The substituted arithmetic behind a damping-ratio result. */
export interface DampingRatioWorking {
  readonly wheelCoefficient_NsPerM: number | null;
  readonly criticalDamping_NsPerM: number | null;
}

/**
 * Damping ratio is dimensionless. Below critical damping it lies in [0, 1);
 * the band is the estimated coefficient's own interval, never a validated claim.
 */
export interface DampingRatioResult {
  readonly dampingRatio: Solved<number>;
  readonly working: DampingRatioWorking;
}
