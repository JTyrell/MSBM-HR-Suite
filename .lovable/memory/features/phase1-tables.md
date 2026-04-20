---
name: Phase 1 Foundation Tables
description: 15 new tables added for Jamaica compliance, scheduling, messaging, approvals, and feature flags
type: feature
---

## New Tables (Phase 1)
- feature_flags — key/value config (enabled_ja_compliance, enabled_workforce_mgmt)
- statutory_rates — date-stamped JA deduction rates (NIS, NHT, EdTax, PAYE) with ceilings
- role_tiers — university hierarchy (ancillary→hr, 9 levels)
- shifts — employee shift assignments (Realtime enabled)
- shift_templates — recurring shift patterns
- shift_swaps — swap requests with approval
- availabilities — employee weekly availability windows
- time_entries — detailed time tracking with approval workflow
- break_records — break tracking within time entries
- time_off_requests — PTO/leave requests
- pto_allowances — annual PTO budgets per employee
- channels — messaging channels (group/private)
- channel_members — channel membership
- messages — realtime messages (Realtime enabled)
- tasks — shift-linked task assignments
- approval_requests — generic multi-level approval workflow

## Profile Extensions
Added nullable JA compliance fields: trn, nis_number, nht_number, paye_tax_code, contract_type, role_tier, grade_step, reporting_manager_id

## Audit
audit_row_change() trigger on profiles, shifts, time_entries, time_off_requests, payroll_records — logs old/new to audit_logs automatically
