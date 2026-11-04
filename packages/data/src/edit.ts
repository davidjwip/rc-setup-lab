import { dataError, fail, type DataError, type DataResult } from './errors.js';
import { isHubFixedPointKey } from './hub.js';
import type {
  ArbTypeDocument,
  CarModelDocument,
  CornerKey,
  CornerPointKey,
} from './model.js';
import { parseCarModel } from './parse.js';

export function updateCornerPointMm(
  model: CarModelDocument,
  cornerKey: CornerKey,
  pointKey: CornerPointKey,
  axis: 1 | 2,
  valueMm: number,
): DataResult<CarModelDocument> {
  if (pointKey === 'wc') {
    return fail([
      dataError(
        'invalidValue',
        `corners.${cornerKey}.points.wc`,
        'the wheel centre is derived from the wheel radius, track, wheelbase and chassis values; edit those instead',
      ),
    ]);
  }
  if (!Number.isFinite(valueMm)) {
    return fail([
      dataError('invalidValue', `corners.${cornerKey}.points.${pointKey}`, 'value must be finite'),
    ]);
  }
  const raw = JSON.parse(JSON.stringify(model.raw)) as Record<string, unknown>;
  const corners = raw['corners'];
  if (typeof corners !== 'object' || corners === null || Array.isArray(corners)) {
    return fail([dataError('invalidDocument', 'corners', 'cannot edit a document without corners')]);
  }
  const corner = (corners as Record<string, unknown>)[cornerKey];
  if (typeof corner !== 'object' || corner === null || Array.isArray(corner)) {
    return fail([
      dataError('missingField', `corners.${cornerKey}`, 'this corner is not in the document'),
    ]);
  }
  const points = (corner as Record<string, unknown>)['points'];
  if (typeof points !== 'object' || points === null || Array.isArray(points)) {
    return fail([
      dataError('missingField', `corners.${cornerKey}.points`, 'this corner has no points'),
    ]);
  }
  const measured = (points as Record<string, unknown>)[pointKey];
  if (typeof measured !== 'object' || measured === null || Array.isArray(measured)) {
    return fail([
      dataError(
        'missingField',
        `corners.${cornerKey}.points.${pointKey}`,
        'this point is not in the document',
      ),
    ]);
  }
  const rawValue = (measured as Record<string, unknown>)['value'];
  if (!Array.isArray(rawValue) || rawValue.length !== 3) {
    return fail([
      dataError(
        'invalidValue',
        `corners.${cornerKey}.points.${pointKey}.value`,
        'point value must be [x, y, z]',
      ),
    ]);
  }
  rawValue[axis] = valueMm;
  return parseCarModel(raw);
}

function rawCorner(
  document: unknown,
  cornerKey: CornerKey,
): Record<string, unknown> | null {
  if (typeof document !== 'object' || document === null || Array.isArray(document)) return null;
  const corners = (document as Record<string, unknown>)['corners'];
  if (typeof corners !== 'object' || corners === null || Array.isArray(corners)) return null;
  const corner = (corners as Record<string, unknown>)[cornerKey];
  return typeof corner === 'object' && corner !== null && !Array.isArray(corner)
    ? (corner as Record<string, unknown>)
    : null;
}

/**
 * Restore every hardpoint on one corner from a baseline document. The selected
 * axle's corner is replaced wholesale; the other corners, and every axle-level
 * value, stay exactly as they are on `model`. Provenance is copied with the
 * values, so a reset corner returns to its model source rather than becoming a
 * new measurement.
 */
export function resetCornerPointsMm(
  model: CarModelDocument,
  baseline: CarModelDocument,
  cornerKey: CornerKey,
): DataResult<CarModelDocument> {
  const baselineCorner = rawCorner(baseline.raw, cornerKey);
  if (baselineCorner === null) {
    return fail([
      dataError(
        'missingField',
        `corners.${cornerKey}`,
        'the baseline document has no such corner to restore',
      ),
    ]);
  }

  const raw = JSON.parse(JSON.stringify(model.raw)) as Record<string, unknown>;
  const targetCorner = rawCorner(raw, cornerKey);
  if (targetCorner === null) {
    return fail([
      dataError('missingField', `corners.${cornerKey}`, 'this corner is not in the document'),
    ]);
  }

  const baselinePoints = baselineCorner['points'];
  if (typeof baselinePoints !== 'object' || baselinePoints === null) {
    return fail([
      dataError('missingField', `corners.${cornerKey}.points`, 'the baseline has no points'),
    ]);
  }

  targetCorner['points'] = JSON.parse(JSON.stringify(baselinePoints)) as unknown;
  return parseCarModel(raw);
}

type AxleEdit = 'front' | 'rear';
type ArbGeometryField = 'bar_diameter' | 'span' | 'arm_length';

const AXLE_CORNER: Readonly<Record<AxleEdit, CornerKey>> = {
  front: 'LF',
  rear: 'LR',
};

const SESSION_SOURCE = 's_session';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cloneRaw(model: CarModelDocument): Record<string, unknown> {
  return JSON.parse(JSON.stringify(model.raw)) as Record<string, unknown>;
}

function ensureSessionSource(raw: Record<string, unknown>): void {
  let sources = asRecord(raw['sources']);
  if (sources === null) {
    sources = {};
    raw['sources'] = sources;
  }
  if (sources[SESSION_SOURCE] === undefined) {
    sources[SESSION_SOURCE] = {
      type: 'estimated',
      method: 'edited this session — not measured',
    };
  }
}

function ensureRecord(
  parent: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const existing = parent[key];
  if (existing === undefined) {
    const created: Record<string, unknown> = {};
    parent[key] = created;
    return created;
  }
  return asRecord(existing);
}

function setMeasuredNumber(
  parent: Record<string, unknown>,
  key: string,
  value: number,
  raw: Record<string, unknown>,
  path: string,
): DataError | null {
  const existing = parent[key];
  if (existing === undefined) {
    ensureSessionSource(raw);
    parent[key] = { value, source: SESSION_SOURCE };
    return null;
  }
  const node = asRecord(existing);
  if (node === null || typeof node['value'] !== 'number' || typeof node['source'] !== 'string') {
    return dataError('invalidValue', path, 'this value is not a stored measurement');
  }
  node['value'] = value;
  return null;
}

function axleRecord(
  raw: Record<string, unknown>,
  axle: AxleEdit,
): Record<string, unknown> | null {
  const axles = asRecord(raw['axles']);
  return axles === null ? null : ensureRecord(axles, axle);
}

/**
 * Write one axle's spring rate. The value is N/mm on disk; the builder converts
 * it to N/m once. Other axles and every hardpoint are untouched.
 */
export function updateAxleSpringRate(
  model: CarModelDocument,
  axle: AxleEdit,
  valueNpm: number,
): DataResult<CarModelDocument> {
  if (!Number.isFinite(valueNpm)) {
    return fail([
      dataError('invalidValue', `axles.${axle}.spring.rate`, 'value must be finite'),
    ]);
  }
  const raw = cloneRaw(model);
  const axleNode = axleRecord(raw, axle);
  if (axleNode === null) {
    return fail([dataError('missingField', `axles.${axle}`, 'this axle is not in the document')]);
  }
  const spring = ensureRecord(axleNode, 'spring');
  if (spring === null) {
    return fail([
      dataError('invalidValue', `axles.${axle}.spring`, 'spring must be an object'),
    ]);
  }
  const error = setMeasuredNumber(
    spring,
    'rate',
    valueNpm,
    raw,
    `axles.${axle}.spring.rate`,
  );
  return error === null ? parseCarModel(raw) : fail([error]);
}

/**
 * Write one axle's damper coefficient (`c_post`, N·s/m). Only the left corner of
 * the selected axle is stored; symmetry derives the right corner. The edited
 * value is labelled `estimated`, never promoted to measured.
 */
export function updateAxleDamperCoefficient(
  model: CarModelDocument,
  axle: AxleEdit,
  valueNsPerM: number,
): DataResult<CarModelDocument> {
  if (!Number.isFinite(valueNsPerM)) {
    return fail([
      dataError(
        'invalidValue',
        `corners.${AXLE_CORNER[axle]}.damper.c_post`,
        'value must be finite',
      ),
    ]);
  }
  const raw = cloneRaw(model);
  const corners = asRecord(raw['corners']);
  const corner = corners === null ? null : asRecord(corners[AXLE_CORNER[axle]]);
  if (corner === null) {
    return fail([
      dataError(
        'missingField',
        `corners.${AXLE_CORNER[axle]}`,
        'this corner is not in the document',
      ),
    ]);
  }
  const damper = ensureRecord(corner, 'damper');
  if (damper === null) {
    return fail([
      dataError(
        'invalidValue',
        `corners.${AXLE_CORNER[axle]}.damper`,
        'damper must be an object',
      ),
    ]);
  }
  const error = setMeasuredNumber(
    damper,
    'c_post',
    valueNsPerM,
    raw,
    `corners.${AXLE_CORNER[axle]}.damper.c_post`,
  );
  return error === null ? parseCarModel(raw) : fail([error]);
}

const ARB_TYPES: readonly ArbTypeDocument[] = ['torsion_bar', 'blade', 'fixed', 'none'];

/**
 * Set the bar type. `none` disables the geometry rows in the UI but does not
 * zero them: the stored diameter/span/arm stay so switching back is lossless.
 */
export function updateAxleArbType(
  model: CarModelDocument,
  axle: AxleEdit,
  type: ArbTypeDocument,
): DataResult<CarModelDocument> {
  if (!ARB_TYPES.includes(type)) {
    return fail([dataError('invalidValue', `axles.${axle}.arb.type`, 'unknown bar type')]);
  }
  const raw = cloneRaw(model);
  const axleNode = axleRecord(raw, axle);
  if (axleNode === null) {
    return fail([dataError('missingField', `axles.${axle}`, 'this axle is not in the document')]);
  }
  const arb = ensureRecord(axleNode, 'arb');
  if (arb === null) {
    return fail([dataError('invalidValue', `axles.${axle}.arb`, 'arb must be an object')]);
  }
  arb['type'] = type;
  return parseCarModel(raw);
}

export function updateAxleArbValue(
  model: CarModelDocument,
  axle: AxleEdit,
  field: ArbGeometryField,
  valueMm: number,
): DataResult<CarModelDocument> {
  const path = `axles.${axle}.arb.${field}`;
  if (!Number.isFinite(valueMm)) {
    return fail([dataError('invalidValue', path, 'value must be finite')]);
  }
  const raw = cloneRaw(model);
  const axleNode = axleRecord(raw, axle);
  if (axleNode === null) {
    return fail([dataError('missingField', `axles.${axle}`, 'this axle is not in the document')]);
  }
  const arb = asRecord(axleNode['arb']);
  if (arb === null) {
    return fail([dataError('missingField', `axles.${axle}.arb`, 'this axle has no bar')]);
  }
  const error = setMeasuredNumber(arb, field, valueMm, raw, path);
  return error === null ? parseCarModel(raw) : fail([error]);
}

function bodyRecord(raw: Record<string, unknown>): Record<string, unknown> | null {
  const body = raw['body'];
  if (body === undefined) {
    const created: Record<string, unknown> = {};
    raw['body'] = created;
    return created;
  }
  return asRecord(body);
}

/**
 * Write the ride height — clearance under the bottom of the plate. It and the
 * plate thickness are the only route into the derived ground plane. The stored
 * provenance is kept, so a typed value is not promoted to measured.
 */
export function updateChassisRideHeight(
  model: CarModelDocument,
  valueMm: number,
): DataResult<CarModelDocument> {
  if (!Number.isFinite(valueMm)) {
    return fail([
      dataError('invalidValue', 'body.reference_ride_height', 'value must be finite'),
    ]);
  }
  const raw = cloneRaw(model);
  const body = bodyRecord(raw);
  if (body === null) {
    return fail([dataError('invalidValue', 'body', 'body must be an object')]);
  }
  const error = setMeasuredNumber(
    body,
    'reference_ride_height',
    valueMm,
    raw,
    'body.reference_ride_height',
  );
  return error === null ? parseCarModel(raw) : fail([error]);
}

/** Write the chassis plate thickness. It enters the ground plane through the same sum. */
export function updateChassisThickness(
  model: CarModelDocument,
  valueMm: number,
): DataResult<CarModelDocument> {
  if (!Number.isFinite(valueMm)) {
    return fail([
      dataError('invalidValue', 'body.chassis.thickness', 'value must be finite'),
    ]);
  }
  const raw = cloneRaw(model);
  const body = bodyRecord(raw);
  if (body === null) {
    return fail([dataError('invalidValue', 'body', 'body must be an object')]);
  }
  const chassis = ensureRecord(body, 'chassis');
  if (chassis === null) {
    return fail([dataError('invalidValue', 'body.chassis', 'chassis must be an object')]);
  }
  const error = setMeasuredNumber(chassis, 'thickness', valueMm, raw, 'body.chassis.thickness');
  return error === null ? parseCarModel(raw) : fail([error]);
}

export type ChassisValueField =
  | 'ride_height'
  | 'thickness'
  | 'front_wheel_diameter'
  | 'rear_wheel_diameter';

/**
 * Write one axle's wheel diameter. The single stored source stays
 * `axles.<axle>.tyre_radius`; the diameter is only the display/edit form a racer
 * uses. The derived hub is placed from that radius.
 */
export function updateWheelDiameter(
  model: CarModelDocument,
  axle: AxleEdit,
  diameterMm: number,
): DataResult<CarModelDocument> {
  const path = `axles.${axle}.tyre_radius`;
  if (!Number.isFinite(diameterMm) || diameterMm <= 0) {
    return fail([dataError('invalidValue', path, 'wheel diameter must be a positive number')]);
  }
  const radiusMm = diameterMm / 2;
  const raw = cloneRaw(model);
  const axleNode = axleRecord(raw, axle);
  if (axleNode === null) {
    return fail([dataError('missingField', `axles.${axle}`, 'this axle is not in the document')]);
  }
  const error = setMeasuredNumber(axleNode, 'tyre_radius', radiusMm, raw, path);
  return error === null ? parseCarModel(raw) : fail([error]);
}

/**
 * Write a chassis value. Ride height and plate thickness locate the ground
 * plane; the two wheel diameters are per-axle and write the single stored
 * `tyre_radius`.
 */
export function updateChassisValue(
  model: CarModelDocument,
  field: ChassisValueField,
  valueMm: number,
): DataResult<CarModelDocument> {
  switch (field) {
    case 'ride_height':
      return updateChassisRideHeight(model, valueMm);
    case 'thickness':
      return updateChassisThickness(model, valueMm);
    case 'front_wheel_diameter':
      return updateWheelDiameter(model, 'front', valueMm);
    case 'rear_wheel_diameter':
      return updateWheelDiameter(model, 'rear', valueMm);
    default:
      return fail([
        dataError(
          'invalidValue' as const,
          'body',
          `unknown chassis value "${String(field)}"`,
        ),
      ]);
  }
}

/**
 * Restore one axle's rate edits from a baseline: spring rate, the whole ARB
 * block and the left corner's damper coefficient. Hardpoints, the other axle
 * and every body value stay exactly as they are on `model`.
 */
export function resetAxleRates(
  model: CarModelDocument,
  baseline: CarModelDocument,
  axle: AxleEdit,
): DataResult<CarModelDocument> {
  const raw = cloneRaw(model);
  const baselineRaw = asRecord(baseline.raw);
  if (baselineRaw === null) {
    return fail([dataError('invalidDocument', '', 'the baseline is not a document')]);
  }
  const targetAxle = axleRecord(raw, axle);
  const baselineAxles = asRecord(baselineRaw['axles']);
  const baselineAxle = baselineAxles === null ? null : asRecord(baselineAxles[axle]);
  if (targetAxle === null || baselineAxle === null) {
    return fail([dataError('missingField', `axles.${axle}`, 'the baseline has no such axle')]);
  }

  const targetSpring = ensureRecord(targetAxle, 'spring');
  const baselineSpring = asRecord(baselineAxle['spring']);
  if (targetSpring !== null) {
    const baselineRate = baselineSpring?.['rate'];
    if (baselineRate === undefined) {
      delete targetSpring['rate'];
    } else {
      targetSpring['rate'] = JSON.parse(JSON.stringify(baselineRate)) as unknown;
    }
  }

  const baselineArb = baselineAxle['arb'];
  if (baselineArb === undefined) {
    delete targetAxle['arb'];
  } else {
    targetAxle['arb'] = JSON.parse(JSON.stringify(baselineArb)) as unknown;
  }

  const cornerKey = AXLE_CORNER[axle];
  const targetCorners = asRecord(raw['corners']);
  const targetCorner = targetCorners === null ? null : asRecord(targetCorners[cornerKey]);
  const baselineCorners = asRecord(baselineRaw['corners']);
  const baselineCorner =
    baselineCorners === null ? null : asRecord(baselineCorners[cornerKey]);
  if (targetCorner === null || baselineCorner === null) {
    return fail([
      dataError('missingField', `corners.${cornerKey}`, 'the baseline has no such corner'),
    ]);
  }
  const baselineDamper = baselineCorner['damper'];
  if (baselineDamper === undefined) {
    delete targetCorner['damper'];
  } else {
    targetCorner['damper'] = JSON.parse(JSON.stringify(baselineDamper)) as unknown;
  }

  return parseCarModel(raw);
}
