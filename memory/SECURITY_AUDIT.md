# Audit de sécurité et de qualité — Baobab Cargo (Prompt 10)
Date : 2026-06-19 · Périmètre : Freight Forwarding (Prompts 1–9)

Verdict global : **✅ Conforme.** Aucune faille bloquante trouvée. Un défaut d'affichage
(statuts en anglais) a été corrigé. Détails ci-dessous, avec preuves.

---

## 1. Sécurité des données — isolation par table
Stack MongoDB : l'équivalent RLS est appliqué **côté serveur** (aucune requête客 directe à
la base ; tout passe par l'API FastAPI). Deux mécanismes : (a) `require_roles(...)` / `has_role()`
pour le RBAC, (b) filtrage systématique par `user_id` pour les clients.

| Collection | Auth requise | Politique d'accès |
|---|---|---|
| auth_users | oui | Interne uniquement (jamais exposée telle quelle) |
| profiles | oui | CLIENT : le sien (`/me/profile`) ; ADMIN/OPERATOR : lecture liste clients |
| user_roles | oui | **Aucun endpoint d'écriture** — rôles posés au seed/inscription (CLIENT forcé) |
| user_sessions / login_attempts / password_reset_tokens / apple_states | — | Internes ; TTL index ; jamais renvoyées |
| countries / logistic_hubs / carriers / delivery_zones / tariffs | lecture: auth · écriture: ADMIN | Référentiels ; écriture journalisée `audit_log` |
| app_settings | lecture: auth · écriture: ADMIN | Taux/diviseur/franchise ; PUT journalisé |
| packages | oui | CLIENT : `{user_id: self}` strict ; staff : tout |
| package_items / package_photos | oui | Hérite du colis parent (contrôle d'appartenance) ; photos servies en base64 gated |
| shipments | oui | CLIENT : `{user_id: self}` ; ADMIN : tout ; **OPERATOR n'a PAS accès aux expéditions** |
| shipment_packages / tracking_events | oui | Via l'expédition parente (appartenance vérifiée) |
| payments | oui | CLIENT : `{user_id: self}` (lecture) ; `/admin/payments` = **ADMIN seul** |
| cost_records | ADMIN | **ADMIN seul** (OPERATOR interdit) |
| status_history / audit_log | oui | Lecture via l'entité parente ; écriture serveur uniquement |
| notifications | interne | Journal d'envoi (idempotence) ; jamais exposé au client |
| customer_addresses / forwarding_addresses | oui | CLIENT : les siennes (`{user_id: self}`) |

**Aucune table n'est accessible sans authentification** hormis `GET /api/` (health check) et
les endpoints d'auth publics (register/login/forgot/reset, callbacks OAuth) — attendu.
**Aucune politique trop large** détectée : OPERATOR est explicitement exclu des montants.

## 2. Scénarios d'attaque — tous échouent (preuves curl, 2026-06-19)
| # | Scénario | Résultat | Attendu |
|---|---|---|---|
| 1a | Non authentifié → `GET /me/packages` | **401** | ✅ |
| 1b | Non authentifié → `GET /admin/shipments` | **401** | ✅ |
| 2 | Client lit le colis d'un autre → `GET /me/packages/{autre}` | **404** | ✅ |
| 3 | Client modifie un poids → `PUT /admin/packages/{id}/weigh` | **403** | ✅ |
| 4 | Client force un statut → `POST /admin/packages/{id}/transition` | **403** | ✅ |
| 5 | OPERATOR lit les paiements → `GET /admin/payments` | **403** | ✅ |
| 6 | OPERATOR lit les coûts → `GET /admin/cost-records` | **403** | ✅ |
| 7 | Client lit la finance → `GET /admin/dashboard/finance` | **403** | ✅ |
| 8 | Client s'attribue ADMIN | **Impossible** : aucun endpoint n'écrit `user_roles` ; l'inscription publique force `CLIENT` | ✅ |
| 9 | Client crée un paiement PAID → `POST /me/payments` | Statut **forcé à PENDING** côté serveur | ✅ |
| 10 | Accès URL admin en client | Bloqué : `ProtectedRoute requireStaff` (front) **+** 403 serveur | ✅ |

## 3. Transitions de statut — 100 % serveur + historisées
Toutes les transitions (PACKAGE/SHIPMENT/PAYMENT) passent par `statemachine.transition_status()`,
qui : valide la transition contre une table blanche, refuse en **409** sinon, écrit une ligne
`status_history` (from/to/actor/reason), et un `audit_log` pour les entités sensibles
(SHIPMENT/PAYMENT). Le navigateur ne peut jamais écrire un champ `status` : aucun endpoint ne
`$set` un statut hors de la machine à états. PREPARING exige un paiement PAID (409 sinon).

## 4. Aucune clé secrète dans le code client
Scan de `frontend/src` : **aucune** occurrence de clé/secret. Le front n'utilise que
`process.env.REACT_APP_BACKEND_URL`. `EMERGENT_EMAIL_KEY`, `JWT_SECRET`,
`PAYMENT_WEBHOOK_SECRET`, `ADMIN_PASSWORD` sont exclusivement dans `backend/.env` (jamais importés
côté client). La clé e-mail part uniquement dans l'en-tête `X-Email-Key` côté serveur.

## 5. Montants, idempotence, cas limites
- **Décimal exact** : tous les montants sont stockés en `Decimal128` (`to_money`, quantize 0.01),
  jamais en float, et renvoyés en **chaîne**. Vérifié sur la marge (revenus − coûts = marge, sans
  artefact flottant).
- **Idempotence paiement** : `_process_payment` court-circuite si le paiement est déjà
  PAID/FAILED/REFUNDED/CANCELLED (`{"idempotent": true}`) ; le webhook exige `X-Webhook-Secret`.
- **Cas limites** : colis sans client → `UNIDENTIFIED`, ne peut pas atteindre `STORED` sans
  rattachement ; expédition sans paiement PAID → `PREPARING` refusé (409) ; **tarif modifié après
  devis** → le `tariff_snapshot` (taux + diviseur + prix) fige le devis : modifier un tarif
  n'altère aucune expédition existante.
- **Idempotence notifications** : index **unique** `(event, entity_type, entity_id)` + contrôle
  avant insertion → un événement = un e-mail au plus.

## 6. PWA
- **Manifeste valide** : `name`, `short_name`, `lang: fr`, `display: standalone`,
  `orientation: portrait`, `theme_color`/`background_color`, icônes 192/512 + maskable 512.
  Installable Android (bannière `beforeinstallprompt`) et iPhone (méta `apple-mobile-web-app-*`
  + aide « Ajouter à l'écran d'accueil »).
- **Service worker en production uniquement** : enregistré seulement hors iframe et en build prod.
- **Aucune donnée privée en cache** : le SW **ignore explicitement** `/api` et les origines
  externes ; il ne met en cache que des ressources statiques (style/script/image/font).
- **Page hors-ligne en français** : `/offline.html` (FR), servie en secours de navigation.

## 7. Responsive & thèmes
Layouts responsives (client : sidebar desktop + bottom-nav mobile ; admin : sidebar sombre +
drawer mobile). Cartes indicateurs empilées 2 colonnes sur mobile → grille 4 colonnes desktop.
Mode clair/sombre via tokens HSL, testé 360 px / tablette / desktop.

---

## Correctifs appliqués dans le cadre de l'audit
- **Statuts affichés en français** (demande explicite) : `StatusBadge.jsx` mappait des clés en
  minuscules (`created`, `pending`…) qui ne correspondaient à aucun code réel (`EXPECTED`,
  `DRAFT`, `PAID`…). Résultat : codes anglais bruts + puces toutes grises. Corrigé par un mapping
  complet PACKAGE/SHIPMENT/PAYMENT (libellés FR + couleurs par statut), avec accès à plat et
  imbriqué. Vérifié : « Attendu », « Payé », « Brouillon », etc. s'affichent partout.

## Recommandations (non bloquant, backlog)
- Découper `server.py` (~1300 lignes) en routers (`routers/dashboard.py`, `me.py`, `admin.py`).
- `admin_dashboard_finance` : filtrer les PAID par `paid_at` directement en Mongo (perf).
- Migrer les photos colis de base64 (Mongo) vers du stockage objet.
- Ajouter une supervision du taux d'échec `notifications.status == 'FAILED'`.
