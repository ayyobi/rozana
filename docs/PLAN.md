# Plan de développement Rozana

Légende : ✅ fait et testé · 🟡 partiel · ⏳ à faire

## Phase 1 — Fondations et design ✅
- ✅ Astro 7 + React 19 + Tailwind 4 + TypeScript strict
- ✅ Design system (palette officielle + variantes AA, Fraunces / DM Sans / Vazirmatn, rayons, ombres, animations 150‑250 ms, `prefers-reduced-motion`)
- ✅ Composants UI : Button, Card, Badge, RoundCheckbox, Progress, Skeleton, EmptyState, Field, Modal, Toaster, illustrations
- ✅ Layout desktop (sidebar) + navigation mobile (barre basse + feuille « Plus » + bouton +), safe areas iOS
- ✅ Dashboard : en‑tête, 6 widgets, mini‑calendrier fonctionnel, registre de widgets (base de la personnalisation)
- ✅ i18n FR / FA typée, RTL complet, chiffres persans
- ✅ En avance sur la phase 2 : connexion réelle PocketBase, protection des routes côté serveur, inscription publique verrouillée
- ✅ Manifest PWA + icônes (le service worker arrive en phase 5)

## Phase 2 — PocketBase et authentification
1. Migrations de toutes les collections (voir ARCHITECTURE.md §5) + règles + index
2. Script `npm run owner:create` (création unique du compte, identifiants hors conversation)
3. `user_settings` : langue, fuseau, devise — remplace le cookie de langue
4. Tests automatisés des permissions : un 2ᵉ utilisateur ne voit RIEN du 1ᵉʳ ; un visiteur anonyme ne lit ni n'écrit rien
5. Export JSON et suppression complète des données
6. Couche `src/services/*` + gestion d'erreurs/toasts

## Phase 3 — Planning
Tâches (formulaire court + options dépliables, sous‑tâches, filtres, tri, recherche, report, duplication, retards), catégories, calendrier jour/semaine/mois (glisser‑déposer, conflits, récurrences), événements, projets (cartes/liste/kanban, sections, progression), dashboard branché sur les vraies données, suppression des données d'aperçu.

## Phase 4 — Finances
Comptes, transactions (centimes), catégories, budgets mensuels (manuel + suggestion priorisant l'essentiel), récurrences (échéances confirmables, anti‑doublon), épargne, transferts, graphiques Recharts, bilans hebdo/mensuels. Tests unitaires des calculs (Vitest).

## Phase 5 — PWA et notifications
Service worker, page hors ligne, installation iPhone, abonnements push, worker de rappels, page de diagnostic, IndexedDB + file de synchronisation + conflits.

## Phase 6 — Fonctionnalités avancées
Habitudes (sans culpabilisation), statistiques (pas de chiffres trompeurs si données insuffisantes), widgets personnalisables enregistrés dans `dashboard_widgets`, assistant IA (fournisseur abstrait, consentement, confirmation avant toute écriture, quotas), bilans intelligents.

## Phase 7 — Tests et déploiement
Tests fonctionnels (Playwright), calculs financiers, permissions, mobile, RTL, PWA, notifications sur iPhone réel, sauvegarde + restauration testée, déploiement HTTPS, documentation.
