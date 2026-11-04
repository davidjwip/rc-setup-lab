import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const yamlPath = `${root}docs/specs/fields.yaml`;
const usedPath = `${root}packages/data/src/schema/field-paths.json`;

const yaml = readFileSync(yamlPath, 'utf8');
const schemaPaths = new Set(
  [...yaml.matchAll(/^\s*-\s+path:\s+([A-Za-z0-9_.<>[\]]+)\s*$/gm)].map((match) => match[1]),
);

const outputIds = new Set(
  [...yaml.matchAll(/^\s*-\s+id:\s+([A-Za-z0-9_.-]+)\s*$/gm)].map((match) => match[1]),
);

const used = JSON.parse(readFileSync(usedPath, 'utf8'));
const missing = [];

for (const path of used.carModel) {
  if (!schemaPaths.has(path)) missing.push(path);
}
for (const id of used.outputs) {
  if (!outputIds.has(id)) missing.push(`output:${id}`);
}

// D-27 / issue #34: a single motor drives and brakes all four wheels. A brake
// bias, torque split or centre-diff field would be inventing a control the car
// does not have, so the gate refuses the schema if one ever appears.
const FORBIDDEN_FIELDS = [
  'brake_bias',
  'brake_force_fraction',
  'torque_split',
  'drive_split',
  'drive_fraction',
  'centre_diff',
  'center_diff',
];
const invented = [...schemaPaths].filter((path) =>
  FORBIDDEN_FIELDS.some((token) => path.toLowerCase().includes(token)),
);

if (missing.length > 0) {
  console.error('field-drift: fields used in code but absent from docs/specs/fields.yaml:');
  for (const path of missing) console.error(`  - ${path}`);
}
if (invented.length > 0) {
  console.error('field-drift: fields that invent a control the car does not have (D-27):');
  for (const path of invented) console.error(`  - ${path}`);
}
if (missing.length > 0 || invented.length > 0) process.exit(1);

console.log(`field-drift: OK (${used.carModel.length} car_model fields and ${used.outputs.length} outputs checked)`);
