import { chmod, copyFile, cp, mkdir, rm } from 'node:fs/promises';

const standalone = '.next/standalone';
const functionBundle = 'cloudfunctions/hulala-classroom';

await mkdir(`${standalone}/.next`, { recursive: true });
await cp('public', `${standalone}/public`, { recursive: true });
await cp('.next/static', `${standalone}/.next/static`, { recursive: true });
await copyFile('scf_bootstrap', `${standalone}/scf_bootstrap`);
await chmod(`${standalone}/scf_bootstrap`, 0o755);
await rm(functionBundle, { force: true, recursive: true });
await mkdir('cloudfunctions', { recursive: true });
await cp(standalone, functionBundle, { recursive: true });
await chmod(`${functionBundle}/scf_bootstrap`, 0o755);

console.log(`CloudBase function bundle prepared in ${functionBundle}`);
