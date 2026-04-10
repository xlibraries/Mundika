/** Minimal inline icons — 18px, 1.5px stroke */
export const icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-[18px]">
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        d="M4 11.5V20h6v-6h4v6h6v-8.5L12 4 4 11.5Z"
      />
    </svg>
  ),
  parties: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-[18px]">
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M16 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM4 20a6 6 0 0 1 12 0M20 21v-2a4 4 0 0 0-4-4"
      />
    </svg>
  ),
  items: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-[18px]">
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M4 7h16M4 12h16M4 17h10"
      />
    </svg>
  ),
  inventory: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-[18px]">
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        d="M4 8.5 12 3l8 5.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8.5Z"
      />
      <path stroke="currentColor" strokeWidth="1.5" d="M9 21V12h6v9" />
    </svg>
  ),
  billing: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-[18px]">
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M4 6h16M4 10h16M8 14h8M8 18h5"
      />
    </svg>
  ),
  ledger: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-[18px]">
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M4 19.5V5h16v14.5M4 15h16M8 9h4"
      />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-5">
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M4 7h16M4 12h16M4 17h16"
      />
    </svg>
  ),
  purchases: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-[18px]">
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0"
      />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-[18px]">
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 19h16M7 16V9m5 7V5m5 11v-5"
      />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-[18px]">
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M10 17H5V7h5M14 12H21M18 9l3 3-3 3"
      />
    </svg>
  ),
} as const;
