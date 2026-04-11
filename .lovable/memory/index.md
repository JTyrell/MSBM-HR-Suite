# Project Memory

## Core
MSBM-HR Suite: AI-Agentic HRM platform. Primary #d11226 (MSBM Red), sidebar #2341a4 (Inner Blue), accent #697ec1 (Light Blue).
Space Grotesk headings, Inter body. Never serif.
Geofenced attendance is non-negotiable — GPS validation required for all clock-in/out.
AI agents deferred to future phase. Focus: Attendance + Payroll.
Supabase Cloud backend with RLS on all tables. Edge functions for geofence validation & payroll calc.

## Memories
- [Database schema](mem://features/db-schema) — All tables: profiles, user_roles, departments, geofences, attendance_records, pay_periods, payroll_records
- [Auth & roles](mem://features/auth) — Email/password auth, auto-profile on signup, RBAC: admin/hr_manager/employee
- [Geofence system](mem://features/geofences) — Haversine distance validation in edge function, circle-based geofences with configurable radius
- [Payroll engine](mem://features/payroll) — Edge function calculates hours from attendance, 22% tax / 5% benefits placeholders, overtime at 40hrs/week
- [Brand colors](mem://design/brand-colors) — MSBM Red #d11226, Inner Blue #2341a4, Light Blue #697ec1
