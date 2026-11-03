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

if (missing.length > 0) {
  console.error('field-drift: fields used in code but absent from docs/specs/fields.yaml:');
  for (const path of missing) console.error(`  - ${path}`);
  process.exit(1);
}

console.log(`field-drift: OK (${used.carModel.length} car_model fields and ${used.outputs.length} outputs checked)`);
