---
name: Phase 2 Statutory Engine
description: Jamaican statutory calculation engine, Zod validation schemas, and compliance fields in CRM UI
type: feature
---

## Edge Functions
- `calculate-ja-statutory` — standalone endpoint that calculates NIS/NHT/EdTax/PAYE from statutory_rates table with ceiling logic
- `calculate-payroll` — updated to check `enabled_ja_compliance` feature flag; when on, uses statutory rates instead of hardcoded 22%/5%
- Rates stored as percentages (e.g., 3 for 3%), converted to decimals in calculation

## Validation (src/lib/validation/jamaican-fields.ts)
- TRN: exactly 9 digits
- NIS: XX-XXXXXX-X format (uppercase letters + digits)
- PAYE Tax Code: A-E enum
- Contract Type: permanent/contract/temporary/probation
- All fields nullable/optional for backward compatibility

## CRM Integration
- JaComplianceFields component (src/components/compliance/JaComplianceFields.tsx)
- Only shows in CRM edit dialog when `enabled_ja_compliance` flag is true
- Fetches role_tiers for tier selection, profiles for reporting manager dropdown
- Profile type extended with: trn, nis_number, nht_number, paye_tax_code, contract_type, grade_step, role_tier, reporting_manager_id

## PAYE Tax Code Effects
- A: Standard rate
- B: Higher rate  
- C: Pensioner (50% reduction)
- D: Multiple employer
- E: Exempt (0 PAYE)
