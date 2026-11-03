import type { Confidence } from '@setuplab/physics';
import { dataError, fail, ok, type DataError, type DataResult } from './errors.js';
import type {
  ArbDocument,
  ArbTypeDocument,
  ArmTypeDocument,
  AxleDocument,
  CarModelDocument,
  CornerDocument,
  CornerKey,
  CornerPointKey,
  MassDocument,
  MeasuredPoint,
  MeasuredValue,
  SourceRecord,
  SourceType,
} from './model.js';

const CORNER_KEYS: readonly CornerKey[] = ['LF', 'RF', 'LR', 'RR'];
const ARB_TYPES: readonly ArbTypeDocument[] = ['torsion_bar', 'blade', 'fixed', 'none'];
const SOURCE_TYPES: readonly SourceType[] = [
  'measured',
  'manufacturer',
  'derived',
  'estimated',
  'assumed',
  'library',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isCornerKey(value: string): value is CornerKey {
  return CORNER_KEYS.includes(value as CornerKey);
}

function isSourceType(value: string): value is SourceType {
  return SOURCE_TYPES.includes(value as SourceType);
}

function isArbType(value: string): value is ArbTypeDocument {
  return ARB_TYPES.includes(value as ArbTypeDocument);
}

function readSources(
  raw: Record<string, unknown>,
  errors: DataError[],
): Record<string, SourceRecord> | null {
  const sourceRecord = asRecord(raw['sources']);
  if (sourceRecord === null) {
    errors.push(dataError('missingField', 'sources', 'the document must declare a sources map'));
    return null;
  }

  const sources: Record<string, SourceRecord> = {};
  for (const [id, rawRecord] of Object.entries(sourceRecord)) {
    const record = asRecord(rawRecord);
    const type = record === null ? null : asString(record['type']);
    if (record === null || type === null || !isSourceType(type)) {
      errors.push(
        dataError('invalidValue', `sources.${id}.type`, 'a source record needs a known type'),
      );
      continue;
    }
    const method = asString(record['method']);
    const by = asString(record['by']);
    sources[id] = {
      type: type as Confidence,
      ...(method === null ? {} : { method }),
      ...(by === null ? {} : { by }),
    };
  }
  return sources;
}

function readMeasuredNumber(
  parent: Record<string, unknown>,
  path: string,
  key: string,
  errors: DataError[],
  sources: Readonly<Record<string, SourceRecord>>,
): MeasuredValue<number> | null {
  const node = asRecord(parent[key]);
  const fullPath = `${path}.${key}`;
  if (node === null) {
    errors.push(dataError('missingField', fullPath, 'a measured value object is required'));
    return null;
  }
  const value = asNumber(node['value']);
  const source = asString(node['source']);
  if (value === null) {
    errors.push(dataError('invalidValue', `${fullPath}.value`, 'value must be a finite number'));
    return null;
  }
  if (source === null) {
    errors.push(dataError('missingSource', `${fullPath}.source`, 'a measured value needs a source'));
    return null;
  }
  const record = sources[source];
  if (record === undefined) {
    errors.push(
      dataError('unresolvedSource', `${fullPath}.source`, `source "${source}" is not declared`),
    );
    return null;
  }
  return { value, source, confidence: record.type };
}

function readOptionalMeasuredNumber(
  parent: Record<string, unknown>,
  path: string,
  key: string,
  errors: DataError[],
  sources: Readonly<Record<string, SourceRecord>>,
): MeasuredValue<number> | null {
  if (parent[key] === undefined) return null;
  return readMeasuredNumber(parent, path, key, errors, sources);
}

function readMeasuredPoint(
  parent: Record<string, unknown>,
  path: string,
  key: string,
  errors: DataError[],
  sources: Readonly<Record<string, SourceRecord>>,
): MeasuredPoint | null {
  const node = asRecord(parent[key]);
  const fullPath = `${path}.${key}`;
  if (node === null) {
    errors.push(dataError('missingField', fullPath, 'a measured point object is required'));
    return null;
  }
  const rawValue = node['value'];
  const source = asString(node['source']);
  if (!Array.isArray(rawValue) || rawValue.length !== 3) {
    errors.push(
      dataError('invalidValue', `${fullPath}.value`, 'a point must be [x, y, z] in millimetres'),
    );
    return null;
  }
  const coordinates: number[] = [];
  for (const coordinate of rawValue) {
    const number = asNumber(coordinate);
    if (number === null || Math.abs(number) > 3000) {
      errors.push(
        dataError(
          'invalidValue',
          `${fullPath}.value`,
          'each coordinate must be finite and within +/-3000 mm',
        ),
      );
      return null;
    }
    coordinates.push(number);
  }
  if (source === null) {
    errors.push(dataError('missingSource', `${fullPath}.source`, 'a measured value needs a source'));
    return null;
  }
  const record = sources[source];
  if (record === undefined) {
    errors.push(
      dataError('unresolvedSource', `${fullPath}.source`, `source "${source}" is not declared`),
    );
    return null;
  }
  const value = coordinates as [number, number, number];
  return { value, source, confidence: record.type };
}

function readMass(
  raw: Record<string, unknown>,
  errors: DataError[],
  sources: Readonly<Record<string, SourceRecord>>,
): MassDocument {
  const body = asRecord(raw['body']);
  const mass = body === null ? null : asRecord(body['mass']);
  if (mass === null) return { sprungFront: null, sprungRear: null };
  return {
    sprungFront: readOptionalMeasuredNumber(mass, 'body.mass', 'sprung_front', errors, sources),
    sprungRear: readOptionalMeasuredNumber(mass, 'body.mass', 'sprung_rear', errors, sources),
  };
}

function readArb(
  axle: Record<string, unknown>,
  path: string,
  errors: DataError[],
  sources: Readonly<Record<string, SourceRecord>>,
): ArbDocument | null {
  const arb = asRecord(axle['arb']);
  if (arb === null) return null;

  const rawType = asString(arb['type']);
  if (rawType === null || !isArbType(rawType)) {
    errors.push(
      dataError(
        'invalidValue',
        `${path}.arb.type`,
        'arb.type must be torsion_bar, blade, fixed or none',
      ),
    );
    return null;
  }

  const arbPath = `${path}.arb`;
  return {
    type: rawType,
    rateAtLink: readOptionalMeasuredNumber(arb, arbPath, 'rate_at_link', errors, sources),
    barDiameter: readOptionalMeasuredNumber(arb, arbPath, 'bar_diameter', errors, sources),
    span: readOptionalMeasuredNumber(arb, arbPath, 'span', errors, sources),
    armLength: readOptionalMeasuredNumber(arb, arbPath, 'arm_length', errors, sources),
    shearModulus: readOptionalMeasuredNumber(arb, arbPath, 'shear_modulus', errors, sources),
  };
}

function readAxle(
  raw: Record<string, unknown>,
  path: string,
  errors: DataError[],
  sources: Readonly<Record<string, SourceRecord>>,
): AxleDocument | null {
  const track = readMeasuredNumber(raw, path, 'track', errors, sources);
  const tyreRadius = readOptionalMeasuredNumber(raw, path, 'tyre_radius', errors, sources);
  const bumpLimit = readOptionalMeasuredNumber(raw, path, 'bump_limit_wheel', errors, sources);
  const droopLimit = readOptionalMeasuredNumber(raw, path, 'droop_limit_wheel', errors, sources);
  const spring = asRecord(raw['spring']);
  const springRate =
    spring === null
      ? null
      : readOptionalMeasuredNumber(spring, `${path}.spring`, 'rate', errors, sources);
  const arb = readArb(raw, path, errors, sources);

  if (track === null) return null;
  return { track, tyreRadius, bumpLimit, droopLimit, springRate, arb };
}

function readArmType(
  corner: Record<string, unknown>,
  path: string,
  errors: DataError[],
): ArmTypeDocument | null {
  const armType = asRecord(corner['arm_type']);
  if (armType === null) {
    errors.push(dataError('missingField', `${path}.arm_type`, 'arm_type is required'));
    return null;
  }
  const lower = asString(armType['lower']);
  const rawUpper = asString(armType['upper']);
  const upper = rawUpper === 'aal' ? 'wishbone' : rawUpper;
  if (lower !== 'hinge' && lower !== 'wishbone') {
    errors.push(
      dataError('unsupportedArmType', `${path}.arm_type.lower`, 'lower arm must be hinge or wishbone'),
    );
  }
  if (upper !== 'single_link' && upper !== 'wishbone') {
    errors.push(
      dataError(
        'unsupportedArmType',
        `${path}.arm_type.upper`,
        'upper arm must be single_link or wishbone',
      ),
    );
  }
  if ((lower !== 'hinge' && lower !== 'wishbone') || (upper !== 'single_link' && upper !== 'wishbone')) {
    return null;
  }
  return { lower, upper };
}

function requiredPointKeys(armType: ArmTypeDocument): readonly CornerPointKey[] {
  const keys: CornerPointKey[] = ['lca_in_a', 'lca_in_b', 'lca_out', 'uca_out', 'wc'];
  if (armType.upper === 'single_link') return [...keys, 'uca_in'];
  return [...keys, 'uca_in_a', 'uca_in_b'];
}

function readCorner(
  raw: unknown,
  cornerKey: CornerKey,
  errors: DataError[],
  sources: Readonly<Record<string, SourceRecord>>,
): CornerDocument | null {
  const path = `corners.${cornerKey}`;
  const corner = asRecord(raw);
  if (corner === null) {
    errors.push(dataError('missingField', path, 'corner object is required'));
    return null;
  }
  const armType = readArmType(corner, path, errors);
  const rawPoints = asRecord(corner['points']);
  if (rawPoints === null) {
    errors.push(dataError('missingField', `${path}.points`, 'points object is required'));
    return null;
  }
  if (armType === null) return null;

  const points: Partial<Record<CornerPointKey, MeasuredPoint>> = {};
  const pointKeys: readonly CornerPointKey[] = [
    'lca_in_a',
    'lca_in_b',
    'lca_out',
    'uca_in',
    'uca_in_a',
    'uca_in_b',
    'uca_out',
    'wc',
    'tie_in',
    'tie_out',
    'damper_lo',
    'damper_up',
    'arb_drop',
  ];
  for (const key of pointKeys) {
    if (rawPoints[key] === undefined) continue;
    const point = readMeasuredPoint(rawPoints, `${path}.points`, key, errors, sources);
    if (point !== null) points[key] = point;
  }
  for (const key of requiredPointKeys(armType)) {
    if (points[key] === undefined && rawPoints[key] === undefined) {
      errors.push(
        dataError('missingField', `${path}.points.${key}`, 'required for this arm type'),
      );
    }
  }
  return { armType, points };
}

function validateMeasuredObjects(
  node: unknown,
  path: string,
  sources: Readonly<Record<string, SourceRecord>> | null,
  errors: DataError[],
): void {
  if (Array.isArray(node)) {
    node.forEach((entry, index) => validateMeasuredObjects(entry, `${path}[${index}]`, sources, errors));
    return;
  }
  const record = asRecord(node);
  if (record === null) return;

  if (Object.prototype.hasOwnProperty.call(record, 'value')) {
    const source = asString(record['source']);
    if (source === null) {
      errors.push(dataError('missingSource', `${path}.source`, 'a measured value needs a source'));
    } else if (sources !== null && sources[source] === undefined) {
      errors.push(
        dataError('unresolvedSource', `${path}.source`, `source "${source}" is not declared`),
      );
    }
  }

  for (const [key, child] of Object.entries(record)) {
    if (path === '' && key === 'sources') continue;
    validateMeasuredObjects(child, path === '' ? key : `${path}.${key}`, sources, errors);
  }
}

function mirrorCorner(corner: CornerDocument): CornerDocument {
  const points: Partial<Record<CornerPointKey, MeasuredPoint>> = {};
  for (const [key, point] of Object.entries(corner.points)) {
    if (point === undefined) continue;
    const [x, y, z] = point.value;
    points[key as CornerPointKey] = {
      value: [x, -y, z],
      source: point.source,
      confidence: point.confidence,
    };
  }
  return { armType: corner.armType, points };
}

export function parseCarModel(rawInput: unknown): DataResult<CarModelDocument> {
  const raw = asRecord(rawInput);
  if (raw === null) {
    return fail([dataError('invalidDocument', '', 'the document root must be an object')]);
  }

  const errors: DataError[] = [];
  const schemaVersion = asString(raw['schema_version']);
  if (schemaVersion === null) {
    errors.push(dataError('missingField', 'schema_version', 'schema_version is required'));
  } else {
    const major = Number.parseInt(schemaVersion.split('.')[0] ?? '', 10);
    if (!Number.isFinite(major) || major > 1) {
      errors.push(
        dataError(
          'unsupportedSchemaVersion',
          'schema_version',
          `this build reads schema_version 1.x, not ${schemaVersion}`,
        ),
      );
    }
  }

  if (raw['kind'] !== 'car_model') {
    errors.push(dataError('invalidValue', 'kind', 'this loader reads car_model documents'));
  }
  const id = asString(raw['id']);
  const name = asString(raw['name']);
  if (id === null) errors.push(dataError('missingField', 'id', 'id is required'));
  if (name === null) errors.push(dataError('missingField', 'name', 'name is required'));

  const frameRecord = asRecord(raw['frame']);
  const standard = frameRecord === null ? null : asString(frameRecord['standard']);
  const axes = frameRecord === null ? null : asString(frameRecord['axes']);
  const origin = frameRecord === null ? null : asString(frameRecord['origin']);
  if (standard !== 'ISO 8855' || axes === null || !axes.includes('y left')) {
    errors.push(
      dataError(
        'frameMismatch',
        'frame',
        'this build reads ISO 8855 (x forward, y left, z up); the file declares another frame',
      ),
    );
  }
  if (origin === null || !origin.includes('rear axle')) {
    errors.push(
      dataError(
        'frameMismatch',
        'frame.origin',
        'the frame origin must be the rear axle centre on the ground plane',
      ),
    );
  }

  const unitsRecord = asRecord(raw['units']);
  const units = unitsRecord ?? {};
  if (unitsRecord === null) {
    errors.push(dataError('missingField', 'units', 'a units block is required'));
  } else {
    if (unitsRecord['length'] !== 'mm') {
      errors.push(
        dataError('unitMismatch', 'units.length', 'this build reads millimetres; the file does not'),
      );
    }
    if (unitsRecord['angle'] !== undefined && unitsRecord['angle'] !== 'deg') {
      errors.push(
        dataError('unitMismatch', 'units.angle', 'this build reads degrees; the file does not'),
      );
    }
    if (unitsRecord['mass'] !== undefined && unitsRecord['mass'] !== 'g') {
      errors.push(
        dataError('unitMismatch', 'units.mass', 'this build reads grams; the file does not'),
      );
    }
  }

  if (typeof raw['symmetry'] !== 'boolean') {
    errors.push(dataError('missingField', 'symmetry', 'symmetry must be stated explicitly'));
  }
  const symmetry = raw['symmetry'] === true;

  const sources = readSources(raw, errors);
  const sourceMap = sources ?? {};
  validateMeasuredObjects(raw, '', sources, errors);

  const rawCorners = asRecord(raw['corners']);
  const corners: Partial<Record<CornerKey, CornerDocument>> = {};
  if (rawCorners === null) {
    errors.push(dataError('missingField', 'corners', 'a corners block is required'));
  } else {
    for (const key of CORNER_KEYS) {
      if (rawCorners[key] === undefined) continue;
      const corner = readCorner(rawCorners[key], key, errors, sourceMap);
      if (corner !== null) corners[key] = corner;
    }
    if (corners.LF === undefined) {
      errors.push(dataError('missingField', 'corners.LF', 'the left-front corner is required'));
    } else if (corners.RF === undefined && symmetry) {
      corners.RF = mirrorCorner(corners.LF);
    }
  }

  const rawAxles = asRecord(raw['axles']);
  const rawFront = rawAxles === null ? null : asRecord(rawAxles['front']);
  let front: CarModelDocument['axles']['front'] | null = null;
  if (rawFront === null) {
    errors.push(dataError('missingField', 'axles.front', 'a front axle block is required'));
  } else {
    front = readAxle(rawFront, 'axles.front', errors, sourceMap);
  }

  const rawRear = rawAxles === null ? null : asRecord(rawAxles['rear']);
  const rear = rawRear === null ? null : readAxle(rawRear, 'axles.rear', errors, sourceMap);

  const mass = readMass(raw, errors, sourceMap);

  if (errors.length > 0 || id === null || name === null || sources === null || front === null) {
    return fail(errors);
  }

  return ok({
    schemaVersion: schemaVersion as string,
    kind: 'car_model',
    id,
    name,
    frame: { standard: 'ISO 8855', axes: axes as string, origin: origin as string },
    units: Object.fromEntries(
      Object.entries(units).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    ),
    symmetry,
    sources,
    corners,
    axles: { front, rear },
    mass,
    raw: rawInput,
  });
}

export function parseCarModelJson(text: string): DataResult<CarModelDocument> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return fail([
      dataError(
        'invalidJson',
        '',
        error instanceof Error ? error.message : 'the document is not valid JSON',
      ),
    ]);
  }
  return parseCarModel(parsed);
}
