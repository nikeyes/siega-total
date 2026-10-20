import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const logicDirectory = join(import.meta.dirname, '..', 'src', 'logic');

const forbiddenImport =
  /(?:from\s+|import\s*\(?\s*)['"](?:three(?:\/[^'"]*)?|[^'"]*\/(?:render|ui|debug|audio)(?:\/[^'"]*)?)['"]/;

function logicSourceFiles(): string[] {
  return readdirSync(logicDirectory, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.ts'))
    .map((path) => join(logicDirectory, path));
}

function filesWhere(isViolation: (source: string) => boolean): string[] {
  return logicSourceFiles().filter((file) => isViolation(readFileSync(file, 'utf8')));
}

describe('src/logic architecture', () => {
  it('finds the logic source files it checks', () => {
    expect(logicSourceFiles().length).toBeGreaterThan(0);
  });

  it.each([
    "import * as THREE from 'three';",
    "import { Vector3 } from 'three/webgpu';",
    "import { drawField } from '../render/field';",
    "const hud = await import('../ui/hud');",
    "import { panel } from './debug';",
    "import { play } from '../audio/sounds';",
  ])('recognizes %s as a forbidden import', (line) => {
    expect(forbiddenImport.test(line)).toBe(true);
  });

  it('allows imports between logic modules and from config', () => {
    expect(forbiddenImport.test("import { createRandom } from './random';")).toBe(false);
    expect(forbiddenImport.test("import { config } from '../config';")).toBe(false);
  });

  it('does not import three, render, ui, debug or audio', () => {
    expect(filesWhere((source) => forbiddenImport.test(source))).toEqual([]);
  });

  it('does not use Math.random', () => {
    expect(filesWhere((source) => source.includes('Math.random'))).toEqual([]);
  });
});
