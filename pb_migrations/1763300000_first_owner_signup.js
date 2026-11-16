/// <reference path="../pb_data/types.d.ts" />
/**
 * Rozana — inscription du premier compte.
 * La création est ouverte au niveau des règles, MAIS le hook
 * pb_hooks/rozana.pb.js refuse toute création dès qu'un compte existe.
 * Résultat : seule la toute première inscription est possible.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.createRule = '';
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.createRule = null;
    app.save(users);
  },
);
