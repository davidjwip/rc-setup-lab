import type { FrontViewInput, FrontViewResult } from '../frontView/types.js';
import { distance, type Vec2 } from '../geometry/vec2.js';
import { solveFrontViewAtBump } from '../frontView/kinematics.js';
import type { Solved } from '../result/solved.js';
import type {
  CamberSample,
  CamberSeriesResult,
  FrontViewScene,
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
} from './types.js';

/**
 * The corner viewBox the design system fixes for a corner diagram: 340 × 132.
 * The clip is always expanded to this ratio so the renderer applies one uniform
 * scale and never distorts the geometry.
 */
export const SCENE_ASPECT = 340 / 132;

/** Breathing room around every measured point, in metres. */
export const SCENE_PADDING_M = 0.02;

/**
 * A ray is only allowed to reach this far before it is clipped. Geometry beyond
 * this is not useful on a 340 px drawing — a nearly parallel link puts the
 * instant centre tens of metres away — and drawing it would shrink the measured
 * corner into illegibility.
 */
export const SCENE_INSTANT_CENTRE_MAX_X_M = 0.75;
export const SCENE_INSTANT_CENTRE_MAX_Y_M = 0.75;
export const SCENE_INSTANT_CENTRE_MIN_Y_M = -0.3;

export const CAMBER_SWEEP_MIN_M = -0.005;
export const CAMBER_SWEEP_MAX_M = 0.005;
export const CAMBER_SWEEP_SAMPLES = 21;

function toScene(point: Vec2): ScenePoint {
  return { x: point.y, y: point.z };
}

function inside(point: ScenePoint, bounds: SceneBounds): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

/**
 * Liang–Barsky clip against the scene rectangle. Returns null only when the
 * segment lies wholly outside, which cannot happen for an anchor that was used
 * to build the clip.
 */
export function clipSegment(
  from: ScenePoint,
  to: ScenePoint,
  bounds: SceneBounds,
): { readonly from: ScenePoint; readonly to: ScenePoint; readonly clipped: boolean } | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const p = [-dx, dx, -dy, dy];
  const q = [
    from.x - bounds.minX,
    bounds.maxX - from.x,
    from.y - bounds.minY,
    bounds.maxY - from.y,
  ];

  let t0 = 0;
  let t1 = 1;
  for (let index = 0; index < p.length; index += 1) {
    const denominator = p[index];
    const numerator = q[index];
    if (denominator === undefined || numerator === undefined) continue;
    if (denominator === 0) {
      if (numerator < 0) return null;
      continue;
    }
    const t = numerator / denominator;
    if (denominator < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }

  return {
    from: { x: from.x + t0 * dx, y: from.y + t0 * dy },
    to: { x: from.x + t1 * dx, y: from.y + t1 * dy },
    clipped: t0 > 0 || t1 < 1,
  };
}

function computeClip(points: readonly ScenePoint[]): SceneBounds {
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;

  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }

  minX -= SCENE_PADDING_M;
  maxX += SCENE_PADDING_M;
  minY -= SCENE_PADDING_M;
  maxY += SCENE_PADDING_M;

  const width = maxX - minX;
  const height = maxY - minY;
  if (width / height < SCENE_ASPECT) {
    const targetWidth = height * SCENE_ASPECT;
    const centre = (minX + maxX) / 2;
    minX = centre - targetWidth / 2;
    maxX = centre + targetWidth / 2;
  } else {
    const targetHeight = width / SCENE_ASPECT;
    const centre = (minY + maxY) / 2;
    minY = centre - targetHeight / 2;
    maxY = centre + targetHeight / 2;
  }

  return { minX, maxX, minY, maxY };
}

function segment(
  id: string,
  role: SceneSegment['role'],
  from: ScenePoint,
  to: ScenePoint,
  source: string,
): SceneSegment {
  return { kind: 'segment', id, role, from, to, source, clipped: false };
}

function rayOrOmitted(
  id: string,
  from: ScenePoint,
  to: ScenePoint,
  bounds: SceneBounds,
  source: string,
): SceneRay {
  const clipped = clipSegment(from, to, bounds);
  if (clipped === null) return { kind: 'omitted', reason: 'degenerateGeometry' };
  return {
    kind: 'drawn',
    segment: {
      kind: 'segment',
      id,
      role: 'construction',
      from: clipped.from,
      to: clipped.to,
      source,
      clipped: clipped.clipped,
    },
  };
}

function sourceReason(value: Solved<unknown>): SceneReason {
  return value.kind === 'undefined' ? value.reason : 'notMeasured';
}

/**
 * Turn a solved front view into a renderable scene description. Pure: no DOM,
 * no colours, no pixels, no trigonometry beyond the straight-line clipping the
 * drawing itself needs. Every primitive carries the physics field it was read
 * from, so the component can be tested against the solver instead of a
 * screenshot.
 */
export interface FrontViewSceneOptions {
  /**
   * Draw the instant centre, its label and the arm-extension rays, and let the
   * point take part in the clip. Off by default: the overlay is available on
   * request, but the framing belongs to the measured geometry.
   */
  readonly includeInstantCentre?: boolean;
}

export function buildFrontViewScene(
  input: FrontViewInput,
  result: FrontViewResult,
  options: FrontViewSceneOptions = {},
): FrontViewScene {
  const includeInstantCentre = options.includeInstantCentre ?? false;
  const working = result.working;
  const contactPatch: ScenePoint = {
    x: working.contactPatchY_m,
    y: working.contactPatchZ_m,
  };

  const hardpoints: readonly SceneHardpoint[] = [
    { kind: 'hardpoint', id: 'lca_in', point: toScene(input.lcaIn_m.value), source: input.lcaIn_m.ref },
    {
      kind: 'hardpoint',
      id: 'lca_out',
      point: toScene(input.lcaOut_m.value),
      source: input.lcaOut_m.ref,
    },
    { kind: 'hardpoint', id: 'uca_in', point: toScene(input.ucaIn_m.value), source: input.ucaIn_m.ref },
    {
      kind: 'hardpoint',
      id: 'uca_out',
      point: toScene(input.ucaOut_m.value),
      source: input.ucaOut_m.ref,
    },
    ...(input.tieIn_m === undefined
      ? []
      : [
          {
            kind: 'hardpoint' as const,
            id: 'tie_in' as const,
            point: toScene(input.tieIn_m.value),
            source: input.tieIn_m.ref,
          },
        ]),
    ...(input.tieOut_m === undefined
      ? []
      : [
          {
            kind: 'hardpoint' as const,
            id: 'tie_out' as const,
            point: toScene(input.tieOut_m.value),
            source: input.tieOut_m.ref,
          },
        ]),
    {
      kind: 'hardpoint',
      id: 'wheel_centre',
      point: toScene(input.wheelCentre_m.value),
      source: input.wheelCentre_m.ref,
    },
    {
      kind: 'hardpoint',
      id: 'contact_patch',
      point: contactPatch,
      source: 'frontView.working.contactPatch',
    },
  ];

  const rollCentre: SceneRollCentre =
    result.rollCentreHeight.kind === 'defined' && result.rollCentreLateral.kind === 'defined'
      ? {
          kind: 'defined',
          x: result.rollCentreLateral.value,
          y: result.rollCentreHeight.value,
          band: result.rollCentreHeight.band,
          source: 'frontView.rollCentreHeight',
        }
      : {
          kind: 'undefined',
          reason:
            result.rollCentreHeight.kind === 'defined'
              ? sourceReason(result.rollCentreLateral)
              : sourceReason(result.rollCentreHeight),
          source: 'frontView.rollCentreHeight',
        };

  const instantCentrePoint =
    includeInstantCentre && result.instantCentre.kind === 'defined'
      ? toScene(result.instantCentre.value)
      : null;

  const instantCentreInReach =
    instantCentrePoint !== null &&
    Math.abs(instantCentrePoint.x) <= SCENE_INSTANT_CENTRE_MAX_X_M &&
    instantCentrePoint.y >= SCENE_INSTANT_CENTRE_MIN_Y_M &&
    instantCentrePoint.y <= SCENE_INSTANT_CENTRE_MAX_Y_M;

  const wheelRadius = distance(input.wheelCentre_m.value, {
    y: contactPatch.x,
    z: contactPatch.y,
  });

  const clipPoints: ScenePoint[] = hardpoints.map((hardpoint) => hardpoint.point);
  if (includeInstantCentre && instantCentreInReach && instantCentrePoint !== null) {
    clipPoints.push(instantCentrePoint);
  }
  if (rollCentre.kind === 'defined') {
    clipPoints.push({ x: rollCentre.x, y: rollCentre.y });
  }
  clipPoints.push(
    { x: input.wheelCentre_m.value.y - wheelRadius, y: input.wheelCentre_m.value.z - wheelRadius },
    { x: input.wheelCentre_m.value.y + wheelRadius, y: input.wheelCentre_m.value.z + wheelRadius },
  );
  const clip = computeClip(clipPoints);

  const instantCentre: SceneInstantCentre = !includeInstantCentre
    ? { kind: 'hidden', source: 'frontView.instantCentre' }
    : instantCentrePoint === null
      ? {
          kind: 'undefined',
          reason: sourceReason(result.instantCentre),
          source: 'frontView.instantCentre',
        }
      : inside(instantCentrePoint, clip)
        ? {
            kind: 'visible',
            x: instantCentrePoint.x,
            y: instantCentrePoint.y,
            source: 'frontView.instantCentre',
          }
        : {
            kind: 'outsideClip',
            x: instantCentrePoint.x,
            y: instantCentrePoint.y,
            source: 'frontView.instantCentre',
          };

  const lowerInner = toScene(input.lcaIn_m.value);
  const lowerOuter = toScene(input.lcaOut_m.value);
  const upperInner = toScene(input.ucaIn_m.value);
  const upperOuter = toScene(input.ucaOut_m.value);
  const wheelCentre = toScene(input.wheelCentre_m.value);

  const omitted: SceneRay = {
    kind: 'omitted',
    reason: instantCentre.kind === 'undefined' ? instantCentre.reason : 'degenerateGeometry',
  };

  const overlayOmitted: SceneRay = { kind: 'omitted', reason: 'overlayOff' };

  const lowerArmRay: SceneRay = !includeInstantCentre
    ? overlayOmitted
    : instantCentrePoint === null
      ? omitted
      : rayOrOmitted(
          'lower-arm-ray',
          lowerInner,
          instantCentrePoint,
          clip,
          'frontView.instantCentre',
        );
  const upperLinkRay: SceneRay = !includeInstantCentre
    ? overlayOmitted
    : instantCentrePoint === null
      ? omitted
      : rayOrOmitted(
          'upper-link-ray',
          upperInner,
          instantCentrePoint,
          clip,
          'frontView.instantCentre',
        );
  const rollCentreRay: SceneRay = !includeInstantCentre
    ? rollCentre.kind === 'defined'
      ? {
          kind: 'drawn',
          segment: segment(
            'roll-centre-ray',
            'construction',
            contactPatch,
            { x: rollCentre.x, y: rollCentre.y },
            'frontView.rollCentreHeight',
          ),
        }
      : { kind: 'omitted', reason: rollCentre.reason }
    : instantCentrePoint === null
      ? omitted
      : rayOrOmitted(
          'roll-centre-ray',
          contactPatch,
          instantCentrePoint,
          clip,
          'frontView.rollCentreHeight',
        );

  const wheel: SceneWheel = {
    kind: 'circle',
    centre: wheelCentre,
    radius: wheelRadius,
    source: 'frontView.working.contactPatch',
  };
  const carrier: SceneCarrier = {
    kind: 'polygon',
    points: [lowerOuter, upperOuter, wheelCentre],
    source: 'frontView.staticState',
  };

  const derivedGeometry =
    result.staticState.kind === 'defined' && result.staticState.flags.has('derivedGeometry');
  const modelledGeometry =
    result.staticState.kind === 'defined' && result.staticState.flags.has('modelledGeometry');

  return {
    corner: input.corner,
    side: input.side,
    derivedGeometry,
    modelledGeometry,
    clip,
    hardpoints,
    lowerArm: segment(
      'lower-arm',
      'arm',
      lowerInner,
      lowerOuter,
      input.lcaIn_m.ref,
    ),
    upperLink: segment(
      'upper-link',
      'link',
      upperInner,
      upperOuter,
      input.ucaIn_m.ref,
    ),
    tieRod:
      input.tieIn_m === undefined || input.tieOut_m === undefined
        ? null
        : segment(
            'tie-rod',
            'tie',
            toScene(input.tieIn_m.value),
            toScene(input.tieOut_m.value),
            input.tieIn_m.ref,
          ),
    carrier,
    wheel,
    instantCentre,
    lowerArmRay,
    upperLinkRay,
    rollCentreRay,
    rollCentre,
  };
}

/**
 * Sample camber against wheel travel with the same solver the cards use. The
 * samples are SI (metres, radians); the presenter converts for display and the
 * drawing only applies a view transform.
 */
export function buildCamberSeries(input: FrontViewInput): CamberSeriesResult {
  const samples: CamberSample[] = [];
  let firstReason: SceneReason = 'outOfTravel';

  for (let index = 0; index < CAMBER_SWEEP_SAMPLES; index += 1) {
    const ratio = index / (CAMBER_SWEEP_SAMPLES - 1);
    const bump_m = CAMBER_SWEEP_MIN_M + (CAMBER_SWEEP_MAX_M - CAMBER_SWEEP_MIN_M) * ratio;
    const state = solveFrontViewAtBump(input, bump_m);
    if (state.kind === 'defined') {
      samples.push({ bump_m, camber_rad: state.value.kingpinAngle_rad });
    } else {
      firstReason = sourceReason(state);
    }
  }

  const staticState = solveFrontViewAtBump(input, 0);
  if (staticState.kind !== 'defined' || samples.length < 2) {
    return {
      kind: 'unavailable',
      reason: staticState.kind === 'defined' ? firstReason : sourceReason(staticState),
      source: 'frontView.state.kingpinAngle',
    };
  }

  const staticFromSweep = samples.find((sample) => Math.abs(sample.bump_m) < 1e-12);
  const staticSample = staticFromSweep ?? {
    bump_m: 0,
    camber_rad: staticState.value.kingpinAngle_rad,
  };

  return {
    kind: 'series',
    samples,
    staticSample,
    bumpRange_m: { min: CAMBER_SWEEP_MIN_M, max: CAMBER_SWEEP_MAX_M },
    source: 'frontView.state.kingpinAngle',
  };
}
