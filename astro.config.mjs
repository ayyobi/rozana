// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// Rozana est rendue côté serveur (SSR) : la protection des routes,
// les appels IA et l'envoi des notifications push se font sur le serveur.
export default defineConfig({
  // URL publique en production (HTTPS) : sert aussi à la protection CSRF d'Astro.
  site: process.env.SITE_URL || undefined,
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  security: {
    checkOrigin: true,
  },
  devToolbar: { enabled: false },
});
