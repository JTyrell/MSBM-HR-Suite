# Project Memory

## Core
MSBMHR_Suite: AI-Agentic HRM platform. Primary #6366F1 (indigo), dark sidebar.
Space Grotesk headings, Inter body. Never serif.
Geofenced attendance is non-negotiable — GPS validation required for all clock-in/out.
AI agents deferred to future phase. Focus: Attendance + Payroll + JA Compliance + Workforce Mgmt.
Supabase Cloud backend with RLS on all tables. Edge functions for geofence validation & payroll calc.
Feature flags: enabled_ja_compliance, enabled_workforce_mgmt — gate new features behind these.

## Memories
- [Database schema](mem://features/db-schema) — All tables: profiles, user_roles, departments, geofences, attendance_records, pay_periods, payroll_records
- [Auth & roles](mem://features/auth) — Email/password auth, auto-profile on signup, RBAC: admin/hr_manager/employee
- [Geofence system](mem://features/geofences) — Haversine distance validation in edge function, circle-based geofences with configurable radius
- [Payroll engine](mem://features/payroll) — Edge function calculates hours from attendance, 22% tax / 5% benefits placeholders, overtime at 40hrs/week
- [Phase 1 tables](mem://features/phase1-tables) — 15 new tables for JA compliance + workforce management foundation
