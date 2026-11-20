/// <reference path="../pb_data/types.d.ts" />
/** Rozana — l'utilisatrice peut supprimer son propre compte (et toutes ses données, en cascade). */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.deleteRule = 'id = @request.auth.id';
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.deleteRule = null;
    app.save(users);
  },
);
