import type { Sourced } from '../frontView/types.js';
import type { Solved } from '../result/solved.js';

export type AxleKey = 'front' | 'rear';

export type ArbType = 'torsion_bar' | 'blade' | 'fixed' | 'none';

/**
 * Anti-roll bar geometry in SI units. A torsion bar carries `barDiameter_m`,
 * `span_m`, `armLength_m` and `shearModulus_Pa`; a blade or fixed bar carries
 * the rate at the drop link (`singleBladeRate_Npm`, N/m) and a blade count.
 * `motionRatio` is IR_arm = d(link travel)/d(wheel travel), dimensionless.
 *
 * Fields are optional because the caller may be reporting a missing field as a
 * value: `solveAntiRollBar` returns `Undefined(incompleteModel)` naming it.
 */
export interface AntiRollBarInput {
  readonly axle: AxleKey;
  readonly type: ArbType;
  readonly barDiameter_m?: Sourced<number> | null;
  readonly span_m?: Sourced<number> | null;
  readonly armLength_m?: Sourced<number> | null;
  readonly shearModulus_Pa?: Sourced<number> | null;
  /** IR_arm, dimensionless. */
  readonly motionRatio?: Sourced<number> | null;
  /** Rate at the drop link for one blade, N/m. */
  readonly singleBladeRate_Npm?: Sourced<number> | null;
  /** Identical blades in parallel. `fixed` is a single bar. */
  readonly blades?: Sourced<number> | null;
}

/**
 * The substituted anti-roll-bar arithmetic, for the UI's "Show the maths".
 * Rates are N/m; `torsionalStiffness_NmPerRad` is the torsion-bar k_θ.
 */
export interface AntiRollBarWorking {
  readonly type: ArbType;
  readonly torsionalStiffness_NmPerRad: number | null;
  readonly armLength_m: number | null;
  readonly motionRatio: number | null;
  readonly blades: number | null;
  readonly rateAtLink_Npm: number | null;
  readonly wheelRate_Npm: number | null;
}

/**
 * Anti-roll bar result in SI units: `rateAtLink` and `wheelRate` are N/m.
 * `fitted` is false only for `arb.type: none`, whose contribution is a defined
 * zero (05 §5: "no flag").
 */
export interface AntiRollBarResult {
  readonly fitted: boolean;
  readonly rateAtLink: Solved<number>;
  readonly wheelRate: Solved<number>;
  readonly working: AntiRollBarWorking;
}

/**
 * One axle's roll-stiffness input. `springWheelRate_Npm` is the per-corner
 * spring wheel rate in N/m (usually the output of the rates module); `track_m`
 * is the contact-patch track in metres.
 */
export interface AxleRollInput {
  readonly axle: AxleKey;
  readonly springWheelRate_Npm: Solved<number>;
  readonly antiRollBar: AntiRollBarInput;
  readonly track_m: Sourced<number> | null;
}

export interface RollStiffnessInput {
  readonly front: AxleRollInput;
  readonly rear: AxleRollInput;
}

export interface AxleRollWorking {
  readonly springWheelRate_Npm: number | null;
  readonly barWheelRate_Npm: number | null;
  readonly track_m: number | null;
  readonly halfTrack_m: number | null;
  readonly rollStiffness_NmPerRad: number | null;
  readonly antiRollBar: AntiRollBarWorking;
}

/**
 * One axle's roll stiffness in N·m/rad, with its bar result carried alongside
 * so a refused bar leaves the spring side readable.
 */
export interface AxleRollResult {
  readonly rollStiffness: Solved<number>;
  readonly antiRollBar: AntiRollBarResult;
  readonly working: AxleRollWorking;
}

/**
 * Whole-car roll stiffness. `total` is N·m/rad; `frontShare` is the front
 * fraction of the total, dimensionless and only defined when both axles are.
 */
export interface RollStiffnessResult {
  readonly front: AxleRollResult;
  readonly rear: AxleRollResult;
  readonly total: Solved<number>;
  readonly frontShare: Solved<number>;
}
