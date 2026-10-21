/** A gold coin with a darker rim and a shine. */
export function coinIconSvg(className: string): string {
  return `<svg class="${className}" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="17" fill="#f5a623" stroke="#16324f" stroke-width="3" />
    <circle cx="20" cy="20" r="11" fill="#ffd23f" stroke="#c77c0e" stroke-width="2" />
    <path d="M15 14 a8 8 0 0 1 8 -3" fill="none" stroke="#fff6c8" stroke-width="3" stroke-linecap="round" />
  </svg>`;
}

/** Two rounded bars. */
export function pauseIconSvg(): string {
  return `<svg viewBox="0 0 40 40" aria-hidden="true">
    <rect x="10" y="8" width="7" height="24" rx="2" fill="#fff" stroke="#16324f" stroke-width="2.5" />
    <rect x="23" y="8" width="7" height="24" rx="2" fill="#fff" stroke="#16324f" stroke-width="2.5" />
  </svg>`;
}
