# Baobab Cargo — PRD

## Problème / Vision
Plateforme web PWA (installable, mobile-first, FR) pour un service de transit de colis **Europe → Bénin**.
Phase actuelle : **Freight Forwarding** uniquement (adresse de réception, réception & pesée au hub, demande d'expédition, paiement, suivi jusqu'au Bénin). Proxy Shopping = plus tard.
Marque retenue : **Baobab Cargo** (nom court « Baobab »).

## Personas
- **Client** : particulier au Bénin qui achète en Europe et fait livrer à une adresse de réception.
- **Admin** : opérateur logistique / propriétaire (back-office semi-manuel).
- **Operator** (futur) : rôle logistique délégué.

## Contraintes techniques (à respecter dans les prochains prompts)
- Devises : EUR (Europe) + XOF affiché (parité 1 EUR = 655,957 XOF, modifiable, stockée en base).
- Montants en décimal exact, jamais en flottant.
- Rôles (CLIENT/ADMIN/OPERATOR) dans une table séparée `user_roles` + fonction `has_role()`.
- RLS sur toutes les tables ; un client ne voit que ses données.
- Transitions de statut uniquement côté serveur (RPC/endpoint) + `status_history`.
- Calculs sensibles côté serveur ; tarifs/zones/taux/diviseur volumétrique en base ; calcul validé figé (snapshot).
- Codes statut en anglais en base, libellés FR à l'affichage.
- Auth : email/mot de passe + Google + Apple, vérification serveur des jetons ; aucun ADMIN via inscription publique.
- Stack de ce projet : React + FastAPI + MongoDB (adapter les concepts RLS/RPC en logique serveur + contrôle d'accès applicatif).

## Design system
- Bleu profond #0B2046, accent terracotta #E56B3D, Plus Jakarta Sans, coins arrondis, espace blanc, mode clair/sombre.
- Composants : boutons, cartes, badges de statut (StatusBadge, libellés FR), tableaux responsives, formulaires, toasts (sonner), squelettes (ListSkeleton), états vides (EmptyState), PageHeader.

## Fait — Prompt 1 (2026-06 — Fondations UI/Nav/PWA)
- Thème light/dark (tokens HSL) + typographie Plus Jakarta Sans + utilitaires d'ombres/animations.
- Espace client : sidebar desktop + bottom nav mobile (Accueil, Mes colis, Expéditions, Profil), pages provisoires avec états vides.
- Back-office admin : sidebar sombre desktop + drawer (Sheet) mobile (Tableau de bord, Clients, Colis, Expéditions, Paramètres), états vides.
- Landing rassurante (hero, 3 étapes, CTA) + page 404.
- PWA : manifest.json (name/short_name/couleurs/standalone/portrait/icônes 192·512·maskable), service worker (cache statique + offline.html FR, prod-only, hors iframe), meta iOS + theme-color, bannière d'installation discrète (beforeinstallprompt + aide iOS).
- Vérifié : 360px / tablette / desktop, clair & sombre ; a11y du drawer corrigée. Testing agent frontend : 95%, aucun blocage.

## Backlog priorisé (prochains prompts, ne pas anticiper)
- **P0 Prompt 2+** : Auth (email/mdp + Google + Apple, vérif serveur), modèle utilisateurs + `user_roles`, référence client unique, adresse de réception.
- **P0** : Modèles Colis (réception, pesée) et Expéditions + machine à états serveur + `status_history`.
- **P1** : Paramètres admin (taux de change EUR/XOF, tarifs, zones, diviseur volumétrique) en base.
- **P1** : Calcul de coût d'expédition côté serveur + snapshot figé ; paiement.
- **P2** : Proxy Shopping ; multi-hubs / multi-pays.

## Prochaines actions
- Attendre le Prompt 2 de l'utilisateur (probablement Auth + rôles + adresse de réception).
