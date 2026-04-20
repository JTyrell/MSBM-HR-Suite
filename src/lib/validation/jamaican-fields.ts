import { z } from "zod";

/**
 * Jamaican statutory field validation schemas
 * TRN: 9 digits (Tax Registration Number)
 * NIS: XX-XXXXXX-X format (National Insurance Scheme)
 * NHT: alphanumeric
 * PAYE Tax Code: A-E
 * Contract Type: permanent, contract, temporary, probation
 */

export const trnSchema = z
  .string()
  .regex(/^\d{9}$/, "TRN must be exactly 9 digits")
  .or(z.literal(""))
  .optional()
  .nullable();

export const nisSchema = z
  .string()
  .regex(/^[A-Z]{2}-\d{6}-[A-Z0-9]$/, "NIS must be in format XX-XXXXXX-X (e.g., AB-123456-C)")
  .or(z.literal(""))
  .optional()
  .nullable();

export const nhtSchema = z
  .string()
  .min(1, "NHT number is required")
  .max(20, "NHT number too long")
  .or(z.literal(""))
  .optional()
  .nullable();

export const payeTaxCodeSchema = z
  .enum(["A", "B", "C", "D", "E", ""])
  .optional()
  .nullable();

export const contractTypeSchema = z
  .enum(["permanent", "contract", "temporary", "probation", ""])
  .optional()
  .nullable();

export const gradeStepSchema = z
  .string()
  .max(20, "Grade/step too long")
  .or(z.literal(""))
  .optional()
  .nullable();

export const jamaicaComplianceSchema = z.object({
  trn: trnSchema,
  nis_number: nisSchema,
  nht_number: nhtSchema,
  paye_tax_code: payeTaxCodeSchema,
  contract_type: contractTypeSchema,
  grade_step: gradeStepSchema,
  role_tier: z.string().optional().nullable(),
  reporting_manager_id: z.string().uuid("Invalid manager ID").optional().nullable(),
});

export type JamaicaComplianceFields = z.infer<typeof jamaicaComplianceSchema>;

export const PAYE_TAX_CODES = [
  { value: "A", label: "A – Standard rate" },
  { value: "B", label: "B – Higher rate" },
  { value: "C", label: "C – Pensioner" },
  { value: "D", label: "D – Multiple employer" },
  { value: "E", label: "E – Exempt" },
] as const;

export const CONTRACT_TYPES = [
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Contract" },
  { value: "temporary", label: "Temporary" },
  { value: "probation", label: "Probation" },
] as const;
