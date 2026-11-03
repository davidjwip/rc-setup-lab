import type { FrontViewInput, RatesInput, Sourced, Vec2 } from '@setuplab/physics';
import { dataError, fail, ok, type DataError, type DataResult } from './errors.js';
import type {
  CarModelDocument,
  CornerDocument,
  CornerKey,
  CornerPointKey,
  MeasuredPoint,
} from './model.js';
import {
  gramsToKilograms,
  millimetresToMetres,
  newtonsPerMillimetreToNewtonsPerMetre,
} from './units.js';

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
        'axles.rear.spring.rate',
        'this document carries a front axle only; the rear rates need rear axle data',
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
