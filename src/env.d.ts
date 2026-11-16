/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_PB_URL?: string;
  readonly PB_INTERNAL_URL?: string;
  readonly PUBLIC_DEFAULT_TIMEZONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    pb: import('pocketbase').default;
    user: import('pocketbase').RecordModel | null;
    locale: import('./i18n').Locale;
  }
}
