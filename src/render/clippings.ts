/** Which cut blades throw a clipping: one in every `bladesPerClipping`, at most `max`, spread over the list. */
export function clippingBlades(cutIndices: readonly number[], bladesPerClipping: number, max: number): number[] {
  // Even a single cut blade throws one, so a light touch on the grass still shows.
  // Never more than one per blade, nor a fraction of one, whatever the debug panel sets.
  const wanted = Math.max(1, Math.floor(cutIndices.length / bladesPerClipping));
  const count = Math.min(wanted, Math.floor(max), cutIndices.length);
  const spacing = cutIndices.length / count;
  return Array.from({ length: count }, (_, clipping) => cutIndices[Math.floor(clipping * spacing)]!);
}
