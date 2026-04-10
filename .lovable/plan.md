
# MSBM-HR Suite — Implementation Plan

## Overview
Build a full-featured HRM web application with **geofenced attendance** and **payroll management** using React + Supabase. The app will be responsive (desktop/tablet/mobile-web) with role-based access (Admin, HR, Employee). AI agents are deferred to a future phase.

---

## Phase 1: Foundation & Authentication

### 1.1 Database Schema (via migrations)
- **profiles** — employee data (name, email, department, job_title, pay_rate, pay_type, hire_date, status)
- **user_roles** — RBAC roles (admin, hr_manager, employee) using enum + security definer function
- **departments** — department management
- **geofences** — named geofence polygons stored as GeoJSON, linked to departments/job sites
- **employee_geofences** — junction table assigning employees to geofences
- **attendance_records** — clock-in/out with lat/lng, timestamp, geofence_id, status (valid/rejected)
- **pay_periods** — period definitions (start, end, status)
- **payroll_records** — per-employee payroll (gross, deductions, net, hours, overtime)
- **pay_stubs** — generated pay stub details
- Enable RLS on all tables with role-based policies

### 1.2 Auth & Roles
- Supabase Auth (email/password)
- Auto-create profile on signup via DB trigger
- Role-based routing: Admin dashboard vs Employee self-service
- Login/signup pages with password reset flow

### 1.3 App Shell & Navigation
- Responsive sidebar layout (collapsible on mobile)
- Role-based nav: Dashboard, Attendance, Geofences (admin), Payroll, Employees, Profile
- Bottom nav bar on mobile breakpoints

---

## Phase 2: Geofenced Attendance Module

### 2.1 Geofence Management (Admin)
- CRUD pages for geofences — create/edit polygons on an interactive Leaflet map
- Assign geofences to departments or individual employees
- List view of all geofences with status

### 2.2 Clock In/Out (Employee)
- Prominent clock-in/out button that requests browser geolocation
- **Server-side validation** via Supabase edge function: checks if coordinates fall within assigned geofence using PostGIS `ST_Contains`
- Clear success/error feedback with location name
- Offline queue: store attempts in localStorage, retry on reconnect

### 2.3 Attendance Dashboard (Admin/HR)
- Map view (Leaflet) showing active geofences + recent clock-in events
- Live feed of clock-in/out activity
- Attendance history table with filters (employee, date range, status)
- Flag missing clock-outs

---

## Phase 3: Payroll Module

### 3.1 Payroll Engine (Edge Functions)
- Edge function to calculate payroll for a pay period:
  - Aggregate approved attendance hours per employee
  - Apply pay rates (hourly/salary), overtime rules
  - Calculate gross pay, deductions (tax placeholders), net pay
- Admin can trigger manual recalculation

### 3.2 Payroll Run Wizard (Admin)
- Step-by-step wizard: Select period → Review hours → Review calculations → Approve & finalize
- Summary cards with totals, anomaly flags (missing clock-outs, excessive hours)
- Export payroll data as CSV

### 3.3 Employee Self-Service
- Pay stubs list with period selector
- Pay breakdown view (gross, deductions, net)
- Download pay stub as PDF (generated client-side)

### 3.4 Employee Management (Admin)
- Employee directory with search/filter
- Employee profile editor (pay rate, department, geofence assignments)
- Onboarding status tracker

---

## Key Technical Decisions
- **Geospatial**: Use PostGIS extension in Supabase + `ST_Contains` for geofence validation in edge functions
- **Maps**: Leaflet with OpenStreetMap tiles (free, no API key needed)
- **UI**: shadcn/ui components already in project, extend with data tables, charts (recharts)
- **Security**: RLS everywhere, JWT validation in edge functions, input validation with Zod
- **Future-ready**: Document FastAPI backend, React Native mobile app, and AI agent architecture in README for later phases
