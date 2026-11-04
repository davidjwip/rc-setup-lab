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
export {
  CAMBER_SWEEP_MAX_M,
  CAMBER_SWEEP_MIN_M,
  CAMBER_SWEEP_SAMPLES,
  SCENE_ASPECT,
  SCENE_INSTANT_CENTRE_MAX_X_M,
  SCENE_INSTANT_CENTRE_MAX_Y_M,
  SCENE_INSTANT_CENTRE_MIN_Y_M,
  SCENE_PADDING_M,
  buildCamberSeries,
  buildFrontViewScene,
  clipSegment,
} from './scene/scene.js';
export type { FrontViewSceneOptions } from './scene/scene.js';
export type {
  CamberSample,
  CamberSeries,
  CamberSeriesResult,
  CamberSeriesUnavailable,
  FrontViewScene,
  HardpointId,
  SceneBounds,
  SceneCarrier,
  SceneHardpoint,
  SceneInstantCentre,
  ScenePoint,
  SceneRay,
  SceneReason,
  SceneRollCentre,
  SceneSegment,
  SceneWheel,
  SegmentRole,
} from './scene/types.js';
export {
  TOE_SWEEP_MAX_M,
  TOE_SWEEP_MIN_M,
  TOE_SWEEP_SAMPLES,
  buildToeSeries,
  solveAckermann,
  solveSteerAngle,
  solveToe,
  solveToeAtTieOutHeight,
} from './steering/toe.js';
export type {
  AckermannResult,
  RackSteeringOptions,
  ToeInput,
  ToeSample,
  ToeSeries,
  ToeSeriesResult,
  ToeSeriesUnavailable,
} from './steering/types.js';
export type { Vec3 } from './geometry/vec3.js';
export { solveRates, solveRatesFromRatio } from './rates/rates.js';
export { solveDampingRatio } from './damping/damping.js';
export { solveAntiRollBar, solveRollStiffness } from './roll/roll.js';
export {
  CG_BALANCE_BAND_FRACTION,
  CG_ROLL_ANGLE_BAND_RELATIVE,
  CG_TLLT_BAND_RELATIVE,
  GRAVITY_MPS2,
  PER_WHEEL_BAND_RELATIVE,
  STATED_CG_HEIGHT_BAND_M,
  STATED_CG_HEIGHT_M,
  inferCgHeight,
  solveLoadTransfer,
} from './transfer/transfer.js';
export { solveAntiDive, solveAntiDiveCurve } from './antiDive/antiDive.js';
export type {
  AntiDiveAxleResult,
  AntiDiveAxleWorking,
  AntiDiveCurve,
  AntiDiveInput,
  AntiDiveResult,
  AntiDiveSample,
  AntiDiveWorking,
  SideViewAxleInput,
} from './antiDive/types.js';
export { solveRaiseAndWeigh } from './cg/cg.js';
export type {
  RaiseAndWeighInput,
  RaiseAndWeighResult,
  RaiseAndWeighWorking,
  RaisedEnd,
} from './cg/types.js';
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
  DampingRatioInput,
  DampingRatioResult,
  DampingRatioWorking,
} from './damping/types.js';
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
