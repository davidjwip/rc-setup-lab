import {
  solveFrontView,
  solveRaiseAndWeigh,
  solveRates,
  solveRollStiffness,
  type AntiDiveInput,
  type AntiRollBarInput,
  type Band,
  type CasterInput,
  type CgComponentInput,
  type Confidence,
  type FrontViewInput,
  type DampingRatioInput,
  type LoadTransferInput,
  type RatesInput,
  type RatesResult,
  type RollStiffnessInput,
  type SideViewAxleInput,
  type Solved,
  type Sourced,
  type ToeInput,
  type Vec2,
  type Vec3,
} from '@setuplab/physics';
import { dataError, fail, ok, type DataError, type DataResult } from './errors.js';
import { absoluteCornerPointMm, hubCentreMeasured } from './hub.js';
import type {
  ArbDocument,
  AxleDocument,
  CarModelDocument,
  CornerDocument,
  CornerKey,
  CornerPointKey,
  MeasuredPoint,
  MeasuredValue,
} from './model.js';
import {
  degreesToRadians,
  gramsToKilograms,
  millimetresToMetres,
  newtonsPerMillimetreToNewtonsPerMetre,
  percentToFraction,
} from './units.js';

/**
 * 05 §3.2: fallback ARB motion ratio when `points.arb_drop` cannot supply one.
 * The front worked examples still use 0.80 so the front goldens stay fixed; the
 * rear derives IR_arm from its own modelled hardpoints.
 */
const ARB_MOTION_RATIO_ASSUMED = 0.8;

/** fields.yaml `corners.<corner>.damper.c_post` states ASSUME(12.0 N·s/m). */
const DEFAULT_DAMPER_COEFFICIENT_NS_PER_M = 12.0;

/** The left corner of each axle is the one the model stores and the editor edits. */
const AXLE_CORNER: Readonly<Record<'front' | 'rear', 'LF' | 'LR'>> = {
  front: 'LF',
  rear: 'LR',
};

/** fields.yaml `axles.<axle>.arb.shear_modulus`: steel is the stated default. */
const STEEL_SHEAR_MODULUS_GPA = 79.3;
const GIGAPASCALS_TO_PASCALS = 1e9;

/**
 * 06 §6.1 / 01 §8.4: fallback rear roll-centre height for a model with no rear
 * corner. The reference car now carries a modelled rear corner, so this is only
 * used when that geometry cannot produce a roll centre.
 */
const REAR_ROLL_CENTRE_HEIGHT_ASSUMED_M = 0.006;

/** fields.yaml `body.mass.unsprung_*`: ESTIMATE default, grams per axle. */
const DEFAULT_UNSPRUNG_AXLE_KG = 0.12;

/** fields.yaml `body.cg.unsprung_height`: ASSUME(0.625 × tyre radius). */
const UNSPRUNG_HEIGHT_TYRE_RADIUS_FACTOR = 0.625;

/**
 * fields.yaml `body.cg.raise_and_weigh.weighing_tolerance`: the repeat-reading
 * spread of one scale, grams. A club scale is worth ±5 g; the video's "take a
 * few readings" is the same statement. It drives the measured CG band.
 */
const DEFAULT_WEIGHING_TOLERANCE_G = 5;

function sourcedNumber(
  measured: MeasuredValue<number> | null,
  ref: string,
  transform: (value: number) => number,
): Sourced<number> | null {
  return measured === null
    ? null
    : { value: transform(measured.value), ref, confidence: measured.confidence };
}

export const SIDE_SIGN: Readonly<Record<CornerKey, 1 | -1>> = {
  LF: 1,
  LR: 1,
  RF: -1,
  RR: -1,
};

function axleKeyForCorner(cornerKey: CornerKey): 'front' | 'rear' {
  return cornerKey === 'LF' || cornerKey === 'RF' ? 'front' : 'rear';
}

/**
 * `thickness + ride_height`: the rigid translation from the document's chassis
 * frame (top surface of the plate) to the ground frame the physics package uses.
 * Null means the document cannot be converted and the caller refuses.
 */
function datumOffsetMm(model: CarModelDocument): number | null {
  const thickness = model.chassisThickness;
  const rideHeight = model.referenceRideHeight;
  if (thickness === null || rideHeight === null) return null;
  const offset = thickness.value + rideHeight.value;
  return Number.isFinite(offset) ? offset : null;
}

function missingDatumErrors(): readonly DataError[] {
  return [
    dataError(
      'missingField',
      'body.chassis.thickness',
      'the chassis datum needs the plate thickness to locate the ground plane',
    ),
    dataError(
      'missingField',
      'body.reference_ride_height',
      'the chassis datum needs the reference ride height to locate the ground plane',
    ),
  ];
}

function sourcedPoint(
  key: CornerKey,
  pointKey: CornerPointKey,
  point: MeasuredPoint,
  offsetMm: number,
): Sourced<Vec2> {
  return {
    value: {
      y: millimetresToMetres(point.value[1]),
      z: millimetresToMetres(point.value[2] + offsetMm),
    },
    ref: `${key}.points.${pointKey}`,
    confidence: point.confidence,
    sourceId: point.source,
  };
}

function sourcedPoint3(
  key: CornerKey,
  pointKey: CornerPointKey,
  point: MeasuredPoint,
  offsetMm: number,
): Sourced<Vec3> {
  return {
    value: {
      x: millimetresToMetres(point.value[0]),
      y: millimetresToMetres(point.value[1]),
      z: millimetresToMetres(point.value[2] + offsetMm),
    },
    ref: `${key}.points.${pointKey}`,
    confidence: point.confidence,
    sourceId: point.source,
  };
}

const CONFIDENCE_RANK: Readonly<Record<Confidence, number>> = {
  measured: 6,
  manufacturer: 5,
  derived: 4,
  modelled: 3,
  estimated: 2,
  assumed: 1,
  library: 0,
};

function weakerConfidence(a: Confidence, b: Confidence): Confidence {
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;
}

function midpointVec2(ref: string, a: Sourced<Vec2>, b: Sourced<Vec2>): Sourced<Vec2> {
  return {
    value: {
      y: (a.value.y + b.value.y) / 2,
      z: (a.value.z + b.value.z) / 2,
    },
    ref,
    confidence: weakerConfidence(a.confidence, b.confidence),
  };
}

/**
 * The front view keeps the midpoint of the two inner pivot screws for roll
 * centre, camber gain and the motion ratio. The side view uses the difference;
 * this is the one place the two constructions meet.
 */
function lowerInnerFrontView(
  model: CarModelDocument,
  cornerKey: CornerKey,
  offsetMm: number,
): Sourced<Vec2> | null {
  const a = point(model, cornerKey, 'lca_in_a', offsetMm);
  const b = point(model, cornerKey, 'lca_in_b', offsetMm);
  if (a === null || b === null) return null;
  return midpointVec2(`${cornerKey}.points.lca_in_a+${cornerKey}.points.lca_in_b`, a, b);
}

function upperInnerKeyFor(corner: CornerDocument): CornerPointKey {
  return corner.armType.upper === 'single_link' ? 'uca_in' : 'uca_in_a';
}

function sideViewAxleInput(
  model: CarModelDocument,
  cornerKey: CornerKey,
  offsetMm: number,
  errors: DataError[],
): SideViewAxleInput | null {
  const corner = cornerFor(model, cornerKey);
  if (!corner.ok) {
    errors.push(...corner.errors);
    return null;
  }
  const upperInnerKey = upperInnerKeyFor(corner.value);
  const required: readonly CornerPointKey[] = [
    'lca_in_a',
    'lca_in_b',
    'lca_out',
    upperInnerKey,
    'uca_out',
  ];
  const values: Partial<Record<CornerPointKey, Sourced<Vec3>>> = {};
  for (const key of required) {
    const value = point3(model, cornerKey, key, offsetMm);
    if (value === null) {
      errors.push(
        dataError(
          'missingField',
          `corners.${cornerKey}.points.${key}`,
          'anti-dive needs this side-view hardpoint',
        ),
      );
    } else {
      values[key] = value;
    }
  }
  const lowerInnerA = values.lca_in_a;
  const lowerInnerB = values.lca_in_b;
  const lowerOuter = values.lca_out;
  const upperInner = values[upperInnerKey];
  const upperOuter = values.uca_out;
  if (
    lowerInnerA === undefined ||
    lowerInnerB === undefined ||
    lowerOuter === undefined ||
    upperInner === undefined ||
    upperOuter === undefined
  ) {
    return null;
  }

  const axleKey = axleKeyForCorner(cornerKey);
  const axle = model.axles[axleKey];
  if (axle === null) {
    errors.push(dataError('missingField', `axles.${axleKey}`, 'anti-dive needs an axle block'));
    return null;
  }
  const wheelbase = model.wheelbase;
  if (axleKey === 'front' && wheelbase === null) {
    errors.push(dataError('missingField', 'body.wheelbase', 'the front contact patch needs the wheelbase'));
    return null;
  }
  const contactX = axleKey === 'front' ? wheelbase?.value : 0;
  if (contactX === undefined) return null;

  return {
    lowerInnerA_m: lowerInnerA,
    lowerInnerB_m: lowerInnerB,
    lowerOuter_m: lowerOuter,
    upperInner_m: upperInner,
    upperOuter_m: upperOuter,
    contactPatchX_m: {
      value: millimetresToMetres(contactX),
      ref: axleKey === 'front' ? 'body.wheelbase' : 'rear.contact_patch_x',
      confidence: axleKey === 'front' ? (wheelbase?.confidence ?? 'derived') : 'derived',
    },
  };
}

function point3(
  model: CarModelDocument,
  cornerKey: CornerKey,
  pointKey: CornerPointKey,
  offsetMm: number,
): Sourced<Vec3> | null {
  const measured = absoluteCornerPointMm(model, cornerKey, pointKey);
  return measured === null ? null : sourcedPoint3(cornerKey, pointKey, measured, offsetMm);
}

function point(
  model: CarModelDocument,
  cornerKey: CornerKey,
  pointKey: CornerPointKey,
  offsetMm: number,
): Sourced<Vec2> | null {
  const measured = absoluteCornerPointMm(model, cornerKey, pointKey);
  return measured === null ? null : sourcedPoint(cornerKey, pointKey, measured, offsetMm);
}

/**
 * 05 §3.2: IR_arm ≈ r_d/a, where r_d is the drop-link attachment projected on
 * the lower-arm line and a is the arm length. Null means the geometry cannot
 * supply it and the caller must fall back to the stated default.
 */
function derivedArbMotionRatio(
  model: CarModelDocument,
  cornerKey: CornerKey,
): Sourced<number> | null {
  const corner = cornerFor(model, cornerKey);
  if (!corner.ok) return null;
  const offsetMm = datumOffsetMm(model);
  if (offsetMm === null) return null;

  const inner = point(model, cornerKey, 'lca_in_a', offsetMm);
  const outer = point(model, cornerKey, 'lca_out', offsetMm);
  const drop = point(model, cornerKey, 'arb_drop', offsetMm);
  if (inner === null || outer === null || drop === null) return null;

  const armY = outer.value.y - inner.value.y;
  const armZ = outer.value.z - inner.value.z;
  const armLengthSquared = armY * armY + armZ * armZ;
  if (!(armLengthSquared > 0)) return null;

  const dropY = drop.value.y - inner.value.y;
  const dropZ = drop.value.z - inner.value.z;
  const ratio = (dropY * armY + dropZ * armZ) / armLengthSquared;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;

  return {
    value: ratio,
    ref: `${cornerKey}.points.arb_drop`,
    confidence: drop.confidence,
    ...(drop.sourceId === undefined ? {} : { sourceId: drop.sourceId }),
  };
}

function mirrorCorner(corner: CornerDocument): CornerDocument {
  const points: Partial<Record<CornerPointKey, MeasuredPoint>> = {};
  for (const [key, measured] of Object.entries(corner.points)) {
    if (measured === undefined) continue;
    const [x, y, z] = measured.value;
    points[key as CornerPointKey] = {
      value: [x, -y, z],
      source: measured.source,
      confidence: measured.confidence,
    };
  }
  return {
    armType: corner.armType,
    toe: corner.toe === null ? null : { ...corner.toe },
    points,
    damper: corner.damper,
  };
}

export function cornerFor(
  model: CarModelDocument,
  cornerKey: CornerKey,
): DataResult<CornerDocument> {
  const direct = model.corners[cornerKey];
  if (direct !== undefined) return ok(direct);
  if (!model.symmetry) {
    return fail([
      dataError('missingField', `corners.${cornerKey}`, 'this corner is not in the document'),
    ]);
  }
  const sourceKey: CornerKey | null =
    cornerKey === 'RF' ? 'LF' : cornerKey === 'RR' ? 'LR' : null;
  const sourceCorner = sourceKey === null ? undefined : model.corners[sourceKey];
  if (sourceKey === null || sourceCorner === undefined) {
    return fail([
      dataError(
        'missingField',
        `corners.${cornerKey}`,
        'this corner is not in the document and the same axle has no left corner to mirror',
      ),
    ]);
  }
  return ok(mirrorCorner(sourceCorner));
}

export function buildFrontViewInput(
  model: CarModelDocument,
  cornerKey: CornerKey = 'LF',
): DataResult<FrontViewInput> {
  const corner = cornerFor(model, cornerKey);
  if (!corner.ok) return corner;

  const axleKey = axleKeyForCorner(cornerKey);
  const axle = model.axles[axleKey];
  if (axle === null) {
    return fail([
      dataError('missingField', `axles.${axleKey}`, 'the front-view solve needs an axle block'),
    ]);
  }

  const errors = [];
  const offsetMm = datumOffsetMm(model);
  if (offsetMm === null) {
    return fail(missingDatumErrors());
  }
  const lcaInA = point(model, cornerKey, 'lca_in_a', offsetMm);
  const lcaInB = point(model, cornerKey, 'lca_in_b', offsetMm);
  const lcaIn =
    lcaInA === null || lcaInB === null
      ? null
      : lowerInnerFrontView(model, cornerKey, offsetMm);
  const lcaOut = point(model, cornerKey, 'lca_out', offsetMm);
  const upperInnerKey: CornerPointKey =
    corner.value.armType.upper === 'single_link' ? 'uca_in' : 'uca_in_a';
  const ucaIn = point(model, cornerKey, upperInnerKey, offsetMm);
  const ucaOut = point(model, cornerKey, 'uca_out', offsetMm);
  const wheelCentre = point(model, cornerKey, 'wc', offsetMm);
  const tieIn = point(model, cornerKey, 'tie_in', offsetMm);
  const tieOut = point(model, cornerKey, 'tie_out', offsetMm);
  const damperLo = point(model, cornerKey, 'damper_lo', offsetMm);
  const damperUp = point(model, cornerKey, 'damper_up', offsetMm);

  if (lcaInA === null) {
    errors.push(dataError('missingField', `corners.${cornerKey}.points.lca_in_a`, 'required'));
  }
  if (lcaInB === null) {
    errors.push(dataError('missingField', `corners.${cornerKey}.points.lca_in_b`, 'required'));
  }
  if (lcaOut === null) {
    errors.push(dataError('missingField', `corners.${cornerKey}.points.lca_out`, 'required'));
  }
  if (ucaIn === null) {
    errors.push(
      dataError('missingField', `corners.${cornerKey}.points.${upperInnerKey}`, 'required'),
    );
  }
  if (ucaOut === null) {
    errors.push(dataError('missingField', `corners.${cornerKey}.points.uca_out`, 'required'));
  }
  if (wheelCentre === null) {
    errors.push(dataError('missingField', `corners.${cornerKey}.points.wc`, 'required'));
  }

  const bumpLimit = axle.bumpLimit;
  const droopLimit = axle.droopLimit;
  if (bumpLimit === null) {
    errors.push(
      dataError(
        'missingField',
        `axles.${axleKey}.bump_limit_wheel`,
        'the front-view solve needs a bump limit',
      ),
    );
  }
  if (droopLimit === null) {
    errors.push(
      dataError(
        'missingField',
        `axles.${axleKey}.droop_limit_wheel`,
        'the front-view solve needs a droop limit',
      ),
    );
  }

  if (
    errors.length > 0 ||
    lcaIn === null ||
    lcaOut === null ||
    ucaIn === null ||
    ucaOut === null ||
    wheelCentre === null ||
    bumpLimit === null ||
    droopLimit === null
  ) {
    return fail(errors);
  }

  return ok({
    corner: cornerKey,
    side: SIDE_SIGN[cornerKey],
    lowerArmType: corner.value.armType.lower,
    upperArmType: corner.value.armType.upper,
    lcaIn_m: lcaIn,
    lcaOut_m: lcaOut,
    ucaIn_m: ucaIn,
    ucaOut_m: ucaOut,
    wheelCentre_m: wheelCentre,
    ...(tieIn === null ? {} : { tieIn_m: tieIn }),
    ...(tieOut === null ? {} : { tieOut_m: tieOut }),
    ...(damperLo === null ? {} : { damperLo_m: damperLo }),
    ...(damperUp === null ? {} : { damperUp_m: damperUp }),
    bumpLimit_m: millimetresToMetres(bumpLimit.value),
    droopLimit_m: millimetresToMetres(droopLimit.value),
  });
}

/**
 * Build the 3-D toe-link input for one corner. The front uses the rack end as
 * its inner ball; the rear uses a fixed chassis-side toe-link ball. Both feed
 * the same plan-view construction.
 */
export function buildToeInput(
  model: CarModelDocument,
  cornerKey: CornerKey,
): DataResult<ToeInput> {
  const corner = cornerFor(model, cornerKey);
  if (!corner.ok) return corner;

  const offsetMm = datumOffsetMm(model);
  if (offsetMm === null) return fail(missingDatumErrors());

  const axleKey: 'front' | 'rear' = cornerKey === 'LF' || cornerKey === 'RF' ? 'front' : 'rear';
  const axle = model.axles[axleKey];
  const errors: DataError[] = [];
  if (axle === null) {
    errors.push(dataError('missingField', `axles.${axleKey}`, 'the toe solve needs an axle block'));
  }

  const upperInnerKey: CornerPointKey =
    corner.value.armType.upper === 'single_link' ? 'uca_in' : 'uca_in_a';
  const keys: readonly CornerPointKey[] = [
    'lca_in_a',
    'lca_in_b',
    'lca_out',
    upperInnerKey,
    'uca_out',
    'wc',
    'tie_in',
    'tie_out',
  ];
  const points: Partial<Record<CornerPointKey, Sourced<Vec3>>> = {};
  for (const key of keys) {
    const value = point3(model, cornerKey, key, offsetMm);
    if (value === null) {
      errors.push(dataError('missingField', `corners.${cornerKey}.points.${key}`, 'required for bump steer'));
    } else {
      points[key] = value;
    }
  }

  const toe = corner.value.toe;
  if (toe === null) {
    errors.push(
      dataError('missingField', `corners.${cornerKey}.toe`, 'bump steer needs the stored static toe'),
    );
  }

  const bumpLimit = axle?.bumpLimit ?? null;
  const droopLimit = axle?.droopLimit ?? null;
  if (bumpLimit === null) {
    errors.push(
      dataError(
        'missingField',
        `axles.${axleKey}.bump_limit_wheel`,
        'the toe solve needs a bump limit',
      ),
    );
  }
  if (droopLimit === null) {
    errors.push(
      dataError(
        'missingField',
        `axles.${axleKey}.droop_limit_wheel`,
        'the toe solve needs a droop limit',
      ),
    );
  }

  const lcaInA = points.lca_in_a;
  const lcaInB = points.lca_in_b;
  const lcaOut = points.lca_out;
  const ucaIn = points[upperInnerKey];
  const ucaOut = points.uca_out;
  const wheelCentre = points.wc;
  const tieIn = points.tie_in;
  const tieOut = points.tie_out;

  if (
    errors.length > 0 ||
    lcaInA === undefined ||
    lcaInB === undefined ||
    lcaOut === undefined ||
    ucaIn === undefined ||
    ucaOut === undefined ||
    wheelCentre === undefined ||
    tieIn === undefined ||
    tieOut === undefined ||
    toe === null ||
    bumpLimit === null ||
    droopLimit === null
  ) {
    return fail(errors);
  }

  return ok({
    corner: cornerKey,
    side: SIDE_SIGN[cornerKey],
    lowerArmType: corner.value.armType.lower,
    upperArmType: corner.value.armType.upper,
    lcaInA_m: lcaInA,
    lcaInB_m: lcaInB,
    lcaOut_m: lcaOut,
    ucaIn_m: ucaIn,
    ucaOut_m: ucaOut,
    wheelCentre_m: wheelCentre,
    tieIn_m: tieIn,
    tieOut_m: tieOut,
    staticToe_rad: {
      value: degreesToRadians(toe.value),
      ref: `${cornerKey}.toe`,
      confidence: toe.confidence,
      sourceId: toe.source,
    },
    bumpLimit_m: millimetresToMetres(bumpLimit.value),
    droopLimit_m: millimetresToMetres(droopLimit.value),
  });
}

/**
 * Build the steering-axis input for one front corner. The two ball joints and
 * the derived wheel centre are composed into the ground frame at this one
 * boundary (D-25); the physics package never sees a stored wheel centre or a
 * stored caster. Rear corners are refused explicitly: a rear upright has no
 * steering axis, and the module must not be handed one.
 */
export function buildCasterInput(
  model: CarModelDocument,
  cornerKey: CornerKey,
): DataResult<CasterInput> {
  const corner = cornerFor(model, cornerKey);
  if (!corner.ok) return corner;

  if (cornerKey === 'LR' || cornerKey === 'RR') {
    return fail([
      dataError(
        'missingField',
        `corners.${cornerKey}.caster`,
        'rear corners have no steering axis; caster, KPI, scrub and trail are front-only',
      ),
    ]);
  }

  const offsetMm = datumOffsetMm(model);
  if (offsetMm === null) return fail(missingDatumErrors());

  const lower = point3(model, cornerKey, 'lca_out', offsetMm);
  const upper = point3(model, cornerKey, 'uca_out', offsetMm);
  const wheelCentre = point3(model, cornerKey, 'wc', offsetMm);

  const errors: DataError[] = [];
  if (lower === null) {
    errors.push(dataError('missingField', `corners.${cornerKey}.points.lca_out`, 'required for caster'));
  }
  if (upper === null) {
    errors.push(dataError('missingField', `corners.${cornerKey}.points.uca_out`, 'required for caster'));
  }
  if (wheelCentre === null) {
    errors.push(dataError('missingField', `corners.${cornerKey}.points.wc`, 'required for caster'));
  }
  if (errors.length > 0 || lower === null || upper === null || wheelCentre === null) {
    return fail(errors);
  }

  return ok({
    corner: cornerKey,
    side: SIDE_SIGN[cornerKey],
    lowerBallJoint_m: lower,
    upperBallJoint_m: upper,
    wheelCentre_m: wheelCentre,
  });
}

/**
 * Build the per-corner rates input: the axle's front-view geometry, the damper
 * mounts, the spring rate (N/mm on disk → N/m in SI) and the sprung mass (g per
 * axle on disk → kg per corner in SI). The spring's installation ratio is derived
 * from the damper geometry on a coilover: on a touring car the spring is coaxial
 * with the damper, so the stated rear ratio (0.7071) is superseded. A model that
 * declares a separate seat or rocker is refused rather than silently conflated —
 * the schema has no separate spring-mount points to derive from yet.
 */
export function buildRatesInput(
  model: CarModelDocument,
  cornerKey: CornerKey = 'LF',
): DataResult<RatesInput> {
  const axleKey = axleKeyForCorner(cornerKey);
  const axle = model.axles[axleKey];
  if (axle === null) {
    return fail([
      dataError('missingField', `axles.${axleKey}`, 'rates need this axle block'),
    ]);
  }

  const springLocation = axle.springLocation ?? 'coilover_at_damper';
  if (springLocation !== 'coilover_at_damper') {
    return fail([
      dataError(
        'missingField',
        `axles.${axleKey}.spring.location`,
        `this slice derives the spring installation ratio from the coaxial damper; a ${springLocation} spring mount needs its own measured points and is not modelled`,
      ),
    ]);
  }

  const frontView = buildFrontViewInput(model, cornerKey);
  if (!frontView.ok) return frontView;
  const corner = cornerFor(model, cornerKey);
  if (!corner.ok) return corner;

  const errors: DataError[] = [];
  const offsetMm = datumOffsetMm(model);
  if (offsetMm === null) return fail(missingDatumErrors());
  const damperLo = point(model, cornerKey, 'damper_lo', offsetMm);
  const damperUp = point(model, cornerKey, 'damper_up', offsetMm);
  const springRate = axle.springRate;

  if (damperLo === null) {
    errors.push(
      dataError(
        'missingField',
        `corners.${cornerKey}.points.damper_lo`,
        'required for the installation ratio',
      ),
    );
  }
  if (damperUp === null) {
    errors.push(
      dataError(
        'missingField',
        `corners.${cornerKey}.points.damper_up`,
        'required for the installation ratio',
      ),
    );
  }
  if (springRate === null) {
    errors.push(
      dataError(
        'missingField',
        `axles.${axleKey}.spring.rate`,
        'required for the wheel rate',
      ),
    );
  }

  if (errors.length > 0 || damperLo === null || damperUp === null || springRate === null) {
    return fail(errors);
  }

  const sprung = axleKey === 'front' ? model.mass.sprungFront : model.mass.sprungRear;
  const sprungMassRef =
    axleKey === 'front' ? 'body.mass.sprung_front' : 'body.mass.sprung_rear';
  const sprungMass =
    sprung === null
      ? null
      : {
          value: gramsToKilograms(sprung.value / 2),
          ref: sprungMassRef,
          confidence: sprung.confidence,
        };

  return ok({
    corner: cornerKey,
    frontView: frontView.value,
    damperLo_m: damperLo,
    damperUp_m: damperUp,
    springRate_Npm: {
      value: newtonsPerMillimetreToNewtonsPerMetre(springRate.value),
      ref: `axles.${axleKey}.spring.rate`,
      confidence: springRate.confidence,
    },
    sprungMass_kg: sprungMass,
  });
}

/**
 * Solve one axle's rates for the editor. Both ends now derive the installation
 * ratio from their own damper hardpoints. Editing either axle's spring rate
 * changes only that axle's result.
 */
export function buildAxleRates(
  model: CarModelDocument,
  axle: 'front' | 'rear',
): DataResult<RatesResult> {
  const input = buildRatesInput(model, AXLE_CORNER[axle]);
  if (!input.ok) return input;
  return ok(solveRates(input.value));
}

/**
 * Build the wheel-level damping-ratio input from the canonical damper
 * coefficient (`corners.<corner>.damper.c_post`) and the solved critical
 * damping. An absent coefficient uses fields.yaml's stated ASSUME(12.0) and is
 * flagged `assumedInput`; an edited value keeps the `estimated` confidence the
 * editor writes, so it never becomes `measured` just because it was typed.
 *
 * TODO(spec §4.8): this is the direct wheel-coefficient path, not
 * `orifice_single_piston_v1`; the full six-input band is a later slice.
 */
export function buildDampingRatioInput(
  model: CarModelDocument,
  axle: 'front' | 'rear',
  criticalDamping_NsPerM: Solved<number>,
): DampingRatioInput {
  const cornerKey = AXLE_CORNER[axle];
  const measured = model.corners[cornerKey]?.damper?.cPost ?? null;
  const coefficient: Sourced<number> =
    measured === null
      ? {
          value: DEFAULT_DAMPER_COEFFICIENT_NS_PER_M,
          ref: `corners.${cornerKey}.damper.c_post`,
          confidence: 'assumed',
        }
      : {
          value: measured.value,
          ref: `corners.${cornerKey}.damper.c_post`,
          confidence: measured.confidence,
        };

  return {
    wheelCoefficient_NsPerM: coefficient,
    criticalDamping_NsPerM: criticalDamping_NsPerM,
  };
}

/**
 * D-24: a present `blades` count means `rate_at_link` is the rate of one blade;
 * absent (the normal case) means it is the rate of the bar as fitted, so the
 * effective count is one and the rate's provenance carries it. `fixed` is a
 * single bar regardless.
 */
function effectiveBladeCount(arb: ArbDocument, prefix: string): Sourced<number> {
  if (arb.type === 'blade' && arb.blades !== null) {
    return {
      value: arb.blades.value,
      ref: `${prefix}.blades`,
      confidence: arb.blades.confidence,
    };
  }
  return {
    value: 1,
    ref: `${prefix}.rate_at_link`,
    confidence: arb.rateAtLink?.confidence ?? 'assumed',
  };
}

/**
 * Build the anti-roll bar input for one axle. Lengths on disk are millimetres
 * and `shear_modulus` is GPa; both are converted here, the one boundary. A
 * missing bar geometry is carried as null so the physics package can refuse
 * the roll stiffness as a value and name the field.
 */
export function buildAntiRollBarInput(
  axle: AxleDocument,
  axleKey: 'front' | 'rear',
  derivedMotionRatio: Sourced<number> | null = null,
): AntiRollBarInput {
  const arb = axle.arb;
  if (arb === null || arb.type === 'none') return { type: 'none', axle: axleKey };

  const prefix = `axles.${axleKey}.arb`;
  const motionRatio: Sourced<number> =
    derivedMotionRatio ?? {
      value: ARB_MOTION_RATIO_ASSUMED,
      ref: `${prefix}.motion_ratio`,
      confidence: 'assumed',
    };

  if (arb.type === 'torsion_bar') {
    return {
      type: 'torsion_bar',
      axle: axleKey,
      barDiameter_m: sourcedNumber(arb.barDiameter, `${prefix}.bar_diameter`, millimetresToMetres),
      span_m: sourcedNumber(arb.span, `${prefix}.span`, millimetresToMetres),
      armLength_m: sourcedNumber(arb.armLength, `${prefix}.arm_length`, millimetresToMetres),
      shearModulus_Pa:
        arb.shearModulus === null
          ? {
              value: STEEL_SHEAR_MODULUS_GPA * GIGAPASCALS_TO_PASCALS,
              ref: `${prefix}.shear_modulus`,
              confidence: 'assumed',
            }
          : {
              value: arb.shearModulus.value * GIGAPASCALS_TO_PASCALS,
              ref: `${prefix}.shear_modulus`,
              confidence: arb.shearModulus.confidence,
            },
      motionRatio,
    };
  }

  return {
    type: arb.type,
    axle: axleKey,
    singleBladeRate_Npm: sourcedNumber(
      arb.rateAtLink,
      `${prefix}.rate_at_link`,
      newtonsPerMillimetreToNewtonsPerMetre,
    ),
    blades: effectiveBladeCount(arb, prefix),
    motionRatio,
  };
}

/**
 * Build the SI roll-stiffness input for both axles. Both spring wheel rates come
 * from the axle's own damper geometry; only the front ARB ratio keeps 05's stated
 * 0.80, because the reference front `arb_drop` is not the one the worked example
 * uses. The rear ARB ratio is derived from the modelled rear `arb_drop`. A missing
 * rear axle is a data error, because the front share cannot exist without it.
 */
export function buildRollStiffnessInput(model: CarModelDocument): DataResult<RollStiffnessInput> {
  const rear = model.axles.rear;
  if (rear === null) {
    return fail([
      dataError(
        'missingField',
        'axles.rear',
        'roll stiffness needs a rear axle block; the front share is not computable without it',
      ),
    ]);
  }

  const frontRates = buildAxleRates(model, 'front');
  if (!frontRates.ok) return frontRates;
  const rearRates = buildAxleRates(model, 'rear');
  if (!rearRates.ok) return rearRates;

  const frontTrack = model.axles.front.track;
  const rearTrack = rear.track;
  const rearMotionRatio = derivedArbMotionRatio(model, 'LR');

  return ok({
    front: {
      axle: 'front',
      springWheelRate_Npm: frontRates.value.wheelRate,
      antiRollBar: buildAntiRollBarInput(model.axles.front, 'front'),
      track_m: {
        value: millimetresToMetres(frontTrack.value),
        ref: 'axles.front.track',
        confidence: frontTrack.confidence,
      },
    },
    rear: {
      axle: 'rear',
      springWheelRate_Npm: rearRates.value.wheelRate,
      antiRollBar: buildAntiRollBarInput(rear, 'rear', rearMotionRatio),
      track_m: {
        value: millimetresToMetres(rearTrack.value),
        ref: 'axles.rear.track',
        confidence: rearTrack.confidence,
      },
    },
  });
}

interface MeasuredCg {
  readonly groundHeight_m: Sourced<number>;
  readonly band_m: Band | null;
}

/**
 * D-26: run the raised-axle, two-scale procedure the document recorded. The
 * wheel radius comes from the axle opposite the raised end, because that is the
 * axle sitting on the scales whose centre defines the pivot height. A missing
 * scale tolerance falls back to fields.yaml's stated ±5 g and is flagged as an
 * assumption in the type, not silently treated as exact.
 */
function measuredCg(model: CarModelDocument): MeasuredCg | null {
  const block = model.cg.raiseAndWeigh;
  const total = model.mass.total;
  const wheelbase = model.wheelbase;
  if (block === null || total === null || wheelbase === null) return null;

  const measuredAxleKey: 'front' | 'rear' = block.raisedEnd === 'front' ? 'rear' : 'front';
  const measuredAxle =
    measuredAxleKey === 'front' ? model.axles.front : model.axles.rear;
  const radius = measuredAxle?.tyreRadius ?? model.axles.front.tyreRadius;
  if (radius === null) return null;

  const tolerance =
    block.weighingTolerance === null
      ? {
          value: DEFAULT_WEIGHING_TOLERANCE_G,
          ref: 'body.cg.raise_and_weigh.weighing_tolerance',
          confidence: 'assumed' as const,
        }
      : {
          value: block.weighingTolerance.value,
          ref: 'body.cg.raise_and_weigh.weighing_tolerance',
          confidence: block.weighingTolerance.confidence,
        };

  const solved = solveRaiseAndWeigh({
    wheelbase_m: {
      value: millimetresToMetres(wheelbase.value),
      ref: 'body.wheelbase',
      confidence: wheelbase.confidence,
    },
    totalMass_kg: {
      value: gramsToKilograms(total.value),
      ref: 'body.mass.total',
      confidence: total.confidence,
    },
    raisedEnd: block.raisedEnd,
    raiseHeight_m: {
      value: millimetresToMetres(block.raiseHeight.value),
      ref: 'body.cg.raise_and_weigh.raise_height',
      confidence: block.raiseHeight.confidence,
    },
    axleWeightLevel_kg: {
      value: gramsToKilograms(block.axleWeightLevel.value),
      ref: 'body.cg.raise_and_weigh.axle_weight_level',
      confidence: block.axleWeightLevel.confidence,
    },
    axleWeightRaised_kg: {
      value: gramsToKilograms(block.axleWeightRaised.value),
      ref: 'body.cg.raise_and_weigh.axle_weight_raised',
      confidence: block.axleWeightRaised.confidence,
    },
    wheelRadius_m: {
      value: millimetresToMetres(radius.value),
      ref: `axles.${measuredAxleKey}.tyre_radius`,
      confidence: radius.confidence,
    },
    weighingTolerance_kg: {
      value: gramsToKilograms(tolerance.value),
      ref: tolerance.ref,
      confidence: tolerance.confidence,
    },
  });

  if (solved.cgHeight_m.kind !== 'defined') return null;

  return {
    groundHeight_m: {
      value: solved.cgHeight_m.value,
      ref: 'body.cg.raise_and_weigh',
      confidence: solved.cgHeight_m.tier === 'firm' ? 'measured' : 'derived',
    },
    band_m: solved.band_m,
  };
}

/**
 * Build the side-view anti-dive input. The two inner pivots are passed
 * independently: the side-view solver uses their difference, while the front
 * view (built separately) uses their midpoint. `cgHeight_m` is the **derived**
 * height above ground (`stored z + thickness + ride_height`); a model with no
 * CG height is refused rather than given an invented default here.
 *
 * There is deliberately no brake-bias or torque-split input: a single motor
 * drives and brakes all four wheels, so the axle share is the dynamic axle load
 * at the traction limit.
 */
export function buildAntiDiveInput(
  model: CarModelDocument,
  longitudinalAcceleration_mps2: number,
): DataResult<AntiDiveInput> {
  const errors: DataError[] = [];
  const offsetMm = datumOffsetMm(model);
  if (offsetMm === null) return fail(missingDatumErrors());

  const mass = model.mass.total;
  if (mass === null) {
    errors.push(dataError('missingField', 'body.mass.total', 'anti-dive needs the total mass'));
  }
  const frontShare = model.cg.frontMassShare;
  if (frontShare === null) {
    errors.push(
      dataError(
        'missingField',
        'body.cg.front_mass_share',
        'anti-dive needs the front mass share',
      ),
    );
  }
  const wheelbase = model.wheelbase;
  if (wheelbase === null) {
    errors.push(dataError('missingField', 'body.wheelbase', 'anti-dive needs the wheelbase'));
  }

  const front = sideViewAxleInput(model, 'LF', offsetMm, errors);
  const rear = sideViewAxleInput(model, 'LR', offsetMm, errors);

  const storedCg = model.cg.height;
  const measured = measuredCg(model);
  const cgHeight: Sourced<number> | null =
    storedCg !== null
      ? {
          value: millimetresToMetres(storedCg.value + offsetMm),
          ref: 'body.cg.height',
          confidence: storedCg.confidence,
        }
      : measured === null
        ? null
        : measured.groundHeight_m;
  const cgBand: Band | null =
    cgHeight === null
      ? null
      : (measured?.band_m ??
        {
          low: cgHeight.value - 0.004,
          high: cgHeight.value + 0.004,
        });

  if (
    errors.length > 0 ||
    mass === null ||
    frontShare === null ||
    wheelbase === null ||
    front === null ||
    rear === null
  ) {
    return fail(errors);
  }

  return ok({
    front,
    rear,
    wheelbase_m: {
      value: millimetresToMetres(wheelbase.value),
      ref: 'body.wheelbase',
      confidence: wheelbase.confidence,
    },
    cgHeight_m: cgHeight,
    ...(cgBand === null ? {} : { cgHeightBand_m: cgBand }),
    totalMass_kg: {
      value: gramsToKilograms(mass.value),
      ref: 'body.mass.total',
      confidence: mass.confidence,
    },
    frontMassShare: {
      value: percentToFraction(frontShare.value),
      ref: 'body.cg.front_mass_share',
      confidence: frontShare.confidence,
    },
    longitudinalAcceleration_mps2,
  });
}

/**
 * Build the SI load-transfer input at one lateral acceleration. Lengths are
 * converted once (mm → m), masses once (g → kg), and the front mass share once
 * (% → fraction). The CG route priority is measured raise-and-weigh, then the
 * component estimate, then the stated 28.0 mm default (D-26 / D-14 / D-18).
 * The stored chassis-frame z stays the anchor when it is present, so lowering
 * the car moves the CG down relative to the ground.
 */
export function buildLoadTransferInput(
  model: CarModelDocument,
  lateralAcceleration_mps2: number,
): DataResult<LoadTransferInput> {
  const errors: DataError[] = [];
  const offsetMm = datumOffsetMm(model);
  if (offsetMm === null) errors.push(...missingDatumErrors());

  const total = model.mass.total;
  if (total === null) {
    errors.push(dataError('missingField', 'body.mass.total', 'load transfer needs the total mass'));
  }
  const frontShare = model.cg.frontMassShare;
  if (frontShare === null) {
    errors.push(
      dataError(
        'missingField',
        'body.cg.front_mass_share',
        'load transfer needs the front mass share',
      ),
    );
  }
  const wheelbase = model.wheelbase;
  if (wheelbase === null) {
    errors.push(dataError('missingField', 'body.wheelbase', 'load transfer needs the wheelbase'));
  }

  const rear = model.axles.rear;
  if (rear === null) {
    errors.push(
      dataError('missingField', 'axles.rear', 'load transfer needs a rear axle block'),
    );
  }

  const frontView = buildFrontViewInput(model, 'LF');
  if (!frontView.ok) return frontView;
  const frontSolved = solveFrontView(frontView.value);
  const rollCentreFront = frontSolved.rollCentreHeight;
  if (rollCentreFront.kind !== 'defined') {
    errors.push(
      dataError(
        'missingField',
        'front.roll_centre_height',
        'load transfer needs the front roll-centre height from module 2',
      ),
    );
  }

  let rollCentreRear: Sourced<number> = {
    value: REAR_ROLL_CENTRE_HEIGHT_ASSUMED_M,
    ref: 'assumed.rear_roll_centre_height',
    confidence: 'assumed',
  };
  const rearView = buildFrontViewInput(model, 'LR');
  if (rearView.ok) {
    const rearSolved = solveFrontView(rearView.value).rollCentreHeight;
    if (rearSolved.kind === 'defined') {
      rollCentreRear = {
        value: rearSolved.value,
        ref: 'rear.roll_centre_height',
        confidence: rearSolved.tier === 'firm' ? 'derived' : 'modelled',
      };
    }
  }

  const rollInput = buildRollStiffnessInput(model);
  if (!rollInput.ok) return rollInput;
  const rollResult = solveRollStiffness(rollInput.value);

  const unsprungFrontMeasured = model.mass.unsprungFront;
  const unsprungRearMeasured = model.mass.unsprungRear;
  const unsprungFront: Sourced<number> =
    unsprungFrontMeasured === null
      ? {
          value: DEFAULT_UNSPRUNG_AXLE_KG,
          ref: 'body.mass.unsprung_front',
          confidence: 'estimated',
        }
      : {
          value: gramsToKilograms(unsprungFrontMeasured.value),
          ref: 'body.mass.unsprung_front',
          confidence: unsprungFrontMeasured.confidence,
        };
  const unsprungRear: Sourced<number> =
    unsprungRearMeasured === null
      ? {
          value: DEFAULT_UNSPRUNG_AXLE_KG,
          ref: 'body.mass.unsprung_rear',
          confidence: 'estimated',
        }
      : {
          value: gramsToKilograms(unsprungRearMeasured.value),
          ref: 'body.mass.unsprung_rear',
          confidence: unsprungRearMeasured.confidence,
        };

  const zOffsetMm = offsetMm ?? 0;

  let unsprungHeight: Sourced<number> | null = null;
  if (model.cg.unsprungHeight !== null) {
    unsprungHeight = {
      value: millimetresToMetres(model.cg.unsprungHeight.value + zOffsetMm),
      ref: 'body.cg.unsprung_height',
      confidence: model.cg.unsprungHeight.confidence,
    };
  } else if (model.axles.front.tyreRadius !== null) {
    unsprungHeight = {
      value:
        UNSPRUNG_HEIGHT_TYRE_RADIUS_FACTOR *
        millimetresToMetres(model.axles.front.tyreRadius.value),
      ref: 'body.cg.unsprung_height',
      confidence: 'assumed',
    };
  } else {
    errors.push(
      dataError(
        'missingField',
        'body.cg.unsprung_height',
        'no unsprung height and no tyre radius to assume it from',
      ),
    );
  }

  if (
    errors.length > 0 ||
    total === null ||
    frontShare === null ||
    wheelbase === null ||
    rear === null ||
    rollCentreFront.kind !== 'defined' ||
    unsprungHeight === null
  ) {
    return fail(errors);
  }

  const components: readonly CgComponentInput[] | null =
    model.cg.components === null || model.cg.components.length === 0
      ? null
      : model.cg.components.map((component, index) => ({
          mass_kg: {
            value: gramsToKilograms(component.mass.value),
            ref: `body.cg.components[${index}].mass`,
            confidence: component.mass.confidence,
          },
          height_m: {
            value: millimetresToMetres(component.height.value + zOffsetMm),
            ref: `body.cg.components[${index}].z`,
            confidence: component.height.confidence,
          },
        }));

  const cgHeight = model.cg.height;
  const storedCgGround: Sourced<number> | null =
    cgHeight === null
      ? null
      : {
          value: millimetresToMetres(cgHeight.value + zOffsetMm),
          ref: 'body.cg.height',
          confidence: cgHeight.confidence,
        };
  const measured = measuredCg(model);
  const cgDefaultHeight = storedCgGround;
  const cgMeasuredHeight =
    measured === null ? null : (storedCgGround ?? measured.groundHeight_m);
  const measuredHalfWidth =
    measured === null || measured.band_m === null
      ? null
      : (measured.band_m.high - measured.band_m.low) / 2;
  const cgMeasuredBand =
    cgMeasuredHeight === null || measuredHalfWidth === null
      ? null
      : {
          low: cgMeasuredHeight.value - measuredHalfWidth,
          high: cgMeasuredHeight.value + measuredHalfWidth,
        };

  return ok({
    totalMass_kg: {
      value: gramsToKilograms(total.value),
      ref: 'body.mass.total',
      confidence: total.confidence,
    },
    frontMassShare: {
      value: percentToFraction(frontShare.value),
      ref: 'body.cg.front_mass_share',
      confidence: frontShare.confidence,
    },
    unsprungFront_kg: unsprungFront,
    unsprungRear_kg: unsprungRear,
    unsprungHeight_m: unsprungHeight,
    cgComponents: components,
    ...(cgDefaultHeight === null ? {} : { cgDefaultHeight_m: cgDefaultHeight }),
    ...(cgMeasuredHeight === null ? {} : { cgMeasuredHeight_m: cgMeasuredHeight }),
    ...(cgMeasuredBand === null ? {} : { cgMeasuredBand_m: cgMeasuredBand }),
    wheelbase_m: {
      value: millimetresToMetres(wheelbase.value),
      ref: 'body.wheelbase',
      confidence: wheelbase.confidence,
    },
    trackFront_m: {
      value: millimetresToMetres(model.axles.front.track.value),
      ref: 'axles.front.track',
      confidence: model.axles.front.track.confidence,
    },
    trackRear_m: {
      value: millimetresToMetres(rear.track.value),
      ref: 'axles.rear.track',
      confidence: rear.track.confidence,
    },
    rollCentreFront_m: {
      value: rollCentreFront.value,
      ref: 'front.roll_centre_height',
      confidence: rollCentreFront.tier === 'firm' ? 'derived' : 'estimated',
    },
    rollCentreRear_m: rollCentreRear,
    rollStiffnessFront_NmPerRad: rollResult.front.rollStiffness,
    rollStiffnessRear_NmPerRad: rollResult.rear.rollStiffness,
    lateralAcceleration_mps2,
  });
}
