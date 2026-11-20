# Assistant IA

## Principes

- Les appels au fournisseur IA se font **uniquement côté serveur** (`src/pages/api/ai/chat.ts`). La clé reste dans `.env` et n'est jamais envoyée au navigateur.
- **Consentement explicite** (Paramètres → Assistant IA) avant tout envoi de tes tâches, événements et projets ; consentement **séparé** pour les finances.
- **Aucune modification sans confirmation** : l'assistant propose des tâches ou événements, tu cliques « Créer » pour chacun.
- **Coûts maîtrisés** : 1 500 jetons de réponse maximum, 10 derniers messages d'historique, contexte limité, quota quotidien (`AI_MAX_REQUESTS_PER_DAY`, 50 par défaut) et limite de 6 questions par minute.
- Sans clé configurée, la page l'indique clairement : **aucune réponse fictive**.
- Désactivable à tout moment dans les paramètres.

## Configuration

Dans `.env` :

```
AI_PROVIDER=anthropic        # ou openai
AI_API_KEY=…                 # clé de ton compte fournisseur
AI_MODEL=…                   # identifiant du modèle choisi
AI_MAX_REQUESTS_PER_DAY=50
```

- `anthropic` : API Messages d'Anthropic.
- `openai` : toute API compatible OpenAI (`AI_BASE_URL` pour changer d'adresse).

Pour ajouter un autre fournisseur : implémenter l'interface `AiProvider` dans `src/lib/ai/provider.ts`.

Redémarre l'application après avoir modifié `.env`.

## Données envoyées

Voir `src/lib/ai/context.ts` : tâches ouvertes, événements des 14 prochains jours, projets en cours, noms des habitudes ; et, seulement si tu l'as autorisé, totaux du mois, budgets et échéances.
