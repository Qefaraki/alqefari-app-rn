# Phase 5 — High‑Velocity Admin Toolkit & Backend Engine

Purpose: Deliver a professional‑grade admin experience optimized for speed, safety, and clarity, enabling power users to build and manage the Alqefari family tree at scale. All UI is RTL‑first and follows an Apple‑like, neo‑native design (no glass/blur).


## 0) Scope and Non‑Goals

- In scope:
  - Backend engine upgrades: bulk creation, undo via audit log, and observable background jobs.
  - Frontend admin toolkit: Admin Mode, global FAB, System Status Indicator, Multi‑Add Children modal, Activity & Revert view.
  - Realtime feedback loops across background jobs and profile updates.
  - Security hardening for admin RPCs and auditability.
- Non‑goals:
  - AI data extraction tooling (future consideration if manual throughput is insufficient).
  - Public user features or non‑admin UX changes.
  - Non‑profile entities (media, marriages) bulk operations in this phase.


## 1) High‑Level Outcomes

- Admins can add multiple children in one operation with a single branch layout recalculation.
- Admins can revert recent actions from the audit log safely.
- Background jobs provide visible, real‑time status updates to the admin.
- The admin workflow minimizes taps, reduces repetitive actions, and displays clear feedback.


## 2) Architecture Overview

- Data Layer:
  - New table `background_jobs` tracks asynchronous tasks such as layout recalculation.
  - RPCs: `admin_bulk_create_children`, `admin_revert_action` encapsulate high‑trust, audited operations.
  - Existing `audit_log` leveraged for revert, with additional guard rails.
- Services:
  - Edge Function `recalculate-layout` writes lifecycle updates to `background_jobs`.
- Frontend:
  - Admin Mode exposes: Global FAB, System Status Indicator, Multi‑Add Children modal, Activity & Revert view.
  - Realtime subscriptions to `background_jobs` and `profiles` keep UI in sync.
- Security:
  - RPCs are `SECURITY DEFINER` and gated by admin role checks; RLS enforces read permissions.


## 3) Backend Workstream

### 3.1 Migrations

- 014_create_background_jobs.sql
  - Create table `background_jobs`:
    - `id uuid pk default gen_random_uuid()`
    - `job_type text check in ('layout_recalculation') not null`
    - `status text check in ('queued','processing','complete','failed') not null`
    - `details jsonb default '{}'::jsonb not null`
    - `created_at timestamptz default now()`
    - `started_at timestamptz`
    - `completed_at timestamptz`
  - Indexes:
    - `idx_background_jobs_recent` on `(job_type, status, created_at desc)`
  - RLS:
    - Enable RLS.
    - Policy: admins can `select`; service role can `insert/update`.

- 015_admin_bulk_create_children.sql
  - RPC: `admin_bulk_create_children(parent_id uuid, children jsonb)` → `setof profiles`
  - Behavior:
    - Validate `parent_id` exists and is not soft‑deleted (if applicable).
    - Lock existing siblings: `select ... for update` to compute `sibling_order` safely.
    - Parse `children` via `jsonb_to_recordset` and insert with `insert ... returning` inside a single transaction.
    - Create one `background_jobs` row (status `queued`) to trigger layout recalculation (async).
    - Write `audit_log` entries per inserted child.
    - Rollback entire transaction if any row fails.
  - Security:
    - `security definer`; guard with explicit admin role check.

- 016_admin_revert_action.sql
  - RPC: `admin_revert_action(audit_log_id uuid, dry_run boolean default false)` → jsonb summary
  - Behavior:
    - Fetch `audit_log` entry (action in `INSERT|UPDATE|DELETE`).
    - `UPDATE` → restore columns from `old_data`.
    - `INSERT` → soft delete target (`deleted_at = now()`).
    - `DELETE` → undelete (`deleted_at = null`).
    - Record a new `audit_log` entry with action `REVERT` and link to original id.
    - If `dry_run`, do not mutate; return diff preview.
    - Guard against reverting `REVERT` or already‑reverted entries.
  - Safety:
    - Idempotent where feasible; verify current state matches expected preconditions.

- 017_optional_audit_and_soft_delete.sql (only if needed)
  - Ensure `profiles.deleted_at` exists; add if missing with partial indexes.
  - Confirm `audit_log` has `action`, `table`, `target_profile_id`, `old_data`, `new_data`, `actor_id`, `created_at`.


### 3.2 Edge Function Wiring

- Update `supabase/functions/recalculate-layout/index.ts`:
  - On start: mark related `background_jobs` row `processing`, set `started_at`.
  - On success: set `complete`, set `completed_at`.
  - On failure: set `failed`, include error in `details`.
  - De‑duplicate jobs by parent within a short window if necessary.


### 3.3 Security and Policies

- Role checks inside RPCs (e.g., `is_admin()` helper or role assertion) to prevent misuse.
- RLS:
  - `background_jobs`: admins `select`; service role for writes.
  - `audit_log`: admins `select`; writes only via triggers/RPCs.
- Grants: only expose the `admin_*` RPCs to admin role.


### 3.4 Performance & Concurrency

- `sibling_order` race prevention via row locking.
- Bulk parse/insert using `jsonb_to_recordset` to minimize per‑row overhead.
- Single background job per batch; avoid N jobs for N children.


### 3.5 Backend Testing

- Transaction rollback test with a failing child record in the middle.
- Sibling order correctness with concurrent inserts (simulated).
- Revert tests for all 3 action types; dry‑run diff correctness.
- Background jobs lifecycle updates verified via queries and realtime.


## 4) Frontend Workstream

All UI RTL‑first and styled using new neo‑native UI components (`src/components/ui/*`, `ios/CardSurface`).

### 4.1 Admin Mode & Global UI

- Admin Mode toggle (hidden/role‑gated) reveals:
  - Global FAB: persistent "+" in Tree View bottom‑right.
    - Opens Add Person (unlinked) form when no parent selected.
  - System Status Indicator: lightweight pill/spinner subscribed to `background_jobs`.
    - Shows "Recalculating layout…" during processing; dismiss on completion/failure.

### 4.2 Multi‑Add Children Modal

- Entry: tap "+" on a node.
- UX:
  - Dynamic list of rows: name (required), gender (required), optional birth year.
  - "+ Add another child" appends rows.
  - Validation inline; duplicate‑name warning (non‑blocking).
- Submit:
  - Single RPC call to `admin_bulk_create_children(parent_id, children[])`.
  - Optimistic placeholders in Tree View (dimmed, "Queued…").
  - On failure: retract placeholders, show actionable error.
  - On success: refresh branch; System Status indicates job status.

### 4.3 Activity & Revert View

- Activity view:
  - Last 20 audit entries for profiles, readable labels (e.g., "You added …").
  - Filter by branch/root (optional).
- Revert controls:
  - Show `Revert` for eligible entries; block for `REVERT` entries.
  - Confirmation sheet provides short diff; final call to `admin_revert_action(audit_log_id)`.
  - Toast on success; refresh affected node(s) and branch.

### 4.4 Realtime & Consistency

- Subscribe to `background_jobs` for status changes.
- Subscribe to `profiles` to update tree instantly after bulk add/revert.
- Debounce redraw during job processing; redraw on completion.

### 4.5 Frontend Testing & UX Guardrails

- E2E: add 10 children, observe one background job and correct sibling order.
- E2E: revert insert/update/delete from Activity view.
- Accessibility: labels, focus management in modal/sheet, RTL verification.
- Performance: bulk add perceived < 2s; indicator latency < 500ms.


## 5) Deliverables

- Database migrations: 014–017 as specified.
- Updated Edge Function lifecycle handling.
- Admin UI components: Global FAB, System Status Indicator, Multi‑Add Children Modal, Activity & Revert View.
- API contracts documented and stable.
- Automated tests and manual test scripts.


## 6) Milestones & Timeline (indicative)

- M1 (Day 1–2): `background_jobs` migration + Edge Function lifecycle updates; realtime enabled.
- M2 (Day 3–4): `admin_bulk_create_children` RPC implemented and tested.
- M3 (Day 5–6): `admin_revert_action` RPC with dry‑run and guard rails; tests.
- M4 (Day 7–8): Admin Mode + Global FAB + System Status Indicator UI.
- M5 (Day 9–10): Multi‑Add Children modal integrated with bulk RPC; optimistic UI.
- M6 (Day 11–12): Activity & Revert view; E2E tests; perf validation.
- Buffer (Day 13–14): Hardening, docs, and sign‑off.


## 7) Acceptance Criteria

- Backend
  - `admin_bulk_create_children` creates all children atomically; correct sibling order; one background job enqueued.
  - `admin_revert_action` reverts INSERT/UPDATE/DELETE reliably; dry‑run returns diff; writes `REVERT` audit entries.
  - `background_jobs` shows accurate lifecycle status; realtime events visible to admins.
- Frontend
  - Admin Mode reveals Global FAB and System Status Indicator.
  - Multi‑Add Children modal adds 2–10 children in one API call with optimistic UI.
  - Activity view lists last 20 audit entries with functional Revert.
  - Tree updates in real‑time after operations; status indicator provides clear feedback.


## 8) Risks & Mitigations

- Race conditions on `sibling_order`: use row locks and compute in‑transaction.
- State drift on revert: validate preconditions; abort with clear errors; use dry‑run.
- Over‑recalculation noise: ensure single job per batch; de‑dupe by parent/time window.
- Policy gaps: explicit role checks inside RPCs; RLS tests; minimal grants.
- Throughput constraints: evaluate perf; if manual is slow, consider AI extraction tool next phase.


## 9) Deployment & Runbook

- Staging first:
  - Apply migrations 014–016 (and 017 if needed).
  - Verify Edge Function updates.
  - Seed a test parent; run bulk add of 10 children; confirm one job.
  - Exercise revert flows on sample audit entries.
- Production rollout:
  - Feature‑flag Admin Mode to admins only.
  - Monitor `background_jobs` for failure spikes; capture `details.error`.
- Incident handling:
  - If layout job fails: inspect `background_jobs.details.error`, rerun layout for parent.
  - If revert misapplies: run revert of revert or apply corrective update; document in audit log.


## 10) API Contracts (Concise)

- rpc.admin_bulk_create_children
  - Request: `{ parent_id: uuid, children: Array<{ name: string, gender: 'M'|'F', birth_year?: number, notes?: string }> }`
  - Response: `{ children: Array<{ id: uuid, name: string, gender: string, sibling_order: number, parent_id: uuid }>, job_id: uuid }`
- rpc.admin_revert_action
  - Request: `{ audit_log_id: uuid, dry_run?: boolean }`
  - Response: `{ reverted: boolean, summary: { action: string, target_profile_id: uuid, fields_restored?: string[] }, error?: string }`
- background_jobs realtime
  - Filter: `job_type='layout_recalculation'` scoped by parent/root context.


## 11) Testing Matrix

- Backend unit/integration:
  - Bulk insert happy path; rollback on invalid row; sibling order with concurrency.
  - Revert for INSERT/UPDATE/DELETE; idempotency; dry‑run.
  - Job lifecycle updates; realtime visibility for admin role.
- Frontend E2E:
  - Multi‑Add 10 children; single job observed; tree reflects new nodes.
  - Activity view shows readable entries; revert works; UI updates.
  - RTL layout and neo‑native style consistency.


## 12) Ownership & Communication

- DRIs:
  - Backend (migrations + RPCs + Edge Function): Backend engineer
  - Frontend (Admin UI + flows + realtime): Frontend engineer
  - QA and sign‑off: PM/Lead
- Standups focus on milestone gates (M1–M6) and blockers.


## 13) Sign‑off Checklist

- [ ] Migrations 014–016 applied and verified (017 if needed)
- [ ] Edge Function writes `background_jobs` lifecycle correctly
- [ ] Bulk add RPC ships with tests and docs
- [ ] Revert RPC ships with dry‑run, guard rails, tests, and docs
- [ ] Admin Mode with Global FAB and Status Indicator
- [ ] Multi‑Add Children modal integrated and validated
- [ ] Activity & Revert view functional with confirmations
- [ ] Realtime updates for jobs and profiles verified
- [ ] Performance targets met; accessibility checks done
- [ ] Runbook and troubleshooting notes documented


—
This roadmap is definitive for Phase 5 and is intended to be implementation‑ready. All UI must be RTL‑first and follow the Apple‑like, neo‑native aesthetic consistent with the new UI components (no glass/blur).
