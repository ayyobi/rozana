/// <reference path="../pb_data/types.d.ts" />
/**
 * Rozana — hooks PocketBase : inscription multi-utilisateurs.
 *
 * Chaque personne inscrite obtient son propre espace : toutes les données sont
 * rattachées à son compte (champ `owner`) et protégées par les règles d'accès.
 *
 * Mode d'inscription, réglé par variables d'environnement au lancement de PocketBase
 * (`npm run pb` lit le fichier .env) :
 *   ROZANA_SIGNUP=open     → tout le monde peut s'inscrire (par défaut)
 *   ROZANA_SIGNUP=invite   → il faut le code ROZANA_INVITE_CODE
 *   ROZANA_SIGNUP=closed   → plus d'inscription (seule la superuser crée des comptes)
 * Le tout premier compte peut toujours être créé.
 * La logique est dans signup.js (partagée par les deux gestionnaires).
 */

onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const cfg = require(`${__hooks}/signup.js`).signupMode();
    const first = $app.countRecords('users') === 0;
    if (!first) {
      if (cfg.mode === 'closed') throw new ForbiddenError("L'inscription est fermée.");
      if (cfg.mode === 'invite') {
        const body = e.requestInfo().body || {};
        if (String(body.invite || '').trim() !== cfg.code) throw new ForbiddenError("Code d'invitation invalide.");
      }
    }
  }
  e.next();
}, 'users');

// État de l'inscription pour la page de connexion.
routerAdd('GET', '/api/rozana/setup-status', (e) => {
  const cfg = require(`${__hooks}/signup.js`).signupMode();
  const first = $app.countRecords('users') === 0;
  return e.json(200, { signupOpen: first || cfg.mode !== 'closed', inviteRequired: !first && cfg.mode === 'invite' });
});
