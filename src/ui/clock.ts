const SECONDS_PER_MINUTE = 60;

/** `m:ss` for a countdown, rounding up so the clock only shows 0:00 when no time is left. */
export function formatClock(seconds: number): string {
  const wholeSeconds = Math.ceil(seconds);
  const minutes = Math.floor(wholeSeconds / SECONDS_PER_MINUTE);
  const rest = wholeSeconds % SECONDS_PER_MINUTE;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
