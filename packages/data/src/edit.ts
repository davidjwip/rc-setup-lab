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
