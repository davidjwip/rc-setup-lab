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
export {
  CG_BALANCE_BAND_FRACTION,
  CG_ROLL_ANGLE_BAND_RELATIVE,
  CG_TLLT_BAND_RELATIVE,
  GRAVITY_MPS2,
  PER_WHEEL_BAND_RELATIVE,
  STATED_CG_HEIGHT_M,
  inferCgHeight,
  solveLoadTransfer,
} from './transfer/transfer.js';
export type {
  AxleTransfer,
  CgComponentInput,
  CgHeightResult,
  CgInferenceInput,
  CgRoute,
  LoadTransferInput,
  LoadTransferResult,
  LoadTransferWorking,
  WheelLoad,
} from './transfer/types.js';
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
