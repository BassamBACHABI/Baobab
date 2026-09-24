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

## Fait — Prompts 6 & 7 (2026-06 — Expéditions, coût, suivi, paiement simulé)
- **Devis/coût calculé côté serveur** (`compute_quote`) depuis `tariffs` + `delivery_zones`, **figé dans `tariff_snapshot`** (taux + diviseur) ; `cost_eur`/`cost_xof` Decimal128. Vérifié : modifier un tarif n'altère PAS une expédition existante.
- Client : sélection de colis STORED → devis EUR/XOF → création DRAFT → **AWAITING_PAYMENT** ; liste + détail avec frise de suivi (tracking_events, libellés FR) + bouton Payer.
- Règles serveur : 1 colis = 1 expédition active ; colis d'un même client ; **PREPARING exige un paiement PAID (409 sinon)** ; à SHIPPED/ARRIVED_BENIN/DELIVERED les colis progressent ; **tracking_event auto** à chaque transition (visible client). Admin : détail (colis, client, paiements, coûts), transporteur/mode/n° suivi (PUT), transitions, saisie `cost_records`.
- **Paiement (SIMULÉ)** : abstraction `PaymentProvider` (`SimulationProvider`) ; paiement PENDING lié à l'expédition ; confirmation par **webhook serveur** (secret env `PAYMENT_WEBHOOK_SECRET`, **idempotent**) → PAID/FAILED + expédition→PAID via transition. Le navigateur ne marque jamais PAID (endpoint `simulate` traite côté serveur). Historique paiements client ; liste admin (ADMIN only).
- Vérifié via curl + captures (devis, création, paiement succès→PAID, PREPARING→SHIPPED, immutabilité snapshot). ⚠️ Provider = SIMULATION (à remplacer par mobile money/carte).

## Fait — Prompts 4 & 5 (2026-06 — Espace client colis + Back-office réception)
- Client : Accueil (adresse de réception + référence + bouton Copier + guide 3 étapes + compteurs en attente/reçus/prêts + montants EUR/XOF), Mes colis (chips de statut défilants + recherche, tableau desktop / cartes mobile), détail colis (photos, poids réel/volumétrique/facturable, dimensions, valeur, contenu, frise status_history), Déclarer un colis attendu (EXPECTED via serveur + status_history).
- Back-office (ADMIN/OPERATOR, responsive) : « Réceptionner un colis » (réf client ou non identifié, marchand, suivi, poids+dimensions, emplacement, contenu, valeur) ; **calcul serveur** poids volumétrique = L×l×H/diviseur, facturable = max(réel, vol) ; identifié → RECEIVED→INSPECTED→STORED auto ; sans client → UNIDENTIFIED (ne peut pas atteindre STORED sans rattachement) ; onglet « Colis à identifier » + rattachement ; conversion d'un EXPECTED en réception ; photos privées (base64, servies gated). Toutes transitions via la fonction serveur (status_history).
- Vérifié via curl + captures (client & admin). ⚠️ Photos stockées en base64 dans Mongo (MVP) — migrer vers object storage plus tard.

## Fait — Prompt 3 (2026-06 — Auth, rôles & profil)
- Mot de passe oublié/réinitialisation (tokens à usage unique, TTL 1h ; lien loggé côté serveur — e-mail à câbler plus tard).
- **Sign in with Apple (web)** : /auth/apple/start + /auth/apple/callback (form_post), vérification serveur du jeton (JWKS RS256, aud=Service ID, iss, exp, nonce). Nécessite `APPLE_CLIENT_ID` + Return URL enregistrée ; 503 tant que non configuré.
- Clé d'identité sociale = `sub` (provider+provider_sub), pas l'e-mail. Google conserve les rôles (table séparée) → ADMIN préservé.
- Redirection par rôle (CLIENT→/client, ADMIN/OPERATOR→/admin) ; routes protégées serveur (`has_role`).
- Profil éditable (prénom/nom/téléphone) + gestion des adresses de livraison au Bénin (ville, quartier/adresse, repère), isolées par utilisateur.
- Frontend : /login (Google + Apple + mot de passe oublié), /forgot-password, /reset-password, /auth/apple-return, profil complet.
- Testing agent : **100 % (34/34 backend, frontend OK)**, aucun bug. ⚠️ Apple réel non testable (Service ID requis) ; e-mail de reset non câblé (MOCKED : lien loggé).

## Fait — Prompt 2 (2026-06 — Schéma Freight Forwarding + Auth + Google)
- Backend MongoDB reproduisant les règles Postgres/RLS côté serveur : collections pour toutes les tables (profiles, user_roles séparé, customer_addresses, countries, logistic_hubs, forwarding_addresses, carriers, packages, package_items/photos, delivery_zones, tariffs, app_settings, shipments, shipment_packages, tracking_events, payments, cost_records, status_history, audit_log).
- Montants en **Decimal128** exact (jamais float), renvoyés en chaîne. Index + unicité (customer_reference CLB-XXXXXX, references PKG/SHP, country code, user_roles).
- Sécurité : `has_role()` serveur + isolation par user_id (CLIENT ne voit que ses données), RBAC (ADMIN complet, OPERATOR colis/photos mais NI payments NI cost_records, CLIENT bloqué sur /admin). Transitions de statut **serveur uniquement** (Package/Shipment/Payment) avec `status_history` + refus 409 ; `audit_log` pour tarifs/poids/coûts/paiements/statuts sensibles. Poids volumétrique = L×l×h / diviseur (5000), facturable = max(réel, volumétrique).
- Auth : email/mot de passe (JWT Bearer) + **Emergent Google sign-in** (échange session serveur, cookie session_token, upsert + trigger d'inscription CLIENT + forwarding address). Aucun ADMIN via inscription publique. Login bloqué proprement pour comptes Google ; logout best-effort.
- Trigger d'inscription : profil + rôle CLIENT + forwarding_address (CLB-XXXXXX) créés automatiquement.
- Seed : FR + BJ, hub Lille, transporteur Baobab Line, 2 zones, 4 tranches de tarif AIR ; réglages `eur_xof_rate=655.957`, `volumetric_divisor=5000`, `storage_free_days=14`, `air_delivery_days_min=2`, `air_delivery_days_max=3`, `default_transport_mode=AIR`. Comptes de test : 1 ADMIN, 1 OPERATOR, 2 CLIENTS (voir test_credentials.md).
- Frontend auth : page /login (email/mot de passe + « Continuer avec Google »), AuthContext, ProtectedRoute (/client, /admin staff), AuthCallback OAuth, déconnexion, profil client affichant la référence + adresse du hub.
- **Mode principal = AÉRIEN**, réception en 2–3 jours (textes landing/expéditions mis à jour, réglages en base).
- Testing agent : **100 % (24/24 backend, 16/16 frontend)**, aucun bug.

## Fait — Prompt 1 (2026-06 — Fondations UI/Nav/PWA)
- Thème light/dark (tokens HSL) + typographie Plus Jakarta Sans + utilitaires d'ombres/animations.
- Espace client : sidebar desktop + bottom nav mobile (Accueil, Mes colis, Expéditions, Profil), pages provisoires avec états vides.
- Back-office admin : sidebar sombre desktop + drawer (Sheet) mobile (Tableau de bord, Clients, Colis, Expéditions, Paramètres), états vides.
- Landing rassurante (hero, 3 étapes, CTA) + page 404.
- PWA : manifest.json (name/short_name/couleurs/standalone/portrait/icônes 192·512·maskable), service worker (cache statique + offline.html FR, prod-only, hors iframe), meta iOS + theme-color, bannière d'installation discrète (beforeinstallprompt + aide iOS).
- Vérifié : 360px / tablette / desktop, clair & sombre ; a11y du drawer corrigée. Testing agent frontend : 95%, aucun blocage.

## Fait — Prompts 8, 9 & 10 (2026-06 — Dashboard/marge, e-mails, audit)
- **Prompt 8 — Tableau de bord admin & marge** : endpoints `/admin/dashboard/metrics` (colis reçus semaine, à identifier, en stock, expéditions par statut), `/finance` (paiements reçus, CA du mois EUR+XOF), `/margin?date_from&date_to` (revenus−coûts=marge par expédition, totaux, marge moyenne, coût moyen/kg), `/todo` (à traiter aujourd'hui). **RBAC strict serveur** : OPERATOR 200 sur metrics/todo, **403 sur finance/margin** ; CLIENT 403 partout. Écrans Paramètres (onglets Général/Hubs/Transporteurs/Zones/Tarifs) ; toute écriture journalisée `audit_log`. Montants Decimal128. Testing agent : 58/58 backend, frontend OK.
- **Prompt 9 — Notifications e-mail** : Resend géré par Emergent (`emailer.py`, garde-fou `_assert_safe_email`), marque **Baobab Cargo**, modèles FR. Événements : colis reçu, colis à identifier (admin), devis dispo, paiement confirmé, expédition expédiée (n° suivi), arrivée Bénin, livraison. Table `notifications` **idempotente** (index unique event+entity). Préférences client (`/me/notification-preferences`) : e-mails non essentiels activables (essentiels toujours envoyés). Clés en secrets uniquement.
- **Prompt 10 — Audit sécurité/qualité** : rapport complet dans `/app/memory/SECURITY_AUDIT.md` (isolation par table, 10 scénarios d'attaque tous en échec via curl, transitions 100 % serveur+historisées, aucun secret côté client, décimaux exacts + idempotence + snapshot figé, PWA, responsive/thèmes). **Correctif** : statuts désormais affichés en **français** (StatusBadge remappé sur les vrais codes EN→libellés FR + couleurs).

## Fait — Suivi Push (2026-06 — Notifications Web Push PWA)
- **Web Push standard (VAPID)** : clés générées et stockées dans `backend/.env` (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`), lib `pywebpush`. Module `push.py` (`push_to_user`, envoi non bloquant via `asyncio.to_thread`, purge des abonnements sur 404/410).
- Endpoints : `GET /push/vapid-public-key`, `POST /me/push/subscribe`, `POST /me/push/unsubscribe` (auth client). Collection `push_subscriptions` (index unique `endpoint`).
- Push envoyé **en parallèle des e-mails** aux mêmes étapes (colis reçu, devis prêt, paiement confirmé, expédié, arrivé au Bénin, livré). Messages FR.
- Service worker : handlers `push` (showNotification) + `notificationclick` (focus/openWindow). Cache bumpé v2.
- Frontend : util `lib/push.js` + bascule « Notifications push » dans le profil client (opt-in par appareil). Détection de support + SW actif ; message d'aide si l'app n'est pas installée. ⚠️ Le SW n'est enregistré qu'en **production/PWA installée** (protège le hot reload) → le push fonctionne sur l'app déployée, et sur iPhone uniquement une fois « Ajouté à l'écran d'accueil » (iOS 16.4+). Backend testé (curl + envoi simulé) ; livraison E2E à valider sur appareil réel après déploiement.

## Fait — Page d'accueil enrichie (2026-06)
- Landing refondue et illustrée (charte respectée) : hero + badge de suivi, bandeau de chiffres (2–3 j, parité 655,957, temps réel, EUR & FCFA), grille « Pourquoi Baobab Cargo » (4 atouts), « Comment ça marche » (3 étapes), 3 sections image/texte (consolidation, réception & pesée, suivi mobile), tarifs indicatifs, témoignage, FAQ (accordéon), CTA et footer enrichi. Images réelles (Unsplash/Pexels) pertinentes. Vérifié à l'écran.

## Fait — Rebrand + Proxy hub + Support + Tarifs éditables (2026-06)
- **Rebrand** « Baobab Cargo » → **« Baobab Transit »** partout (Logo, PWA manifest/index.html, back-office, e-mails, API title, landing).
- **Proxy — réception au hub & validation client** : admin ajoute **poids + photo** (`/admin/proxy-orders/{id}/hub-details`), la réception (`/receive`) est refusée (409) sans poids. Le client valide ensuite l'**expédition** (`/ship-quote` puis `/ship`) : une expédition réelle est créée depuis le poids reçu (liée via `proxy_order_id`, sans créer de colis), puis payée via le flux existant. Refactor pricing partagé `_price_for_weight`.
- **Support** : messagerie interne 1 conversation/client (`/me/support/messages`, `/admin/support/threads*`), onglets Support côté client et admin (ADMIN+OPERATOR).
- **Tarifs** : édition (`PUT /tariffs/{id}`) + suppression (`DELETE`) côté admin (journalisé), affichage public sur la landing via `GET /public/tariffs`.
- **Landing** : phrase « point relais à Cotonou » retirée, section **avis 4-5★** ajoutée, tarifs dynamiques.
- Vérifié testing agent : **17/17 backend PASS, frontend 100 %**, RBAC strict (OPERATOR 403 sur proxy & tarifs), isolation client 404, décimaux exacts. Commission proxy par défaut = 10 % (min 5 €), configurable.

## Fait — Page Clients + pastilles non-lu (2026-06)
- **Bug corrigé** : la page `/admin/clients` était un stub (toujours vide) → implémentée (liste des clients avec recherche, référence copiable, statut « Actif », date) via `GET /admin/clients`.
- **Pastilles non-lu** : `GET /me/badges` & `GET /admin/badges` (+ `POST /me/support/seen`). Client : Support (messages staff non lus) + Achats (commandes à payer / à expédier). Admin : Support (fils en attente de réponse) + Achats proxy (REQUESTED/PAID, ADMIN only). Affichage sur les nav (client & admin).
- **ClientHome** : salutation avec prénom ; « Frais à régler » calculé réellement (expéditions AWAITING_PAYMENT + proxy QUOTED) au lieu de 0 codé en dur + bouton « Régler ».
- Vérifié testing agent : 10/10 backend, 100 % frontend, RBAC OK (OPERATOR proxy=0, CLIENT 403 sur /admin/badges).

## Backlog priorisé (prochains prompts, ne pas anticiper)
- **Paiement expédition proxy explicite (2026-06)** : après réception au hub, la commande proxy affiche l'état de l'expédition + bouton « Payer l'expédition » ; l'envoi vers le Bénin reste bloqué (409) tant que l'expédition n'est pas payée (vérifié curl). Section « Achats pour moi » ajoutée à la landing.
- **P1** : Paiement réel Mobile Money **KkiaPay** (MTN/Moov + carte, sandbox puis prod) — remplacer `SimulationProvider`.
- **P1** : Relance automatique de devis impayé après 48 h (tâche planifiée quotidienne).

## Prochaines actions
- Attendre le Prompt 2 de l'utilisateur (probablement Auth + rôles + adresse de réception).
