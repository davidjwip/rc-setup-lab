import type { CornerKey, SideSign } from '../frontView/types.js';
import type { Vec3 } from '../geometry/vec3.js';
import type { Sourced } from '../frontView/types.js';
import type { Flag, Solved, UndefinedReason } from '../result/solved.js';

/** Everything the toe solve needs, in the ground frame (metres). */
export interface ToeInput {
  readonly corner: CornerKey;
  readonly side: SideSign;
  readonly lowerArmType: 'hinge' | 'wishbone';
  readonly upperArmType: 'single_link' | 'wishbone';
  readonly lcaInA_m: Sourced<Vec3>;
  readonly lcaInB_m: Sourced<Vec3>;
  readonly lcaOut_m: Sourced<Vec3>;
  readonly ucaIn_m: Sourced<Vec3>;
  readonly ucaOut_m: Sourced<Vec3>;
  readonly wheelCentre_m: Sourced<Vec3>;
  readonly tieIn_m: Sourced<Vec3>;
  readonly tieOut_m: Sourced<Vec3>;
  /**
   * Measured 3-D tie-rod length. Absent means derive it from `tie_in`/`tie_out`;
   * an explicit value lets a height study hold the rod length fixed (04 §6.4).
   */
  readonly tieRodLength_m?: Sourced<number>;
  /** Stored static toe, positive = toe-in, in radians. */
  readonly staticToe_rad: Sourced<number>;
  readonly bumpLimit_m: number;
  readonly droopLimit_m: number;
}

export interface RackSteeringOptions {
  /** 04 (4.14): the rack's stored mechanical travel limit. */
  readonly rackLimit_m?: number;
  /** 04 §6.3: steering-arm shim about the steering-axis ground point. */
  readonly steeringArmOffset_rad?: number;
}

export interface AckermannResult {
  readonly kind: 'reported' | 'suppressed';
  readonly percent: number | null;
  readonly inner_rad: number;
  readonly outer_rad: number;
  readonly flags: ReadonlySet<Flag>;
}

export interface ToeSample {
  readonly bump_m: number;
  /** Absolute toe at this travel, positive = toe-in. */
  readonly toe_rad: number;
}

export interface ToeSeries {
  readonly kind: 'series';
  readonly samples: readonly ToeSample[];
  readonly staticSample: ToeSample;
  readonly bumpRange_m: {
    readonly min: number;
    readonly max: number;
  };
  /** Slope at static ride height, positive = toe-in in bump. */
  readonly gain_radPerM: Solved<number>;
  /** Toe(+5 mm) − toe(−5 mm), positive = toe-in under compression. */
  readonly totalAcrossRange_rad: Solved<number>;
  readonly direction: 'toe-in' | 'toe-out' | 'neutral';
  readonly source: string;
}

export interface ToeSeriesUnavailable {
  readonly kind: 'unavailable';
  readonly reason: UndefinedReason;
  readonly inputs: readonly string[];
  readonly source: string;
}

export type ToeSeriesResult = ToeSeries | ToeSeriesUnavailable;
