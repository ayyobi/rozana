/* Illustrations discrètes, trait fin, dessinées pour Rozana.
   Elles héritent de `currentColor` et restent décoratives (aria-hidden côté parent). */

const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function Sunrise() {
  return (
    <svg viewBox="0 0 96 96" {...common}>
      <path d="M26 62a22 22 0 0 1 44 0" fill="var(--color-apricot-soft)" />
      <path d="M48 26v8M24 36l5 5M72 36l-5 5M14 56h7M75 56h7" />
      <path d="M10 62h76" />
      <path d="M22 72h52M34 82h28" opacity="0.6" />
    </svg>
  );
}

export function Cup() {
  return (
    <svg viewBox="0 0 96 96" {...common}>
      <path d="M22 44h44v10c0 14-10 24-22 24S22 68 22 54V44Z" fill="var(--color-peach-soft)" />
      <path d="M66 48h4a8 8 0 0 1 0 16h-6" />
      <path d="M16 84h60" />
      <path d="M36 34c-3-4 3-6 0-10M46 34c-3-4 3-6 0-10M56 34c-3-4 3-6 0-10" />
    </svg>
  );
}

export function CalendarSketch() {
  return (
    <svg viewBox="0 0 96 96" {...common}>
      <rect x="16" y="22" width="64" height="58" rx="10" fill="var(--color-apricot-soft)" />
      <path d="M16 38h64M32 14v14M64 14v14" />
      <circle cx="34" cy="54" r="3" fill="var(--color-coral)" stroke="none" />
      <path d="M46 54h18M30 66h34" />
    </svg>
  );
}

export function Sprout() {
  return (
    <svg viewBox="0 0 96 96" {...common}>
      <path d="M26 66h44l-5 18H31l-5-18Z" fill="var(--color-peach-soft)" />
      <path d="M48 66V44" />
      <path d="M48 50c-12 0-18-8-18-18 12 0 18 8 18 18Z" fill="var(--color-sage)" />
      <path d="M48 44c0-10 6-16 16-16 0 10-6 16-16 16Z" fill="var(--color-sage)" />
    </svg>
  );
}

export function Coins() {
  return (
    <svg viewBox="0 0 96 96" {...common}>
      <ellipse cx="40" cy="66" rx="20" ry="7" fill="var(--color-apricot-soft)" />
      <path d="M20 66v8c0 4 9 7 20 7s20-3 20-7v-8" />
      <ellipse cx="40" cy="56" rx="20" ry="7" fill="var(--color-apricot)" />
      <path d="M20 56v10M60 56v10" />
      <circle cx="66" cy="34" r="14" fill="var(--color-coral-soft)" />
      <path d="M66 27v14M62 30h6a3 3 0 0 1 0 6h-4" />
    </svg>
  );
}

export function Folder() {
  return (
    <svg viewBox="0 0 96 96" {...common}>
      <path d="M14 30a6 6 0 0 1 6-6h18l6 8h32a6 6 0 0 1 6 6v34a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6V30Z" fill="var(--color-peach-soft)" />
      <path d="M30 56h22M30 64h14" />
      <path d="M70 52l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" fill="var(--color-apricot)" />
    </svg>
  );
}
