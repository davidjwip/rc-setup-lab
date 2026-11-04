import {
  notMeasured,
  solveFrontView,
  solveRates,
  solveRatesFromRatio,
  solveRollStiffness,
  type AntiRollBarInput,
  type CgComponentInput,
  type FrontViewInput,
  type DampingRatioInput,
  type LoadTransferInput,
  type RatesInput,
  type RatesResult,
  type RollStiffnessInput,
  type Solved,
  type Sourced,
  type Vec2,
} from '@setuplab/physics';
import { dataError, fail, ok, type DataError, type DataResult } from './errors.js';
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
  gramsToKilograms,
  millimetresToMetres,
  newtonsPerMillimetreToNewtonsPerMetre,
  percentToFraction,
} from './units.js';

/**
 * 05 §6.5: the reference car has no rear hardpoints, so its rear installation
 * ratio is an assumed input. It is not stored in fields.yaml; the TODO in the
 * PR records the schema gap.
 */
const REAR_INSTALLATION_RATIO_ASSUMED = 0.7071;

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

function sourcedPoint(key: CornerKey, pointKey: CornerPointKey, point: MeasuredPoint): Sourced<Vec2> {
  return {
    value: {
      y: millimetresToMetres(point.value[1]),
      z: millimetresToMetres(point.value[2]),
    },
    ref: `${key}.points.${pointKey}`,
    confidence: point.confidence,
    sourceId: point.source,
  };
}

function point(
  corner: CornerDocument,
  cornerKey: CornerKey,
  pointKey: CornerPointKey,
): Sourced<Vec2> | null {
  const measured = corner.points[pointKey];
  return measured === undefined ? null : sourcedPoint(cornerKey, pointKey, measured);
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

  const inner = point(corner.value, cornerKey, 'lca_in_a');
  const outer = point(corner.value, cornerKey, 'lca_out');
  const drop = point(corner.value, cornerKey, 'arb_drop');
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
  return { armType: corner.armType, points, damper: corner.damper };
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

  const errors = [];
  const lcaIn = point(corner.value, cornerKey, 'lca_in_a');
  const lcaOut = point(corner.value, cornerKey, 'lca_out');
  const upperInnerKey: CornerPointKey =
    corner.value.armType.upper === 'single_link' ? 'uca_in' : 'uca_in_a';
  const ucaIn = point(corner.value, cornerKey, upperInnerKey);
  const ucaOut = point(corner.value, cornerKey, 'uca_out');
  const wheelCentre = point(corner.value, cornerKey, 'wc');

  if (lcaIn === null) {
    errors.push(dataError('missingField', `corners.${cornerKey}.points.lca_in_a`, 'required'));
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

  const bumpLimit = model.axles.front.bumpLimit;
  const droopLimit = model.axles.front.droopLimit;
  if (bumpLimit === null) {
    errors.push(
      dataError(
        'missingField',
        'axles.front.bump_limit_wheel',
        'the front-view solve needs a bump limit',
      ),
    );
  }
  if (droopLimit === null) {
    errors.push(
      dataError(
        'missingField',
        'axles.front.droop_limit_wheel',
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
    bumpLimit_m: millimetresToMetres(bumpLimit.value),
    droopLimit_m: millimetresToMetres(droopLimit.value),
  });
}

/**
 * Build the per-corner rates input: the front-view geometry, the damper mounts, the
 * spring rate (N/mm on disk → N/m in SI) and the sprung mass (g per axle on disk →
 * kg per corner in SI). Absent sprung mass is carried as null so the wheel rate can
 * still be solved and the frequency alone reports `notMeasured`.
 */
export function buildRatesInput(
  model: CarModelDocument,
  cornerKey: CornerKey = 'LF',
): DataResult<RatesInput> {
  if (cornerKey === 'LR' || cornerKey === 'RR') {
    // TODO(spec 05 §6.5): the rear geometry is modelled now, but this path still
    // reads the front spring and front sprung mass. Wiring rear rates is the
    // spring/damper slice; the roll builder derives the rear ARB ratio meanwhile.
    return fail([
      dataError(
        'missingField',
        'axles.rear',
        'rear rates are not built in this slice; use the roll builder for the rear axle',
      ),
    ]);
  }

  const frontView = buildFrontViewInput(model, cornerKey);
  if (!frontView.ok) return frontView;
  const corner = cornerFor(model, cornerKey);
  if (!corner.ok) return corner;

  const errors: DataError[] = [];
  const damperLo = point(corner.value, cornerKey, 'damper_lo');
  const damperUp = point(corner.value, cornerKey, 'damper_up');
  const springRate = model.axles.front.springRate;

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
      dataError('missingField', 'axles.front.spring.rate', 'required for the wheel rate'),
    );
  }

  if (
    errors.length > 0 ||
    damperLo === null ||
    damperUp === null ||
    springRate === null
  ) {
    return fail(errors);
  }

  const sprung = model.mass.sprungFront;
  const sprungMass =
    sprung === null
      ? null
      : {
          value: gramsToKilograms(sprung.value / 2),
          ref: 'body.mass.sprung_front',
          confidence: sprung.confidence,
        };

  return ok({
    corner: cornerKey,
    frontView: frontView.value,
    damperLo_m: damperLo,
    damperUp_m: damperUp,
    springRate_Npm: {
      value: newtonsPerMillimetreToNewtonsPerMetre(springRate.value),
      ref: 'axles.front.spring.rate',
      confidence: springRate.confidence,
    },
    sprungMass_kg: sprungMass,
  });
}

/**
 * 05 §6.5: the rear spring path still uses its stated installation ratio until
 * the rear damper hardpoints replace it. The rear ARB ratio is derived from the
 * modelled rear geometry; only the spring side is the stated input.
 */
function buildRearRates(model: CarModelDocument): DataResult<RatesResult> {
  const rear = model.axles.rear;
  if (rear === null) {
    return fail([dataError('missingField', 'axles.rear', 'rear rates need a rear axle block')]);
  }
  const springRate = rear.springRate;
  if (springRate === null) {
    return fail([
      dataError('missingField', 'axles.rear.spring.rate', 'required for the wheel rate'),
    ]);
  }
  const sprung = model.mass.sprungRear;
  const sprungMass =
    sprung === null
      ? null
      : {
          value: gramsToKilograms(sprung.value / 2),
          ref: 'body.mass.sprung_rear',
          confidence: sprung.confidence,
        };

  return ok(
    solveRatesFromRatio({
      corner: 'LR',
      installationRatio: {
        value: REAR_INSTALLATION_RATIO_ASSUMED,
        ref: 'assumed.IR_rear',
        confidence: 'assumed',
      },
      springRate_Npm: {
        value: newtonsPerMillimetreToNewtonsPerMetre(springRate.value),
        ref: 'axles.rear.spring.rate',
        confidence: springRate.confidence,
      },
      sprungMass_kg: sprungMass,
    }),
  );
}

/**
 * Solve one axle's rates for the editor: the front from its measured geometry,
 * the rear from 05 §6.5's stated installation ratio. Editing either axle's
 * spring rate changes only that axle's result.
 */
export function buildAxleRates(
  model: CarModelDocument,
  axle: 'front' | 'rear',
): DataResult<RatesResult> {
  if (axle === 'rear') return buildRearRates(model);
  const input = buildRatesInput(model, 'LF');
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

function frontSpringWheelRate(model: CarModelDocument): DataResult<Solved<number>> {
  const ratesInput = buildRatesInput(model, 'LF');
  if (!ratesInput.ok) return ratesInput;
  return ok(solveRates(ratesInput.value).wheelRate);
}

/**
 * 05 §6.5: the rear spring path still uses its stated installation ratio. This
 * slice derives only the rear ARB motion ratio from the new modelled geometry;
 * TODO(spec 05 §6.5) moves the rear spring ratio onto its damper hardpoints.
 */
function rearSpringWheelRate(model: CarModelDocument): Solved<number> {
  const rear = model.axles.rear;
  if (rear === null) return notMeasured(['axles.rear']);
  const springRate = rear.springRate;
  if (springRate === null) return notMeasured(['axles.rear.spring.rate']);

  const rates = solveRatesFromRatio({
    corner: 'LR',
    installationRatio: {
      value: REAR_INSTALLATION_RATIO_ASSUMED,
      ref: 'assumed.IR_rear',
      confidence: 'assumed',
    },
    springRate_Npm: {
      value: newtonsPerMillimetreToNewtonsPerMetre(springRate.value),
      ref: 'axles.rear.spring.rate',
      confidence: springRate.confidence,
    },
    sprungMass_kg: null,
  });
  return rates.wheelRate;
}

/**
 * Build the SI roll-stiffness input for both axles. The front wheel rate comes
 * from the measured front-view geometry and keeps 05's stated ARB ratio; the
 * rear spring rate still uses 05 §6.5's stated installation ratio, while its
 * ARB ratio is derived from the modelled rear `arb_drop`. A missing rear axle
 * is a data error, because the front share cannot exist without it.
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

  const frontWheelRate = frontSpringWheelRate(model);
  if (!frontWheelRate.ok) return frontWheelRate;

  const frontTrack = model.axles.front.track;
  const rearTrack = rear.track;
  const rearMotionRatio = derivedArbMotionRatio(model, 'LR');

  return ok({
    front: {
      axle: 'front',
      springWheelRate_Npm: frontWheelRate.value,
      antiRollBar: buildAntiRollBarInput(model.axles.front, 'front'),
      track_m: {
        value: millimetresToMetres(frontTrack.value),
        ref: 'axles.front.track',
        confidence: frontTrack.confidence,
      },
    },
    rear: {
      axle: 'rear',
      springWheelRate_Npm: rearSpringWheelRate(model),
      antiRollBar: buildAntiRollBarInput(rear, 'rear', rearMotionRatio),
      track_m: {
        value: millimetresToMetres(rearTrack.value),
        ref: 'axles.rear.track',
        confidence: rearTrack.confidence,
      },
    },
  });
}

/**
 * Build the SI load-transfer input at one lateral acceleration. Lengths are
 * converted once (mm → m), masses once (g → kg), and the front mass share once
 * (% → fraction). The CG height is not read as a measurement: the physics
 * package infers it from `body.cg.components[]`, or uses the stated default.
 */
export function buildLoadTransferInput(
  model: CarModelDocument,
  lateralAcceleration_mps2: number,
): DataResult<LoadTransferInput> {
  const errors: DataError[] = [];

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

  let unsprungHeight: Sourced<number> | null = null;
  if (model.cg.unsprungHeight !== null) {
    unsprungHeight = {
      value: millimetresToMetres(model.cg.unsprungHeight.value),
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
            value: millimetresToMetres(component.height.value),
            ref: `body.cg.components[${index}].z`,
            confidence: component.height.confidence,
          },
        }));

  const cgHeight = model.cg.height;
  const cgDefaultHeight: Sourced<number> | null =
    cgHeight === null
      ? null
      : {
          value: millimetresToMetres(cgHeight.value),
          ref: 'body.cg.height',
          confidence: cgHeight.confidence,
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
