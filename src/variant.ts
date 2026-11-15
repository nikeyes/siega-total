/** Set by Vite from the SIEGA_VARIANT environment variable when building (vite.config.ts). */
declare const __SIEGA_VARIANT__: string;

/** «actual» is the game everyone plays; «nueva» tries changes on top of it and is published at /nueva/. */
export type Variant = 'actual' | 'nueva';

export const variant: Variant = __SIEGA_VARIANT__ === 'nueva' ? 'nueva' : 'actual';

/** Each variant keeps its own save, so trying the new one does not touch the progress in the other. */
export function saveKeyFor(variantName: Variant): string {
  return variantName === 'actual' ? 'siega-total' : `siega-total-${variantName}`;
}

/** Only the values a variant changes; lists are replaced whole. */
export type Changes<T> = { [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? Changes<T[K]> : T[K] };

/** A copy of `base` with the values `changes` names, however deep. */
export function withChanges<T>(base: T, changes: Changes<T>): T {
  const result = { ...base };
  for (const key of Object.keys(changes) as (keyof T)[]) {
    const change = changes[key];
    const original = base[key];
    const isNested = typeof change === 'object' && change !== null && !Array.isArray(change);
    result[key] = (isNested ? withChanges(original, change as Changes<T[keyof T]>) : change) as T[keyof T];
  }
  return result;
}
