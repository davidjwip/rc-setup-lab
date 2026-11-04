import type { CornerKey, SideSign } from '../frontView/types.js';
import type { Band, UndefinedReason } from '../result/solved.js';

/**
 * Scene coordinates are plain paper coordinates in SI metres: `x` is lateral
 * distance from the vehicle centreline (the physics frame's `y`), `y` is height
 * above the ground (the physics frame's `z`). Rotating the axis names once, at
 * the physics → scene boundary, keeps the drawing free of any axis convention.
 */
export interface ScenePoint {
  readonly x: number;
  readonly y: number;
}

export interface SceneBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export type SceneReason = UndefinedReason | 'notMeasured' | 'overlayOff';

export type HardpointId =
  | 'lca_in'
  | 'lca_out'
  | 'uca_in'
  | 'uca_out'
  | 'tie_in'
  | 'tie_out'
  | 'wheel_centre'
  | 'contact_patch';

export interface SceneHardpoint {
  readonly kind: 'hardpoint';
  readonly id: HardpointId;
  readonly point: ScenePoint;
  /** The physics field this point was read from. */
  readonly source: string;
}

export type SegmentRole = 'arm' | 'link' | 'tie' | 'construction';

export interface SceneSegment {
  readonly kind: 'segment';
  readonly id: string;
  readonly role: SegmentRole;
  readonly from: ScenePoint;
  readonly to: ScenePoint;
  readonly source: string;
  /** True when the clip shortened the segment. */
  readonly clipped: boolean;
}

export type SceneInstantCentre =
  | {
      readonly kind: 'visible';
      readonly x: number;
      readonly y: number;
      readonly source: string;
    }
  | {
      readonly kind: 'outsideClip';
      readonly x: number;
      readonly y: number;
      readonly source: string;
    }
  | {
      readonly kind: 'undefined';
      readonly reason: SceneReason;
      readonly source: string;
    }
  | {
      readonly kind: 'hidden';
      readonly source: string;
    };

export type SceneRay =
  | { readonly kind: 'drawn'; readonly segment: SceneSegment }
  | { readonly kind: 'omitted'; readonly reason: SceneReason };

export type SceneRollCentre =
  | {
      readonly kind: 'defined';
      readonly x: number;
      readonly y: number;
      readonly band: Band | null;
      readonly source: string;
    }
  | {
      readonly kind: 'undefined';
      readonly reason: SceneReason;
      readonly source: string;
    };

export interface SceneWheel {
  readonly kind: 'circle';
  readonly centre: ScenePoint;
  readonly radius: number;
  readonly source: string;
}

export interface SceneCarrier {
  readonly kind: 'polygon';
  readonly points: readonly ScenePoint[];
  readonly source: string;
}

export interface FrontViewScene {
  readonly corner: CornerKey;
  readonly side: SideSign;
  /** True when the corner's hardpoints are derived, not measured. */
  readonly derivedGeometry: boolean;
  /** True when the corner's hardpoints are modelled, not measured. */
  readonly modelledGeometry: boolean;
  readonly clip: SceneBounds;
  readonly hardpoints: readonly SceneHardpoint[];
  readonly lowerArm: SceneSegment;
  readonly upperLink: SceneSegment;
  /** Tie rod in front view, or null when the corner has no tie link. */
  readonly tieRod: SceneSegment | null;
  readonly carrier: SceneCarrier;
  readonly wheel: SceneWheel;
  readonly instantCentre: SceneInstantCentre;
  readonly lowerArmRay: SceneRay;
  readonly upperLinkRay: SceneRay;
  readonly rollCentreRay: SceneRay;
  readonly rollCentre: SceneRollCentre;
}

export interface CamberSample {
  readonly bump_m: number;
  readonly camber_rad: number;
}

export interface CamberSeries {
  readonly kind: 'series';
  readonly samples: readonly CamberSample[];
  readonly staticSample: CamberSample;
  readonly bumpRange_m: {
    readonly min: number;
    readonly max: number;
  };
  readonly source: string;
}

export interface CamberSeriesUnavailable {
  readonly kind: 'unavailable';
  readonly reason: SceneReason;
  readonly source: string;
}

export type CamberSeriesResult = CamberSeries | CamberSeriesUnavailable;
