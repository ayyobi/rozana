import fr from './fr.json';
import fa from './fa.json';

export const LOCALES = ['fr', 'fa'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';
export const LOCALE_COOKIE = 'rozana_locale';

export type Dictionary = typeof fr;

// fa.json doit avoir exactement la même forme que fr.json : TypeScript le vérifie ici.
const dictionaries: Record<Locale, Dictionary> = { fr, fa };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function dirOf(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'fa' ? 'rtl' : 'ltr';
}

/** Tag BCP-47 utilisé par Intl. Le calendrier grégorien est forcé pour l'instant ;
 *  le calendrier solaire persan s'ajoutera via `-u-ca-persian`. */
export function intlTag(locale: Locale, calendar: 'gregory' | 'persian' = 'gregory'): string {
  return locale === 'fa' ? `fa-IR-u-ca-${calendar}-nu-arabext` : `fr-FR-u-ca-${calendar}`;
}

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = T extends readonly unknown[]
  ? never
  : T extends object
    ? { [K in keyof T & string]: T[K] extends string ? K : Join<K, Paths<T[K]>> }[keyof T & string]
    : never;

export type TranslationKey = Paths<Dictionary>;

function lookup(dict: Dictionary, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[part];
    return undefined;
  }, dict);
}

/** Crée une fonction de traduction typée pour une langue. */
export function useTranslations(locale: Locale) {
  const dict = dictionaries[locale];
  return function t(key: TranslationKey, params?: Record<string, string | number>): string {
    const raw = lookup(dict, key) ?? lookup(dictionaries[DEFAULT_LOCALE], key);
    if (typeof raw !== 'string') return key;
    if (!params) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
  };
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
