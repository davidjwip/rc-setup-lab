import {
  notMeasured,
  solveRates,
  solveRatesFromRatio,
  type AntiRollBarInput,
  type FrontViewInput,
  type RatesInput,
  type RollStiffnessInput,
  type Solved,
  type Sourced,
  type Vec2,
} from '@setuplab/physics';
import { dataError, fail, ok, type DataError, type DataResult } from './errors.js';
import type {
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
} from './units.js';

/**
 * 05 §6.5: the reference car has no rear hardpoints, so its rear installation
 * ratio is an assumed input. It is not stored in fields.yaml; the TODO in the
 * PR records the schema gap.
 */
const REAR_INSTALLATION_RATIO_ASSUMED = 0.7071;

/**
 * 05 §3.2/§6.3: the ARB motion ratio used by the worked examples. The schema
 * has no field for it and the reference asset's `arb_drop` does not reproduce
 * 0.80, so this slice states the assumption rather than inventing a linkage.
 * TODO(spec §3.2): derive IR_arm from `points.arb_drop` once the schema can
 * carry the derived value.
 */
const ARB_MOTION_RATIO_ASSUMED = 0.8;

/** fields.yaml `axles.<axle>.arb.shear_modulus`: steel is the stated default. */
const STEEL_SHEAR_MODULUS_GPA = 79.3;
const GIGAPASCALS_TO_PASCALS = 1e9;

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
  return { armType: corner.armType, points };
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
  const leftFront = model.corners.LF;
  if (leftFront === undefined) {
    return fail([dataError('missingField', 'corners.LF', 'no source corner to mirror')]);
  }
  return ok(mirrorCorner(leftFront));
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
    return fail([
      dataError(
        'missingField',
        `corners.${cornerKey}.points.lca_in_a`,
        'the rear axle has no measured corner geometry; use the roll builder for its assumed input',
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
 * Build the anti-roll bar input for one axle. Lengths on disk are millimetres
 * and `shear_modulus` is GPa; both are converted here, the one boundary. A
 * missing bar geometry is carried as null so the physics package can refuse
 * the roll stiffness as a value and name the field.
 */
export function buildAntiRollBarInput(axle: AxleDocument, axleKey: 'front' | 'rear'): AntiRollBarInput {
  const arb = axle.arb;
  if (arb === null || arb.type === 'none') return { type: 'none', axle: axleKey };

  const prefix = `axles.${axleKey}.arb`;
  const motionRatio: Sourced<number> = {
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
    // TODO(spec §3.2): fields.yaml has no axles.<axle>.arb.blades. A blade model
    // therefore reaches solveAntiRollBar with no count and is refused, never
    // assumed; `fixed` is a single bar and needs no count.
    blades: null,
    motionRatio,
  };
}

function frontSpringWheelRate(model: CarModelDocument): DataResult<Solved<number>> {
  const ratesInput = buildRatesInput(model, 'LF');
  if (!ratesInput.ok) return ratesInput;
  return ok(solveRates(ratesInput.value).wheelRate);
}

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
 * from the measured front-view geometry; the rear has no hardpoints in the
 * reference car, so it uses 05 §6.5's assumed rear installation ratio. A
 * missing rear axle is a data error, because the front share cannot exist
 * without it.
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
      antiRollBar: buildAntiRollBarInput(rear, 'rear'),
      track_m: {
        value: millimetresToMetres(rearTrack.value),
        ref: 'axles.rear.track',
        confidence: rearTrack.confidence,
      },
    },
  });
}
