/// <reference path="../pb_data/types.d.ts" />
/**
 * Rozana — hooks PocketBase.
 * Application personnelle : un seul compte peut être créé par inscription.
 * Ensuite, seule la superuser peut créer un compte (tableau de bord /_/).
 */

// Bloque toute inscription dès qu'un compte existe.
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const total = $app.countRecords('users');
    if (total > 0) {
      throw new ForbiddenError("L'inscription est fermée : un compte existe déjà.");
    }
  }
  e.next();
}, 'users');

// Indique si l'inscription du premier compte est encore possible.
routerAdd('GET', '/api/rozana/setup-status', (e) => {
  const total = $app.countRecords('users');
  return e.json(200, { signupOpen: total === 0 });
});
