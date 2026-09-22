/**
 * Utilidades compartidas de las suites frontend: resuelve la raíz del repo
 * y carga scripts/ como módulos ES en el contexto jsdom de Vitest.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Carga un script del repo como módulo ES en el contexto jsdom. */
export async function loadScript(relPath) {
  await import(resolve(repoRoot, relPath));
}
