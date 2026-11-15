// Fails when the initial load of either variant (everything in its build but the lazy debug panel) weighs more than 2 MB gzipped.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

/** The game everyone plays, and the new variant built inside it. */
const BUILDS = ['dist', 'dist/nueva'];
const LIMIT_BYTES = 2 * 1024 * 1024;
/** Loaded only with ?debug, so it is not part of the initial load. */
const LAZY_CHUNK = /^assets\/panel-.*\.js$/;

const kilobytes = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
let overLimit = false;
for (const build of BUILDS) {
  const files = readdirSync(build, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .map((path) => relative(build, path))
    // Another build inside this one is not part of its load.
    .filter((path) => !BUILDS.some((other) => other !== build && path.startsWith(`${relative(build, other)}/`)))
    .filter((path) => !LAZY_CHUNK.test(path));
  const total = files.reduce((sum, path) => sum + gzipSync(readFileSync(join(build, path))).length, 0);
  console.log(`${build}: initial load ${kilobytes(total)} gzipped in ${files.length} files (limit ${kilobytes(LIMIT_BYTES)}).`);
  if (total > LIMIT_BYTES) overLimit = true;
}
if (overLimit) {
  console.error('The initial load is over the limit.');
  process.exit(1);
}
