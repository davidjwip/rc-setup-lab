export {
  assertNever,
  defined,
  notMeasured,
  undefinedResult,
  type Band,
  type Basis,
  type Confidence,
  type Defined,
  type FieldRef,
  type Flag,
  type NotMeasured,
  type Ref,
  type Solved,
  type Tier,
  type Undefined,
  type UndefinedReason,
} from './result/solved.js';

export { solveFrontView, solveFrontViewAtBump } from './frontView/kinematics.js';
export { solveRates, solveRatesFromRatio } from './rates/rates.js';
export { solveAntiRollBar, solveRollStiffness } from './roll/roll.js';
export type {
  AntiRollBarInput,
  AntiRollBarResult,
  AntiRollBarWorking,
  ArbType,
  AxleKey,
  AxleRollInput,
  AxleRollResult,
  AxleRollWorking,
  RollStiffnessInput,
  RollStiffnessResult,
} from './roll/types.js';
export type {
  RatesFromRatioInput,
  RatesInput,
  RatesResult,
  RatesWorking,
} from './rates/types.js';
export type {
  CornerKey,
  FrontViewInput,
  FrontViewResult,
  FrontViewState,
  FrontViewWorking,
  SideSign,
  Sourced,
} from './frontView/types.js';
export type { Vec2 } from './geometry/vec2.js';
