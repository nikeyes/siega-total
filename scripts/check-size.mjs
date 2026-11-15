// Fails when the initial load (everything in dist/ but the lazy debug panel) weighs more than 2 MB gzipped.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const LIMIT_BYTES = 2 * 1024 * 1024;
/** Loaded only with ?debug, so it is not part of the initial load. */
const LAZY_CHUNK = /^assets\/panel-.*\.js$/;

const files = readdirSync(DIST, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath, entry.name))
  .filter((path) => !LAZY_CHUNK.test(relative(DIST, path)));

const total = files.reduce((sum, path) => sum + gzipSync(readFileSync(path)).length, 0);
const kilobytes = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
console.log(`Initial load: ${kilobytes(total)} gzipped in ${files.length} files (limit ${kilobytes(LIMIT_BYTES)}).`);
if (total > LIMIT_BYTES) {
  console.error('The initial load is over the limit.');
  process.exit(1);
}
