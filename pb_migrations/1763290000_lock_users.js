/// <reference path="../pb_data/types.d.ts" />
/**
 * Rozana — verrouillage de la collection `users`.
 * Application mono-utilisatrice : aucune inscription publique.
 * Le compte personnel est créé une seule fois par un superuser
 * (script `npm run owner:create`, phase 2).
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.listRule = 'id = @request.auth.id';
    users.viewRule = 'id = @request.auth.id';
    users.createRule = null; // superuser uniquement
    users.updateRule = 'id = @request.auth.id';
    users.deleteRule = null;
    // Pas de connexion OAuth2 ni OTP : mot de passe uniquement.
    users.oauth2.enabled = false;
    users.otp.enabled = false;
    users.passwordAuth.enabled = true;
    users.passwordAuth.identityFields = ['email'];
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.createRule = '';
    app.save(users);
  },
);
