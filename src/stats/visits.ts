const COUNTER_URL = 'https://librecounter.org/counter.svg';

/**
 * The made-up page a started game is counted as: Librecounter only counts page views,
 * by the page that requests its counter.
 */
export function gameStartedPage(origin: string, basePath: string): string {
  return `${origin}${basePath}partida`;
}

/** One more view of the game's made-up page on Librecounter; a failed count never bothers the player. */
export function countGameStarted(): void {
  fetch(COUNTER_URL, {
    mode: 'no-cors',
    cache: 'no-store',
    referrer: gameStartedPage(location.origin, import.meta.env.BASE_URL),
    referrerPolicy: 'unsafe-url',
  }).catch(() => {});
}
