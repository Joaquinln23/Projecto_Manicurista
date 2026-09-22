import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Carga un script del repo como módulo ES en el contexto jsdom. */
export async function loadScript(relPath) {
  await import(resolve(repoRoot, relPath));
}
