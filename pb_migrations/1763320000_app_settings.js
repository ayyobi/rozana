/// <reference path="../pb_data/types.d.ts" />
/** Rozana — réglages PocketBase : requêtes groupées (batch) et limites de débit. */
migrate((app) => {
  const s = app.settings();
  s.batch.enabled = true;
  s.batch.maxRequests = 100;
  s.batch.timeout = 10;
  s.rateLimits.enabled = true;
  app.save(s);
});
