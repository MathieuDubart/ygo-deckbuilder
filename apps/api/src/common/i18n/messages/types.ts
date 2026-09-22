import type { Messages } from './en';

/** Traduction partielle : toute clé absente retombe sur l'anglais. */
export type DeepPartialMessages = DeepPartial<Messages>;
type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };
