import { z } from 'zod';

// ── Shift Schemas ────────────────────────────────────────────

export const shiftStatusSchema = z.enum(['draft', 'published', 'completed', 'cancelled']);

export const createShiftSchema = z.object({
  employee_id: z.string().uuid('Employee is required'),
  department_id: z.string().uuid().nullable().optional(),
  title: z.string().max(100).nullable().optional(),
  start_time: z.string().datetime({ message: 'Valid start time required' }),
  end_time: z.string().datetime({ message: 'Valid end time required' }),
  break_minutes: z.number().int().min(0).max(480).default(0),
  notes: z.string().max(500).nullable().optional(),
  color: z.string().max(7).default('#3b82f6'),
}).refine(
  (d) => new Date(d.end_time) > new Date(d.start_time),
  { message: 'End time must be after start time', path: ['end_time'] }
);

export const updateShiftSchema = createShiftSchema.partial().extend({
  status: shiftStatusSchema.optional(),
});

// ── Availability Schemas ─────────────────────────────────────

export const availabilitySchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Format: HH:MM'),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Format: HH:MM'),
  is_available: z.boolean().default(true),
  effective_from: z.string().optional(),
  expires_on: z.string().nullable().optional(),
});

// ── Time-Off Request Schema ──────────────────────────────────

export const leaveTypeSchema = z.enum([
  'vacation', 'sick', 'personal', 'maternity', 'paternity', 'bereavement', 'other',
]);

export const timeOffRequestSchema = z.object({
  leave_type: leaveTypeSchema,
  start_date: z.string().min(1, 'Start date required'),
  end_date: z.string().min(1, 'End date required'),
  notes: z.string().max(500).nullable().optional(),
}).refine(
  (d) => new Date(d.end_date) >= new Date(d.start_date),
  { message: 'End date must be on or after start date', path: ['end_date'] }
);

// ── Shift Swap Schema ────────────────────────────────────────

export const shiftSwapRequestSchema = z.object({
  original_shift_id: z.string().uuid(),
  target_employee_id: z.string().uuid('Target employee required'),
  notes: z.string().max(500).nullable().optional(),
});

// ── Shift Template Schema ────────────────────────────────────

export const shiftTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  department_id: z.string().uuid().nullable().optional(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Format: HH:MM'),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Format: HH:MM'),
  break_minutes: z.number().int().min(0).max(480).default(0),
  color: z.string().max(7).default('#3b82f6'),
});

// ── Scheduling Rules Schema ──────────────────────────────────

export const schedulingRuleSchema = z.object({
  rule_type: z.enum([
    'max_shift_hours',
    'min_break_minutes',
    'overtime_weekly_threshold',
    'max_consecutive_days',
    'budget_cap_weekly',
  ]),
  value: z.number().min(0),
  department_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(255).nullable().optional(),
});

// ── Academic Calendar Schema ─────────────────────────────────

export const academicCalendarSchema = z.object({
  title: z.string().min(1).max(200),
  event_type: z.enum([
    'semester_start', 'semester_end', 'exam_period',
    'holiday', 'orientation', 'graduation',
  ]),
  start_date: z.string().min(1),
  end_date: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type TimeOffRequestInput = z.infer<typeof timeOffRequestSchema>;
export type ShiftSwapInput = z.infer<typeof shiftSwapRequestSchema>;
export type ShiftTemplateInput = z.infer<typeof shiftTemplateSchema>;
