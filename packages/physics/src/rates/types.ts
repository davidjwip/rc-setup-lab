import type { CornerKey, FrontViewInput, Sourced } from '../frontView/types.js';
import type { Vec2 } from '../geometry/vec2.js';
import type { Solved } from '../result/solved.js';

/**
 * A corner solved from its front-view geometry and damper mounts.
 * Lengths are metres; `springRate_Npm` is N/m; `sprungMass_kg` is kg (SI inside the package).
 */
export interface RatesInput {
  readonly corner: CornerKey;
  readonly frontView: FrontViewInput;
  readonly damperLo_m: Sourced<Vec2>;
  readonly damperUp_m: Sourced<Vec2>;
  readonly springRate_Npm: Sourced<number>;
  readonly sprungMass_kg: Sourced<number> | null;
}

/**
 * A corner whose installation ratio is an explicit input rather than a geometric result.
 * Used where the reference car has no hardpoints (05 §6.5): the ratio is labelled `assumed`.
 */
export interface RatesFromRatioInput {
  readonly corner: CornerKey;
  readonly installationRatio: Sourced<number>;
  readonly springRate_Npm: Sourced<number>;
  readonly sprungMass_kg: Sourced<number> | null;
}

/**
 * The substituted arithmetic behind a rates result, for the UI's "Show the maths".
 * `bumpStep_m` is the half-width of the central difference; it is 0 when the ratio is an assumed input.
 */
export interface RatesWorking {
  readonly bumpStep_m: number;
  readonly damperLengthLow_m: number | null;
  readonly damperLengthHigh_m: number | null;
  readonly springRate_Npm: number;
  readonly installationRatio: number | null;
  readonly wheelRate_Npm: number | null;
  readonly sprungMass_kg: number | null;
}

/**
 * Per-corner rates. SI units inside the package:
 * `installationRatio` is dimensionless, `wheelRate` is N/m, `rideFrequency` is Hz,
 * `criticalDamping` is N·s/m.
 */
export interface RatesResult {
  readonly installationRatio: Solved<number>;
  readonly wheelRate: Solved<number>;
  readonly rideFrequency: Solved<number>;
  readonly criticalDamping: Solved<number>;
  readonly working: RatesWorking;
}
