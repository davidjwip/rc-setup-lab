import { dataError, fail, type DataResult } from './errors.js';
import type { CarModelDocument, CornerKey, CornerPointKey } from './model.js';
import { parseCarModel } from './parse.js';

export function updateCornerPointMm(
  model: CarModelDocument,
  cornerKey: CornerKey,
  pointKey: CornerPointKey,
  axis: 1 | 2,
  valueMm: number,
): DataResult<CarModelDocument> {
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
