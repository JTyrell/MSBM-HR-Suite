export interface SchedulingRule {
  rule_type: string;
  value: number;
  department_id?: string | null;
}

export interface ShiftDetails {
  start_time: string; // ISO
  end_time: string; // ISO
  break_minutes: number;
}

export interface ConflictItem {
  type: "double_booking" | "overtime" | "budget_overrun" | "availability" | "break_violation" | "max_shift";
  severity: "error" | "warning";
  message: string;
  details?: Record<string, unknown>;
}

export function evaluateSchedulingRules(
  proposedShift: ShiftDetails,
  existingWeekShifts: ShiftDetails[],
  rules: SchedulingRule[],
  departmentId?: string | null
): ConflictItem[] {
  const conflicts: ConflictItem[] = [];
  
  const getRule = (type: string): number | null => {
    // Department-specific rule takes priority over global
    const deptRule = rules.find(r => r.rule_type === type && r.department_id === departmentId);
    if (deptRule) return deptRule.value;
    const globalRule = rules.find(r => r.rule_type === type && (!r.department_id || r.department_id === '00000000-0000-0000-0000-000000000000'));
    return globalRule?.value ?? null;
  };

  const shiftStart = new Date(proposedShift.start_time);
  const shiftEnd = new Date(proposedShift.end_time);
  const shiftHours = (shiftEnd.getTime() - shiftStart.getTime()) / 3600000;

  // 1. Max shift length check
  const maxShift = getRule("max_shift_hours") || 8;
  if (shiftHours > maxShift) {
    conflicts.push({
      type: "max_shift",
      severity: "warning",
      message: `Shift is ${shiftHours.toFixed(1)}h — exceeds maximum ${maxShift}h`,
      details: { shift_hours: shiftHours, max_hours: maxShift },
    });
  }

  // 2. Weekly overtime check
  const otThreshold = getRule("overtime_weekly_threshold") || 40;
  
  let weeklyHours = shiftHours - (proposedShift.break_minutes / 60); // include the proposed shift
  for (const s of existingWeekShifts) {
    const h = (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3600000;
    const breakH = (s.break_minutes || 0) / 60;
    weeklyHours += (h - breakH);
  }

  if (weeklyHours > otThreshold) {
    conflicts.push({
      type: "overtime",
      severity: "warning",
      message: `Weekly hours would be ${weeklyHours.toFixed(1)}h — exceeds ${otThreshold}h threshold (overtime)`,
      details: { weekly_hours: weeklyHours, threshold: otThreshold },
    });
  }

  // 3. Break compliance (JA labor law)
  const minBreak = getRule("min_break_minutes") || 60;
  if (shiftHours >= 5) {
    const breakMin = proposedShift.break_minutes || 0;
    if (breakMin < minBreak) {
      conflicts.push({
        type: "break_violation",
        severity: "warning",
        message: `Shift is ${shiftHours.toFixed(1)}h with only ${breakMin}min break — JA labor law requires ${minBreak}min after 5h`,
        details: { shift_hours: shiftHours, break_minutes: breakMin, required: minBreak },
      });
    }
  }

  return conflicts;
}

export function checkOverlappingShifts(
  proposedShift: ShiftDetails,
  existingShifts: ShiftDetails[]
): boolean {
  const pStart = new Date(proposedShift.start_time).getTime();
  const pEnd = new Date(proposedShift.end_time).getTime();

  for (const s of existingShifts) {
    const sStart = new Date(s.start_time).getTime();
    const sEnd = new Date(s.end_time).getTime();

    // Overlap condition: start of one is before the end of the other,
    // AND end of one is after the start of the other
    if (pStart < sEnd && pEnd > sStart) {
      return true;
    }
  }

  return false;
}
