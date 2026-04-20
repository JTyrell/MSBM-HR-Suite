

# MSBM-HR Suite: Jamaica Compliance + Sling-Style Workforce Management — Integration Plan

This is an extensive feature set touching every layer of the application. Below is the full audit, gap analysis, and phased integration plan.

---

## Build Errors (Immediate Fix)

Two TypeScript errors in edge functions where `error` is typed as `unknown`:
- `supabase/functions/calculate-payroll/index.ts:135` — change `error.message` to `(error as Error).message`
- `supabase/functions/validate-geofence/index.ts:152` — same fix

These will be fixed first before any feature work.

---

## Audit and Comparison Table

| Feature | Current Status | Required Status | Integration Approach |
|---------|---------------|-----------------|---------------------|
| **Employee profiles** | ✅ Basic profiles (name, email, pay_rate, pay_type, department, job_title) | TRN, NIS, NHT, PAYE code, contract_type, role_tier, grade_step, reporting_chain | Add nullable columns to `profiles` via migration |
| **RBAC roles** | ✅ 3 roles: admin, hr_manager, employee | 9+ university tiers: ancillary, maintenance, admin, ict_tech, ict_sysadmin, ict_mgmt, faculty, executive, hr | Extend `app_role` enum + add `role_tiers` table for scoped permissions |
| **Department-scoped RLS** | ⚠️ Admin/HR see all, employees see own | Department-scoped visibility for managers | New RLS policies using department_id matching |
| **Payroll calculation** | ✅ Basic: hours × rate, flat 22% tax, 5% benefits | JA statutory: NIS, NHT, Education Tax, PAYE with rate ceilings, retroactive adjustments | New `statutory_rates` table + rewrite `calculate-payroll` edge function |
| **Statutory rate management** | ❌ Hardcoded rates | Date-stamped rates in DB with effective_from/expires_on | New `statutory_rates` table |
| **Geofenced clock-in/out** | ✅ Mapbox + Haversine validation | + Offline mode, break compliance, max shift enforcement | Extend ClockInOut with offline queue + break tracking |
| **Attendance records** | ✅ Basic clock-in/out with GPS | + Break tracking, timesheet approval workflow, manager sign-off | Add `break_records` table, approval status fields |
| **Shift scheduling** | ❌ Not built | Drag-and-drop shift builder, templates, conflict detection, swap requests | New tables: `shifts`, `shift_templates`, `shift_swaps`, `availabilities` + ShiftBoard UI |
| **Time-off / PTO** | ❌ Not built | Time-off requests, allowance tracking, JA statutory minimums, carryover | New `time_off_requests`, `pto_allowances` tables + approval workflow |
| **Team messaging** | ❌ Not built | Realtime group/private messaging, newsfeed, task assignments | New `messages`, `channels`, `tasks` tables + Supabase Realtime |
| **Labor reporting** | ❌ Not built | Daily/weekly/monthly hours, overtime, cost by department, forecasting | New reporting page + Edge Function for aggregation |
| **Export (MyHR+/HRplus)** | ❌ Not built | CSV/XLSX remittance exports matching JA formats | New Edge Function: `export-ja-remittance` |
| **Audit logging** | ✅ Basic audit_logs table with CRM logging | Row-level change tracking for all HR + scheduling actions | Add DB triggers for automatic audit logging |
| **Mapbox staff visualization** | ⚠️ Clock-in map only | Staff location dashboard with privacy controls | New admin map view with opt-in location display |
| **Feature flags** | ❌ Not built | `enabled_ja_compliance`, `enabled_workforce_mgmt` | New `feature_flags` config table |
| **Approval workflows** | ❌ Not built | SLA tracking, escalation, multi-level approvals | New `approval_requests` table with status tracking |
| **Push notifications** | ❌ Not built | Schedule updates, shift changes, approvals | Edge Function + web push API |
| **Offline time clock** | ❌ Not built | Sync-on-reconnect with conflict resolution | Service worker + IndexedDB queue |
| **Data protection (JA DPA 2020)** | ❌ Not built | Retention policies, field-level audit, export controls | Policy enforcement via RLS + config table |

---

## Gap Analysis

### ✅ Already Built
- Employee profiles with basic fields (`src/pages/Employees.tsx`, `src/pages/CRM.tsx`)
- RBAC with 3 roles + `has_role()` / `is_admin_or_hr()` security functions
- Geofenced clock-in/out with Mapbox (`src/pages/ClockInOut.tsx`)
- Attendance records with GPS logging (`src/pages/Attendance.tsx`)
- Basic payroll engine with edge function (`supabase/functions/calculate-payroll/`)
- Geofence validation edge function (`supabase/functions/validate-geofence/`)
- Audit logs table + CRM logging (`src/pages/CRM.tsx`)
- Department management (`departments` table + CRM UI)
- Pay periods and payroll records
- Dashboard with stats (`src/pages/Dashboard.tsx`)

### ⚠️ Partially Implemented
- **RBAC**: 3 roles exist but need 9+ university tiers — extend `app_role` enum, add `role_tiers` table
- **Payroll**: Calculation exists but uses hardcoded rates — needs statutory rate table + JA formula engine
- **Audit logging**: Table exists but no DB triggers for automatic row-change capture
- **Mapbox**: Used for clock-in only — needs admin staff location view

### ❌ Entirely Missing
- **Jamaican statutory fields** on profiles (TRN, NIS, NHT, PAYE code, contract_type, grade_step)
- **Statutory rates table** with date-stamped rates
- **Shift scheduling** (tables: `shifts`, `shift_templates`, `shift_swaps`, `scheduling_rules`)
- **Staff availability** (`availabilities` table)
- **Time entries / timesheets** (`time_entries` table with approval workflow)
- **Break tracking** (`break_records` table)
- **Time-off / PTO management** (`time_off_requests`, `pto_allowances` tables)
- **Team messaging** (`channels`, `messages`, `tasks` tables + Realtime)
- **Labor reporting dashboard** (new page + aggregation queries)
- **Export engine** for MyHR+/HRplus remittance + Sling timesheet formats
- **Feature flags** config table
- **Approval workflow engine** (`approval_requests` table)
- **Offline time clock** (service worker + IndexedDB)
- **Push notifications**
- **Jamaica DPA compliance** (retention policies, export controls)
- **UI pages**: ShiftBoard, Messaging, TimeOff, Reports, StaffMap

---

## Integration Plan (Phased)

### Phase 1: Foundation — Schema, Flags, and Build Fix (Week 1)

**Step 1a**: Fix build errors in edge functions (cast `error` to `Error`).

**Step 1b**: Database migration — add JA compliance fields to `profiles`:
```
trn, nis_number, nht_number, paye_tax_code, contract_type,
role_tier, grade_step, reporting_manager_id
```
All nullable for backward compatibility.

**Step 1c**: New tables via migration:
- `feature_flags` — key/value config with `enabled_ja_compliance`, `enabled_workforce_mgmt`
- `statutory_rates` — rate_type, rate_value, effective_from, expires_on, ceiling_amount
- `shifts` — employee_id, start_time, end_time, department_id, status, recurring_template_id
- `shift_templates` — name, department_id, pattern (JSONB), recurrence_rule
- `shift_swaps` — requester_id, target_id, shift_id, status, approved_by
- `availabilities` — employee_id, day_of_week, start_time, end_time, is_available
- `time_entries` — employee_id, shift_id, clock_in, clock_out, break_minutes, status, approved_by
- `break_records` — time_entry_id, start, end, type
- `time_off_requests` — employee_id, type, start_date, end_date, status, approved_by
- `pto_allowances` — employee_id, year, total_days, used_days, carryover_days
- `channels` — name, type (group/private), department_id
- `channel_members` — channel_id, user_id
- `messages` — channel_id, sender_id, content, created_at (Realtime-enabled)
- `tasks` — assignee_id, shift_id, title, completed, due_date
- `approval_requests` — type, requester_id, approver_id, status, sla_deadline, escalation_path

**Step 1d**: RLS policies on all new tables scoped by role/department. Enable Realtime on `messages` and `shifts`.

**Step 1e**: Extend `app_role` enum to include university tiers OR create separate `role_tiers` table (recommended to avoid breaking existing enum references).

### Phase 2: Statutory Engine + Validation (Week 2)

- Zod schemas for JA field validation (TRN: 9 digits, NIS: XX-XXXXXX-X, PAYE: A-E)
- New Edge Function: `calculate-ja-statutory` — looks up rates from `statutory_rates`, calculates NIS/NHT/EdTax/PAYE with ceiling logic
- Update `calculate-payroll` to call statutory engine when `enabled_ja_compliance` flag is on
- Retroactive pay adjustment support via `statutory_rates` history
- Employee form updates gated behind feature flag

### Phase 3: Scheduling Engine (Week 3)

- New page: `src/pages/Scheduling.tsx` — shift board with weekly/daily views
- Drag-and-drop shift creation using existing shadcn/ui components
- Conflict detection Edge Function: `evaluate-scheduling-conflicts` (overtime >40hrs, double-booking, budget)
- Shift swap request workflow with manager approval
- Recurring shift templates for departments
- Availability management UI
- Route added to `App.tsx`, sidebar nav updated

### Phase 4: Time Tracking + Approvals (Week 4)

- Enhanced time entries with break tracking
- Timesheet approval workflow (submit → manager review → approve/reject)
- Break compliance rules (JA labor law: configurable via `statutory_rates`)
- Max shift length enforcement
- Time-off request and PTO management pages
- Audit triggers on all scheduling/time tables

### Phase 5: Communication + Reporting (Week 5)

- Team messaging with Supabase Realtime channels
- Department/role-scoped message channels
- Newsfeed for announcements
- Task assignment linked to shifts
- Labor reporting dashboard: hours, overtime, cost by department
- Export Edge Functions: `export-ja-remittance` (CSV/XLSX), `export-timesheets`
- Budget guardrails with department allocation alerts

### Phase 6: Maps, Mobile, Rollout (Week 6)

- Admin staff location map (Mapbox) with privacy opt-in
- Offline time clock using service worker + IndexedDB with sync-on-reconnect
- PWA manifest for mobile experience
- Shadow mode: run new calculations alongside existing, log diffs
- Rollback via feature flag toggles
- Jamaica DPA compliance: data retention config, export controls

---

## Rollback Strategy

- All new features gated behind `feature_flags` table entries
- New DB columns are nullable — no impact on existing queries
- Edge Functions are versioned — old versions remain deployed until explicitly replaced
- RLS policies are additive — existing policies untouched, new ones layered on top
- Migration files include comments for manual reversal if needed

---

## Testing Checklist

- TRN/NIS format validation (Zod edge cases)
- Statutory rate ceiling + retroactive logic in Edge Function
- Scheduling conflict detection: overtime, double-booking, budget
- RLS policy isolation for scheduling data (department-scoped)
- Export field mapping against MyHR+ spec
- Audit trail immutability (trigger + RLS on audit_logs)
- Jamaica DPA data retention auto-purge
- Mapbox geofencing opt-in flow
- Offline time clock sync conflict resolution
- Realtime messaging delivery

---

## Recommended Starting Point

Given the scope, I recommend starting with **Phase 1** (schema + flags + build fix) to establish the foundation. This is non-destructive and enables all subsequent phases. Shall I proceed with Phase 1?

