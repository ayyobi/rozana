# Rozana (روزانه) — Architecture technique

> Design : palette neutre et chaleureuse (lin, sable, terracotta, sauge), motif soleil levant.

> Chaque jour, à ton rythme.

## 1. Vue d'ensemble

```
 iPhone / ordinateur (PWA)                 Serveur (HTTPS, un seul VPS)
┌────────────────────────────┐        ┌───────────────────────────────────────┐
│ Astro (HTML rendu serveur) │◀──────▶│ Astro SSR (Node, adapter standalone)  │
│ + îlots React              │  HTTPS │  • middleware : session + routes      │
│ + SDK PocketBase           │        │  • /api/auth, /api/ai, /api/push…     │
│ + IndexedDB (Dexie, ph. 5) │        └──────────────┬────────────────────────┘
│ + Service Worker (ph. 5)   │                       │
└─────────────┬──────────────┘                       ▼
              │  HTTPS (jeton utilisateur)   ┌───────────────────────────────┐
              └─────────────────────────────▶│ PocketBase 0.40 (SQLite)       │
                                             │  • règles d'accès par user     │
                                             │  • migrations JS versionnées   │
                                             └──────────────┬────────────────┘
                                                            │
                                             ┌──────────────▼────────────────┐
                                             │ Worker de rappels (Node, ph. 5)│
                                             │  • toutes les minutes          │
                                             │  • Web Push (VAPID)            │
                                             └───────────────────────────────┘
```

| Couche | Choix | Pourquoi |
|---|---|---|
| Framework | **Astro 7** (`output: 'server'`, `@astrojs/node`) | Pages légères rendues serveur, protection des routes côté serveur, API routes pour IA et push. |
| Interactivité | **React 19** en îlots | Seuls les widgets interactifs chargent du JS. |
| Styles | **Tailwind CSS 4** + variables CSS | Tokens de la palette Rozana, variantes `rtl:` natives, propriétés logiques (`ms-`, `ps-`, `start-`). |
| Langage | **TypeScript strict** (+ `noUncheckedIndexedAccess`) | `astro check` sans erreur exigé à chaque phase. |
| Données | **PocketBase 0.40** (SDK JS 0.29) | Auth, règles d'accès, temps réel, sauvegardes, un seul binaire. |
| État client | **nanostores** | Minuscule, partagé entre îlots React. |
| Validation | **zod 4** | Mêmes schémas pour formulaires et API. |
| Dates | **date-fns 4 + @date-fns/tz**, `Intl` | Fuseau `Europe/Paris` par défaut ; calendrier persan possible via `-u-ca-persian`. |
| Icônes | **lucide-react** | Rendues en SVG statique côté serveur quand rien n'est interactif. |
| Graphiques | **Recharts** (phase 4) | Responsive et accessible. |
| Hors ligne | **Dexie (IndexedDB)** + file de mutations (phase 5) | Lecture hors ligne, synchronisation, conflits. |
| Push | **web-push** + worker Node (phase 5) | Pas de `setTimeout` navigateur. |
| Polices | `@fontsource-variable` (Fraunces, DM Sans, Vazirmatn) | Auto-hébergées : rapides, hors ligne, sans traceur. |

## 2. Authentification et sécurité

- **Multi-utilisateurs, espaces séparés** : chaque enregistrement porte un `owner` ; les règles PocketBase limitent lecture et écriture au propriétaire. Inscription réglable (`ROZANA_SIGNUP` = `open` / `invite` / `closed`, `ROZANA_INVITE_CODE`), appliquée par le hook `pb_hooks/rozana.pb.js` côté serveur.
- **Session** : cookie `pb_auth` (jeton PocketBase). À chaque requête de page, le middleware revalide le jeton auprès de PocketBase (`authRefresh`) ; jeton invalide → redirection `/connexion?expired=1`.
- Le cookie n'est **pas** `httpOnly` : le SDK du navigateur doit lire le jeton pour parler directement à PocketBase (indispensable pour la synchronisation hors ligne). La protection réelle est faite par **les règles PocketBase**, vérifiées côté serveur. Contreparties : `SameSite=Lax`, `Secure` en production, CSP stricte au déploiement, aucun HTML utilisateur injecté.
- **CSRF** : vérification d'origine d'Astro (`security.checkOrigin`), `SITE_URL` réglé en production.
- **Connexion** : limite de 8 tentatives / 10 min / IP + message d'erreur identique (e-mail inconnu ou mauvais mot de passe). Redirection `next` limitée aux chemins internes.
- **Superuser** : jamais dans le frontend ; identifiants utilisés uniquement en local par les scripts.
- **IA** : appels uniquement côté serveur, clé dans l'environnement, consentement explicite avant d'envoyer des données personnelles ou financières.

## 3. Internationalisation

- `src/i18n/fr.json` et `fa.json` ; `useTranslations(locale)` est **typé** : une clé inexistante est une erreur TypeScript, et `fa.json` doit avoir la même forme que `fr.json`.
- `<html lang dir>` réglé côté serveur → pas de flash LTR/RTL.
- Persan : Vazirmatn, chiffres persans (`-nu-arabext`), icônes directionnelles inversées (`rtl:-scale-x-100`), mises en page en propriétés logiques.
- Préférence de langue : cookie en phase 1 → `user_settings.locale` en phase 2.
- Les textes saisis par l'utilisatrice ne sont jamais traduits.

## 4. Structure du code

```
src/
├── components/
│   ├── ui/            Button, primitives (Card, Badge, Field, Progress, Skeleton, EmptyState),
│   │                  Modal (<dialog>), Toaster, illustrations
│   ├── layout/        Logo, Sidebar, BottomNav, QuickAdd, ComingSoon
│   ├── auth/          LoginForm
│   ├── dashboard/     Dashboard, widgets, MiniCalendar, DashboardHeader, registry
│   ├── calendar/ tasks/ projects/ habits/ finance/   (phases 3 à 6)
├── layouts/           BaseLayout (head, PWA, lang/dir), AppLayout (navigation + FAB + toasts)
├── pages/             routes FR (/dashboard, /planning/jour…) + api/
├── lib/
│   ├── pocketbase/    client serveur par requête, cookie
│   ├── auth/          limiteur de débit
│   ├── finance/       centimes, budgets, récurrences (fonctions pures testées)
│   ├── notifications/ (phase 5)
│   └── utils/         dates, cn
├── services/          (phase 3) accès PocketBase par domaine : tasks.ts, events.ts…
├── stores/            nanostores (toasts, sync…)
├── types/             types partagés (+ types PocketBase générés)
├── i18n/
└── middleware.ts
pb_migrations/         migrations JS PocketBase versionnées
scripts/               owner:create, worker de rappels, sauvegardes
```

Règle : **l'interface n'appelle jamais PocketBase directement** ; elle passe par `src/services/*`, qui gèrent validation, erreurs et (phase 5) file hors ligne.

## 5. Collections PocketBase

Conventions communes à toutes les collections privées :

- champ `owner` → relation vers `users`, **obligatoire**, `cascadeDelete: true` (supprimer le compte supprime tout).
- règles : `list/view/update/delete = owner = @request.auth.id` ; `create = @request.auth.id != "" && owner = @request.auth.id`.
- champs `created` / `updated` automatiques ; index sur `owner`.
- montants : **entiers en centimes** (`number`, `onlyInt: true`), devise ISO 4217 (`text`, 3 lettres).
- dates : `date` stockée en UTC + champ `all_day` quand utile ; affichage dans `user_settings.timezone`.

| Collection | Champs principaux (obligatoires en **gras**) | Relations / suppression | Index |
|---|---|---|---|
| `users` (auth) | **email**, name, avatar | — | — |
| `user_settings` | **owner** (unique), **locale** (`fr`/`fa`), **timezone**, currency, week_start, calendar (`gregory`/`persian`), ai_enabled, ai_consent_at, finance_alert_threshold (80) , daily_summary, weekly_summary | owner cascade | unique(owner) |
| `categories` | **owner**, **name**, **color**, icon, **scope** (`planning`/`project`), sort | owner cascade ; tâches/événements → `null` à la suppression | (owner, scope) |
| `tasks` | **owner**, **title**, description, category, project, section, start_at, end_at, deadline, all_day, **priority**, **status**, estimate_min, recurrence (JSON RRULE), links (JSON), notes, completed_at, sort | project → `null` (une tâche vit sans projet) ; category → `null` | (owner, status), (owner, deadline), (owner, project) |
| `subtasks` | **owner**, **task**, **title**, done, sort | task **cascade** | (task) |
| `events` | **owner**, **title**, description, category, **start_at**, **end_at**, all_day, recurrence (JSON), color, series_id, exception_of | category → `null` | (owner, start_at) |
| `projects` | **owner**, **name**, description, category, color, icon, start_date, deadline, **status**, notes, links (JSON), view (`cards`/`list`/`kanban`) | tâches → `project = null` (ou suppression sur confirmation) | (owner, status) |
| `project_sections` | **owner**, **project**, **name**, sort | project cascade ; tâches → `section = null` | (project) |
| `habits` | **owner**, **name**, icon, color, description, **frequency** (`daily`/`weekly`/`custom`), days (JSON 0‑6), reminder_time, target_qty, target_unit, archived | — | (owner, archived) |
| `habit_logs` | **owner**, **habit**, **date** (AAAA‑MM‑JJ local), qty, note | habit cascade | **unique(habit, date)** |
| `finance_accounts` | **owner**, **name**, **type** (courant/épargne/espèces/autre), **currency**, opening_balance_cents, archived | transactions → bloquer la suppression (archiver) | (owner) |
| `finance_categories` | **owner**, **name**, **kind** (`expense`/`income`), color, icon, **essential** (bool, priorité dans la répartition), budget_group | transactions → `null` | (owner, kind) |
| `transactions` | **owner**, **account**, **type** (`expense`/`income`), **amount_cents** (>0), **currency**, category, **date**, payment_method, description, **status** (`confirmed`/`pending`), recurring, due_key, transfer | account restrict ; recurring → `null` | (owner, date), **unique(recurring, due_key)** anti‑doublon |
| `monthly_budgets` | **owner**, **month** (AAAA‑MM), **category**, **amount_cents**, source (`manual`/`suggested`) | category cascade | **unique(owner, month, category)** |
| `recurring_transactions` | **owner**, **label**, **type**, **amount_cents**, **currency**, account, category, **frequency** (`weekly`/`monthly`/`yearly`/`custom`), interval, **start_date**, end_date, day_of_month, reminder_days_before, active | transactions gardées (`recurring = null`) | (owner, active) |
| `savings_goals` | **owner**, **name**, **target_cents**, **currency**, target_date, notes, archived | contributions cascade | (owner) |
| `savings_contributions` | **owner**, **goal**, **amount_cents** (≠0, négatif = retrait), **date**, note, transaction | goal cascade | (goal, date) |
| `money_transfers` | **owner**, **recipient**, **amount_cents**, **currency**, fee_cents, rate (texte décimal exact), received_cents, received_currency, **date**, **status** (`planned`/`sent`/`received`/`cancelled`), notes, transaction | transaction → `null` | (owner, date) |
| `reminders` | **owner**, **dedupe_key**, target_type, target_id, title, status, sent_at — journal des rappels envoyés (anti-doublon) | owner cascade | **unique(owner, dedupe_key)** |
| `push_subscriptions` | **owner**, **endpoint** (unique), **p256dh**, **auth**, user_agent, last_success_at, failures | owner cascade | unique(endpoint) |
| `dashboard_widgets` | **owner**, **widget** (id du registre), **visible**, **order**, **size** | owner cascade | unique(owner, widget) |
| `ai_conversations` | **owner**, title, archived | messages cascade | (owner) |
| `ai_messages` | **owner**, **conversation**, **role**, **content**, tokens_in, tokens_out, proposed_actions (JSON), actions_confirmed_at | conversation cascade | (conversation, created) |

Points de vigilance :

- **Pas de double comptage** : un transfert peut créer UNE transaction de dépense liée (`transfer`) ; les bilans comptent la transaction, jamais le transfert en plus. Une contribution d'épargne est un mouvement entre comptes, pas une dépense.
- **Récurrences** : le worker génère des échéances « prévues » (`status = pending`) avec `due_key = AAAA-MM-JJ` ; l'index unique `(recurring, due_key)` empêche les doublons. La transaction devient `confirmed` uniquement quand l'utilisatrice confirme.
- **Trois soldes distincts** : solde enregistré (transactions confirmées), reste du budget mensuel (budgets − dépenses confirmées du mois), solde prévisionnel (solde enregistré + échéances à venir).
- **Pas de relations circulaires** : `tasks → projects`, jamais l'inverse ; la progression d'un projet est calculée, pas stockée.

## 6. Notifications push (phase 5)

1. L'utilisatrice active les notifications **après un geste** (bouton), dans la PWA installée (iOS 16.4+).
2. Le navigateur crée un abonnement (clé VAPID publique) → enregistré dans `push_subscriptions`.
4. Le **worker** (`scripts/reminder-worker.ts`, processus séparé) calcule chaque minute les rappels dus à partir des tâches, événements, habitudes et finances, les enregistre dans `reminders` (index unique = un seul envoi) puis envoie le push ; abonnement 404/410 → supprimé.
5. Page `/parametres/notifications` : diagnostic (PWA installée ? permission ? abonnement ? dernier envoi ?) + bouton « Envoyer une notification de test ».

## 7. Hors ligne (phase 5)

- Service Worker : cache des ressources statiques (`/_astro/*`, polices, icônes), page `/hors-ligne`.
- Dexie : copie locale des collections + table `outbox` (mutations en attente avec `updated` de référence).
- Au retour du réseau : rejeu de l'outbox ; si le `updated` serveur a changé → conflit présenté à l'utilisatrice (garder la mienne / garder celle du serveur).
- Indicateur d'état : « Synchronisé », « En attente (n) », « Hors ligne ». Une modification locale n'affiche jamais « Enregistré ».

## 8. Déploiement visé

Un VPS (ou Fly.io / Railway) avec : Caddy (HTTPS automatique) → Astro (port 4321) et PocketBase (port 8090, sous-domaine `api.`), worker de rappels, sauvegarde quotidienne de `pb_data` (backups PocketBase + copie hors serveur), **restauration testée** avant la mise en service.
