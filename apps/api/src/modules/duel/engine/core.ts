import type { OcgCoreSync } from 'ocgcore-wasm';

let core: Promise<OcgCoreSync> | null = null;

/**
 * Moteur d'EDOPro (ygopro-core) compilé en WebAssembly, version synchrone : une seule instance
 * pour tout le processus, chaque duel est un « handle » indépendant.
 * Import dynamique : le paquet est un module ESM, l'API est compilée en CommonJS.
 */
export function ocgCore(): Promise<OcgCoreSync> {
  core ??= (async () => {
    const mod = (await import('ocgcore-wasm')) as unknown as {
      default:
        | ((o: { sync: true }) => Promise<OcgCoreSync>)
        | { default: (o: { sync: true }) => Promise<OcgCoreSync> };
    };
    const createCore = typeof mod.default === 'function' ? mod.default : mod.default.default;
    return createCore({ sync: true });
  })().catch((e: unknown) => {
    core = null;
    throw e;
  });
  return core;
}
