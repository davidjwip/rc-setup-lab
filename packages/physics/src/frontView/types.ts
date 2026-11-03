import type { Confidence, Ref, Solved } from '../result/solved.js';
import type { Vec2 } from '../geometry/vec2.js';

export type CornerKey = 'LF' | 'RF' | 'LR' | 'RR';
export type SideSign = 1 | -1;

export interface Sourced<T> {
  readonly value: T;
  readonly ref: Ref;
  readonly confidence: Confidence;
  readonly tolerance?: number;
}

export interface FrontViewInput {
  readonly corner: CornerKey;
  readonly side: SideSign;
  readonly lowerArmType: 'hinge' | 'wishbone';
  readonly upperArmType: 'single_link' | 'wishbone';
  readonly lcaIn_m: Sourced<Vec2>;
  readonly lcaOut_m: Sourced<Vec2>;
  readonly ucaIn_m: Sourced<Vec2>;
  readonly ucaOut_m: Sourced<Vec2>;
  readonly wheelCentre_m: Sourced<Vec2>;
  readonly bumpLimit_m: number;
  readonly droopLimit_m: number;
}

export interface FrontViewState {
  readonly bump_m: number;
  readonly crankAngle_rad: number;
  readonly lowerOuter_m: Vec2;
  readonly upperOuter_m: Vec2;
  readonly wheelCentre_m: Vec2;
  readonly kingpinAngle_rad: number;
  readonly kingpinAngleGlobal_rad: number;
}

export interface FrontViewWorking {
  readonly lowerSlope: number | null;
  readonly upperSlope: number | null;
  readonly contactPatchY_m: number;
  readonly contactPatchZ_m: number;
  readonly instantCentreY_m: number | null;
  readonly instantCentreZ_m: number | null;
  readonly rollCentreSlope: number | null;
}

export interface FrontViewResult {
  readonly instantCentre: Solved<Vec2>;
  readonly rollCentreHeight: Solved<number>;
  readonly rollCentreLateral: Solved<number>;
  readonly camberGain: Solved<number>;
  readonly camberGainGlobal: Solved<number>;
  readonly staticState: Solved<FrontViewState>;
  readonly working: FrontViewWorking;
}
