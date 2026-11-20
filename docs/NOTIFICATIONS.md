# Notifications push

Rozana envoie des rappels même quand l'application est fermée, grâce à :

- un **Service Worker** (`public/sw.js`) qui reçoit les notifications ;
- des **clés VAPID** qui signent les envois ;
- un **processus serveur** (`scripts/reminder-worker.ts`) qui vérifie chaque minute les rappels à envoyer — aucun `setTimeout` dans le navigateur.

## Ce qui est envoyé

| Type | Quand | Réglage |
|---|---|---|
| Tâche | heure de début − rappel choisi (ou 9 h le jour de l'échéance) | Rappels de tâches |
| Événement | heure de début − rappel (9 h si journée entière), récurrences comprises | Rappels d'événements |
| Habitude | à l'heure de rappel, si elle n'est pas encore cochée | Rappels d'habitudes |
| Échéance financière | 9 h, X jours avant (réglable par récurrence) | Rappels financiers |
| Budget | dès qu'un budget atteint le seuil (80 % par défaut) puis s'il est dépassé — une fois par mois | Rappels financiers |
| Transfert prévu | 9 h le jour prévu | Rappels financiers |
| Bilans | lundi 9 h (hebdomadaire), le 1er à 9 h (mensuel) | Rappels financiers |
| Résumés | quotidien à l'heure choisie, hebdomadaire le lundi | Résumé quotidien / hebdomadaire |

Chaque rappel n'est envoyé **qu'une fois** (index unique `reminders(owner, dedupe_key)`).

## Mise en place

1. Génère les clés (une seule fois) :
   ```bash
   npm run vapid
   ```
   Copie les deux clés dans `.env` : `PUBLIC_VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY`, plus `VAPID_SUBJECT=mailto:ton-adresse`.
2. Ajoute dans `.env` les identifiants superuser PocketBase (`PB_SUPERUSER_EMAIL`, `PB_SUPERUSER_PASSWORD`). Ils restent sur le serveur.
3. Construis puis lance le processus de rappels, à côté de l'application :
   ```bash
   npm run build:worker
   npm run worker
   ```
   En production, fais-le tourner en permanence (pm2, systemd, service Docker…).
4. Dans Rozana : **Paramètres → Notifications → Activer les notifications**, puis **Envoyer une notification de test**.

## iPhone

- iOS **16.4 ou plus récent**.
- **HTTPS obligatoire** (sauf `localhost` sur ordinateur).
- Ajoute Rozana à l'écran d'accueil : Safari → Partager → « Sur l'écran d'accueil ». Ouvre-la **depuis l'icône**.
- Active les notifications **depuis l'application installée** (la demande d'autorisation suit un appui sur le bouton, comme l'exige iOS).
- La page Paramètres affiche un **diagnostic** : HTTPS, Service Worker, Push API, autorisation, mode écran d'accueil, abonnement, clés serveur.

## Ce qui a été testé

- Envoi réel de notifications chiffrées (`aes128gcm`, signature VAPID) vers un service push de test.
- Anti-doublon : un second passage du processus n'envoie rien.
- Abonnements expirés (404/410) supprimés automatiquement.
- Non testé ici : réception sur un vrai iPhone (nécessite un déploiement HTTPS).
