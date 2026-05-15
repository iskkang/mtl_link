# FESCO Sync Critical Guardrails — DO NOT BREAK

These rules are non-negotiable.

## Frozen working state

The current FESCO sync is working and must be preserved.

Confirmed working result:

```json
{"ok":true,"fetched":421,"total":421,"updated":421,"durationMs":73337}
```

## Absolute rules

- Do NOT repeatedly run `/api/fesco/sync`.
- A sync test against FESCO must only be run when explicitly requested.
- Do not run sync casually after unrelated changes.
- Do not run multiple sync tests in a row.
- FESCO access is sensitive and excessive login/order requests may cause rate-limit, blocking, or account problems.

---

- Do NOT modify `api/fesco/auth.ts` unless the user explicitly says:
  - `"Modify FESCO auth.ts"` or
  - `"Change FESCO login logic"`.

- Do NOT add `User-Agent` to the FESCO login POST request.
  This broke login before.
  The working login POST headers are only:
  - `Content-Type`
  - `Accept`
  - `X-Lk-Lang`

- Login endpoint: `POST https://my.fesco.com/api/v2/lk/user/login`

- Login body shape must remain:
  - `usernameOrEmail`
  - `password`
  - `safeDevice`
  - `personalData`
  - `sessionId`
  - `browser`

---

- Do NOT remove `User-Agent` from the FESCO orders GET request.
  Orders fetch works with:
  - `Authorization: Bearer <token>`
  - `X-Lk-Lang`
  - `User-Agent`

- Login POST and Orders GET intentionally use different header behavior.
  Do not "clean up" or unify them.

---

- Do NOT replace `undiciFetch` with native fetch.

- Do NOT change the FESCO Agent timeout settings unless explicitly requested.
  Current stable Agent settings:

  ```ts
  const fescoHttpAgent = new Agent({
    connectTimeout: 45000,
    headersTimeout: 120000,
    bodyTimeout:    120000,
  })
  ```

- Do NOT change FESCO pagination unless explicitly requested.
  - Page size remains unchanged.
  - Sequential request flow must remain.
  - Do not introduce parallel fetching.
  - Do not reduce delay aggressively.

- Do NOT change Supabase upsert logic for FESCO orders unless explicitly requested.

---

- Do NOT let the frontend call `my.fesco.com` directly.
- Do NOT let UI Refresh call `/api/fesco/sync`.
- UI Refresh must only refetch Supabase-backed data through `/api/fesco/orders`.
- Detail panel must use internal API/Supabase-backed data only.

---

- Do NOT run:
  ```
  vercel env pull .env.local
  ```
  This previously overwrote the local `.env.local` and caused environment loss.

  If Vercel env pull is ever needed, only do:
  ```
  vercel env pull .env.from-vercel
  ```
  Then compare manually. Never overwrite `.env.local`.

- Do NOT commit `.env.local`, `.env.local.backup`, `.env.recovered`, `.env.from-vercel`, or any secret file.

- Ensure `.gitignore` includes:
  ```
  .env
  .env.*
  !.env.example
  ```

---

- Do NOT log secrets. Never log:
  - FESCO password
  - FESCO JWT token
  - Supabase service role key
  - `CRON_SECRET`
  - raw auth response
  - full FESCO order payloads

---

- Production `/api/fesco/sync` must remain protected by `CRON_SECRET`.
- Local development may bypass the guard only if intentionally coded for local testing.
- Production must not allow ordinary users or random external requests to trigger sync.

---

- Atomic DB lock must remain intact.
- Only one active FESCO sync may run at a time.
- If another sync is running, return:
  ```json
  { "ok": false, "error": "sync already running" }
  ```
- Do not remove the DB-level lock/index/RPC unless explicitly requested.

---

## Before making any future change

Before editing any FESCO-related file, you must check whether the change violates any rule above.

FESCO-related files include at minimum:

- `api/fesco/auth.ts`
- `api/fesco/sync.ts`
- `api/fesco/orders.ts`
- `api/fesco/order.ts`
- `src/components/tracking/FescoTrackingPage.tsx`
- FESCO-related Supabase migrations
- Vercel cron configuration

If a requested change might touch these rules, stop and explicitly warn the user before editing.
