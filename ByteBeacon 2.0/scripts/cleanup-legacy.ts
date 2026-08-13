import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bb2Root = path.resolve(__dirname, '..');
const legacyRoot = path.resolve(bb2Root, '..');

/* eslint-disable no-console */
console.log('--- ByteBeacon 2.0 Safe Legacy Cleanup ---');
console.log(`Legacy Root:   ${legacyRoot}`);
console.log(`BB2 Root:      ${bb2Root}`);

// 1. Safety verification: Ensure BB2 has all its required files first
const requiredBB2Directories = ['apps/backend', 'apps/frontend', 'packages/shared', 'docs', 'database'];
for (const dir of requiredBB2Directories) {
  const p = path.join(bb2Root, dir);
  if (!fs.existsSync(p)) {
    throw new Error(`CRITICAL ABORT: ByteBeacon 2.0 destination path ${p} does not exist! Aborting cleanup.`);
  }
}

// 2. Exact items proven to be accidentally created BB2 artifacts in legacy root
const bb2ArtifactsInLegacy = [
  path.join(legacyRoot, 'apps'),
  path.join(legacyRoot, 'packages'),
  path.join(legacyRoot, 'docs'),
  path.join(legacyRoot, '.github'),
  path.join(legacyRoot, 'pnpm-workspace.yaml'),
];

let removedCount = 0;
for (const itemPath of bb2ArtifactsInLegacy) {
  if (fs.existsSync(itemPath)) {
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) {
      fs.rmSync(itemPath, { recursive: true, force: true });
      console.log(`[REMOVED DIR]  ${itemPath}`);
      removedCount++;
    } else {
      fs.unlinkSync(itemPath);
      console.log(`[REMOVED FILE] ${itemPath}`);
      removedCount++;
    }
  } else {
    console.log(`[NOT PRESENT]  ${itemPath}`);
  }
}

// 3. Restore legacy README.md in legacy root
const legacyReadmePath = path.join(legacyRoot, 'README.md');
const legacyReadmeContent = `# ByteBeacon (Legacy Reference)

This repository directory contains the legacy ByteBeacon reference codebase.

> [!NOTE]
> **Reference Only**: This legacy codebase is strictly read-only and preserved for reference.
> The active ground-up clean-slate project is located in \`ByteBeacon 2.0/\`.
`;
fs.writeFileSync(legacyReadmePath, legacyReadmeContent.trim());
console.log(`[RESTORED]     ${legacyReadmePath}`);

console.log(`\nCleanup completed safely. Removed ${removedCount} BB2 artifacts from legacy repository.`);
