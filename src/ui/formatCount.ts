const countFormat = new Intl.NumberFormat('es-ES');

/** Counts and coins the Spanish way: thousands grouped with dots from five digits. */
export function formatCount(count: number): string {
  return countFormat.format(count);
}
