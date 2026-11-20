# Déploiement (iPhone + ordinateur)

Pour installer Rozana sur l'iPhone et recevoir les notifications, il faut un serveur accessible en **HTTPS**.

## Architecture conseillée (un petit VPS)

```
Caddy (HTTPS automatique)
 ├─ rozana.ton-domaine.fr  → Astro   (npm start, port 4321)
 └─ api.ton-domaine.fr     → PocketBase (port 8090)
Processus de rappels : npm run worker
```

Exemple de `Caddyfile` :

```
rozana.ton-domaine.fr {
  encode gzip
  reverse_proxy 127.0.0.1:4321
  header {
    Strict-Transport-Security "max-age=31536000"
    Content-Security-Policy "default-src 'self'; connect-src 'self' https://api.ton-domaine.fr; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'"
  }
}
api.ton-domaine.fr {
  reverse_proxy 127.0.0.1:8090
}
```

## Étapes

1. Sur le serveur : Node 22+, le binaire PocketBase 0.40 et le projet.
2. `.env` de production :
   ```
   SITE_URL=https://rozana.ton-domaine.fr
   PUBLIC_PB_URL=https://api.ton-domaine.fr
   PB_INTERNAL_URL=http://127.0.0.1:8090
   (+ clés VAPID, superuser pour le worker, IA)
   ```
3. `npm ci && npm run build && npm run build:worker` (`PUBLIC_PB_URL` est figée au build).
4. Lance trois services permanents : `./pocketbase serve`, `npm start`, `npm run worker`.
5. Choisis le mode d'inscription dans `.env` : `ROZANA_SIGNUP=invite` avec un `ROZANA_INVITE_CODE` (recommandé en ligne) ou `closed`. Chaque personne inscrite obtient son propre espace.
6. Dans le tableau de bord PocketBase (`/_/`) : Settings → Application URL, et active les limites de débit si besoin.

## Sauvegardes

- PocketBase : `/_/` → Settings → Backups → active les **sauvegardes automatiques** (par exemple chaque nuit) et, idéalement, un stockage S3 externe.
- Copie manuelle possible : arrêter PocketBase puis copier le dossier `pb_data/`.
- **Tester la restauration** avant d'utiliser Rozana au quotidien : télécharge une sauvegarde, restaure-la sur une copie (`./pocketbase serve --dir=pb_data_test`), vérifie qu'on peut se connecter et voir ses données.
- L'export JSON (Paramètres → Mes données) est un complément, pas une sauvegarde complète.

## Sécurité — rappel

- Le compte superuser n'est jamais utilisé par le navigateur.
- Toutes les collections sont protégées par des règles « propriétaire uniquement » (testées par `npm run test:permissions` sur une base de test).
- HTTPS obligatoire, cookies `Secure`, protection CSRF d'Astro, en-têtes de sécurité.
