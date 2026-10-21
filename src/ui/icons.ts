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

const OUTLINE = 'stroke="#16324f" stroke-width="2.5" stroke-linejoin="round"';

/** Each booster's icon: an arrow up for a bigger blade, a compass needle and a clock. */
export function boosterIconSvg(kind: 'upgrade' | 'compass' | 'clock'): string {
  const shapes = {
    upgrade: `<path d="M20 5 L34 20 H25 V35 H15 V20 H6 Z" fill="#4fd65a" ${OUTLINE} />`,
    compass: `<circle cx="20" cy="20" r="15" fill="#f3f8ff" ${OUTLINE} /><path d="M20 8 L25 20 H15 Z" fill="#ff5a4f" ${OUTLINE} /><path d="M20 32 L15 20 H25 Z" fill="#9fb3c8" ${OUTLINE} />`,
    clock: `<circle cx="20" cy="21" r="14" fill="#f3f8ff" ${OUTLINE} /><path d="M20 12 V21 L26 25" fill="none" stroke="#16324f" stroke-width="3" stroke-linecap="round" /><rect x="16" y="3" width="8" height="4" rx="1" fill="#ffd23f" ${OUTLINE} />`,
  };
  return `<svg viewBox="0 0 40 40" aria-hidden="true">${shapes[kind]}</svg>`;
}

/** A hand pointing up with the index finger, its tip at (17, 3) of the 40 × 40 box. */
export function handIconSvg(className: string): string {
  return `<svg class="${className}" viewBox="0 0 40 40" aria-hidden="true">
    <rect x="5" y="22" width="11" height="7" rx="3.5" fill="#ffd2a8" ${OUTLINE} />
    <rect x="20" y="15" width="7" height="10" rx="3.5" fill="#ffd2a8" ${OUTLINE} />
    <rect x="26" y="17" width="7" height="10" rx="3.5" fill="#ffd2a8" ${OUTLINE} />
    <rect x="11" y="19" width="23" height="18" rx="7" fill="#ffd2a8" ${OUTLINE} />
    <rect x="13.5" y="1.5" width="7" height="24" rx="3.5" fill="#ffd2a8" ${OUTLINE} />
  </svg>`;
}
