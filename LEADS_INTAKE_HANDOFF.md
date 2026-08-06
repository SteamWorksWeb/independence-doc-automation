# Leads Intake/Admin Handoff

Session date: 2026-08-06
Workspace: Independence Law FRONTEND
Workspace marker: `INDEPENDENCE-LAW-FRONTEND`
Current frontend branch at time of writing: `fix/leads-intake-save-snapshot-upsert`

This file is a recovery/handoff note for continuing the Leads intake/admin work if the AI session or credits run out.

## Latest Update: Phase 1 Complete

Phase 1 is now deployed and manually verified in production.

Backend:

- Backend branch `fix/leads-intake-save-snapshot-upsert` was merged/deployed first.
- Backend commit reported by backend agent: `62ef61927965caa4a054c29ccde4693e722aa256 Fix admin snapshot save for leads`.
- Backend route changed: `PATCH /api/v1/admin/clients/:id/snapshot`.
- New backend behavior:
  - Finds client by `:id`.
  - Uses existing normalized snapshot data.
  - Updates latest `DischargeSnapshot` if present.
  - Creates first `DischargeSnapshot` if missing.
  - Preserves status/verdict recalculation.
  - Returns `200 { snapshot }`.
- Backend verification reported:
  - `npm run lint` passed.
  - `npm run build` passed.
  - No pending migrations.
  - Manual API test for client `2c079ae9-f8be-4bdb-9ce8-bd9bb9c5bcfd` created snapshot `aeacbf2b-ebdb-42c5-a679-7d39df7ce818`, then a second PATCH updated the same snapshot without duplication.

Frontend:

- Frontend branch `fix/leads-intake-save-snapshot-upsert` was fast-forward merged into `main`.
- Frontend `main` was pushed and deployed.
- Frontend deployed commit: `cf3539a Prepare frontend leads intake save fixes`.
- Frontend verification before merge:
  - `npx tsc --noEmit` passed.
  - `npm run build` passed.

Production manual verification:

- `/admin/leads` still shows the old Leads UX: filters, `Manage` button, modal actions, and `DischargeSnapshotsTable`.
- Manage modal opens for `Test Account`.
- Edit page opens at `/admin/leads/2c079ae9-f8be-4bdb-9ce8-bd9bb9c5bcfd/edit`.
- Save now succeeds.
- Reopening/hydration shows saved values persisted.
- Example persisted values seen after save:
  - First Name: `Test`
  - Last Name: `Account`
  - Email: `support@steamworks.io`
  - Phone: `888-888-8888`
  - Federal Student Loans: `Yes`
  - Outstanding Principal Balance: `10000`
  - Household Size: `3`
  - Monthly Gross Income: `4300`
  - Monthly Take-Home Pay: `1000`
  - Scoreboard recalculated to `Borderline`.

Remaining follow-up:

- If a separate completed snapshot/client exists, still test that existing snapshot save path works normally.
- Next likely task is Phase 2: partial intake persistence before final submit.
- Do not replace the restored Leads UX while working on Phase 2.

## Current Goal

Restore and preserve the original Admin Leads workflow while fixing admin edit hydration/save behavior.

The intended lifecycle is:

1. Invite is sent: user remains a pending invite.
2. User opens tokenized email and creates a password: user becomes a `LEAD` in the admin dashboard, even if intake is blank.
3. As the lead fills intake, partial progress should eventually persist and hydrate into admin views.
4. Final intake submit may create/complete a `DischargeSnapshot`, but admin visibility should not depend on final submit.
5. Admin should be able to edit/save available lead intake/snapshot data.

## Current Frontend State

Recent frontend commits on the working line:

- `740dc82 Fallback profile save when snapshot is missing`
- `89ff882 Support lead API data in restored leads page`
- `4ad3a22 Restore leads snapshot management page`
- `76de6a7 fix(snapshot-proxy): read borrower_session before client_token; add email to payload`
- `7dcf118 feat(onboarding): add AuthSidebar branding, thank-you screen, Go to My Portal button`
- `b55a683 fix(intake): restore redirect to OnboardingPage after password setup - correct 7-step discharge snapshot form`
- `564ac70 feat: Lead/Client separation - new LeadsTable component with Promote to Client action`

Important: `564ac70` is the commit where the Leads page went off the rails visually/functionally. It introduced/used `LeadsTable` with simplified direct actions and removed/bypassed the old filter + Manage modal workflow.

## What Was Restored Today

The old `/admin/leads` UX was restored:

- Uses `DischargeSnapshotsTable`
- Has status filters
- Has the `Manage` button
- Has modal actions
- Shows lead row again

Relevant commits:

- `4ad3a22 Restore leads snapshot management page`
  - Restored `/admin/leads/page.tsx` to use `DischargeSnapshotsTable`.

- `89ff882 Support lead API data in restored leads page`
  - Added support for backend `{ leads: [...] }` response as well as old `{ snapshots: [...] }`.
  - Added `mapLead()` so `LEAD` client records can be displayed in the old snapshot table shape.

- `740dc82 Fallback profile save when snapshot is missing`
  - Added a frontend proxy fallback when backend snapshot save returns "snapshot not found".
  - This fallback is likely dead/wrong because backend `PATCH /admin/clients/:id/profile` does not exist.

## Morning Fixes That Must Be Preserved

These were valuable and should not be undone:

- `e0dba85 fix(data-boundary): correct admin edit payload to match backend PATCH contract`
  - Payload key `additionalMonthlyIncome` became `additionalIncome`.
  - Payload key `unemployed5Years` became `unemployed5PlusYears`.
  - `hasFederalLoans` is normalized to `"yes" | "no" | "unsure"` rather than boolean.

- `21b659c fix(frontend): principal balance hydration, good faith UI, and field ordering`
  - Hydration prioritizes `principalBalance`.
  - Hydration prioritizes `additionalIncome`.

- `4b0bce5 fix(frontend): registration simplification, currency stripping, phone formatting`
  - Phone formatting added to admin edit page.

- `a264c21 Harden admin snapshot edit hydration`
  - Hydration searches nested objects and arrays more robustly.

- `3e535a9 Fix lead delete and snapshot edit page state`
  - Added `extractSnapshotData()`.
  - Improved hydration from nested `snapshot`, `dischargeSnapshot`, `intakeSnapshot`, and related structures.

## Current Broken Behavior

Known failing flow:

1. Go to `/admin/leads`.
2. Lead appears.
3. Click `Manage`.
4. Click `Edit Snapshot`.
5. Browser opens:
   `/admin/leads/2c079ae9-f8be-4bdb-9ce8-bd9bb9c5bcfd/edit`
6. Edit page hydrates some/basic data.
7. Clicking Save sends:
   `PATCH /api/admin/clients/2c079ae9-f8be-4bdb-9ce8-bd9bb9c5bcfd/profile`
8. Response is:
   `404 Not found`

Frontend edit page currently calls the browser-facing route:

```txt
GET   /api/admin/clients/:id/profile
PATCH /api/admin/clients/:id/profile
```

Frontend proxy file:

```txt
src/app/api/admin/clients/[id]/profile/route.ts
```

That proxy currently forwards PATCH/PUT to backend:

```txt
PATCH /api/v1/admin/clients/:id/snapshot
```

Then, if "snapshot not found", it tries backend:

```txt
PATCH /api/v1/admin/clients/:id/profile
```

AG 2.0 reported backend `PATCH /admin/clients/:id/profile` does not exist, so that fallback returns plain `Not found`.

## AG 2.0 / Sonnet Investigation Summary

AG 2.0 reported:

- Password setup/token flow creates a `Client` with `userType = LEAD`.
- The edit URL ID appears to be the correct `Client.id`.
- `GET /admin/clients/:id/profile` works because backend profile GET can return profile data for the client/lead.
- `PATCH /admin/clients/:id/snapshot` expects client ID and updates an existing `DischargeSnapshot`.
- If no `DischargeSnapshot` exists, backend returns `Discharge snapshot not found`.
- Backend `PATCH /admin/clients/:id/profile` does not exist.
- Borrower intake wizard currently persists only limited/basic data before final submit.
- Steps 2-7 may be React state only until final submit.
- `unemployed5of10` is a backend/DB field that frontend hydration currently does not check.

Important unresolved nuance:

The user expects partial intake data to persist and hydrate into admin before final submit. If Steps 2-7 are not persisted today, that is a larger Phase 2 design/data-model issue and should not be mixed into the immediate save fix.

## Recommended Phase 1

Do only these small, targeted changes first.

### Fix 1: Backend snapshot upsert

Backend file likely:

```txt
backend/src/routes/admin.ts
```

Backend route:

```txt
PATCH /admin/clients/:id/snapshot
```

Required behavior:

- Keep route path unchanged.
- Keep ID type unchanged: `:id` should remain client ID.
- Keep existing client lookup.
- Keep existing request body normalization.
- If a latest `DischargeSnapshot` exists for `clientId`, update it exactly as today.
- If no snapshot exists, create one for that `clientId` using the same normalized data object the update path uses.
- Return the same response shape as the existing update path.
- Do not add schema migration in Phase 1 unless absolutely required.

### Fix 2: Frontend proxy cleanup

Frontend file:

```txt
src/app/api/admin/clients/[id]/profile/route.ts
```

Required behavior:

- Remove dead fallback to backend `PATCH /admin/clients/:id/profile`.
- Keep browser-facing route path unchanged for now:
  `PATCH /api/admin/clients/:id/profile`
- Keep proxying PATCH/PUT to backend:
  `/admin/clients/:id/snapshot`
- Preserve auth/cookie behavior.
- Preserve JSON handling.

### Fix 3: Hydration alias

Frontend file:

```txt
src/app/admin/leads/[id]/edit/page.tsx
```

Add `unemployed5of10` to the hydration aliases for the existing admin edit form field:

```txt
unemployed5Years
```

Do not change the save payload key unless proven necessary. Current payload intentionally sends:

```txt
unemployed5PlusYears
```

## Do Not Touch In Phase 1

- `/admin/leads` layout
- `src/components/admin/DischargeSnapshotsTable.tsx`
- `src/components/admin/LeadsTable.tsx`
- intake wizard autosave
- setup-password lifecycle
- invite lifecycle
- Prisma schema/migrations
- unrelated styles/navigation/routes

## Recommended Phase 2

After Phase 1 stabilizes save behavior, design and implement partial intake persistence.

Questions for Phase 2:

- Are Steps 2-7 currently persisted before final submit?
- If not, where should draft intake data live?
  - expanded `IntakeProfile`
  - draft JSON column/table
  - early/incomplete `DischargeSnapshot`
- Should admin edit save update `IntakeProfile`, `DischargeSnapshot`, or both?
- Should admin lead/client profile hydrate from draft intake, final snapshot, or a merged profile object?

This is larger and should not be bundled with the immediate save fix.

## Branch/Safety Plan

Work should happen on branch:

```txt
fix/leads-intake-save-snapshot-upsert
```

Use this branch in both frontend and backend.

Rules:

- Do not commit to `main`.
- Do not push to `main`.
- Stop if either repo has unexpected uncommitted changes.
- Prefer separate commits:
  1. backend snapshot upsert
  2. frontend proxy cleanup + hydration alias

## Test Plan

After Phase 1:

1. Backend build/typecheck/tests pass.
2. Frontend `npx tsc --noEmit` passes.
3. Frontend production build passes if feasible.
4. `/admin/leads` still shows old filters + Manage button + modal.
5. Test lead still appears.
6. Manage -> Edit Snapshot opens with client UUID:
   `2c079ae9-f8be-4bdb-9ce8-bd9bb9c5bcfd`
7. Change a harmless value, such as principal balance.
8. Save succeeds.
9. Reopen edit page and confirm value persisted.
10. Existing completed snapshot/client still saves normally.
11. No direct Promote/Delete-only layout replaces old UX.

## Security Note

An `admin_session` cookie appeared in a screenshot during debugging. After this stabilizes, log out and log back in to rotate the session.


