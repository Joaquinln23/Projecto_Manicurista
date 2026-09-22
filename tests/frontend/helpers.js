import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Carga un script clásico del repo en el contexto global jsdom. */
export function loadScript(relPath) {
  const code = readFileSync(resolve(repoRoot, relPath), 'utf8');
  (0, eval)(code);
}
