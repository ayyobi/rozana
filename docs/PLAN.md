# État d'avancement de Rozana

Légende : ✅ fait et testé · 🟡 fait, à tester sur appareil réel · ⏳ à faire

## Fondations
- ✅ Astro 7, React 19, Tailwind 4, TypeScript strict (0 erreur `astro check`)
- ✅ Design system neutre et chaleureux, composants UI, états vides, squelettes, toasts, modales
- ✅ Navigation : barre latérale (ordinateur), barre basse + menu « Plus » (mobile), bouton + partout
- ✅ Bilingue FR / FA (RTL, Vazirmatn, chiffres persans), langue enregistrée dans le compte

## Données et sécurité
- ✅ 22 collections PocketBase (migrations), règles « propriétaire uniquement », relations vérifiées
- ✅ 14 tests de permissions (`npm run test:permissions`)
- ✅ Plusieurs utilisateurs, chacun dans son propre espace (85 vérifications d'isolation) ; inscription ouverte, sur invitation ou fermée ; connexion, session vérifiée côté serveur, expiration
- ✅ Export JSON, suppression du compte et de toutes les données, changement de mot de passe
- ✅ Données de départ (catégories, catégories financières, compte courant) à la première connexion

## Planning
- ✅ Tâches : ajout rapide, formulaire court + options avancées, sous-tâches, récurrence, liens, rappels, filtres, tri, recherche, dupliquer, reporter, supprimer avec confirmation, retards, à venir, historique
- ✅ Calendrier jour / semaine / mois, navigation, Aujourd'hui, filtres par catégorie, glisser-déposer (ordinateur), événements récurrents (exception d'une occurrence), détection des conflits, rappels financiers, tâches ≠ événements visuellement
- ✅ Catégories personnalisables
- ✅ Projets : cartes / liste / kanban, sections, progression automatique, prochaines étapes, kanban des tâches

## Dashboard
- ✅ Données réelles : priorités, planning du jour, projets, habitudes, finances, mini-calendrier avec indicateurs
- ✅ Personnalisation (afficher, masquer, ordre, taille) enregistrée dans PocketBase
- ✅ Cloche d'alertes (retards, budgets, échéances, transferts)

## Habitudes
- ✅ Création, jours, objectif chiffré, rappel, cocher / décocher, calendrier de suivi, taux 7 j / 30 j, semaine, mois, séries sans culpabilisation, archivage

## Finances
- ✅ Montants en centimes entiers (23 tests unitaires)
- ✅ Comptes, catégories (dont « obligatoire »), transactions (CRUD, filtres, recherche, totaux)
- ✅ Trois soldes distincts : enregistré, reste du budget, prévisionnel
- ✅ Budgets mensuels + suggestion (obligatoire d'abord), copie du mois précédent
- ✅ Récurrences : échéances à confirmer, jamais payées automatiquement, anti-doublon
- ✅ Épargne : objectifs, contributions / retraits, mensualité recommandée, date estimée
- ✅ Transferts : suivi par mois / année, frais, taux, dépense liée créée une seule fois
- ✅ Bilans hebdomadaires / mensuels, comparaison, conseils, graphiques accessibles

## Statistiques
- ✅ Productivité, habitudes, finances — aucune tendance affichée sans données suffisantes

## PWA, hors ligne, notifications
- ✅ Manifest, icônes, Service Worker, page hors ligne
- ✅ Hors ligne : lecture des données synchronisées, file d'attente IndexedDB, synchronisation au retour, conflits (choix de version), indicateur ; jamais « enregistré » si seulement local
- ✅ Push : abonnement, test, diagnostic, processus serveur des rappels (envoi réel vérifié vers un service push de test)
- 🟡 Réception sur iPhone : nécessite un déploiement HTTPS (voir DEPLOIEMENT.md)

## Assistant IA
- ✅ Appels serveur, fournisseur interchangeable, consentement, quotas, état explicite sans clé, actions confirmées une par une
- 🟡 Réponses réelles : à tester avec ta propre clé API

## Pistes futures
- ⏳ Calendrier solaire persan (architecture prête : `intlTag(locale, 'persian')`)
- ⏳ Glisser-déposer tactile dans le calendrier (sur mobile : modifier la date dans le formulaire)
- ⏳ Conversion multi-devises dans les totaux (aujourd'hui : devise principale)
