import { intlTag, type Locale } from '@/i18n';

/**
 * Tous les montants sont stockés et calculés en unités minimales entières (centimes).
 * Cette fonction ne sert qu'à l'AFFICHAGE : la conversion se fait par chaîne, sans
 * arithmétique flottante.
 */
export function formatCents(cents: number, currency: string, locale: Locale): string {
  if (!Number.isSafeInteger(cents)) throw new TypeError('Montant invalide : entier de centimes attendu.');
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const decimal = `${negative ? '-' : ''}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  // Intl accepte une chaîne décimale exacte (Intl.NumberFormat v3).
  return new Intl.NumberFormat(intlTag(locale), { style: 'currency', currency }).format(
    decimal as unknown as number,
  );
}

/** Addition sûre d'entiers de centimes. */
export function addCents(...values: number[]): number {
  const total = values.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(total)) throw new RangeError('Dépassement de capacité.');
  return total;
}
