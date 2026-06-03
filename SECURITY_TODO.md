# Security & Session Hardening — Post-Release TODO

Audit date: 2026-06-03. Status: **app is functional; these harden permissive behavior.**
None of these block go-live. All are **logic-only — no `prisma db push` / no DB migration.**
Recommended approach: fix on a `security-hardening` branch after go-live, test, then merge.

---

## 🔴 CRITICAL

### C1. Token does not honor deactivation / role changes
- **File:** `backend/src/auth/strategies/jwt.strategy.ts:24-32`
- **Problem:** `validate()` trusts the JWT payload with no DB lookup. A deactivated
  (`status=INACTIVE`), soft-deleted (`deletedAt`), or role-changed user keeps their
  old access until the token expires (up to 12h). Demotions don't take effect until
  re-login.
- **Fix:** In `validate()`, look up the user; reject if `status !== 'ACTIVE'` or
  `deletedAt != null`; use the **live** `role` from DB instead of the token's role.
  Preserve all existing payload fields (userId, username, role, businessId, counterId).
- **Blast radius:** HIGH — runs on every authenticated request. Test that valid users
  stay logged in and latency is acceptable.

### C2. POS controller has no role enforcement
- **File:** `backend/src/pos/pos.controller.ts:25` (only `JwtAuthGuard`, no `RolesGuard`)
- **Problem:** Any authenticated user (incl. CASHIER, VIEWER) can call:
  - `POST /pos/bills/:id/void` (line ~158) — **cash-theft vector** (void a paid sale, pocket cash)
  - `POST /pos/credit-notes` (line ~175) — issue refunds
  - `PUT /pos/shifts/:id/force-close` (line 64) — close another cashier's shift
  - `POST /pos/counters` (line 32) — create counters
  - Historical bill create/delete already have manual role checks (lines 230, 239, 262).
- **Fix:** Add `RolesGuard` and apply `@Roles('SUPER_ADMIN','BRANCH_MANAGER')` **per-method**
  on the sensitive endpoints only. **Do NOT** put `@Roles` at controller level — that would
  block `createBill`/`getBills` and break POS entirely.
- **BUSINESS DECISION NEEDED:** Who may void a bill? In a single-person shop the owner may
  ring sales under a cashier account. Decide before implementing.
- **Blast radius:** HIGH if misapplied. Behavioral change: cashiers lose void/refund.

---

## 🟠 HIGH — Shift / multi-terminal integrity

### H1. Bill not validated against the cashier's own shift / counter
- **File:** `backend/src/pos/pos.service.ts:296-299` (and shift increment at line 632)
- **Problem:** `createBill` loads the shift by client-supplied `dto.shiftId` with only
  `status:'OPEN'`. It does not check `shift.cashierId === userId` or
  `shift.counterId === dto.counterId`. Sales can be posted against another cashier's
  shift, corrupting cash reconciliation.
- **Fix:** Resolve the shift server-side from `userId` (ignore client `shiftId`), OR assert
  `shift.cashierId === userId && shift.counterId === dto.counterId`.
- **Note:** Must fix H3 at the same time, or strict checks will reject valid multi-counter sales.

### H2. Multiple open shifts allowed on the same counter
- **File:** `backend/src/pos/pos.service.ts:108-128`
- **Problem:** `openShift` only checks the cashier, not the counter. Two cashiers can open
  shifts on one counter; `getCounters` (`take:1`, line 96-100) hides the second. Breaks
  cash-drawer reconciliation on multi-terminal setups.
- **Fix:** Enforce one open shift per counter — reject if the counter already has an OPEN shift.

### H3. "Resume shift" ignores the counter
- **File:** `backend/src/pos/pos.service.ts:119-128`
- **Problem:** A cashier with an open shift on Counter A who opens a shift at Counter B's
  terminal gets Counter A's shift back, then bills on B → counterId/shift mismatch.
- **Fix:** Match resume to the requested counter, or reject resume on a different counter.

---

## 🟡 MEDIUM

### M1. No single-session enforcement
- Stateless JWT; same login works on unlimited terminals. Combined with H2/H3 causes
  confusing shared-shift behavior. Shift totals use atomic `increment` so no lost updates.

### M2. Silent refresh cannot refresh an expired token
- **File:** `frontend/src/lib/api.ts` (`silentRefresh`) + `backend/.../jwt.strategy.ts:20`
- `/auth/refresh` is behind `JwtAuthGuard` with `ignoreExpiration:false`, so an expired
  token can't be refreshed — user is logged out. For true sliding sessions, add a separate
  long-lived refresh token not gated by the access-token guard.

### M3. No inactivity / idle auto-logout
- 12h token in `localStorage`; unattended terminals stay logged in. Consider a lock screen
  using the existing `auth/verify-pin` endpoint.

### M4. Audit trail stores username where full name is expected
- **File:** `backend/src/users/users.controller.ts:40, 48, 57`
- Passes `fullName: req.user.username` (JWT has no fullName), so `createdByName` /
  `updatedByName` record the username. Cosmetic; weakens audit trail.

### M5. Client-side route gating only (no `middleware.ts`)
- **File:** `frontend/src/app/dashboard/layout.tsx:30`
- Menus hidden for cashiers, but pages still load on direct URL. Data is protected by
  backend `RolesGuard` — **except the POS endpoints in C2.** So C2 matters doubly.

---

## ✅ Already correct (do not "fix")
- Role escalation blocked — `create-user.dto.ts` / `update-user.dto.ts` whitelist roles and
  exclude `SUPER_ADMIN`.
- `toggleActive` blocks deactivating self and the owner (`users.service.ts:143-151`).
- Cost price role-gated via `canViewCost(role)` (`products.service.ts:728-770`).
- Multi-tenancy airtight — `businessId` always from JWT, never request body.
- 11/12 controllers use `RolesGuard` (POS is the lone gap → C2).
- PINs/passwords argon2id-hashed, never returned.
- Shift totals use atomic `increment`.

---

## Separate (already discussed) — secret hygiene
- JWT secret is predictable AND was committed in history (commit `50a267f`). After release:
  rotate `JWT_SECRET` (forces one re-login) and purge `.env` from git history
  (`git filter-repo`) before the repo leaves this machine. `.env` is now untracked (commit `3fa3c7f`).

---

## Suggested test plan for the hardening branch
1. Log in as a cashier → normal billing still works (createBill, getBills).
2. Confirm void / force-close now return 403 for cashier, work for manager.
3. Deactivate a test user → their next request logs them out (C1).
4. Change a test user's role → new role applies without re-login (C1).
5. Multi-counter: open shift A, try opening on counter B → behaves per H2/H3 decision.
