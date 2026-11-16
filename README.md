# Rozana · روزانه

*Chaque jour, à ton rythme.* — application personnelle de planning, tâches, habitudes et finances (PWA, FR/FA).

- Architecture et collections : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Plan et état d'avancement : [`docs/PLAN.md`](docs/PLAN.md)

## Prérequis

- Node.js ≥ 20.19 (testé avec 22)
- PocketBase **0.40.x** : télécharger le binaire pour ton système sur
  https://github.com/pocketbase/pocketbase/releases (ex. `pocketbase_0.40.0_windows_amd64.zip`)
  et placer `pocketbase` / `pocketbase.exe` à la racine du projet (il est ignoré par Git).

## Démarrage en local

```bash
npm install
cp .env.example .env            # Windows : copy .env.example .env

# Terminal 1 — PocketBase (charge pb_migrations/ et pb_hooks/). Laisse-le ouvert.
npm run pb
#    → au premier lancement, crée aussi ton superuser via le lien affiché

# Terminal 2 — Application
npm run dev                      # http://localhost:4321
```

**Premier compte :** sur la page de connexion, clique sur « Première utilisation ? Crée ton compte ».
L'inscription n'est possible que tant qu'aucun compte n'existe ; elle se ferme ensuite toute seule
(vérifié côté PocketBase, pas seulement dans l'interface).

> ⚠️ En production, crée ton compte **juste après le premier déploiement** : tant qu'aucun compte
> n'existe, la première personne qui s'inscrit devient la propriétaire.

**« PocketBase ne répond pas » ?** Le terminal 1 n'est pas lancé, `pocketbase.exe` n'est pas à la
racine du projet, ou `PUBLIC_PB_URL` dans `.env` ne pointe pas vers `http://127.0.0.1:8090`.

Astuce : `/dashboard?apercu=1` affiche une maquette avec des données d'exemple, clairement signalée par un bandeau. Rien n'est enregistré ; ce mode disparaîtra en phase 3.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run pb` | lance PocketBase (binaire à la racine) |
| `npm run dev` | serveur de développement |
| `npm run check` | vérification TypeScript / Astro |
| `npm run build` | build de production (`dist/`) |
| `npm start` | lance le build (`HOST`, `PORT`, variables `.env`) |

## Sécurité — à retenir

- Ne mets jamais de secret dans Git ni dans une conversation : uniquement dans `.env` (local) ou dans les variables du serveur.
- En production : HTTPS obligatoire (PWA + notifications iPhone), `SITE_URL` renseigné.
