import { z } from 'zod';

// ── Jamaican Compliance Field Schemas ────────────────────────

/** TRN: Tax Registration Number — exactly 9 digits */
export const trnSchema = z
  .string()
  .regex(/^\d{9}$/, 'TRN must be exactly 9 digits')
  .nullable()
  .optional();

/** NIS: National Insurance Scheme — format XX-XXXXXX-X */
export const nisSchema = z
  .string()
  .regex(/^\d{2}-\d{6}-\d$/, 'NIS format must be XX-XXXXXX-X')
  .nullable()
  .optional();

/** PAYE Tax Code: A through E */
export const payeCodeSchema = z.enum(['A', 'B', 'C', 'D', 'E']).nullable().optional();

/** Contract Type */
export const contractTypeSchema = z
  .enum(['permanent', 'contract', 'temporary', 'probation'])
  .nullable()
  .optional();

/**
 * Role Tier — University role classification
 * NOTE: ict_tsr = ICT Student Intern (TSR)
 * They are student interns officially working for internal staff.
 * PAYE-exempt below the monthly income threshold.
 */
export const roleTierSchema = z
  .enum([
    'ancillary',
    'maintenance',
    'admin_staff',
    'ict_tsr',       // ICT Student Intern (TSR) — PAYE exempt below threshold
    'ict_sysadmin',
    'ict_mgmt',
    'faculty',
    'executive',
    'hr',
  ])
  .nullable()
  .optional();

/** Full JA compliance fields for employee profile */
export const jaComplianceSchema = z.object({
  trn: trnSchema,
  nis_number: nisSchema,
  nht_number: z.string().max(20, 'NHT number max 20 characters').nullable().optional(),
  paye_tax_code: payeCodeSchema,
  contract_type: contractTypeSchema,
  role_tier: roleTierSchema,
  grade: z.string().max(10, 'Grade max 10 characters').nullable().optional(),
  step: z.number().int().min(1).max(20).nullable().optional(),
  reports_to: z.string().uuid('Invalid manager ID').nullable().optional(),
  location_consent: z.boolean().optional(),
});

/** Extended employee invite schema (base + JA fields) */
export const inviteEmployeeSchema = z.object({
  email: z.string().email('Valid email required'),
  first_name: z.string().min(1, 'First name required').max(100),
  last_name: z.string().min(1, 'Last name required').max(100),
  department_id: z.string().uuid().nullable().optional(),
  job_title: z.string().max(100).nullable().optional(),
  pay_rate: z.number().min(0).max(99999999).optional(),
  pay_type: z.enum(['hourly', 'salary']).optional(),
  // JA compliance fields (optional at invite time)
  ...jaComplianceSchema.shape,
});

/** Employee profile update schema */
export const updateEmployeeSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  job_title: z.string().max(100).nullable().optional(),
  pay_rate: z.number().min(0).max(99999999).optional(),
  pay_type: z.enum(['hourly', 'salary']).optional(),
  status: z.enum(['active', 'inactive', 'terminated']).optional(),
  hire_date: z.string().nullable().optional(),
  ...jaComplianceSchema.shape,
});

export type JAComplianceFields = z.infer<typeof jaComplianceSchema>;
export type InviteEmployeeInput = z.infer<typeof inviteEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
