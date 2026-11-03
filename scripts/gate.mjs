import { spawnSync } from 'node:child_process';

const stages = [
  ['typecheck', ['run', 'typecheck']],
  ['test', ['run', 'test']],
  ['field-drift', ['run', 'field-drift']],
];

let failed = false;

for (const [name, args] of stages) {
  console.log(`\n=== gate: ${name} ===`);
  const result = spawnSync('npm', args, { stdio: 'inherit', shell: process.platform === 'win32' });
  console.log(`=== gate: ${name} exit ${result.status ?? 1} ===`);
  if (result.status !== 0) failed = true;
}

if (failed) {
  console.error('\ngate: FAILED');
  process.exit(1);
}

console.log('\ngate: PASSED');
