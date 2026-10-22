/** The gain for a volume slider at `position` (0 to 1): squared, because the ear hears loudness on a curve, not a line. */
export function sliderGain(position: number): number {
  return position * position;
}
