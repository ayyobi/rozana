/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_PB_URL?: string;
  readonly PB_INTERNAL_URL?: string;
  readonly PUBLIC_DEFAULT_TIMEZONE?: string;
  readonly PUBLIC_VAPID_PUBLIC_KEY?: string;
  readonly VAPID_PRIVATE_KEY?: string;
  readonly VAPID_SUBJECT?: string;
  readonly AI_PROVIDER?: string;
  readonly AI_API_KEY?: string;
  readonly AI_MODEL?: string;
  readonly AI_MAX_REQUESTS_PER_DAY?: string;
  readonly SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    pb: import('pocketbase').default;
    user: import('pocketbase').RecordModel | null;
    locale: import('./i18n').Locale;
    settings: import('./types/models').UserSettings | null;
    timezone: string;
  }
}
