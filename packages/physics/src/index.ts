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
