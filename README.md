# Rozana · روزانه

*Chaque jour, à ton rythme.* — application personnelle de planning, tâches, projets, habitudes et finances (PWA, français / persan).

- État d'avancement : [`docs/PLAN.md`](docs/PLAN.md)
- Architecture et collections : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Notifications : [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md) · Assistant IA : [`docs/ASSISTANT.md`](docs/ASSISTANT.md) · Mise en ligne : [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md)

## Prérequis

- Node.js ≥ 20.19 (22 ou 24 conseillé)
- PocketBase **0.40.x** à la racine du projet (`pocketbase.exe` sous Windows) :
  https://github.com/pocketbase/pocketbase/releases

## Démarrage en local

```bash
npm install
# copie .env.example en .env (une seule fois)

# Terminal 1 — PocketBase (applique pb_migrations/ et pb_hooks/). Laisse-le ouvert.
npm run pb

# Terminal 2 — l'application
npm run dev            # http://localhost:4321
```

## Plusieurs utilisateurs

Chaque personne crée son compte avec « Pas encore de compte ? Crée ton espace » sur la page de connexion. Chacun a **son propre espace** : tâches, planning, projets, habitudes et finances ne sont visibles que par leur propriétaire (vérifié par les règles PocketBase et par les tests).

Mode d'inscription, dans `.env` (puis relancer `npm run pb`) :

| Réglage | Effet |
|---|---|
| `ROZANA_SIGNUP=open` (défaut) | tout le monde peut créer son espace |
| `ROZANA_SIGNUP=invite` + `ROZANA_INVITE_CODE=…` | il faut le code d'invitation |
| `ROZANA_SIGNUP=closed` | plus d'inscription (comptes créés dans le tableau de bord PocketBase) |

Une fois l'application en ligne, préfère `invite` ou `closed`.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run pb` | lance PocketBase |
| `npm run dev` | développement |
| `npm run check` | vérification TypeScript / Astro |
| `npm test` | tests unitaires (finances, dates, récurrences, conflits) |
| `npm run test:permissions` | tests de sécurité PocketBase (**base de test uniquement**) |
| `npm run build` / `npm start` | production |
| `npm run vapid` | génère les clés des notifications push |
| `npm run build:worker` / `npm run worker` | processus des rappels push |

## Sécurité

- Aucun secret dans Git ni dans une conversation : seulement dans `.env` ou les variables du serveur.
- En production : HTTPS, `SITE_URL`, sauvegardes PocketBase testées (voir DEPLOIEMENT.md).
