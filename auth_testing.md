# Auth testing — Baobab Cargo

Auth backends: custom JWT (email/password) + Emergent Google sign-in.
Unified `get_current_user` accepts EITHER a JWT access token OR an Emergent `session_token`,
provided via `Authorization: Bearer <token>` or the `session_token` cookie.

Collections: `auth_users` (email, password_hash, provider), `profiles` (_id == auth user id),
`user_roles` (separate, {user_id, role}), `user_sessions` (Emergent Google), `login_attempts`.

## Seeded accounts
- ADMIN: bachabi.bassam@gmail.com / Admin#Baobab2026
- OPERATOR: operator@baobabcargo.app / Operator#2026
- CLIENT: awa@example.com / Client#2026 (has 1 EXPECTED package)
- CLIENT: koffi@example.com / Client#2026 (no packages)

## API smoke test (email/password JWT)
```
API=https://europe-benin-log.preview.emergentagent.com
TOKEN=$(curl -s -X POST $API/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"awa@example.com","password":"Client#2026"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s $API/api/auth/me -H "Authorization: Bearer $TOKEN"
curl -s $API/api/me/packages -H "Authorization: Bearer $TOKEN"          # awa sees 1 package
curl -s $API/api/me/forwarding-address -H "Authorization: Bearer $TOKEN" # CLB-XXXXXX
```

## Isolation checks
- Login as koffi -> GET /api/me/packages returns [] (does NOT see awa's package).
- CLIENT calling /api/admin/* -> 403.
- OPERATOR calling /api/admin/payments or /api/admin/cost-records -> 403.
- OPERATOR calling /api/admin/packages -> 200.

## Status transitions (server-only)
- POST /api/admin/packages/{id}/transition {to_status,reason} — only allowed transitions succeed (else 409),
  writes to status_history. Illegal e.g. EXPECTED -> DELIVERED must 409.

## Google (Emergent) flow
- Frontend redirects to https://auth.emergentagent.com/?redirect=<origin>/client
- Returns to <origin>/client#session_id=... ; frontend POSTs {session_id} to /api/auth/google/session
- Backend calls Emergent session-data, upserts user (CLIENT + forwarding address on first login),
  stores user_sessions doc, sets session_token cookie, returns {session_token, user}.
- To simulate without real Google: insert an auth_users + user_sessions doc and call /api/auth/me with the session_token.
