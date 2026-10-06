# Déploiement de recette (Vercel + MongoDB Atlas)

Cette recette utilise une base indépendante. Elle ne reprend pas les données du projet Emergent.

## 1. Créer la base

Créer un cluster Atlas Free, un utilisateur MongoDB réservé à la recette et une base nommée `baobab_recette`. Récupérer l’URI MongoDB dans Atlas et la conserver comme secret. Ne pas la committer dans Git.

Atlas Free convient à une petite recette, avec stockage et capacité limités. Vercel utilise des adresses de sortie variables ; l’accès réseau Atlas peut donc demander une règle réseau large. Si cette règle est nécessaire, utiliser uniquement cette base de recette, un compte à mot de passe long et sans privilège d’administration Atlas, et ne jamais réutiliser ce compte ailleurs.

## 2. Déployer l’API

Créer un projet Vercel relié au même dépôt GitHub, avec `backend` comme Root Directory. La fonction FastAPI est exportée par `server.py`; Vercel détecte le runtime Python et installe les dépendances de `backend/requirements.txt`.

Variables obligatoires dans les environnements Vercel Preview et Production du projet API :

- `MONGO_URL` : URI Atlas de la base de recette.
- `DB_NAME` : `baobab_recette`.
- `JWT_SECRET` : valeur aléatoire longue, propre à la recette.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` : identifiants de l’administrateur de recette.
- `OPERATOR_EMAIL`, `OPERATOR_PASSWORD` : identifiants opérateur de recette.
- `SEED_CLIENT_PASSWORD` : mot de passe aléatoire des deux clients de démonstration créés par le seed.
- `CORS_ORIGINS` : origine exacte du frontend Vercel, par exemple `https://baobab-recette.vercel.app` (sans slash final).
- `FRONTEND_URL` : même URL du frontend, utilisée pour construire les liens e-mail.

Le backend exécute `run_seed()` au démarrage. Les comptes de démonstration Awa et Koffi sont donc créés avec `SEED_CLIENT_PASSWORD`.

Variables facultatives selon les fonctions utilisées : `APPLE_CLIENT_ID`, `APPLE_REDIRECT_URI`, `EMERGENT_EMAIL_KEY`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`, `PAYMENT_WEBHOOK_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Le paiement reste simulé dans cette application et le service d’e-mail utilise encore l’intégration Emergent.

Après le premier déploiement, noter le domaine stable de l’API Vercel, par exemple `https://baobab-api.vercel.app`.

## 3. Déployer le frontend

Créer un second projet Vercel relié au même dépôt, avec `frontend` comme Root Directory. Framework : Create React App. Commande de build : `npm run build`. Dossier de sortie : `build`.

Ajouter `REACT_APP_BACKEND_URL` avec le domaine stable de l’API, sans `/api` final, par exemple `https://baobab-api.vercel.app`. Cette variable est incorporée au bundle au moment du build ; redéployer le frontend après l’avoir modifiée.

Le fichier `frontend/vercel.json` réécrit les routes client vers `index.html` pour préserver le routage React.

## 4. Vérifier la recette

Ouvrir `https://<domaine-api>/api/` (réponse attendue : `{"service":"Baobab Transit API","status":"ok"}`), puis le frontend. Vérifier inscription, connexion, ouverture de l’espace client et chargement des tarifs. Le paiement affiché est une simulation, pas un encaissement réel.

Ne pas utiliser cette recette pour des données réelles. Le forfait gratuit Vercel Hobby est réservé à l’usage personnel/non commercial selon les conditions Vercel ; vérifier l’éligibilité du projet avant de le publier.
