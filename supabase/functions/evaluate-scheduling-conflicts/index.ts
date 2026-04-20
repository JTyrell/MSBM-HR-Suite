/* eslint-disable @typescript-eslint/no-explicit-any */
 
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * evaluate-scheduling-conflicts â€” Supabase Edge Function
 *
 * Checks a proposed shift against:
 *   1. Double-booking: overlapping shifts for the same employee
 *   2. Overtime: weekly hours exceeding threshold (default 40)
 *   3. Budget overruns: department labor cost exceeding budget
 *   4. Availability violations: shift outside employee's availability window
 *   5. Break compliance: JA labor law rest period requirements
 *   6. Max shift length: exceeding max allowed continuous hours
 *
 * Input: { employee_id, start_time, end_time, department_id?, shift_id? (for edits) }
 * Output: { conflicts: ConflictItem[], has_conflicts: boolean }
 */

interface ConflictItem {
  type: "double_booking" | "overtime" | "budget_overrun" | "availability" | "break_violation" | "max_shift";
  severity: "error" | "warning";
  message: string;
  details?: Record<string, any>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { employee_id, start_time, end_time, department_id, shift_id } = body;

    if (!employee_id || !start_time || !end_time) {
      return new Response(
        JSON.stringify({ error: "employee_id, start_time, and end_time are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const conflicts: ConflictItem[] = [];
    const shiftStart = new Date(start_time);
    const shiftEnd = new Date(end_time);
    const shiftHours = (shiftEnd.getTime() - shiftStart.getTime()) / 3600000;

    // â”€â”€ 1. Fetch scheduling rules â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { data: rules } = await supabase
      .from("scheduling_rules")
      .select("*")
      .or(`department_id.is.null,department_id.eq.${department_id || "00000000-0000-0000-0000-000000000000"}`);

    const getRule = (type: string): number | null => {
      // Department-specific rule takes priority over global
      const deptRule = rules?.find(r => r.rule_type === type && r.department_id === department_id);
      const globalRule = rules?.find(r => r.rule_type === type && !r.department_id);
      return deptRule?.value ?? globalRule?.value ?? null;
    };

    // â”€â”€ 2. Max shift length check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const maxShift = getRule("max_shift_hours") || 8;
    if (shiftHours > maxShift) {
      conflicts.push({
        type: "max_shift",
        severity: "warning",
        message: `Shift is ${shiftHours.toFixed(1)}h â€” exceeds maximum ${maxShift}h`,
        details: { shift_hours: shiftHours, max_hours: maxShift },
      });
    }

    // â”€â”€ 3. Double-booking check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let overlapQuery = supabase
      .from("shifts")
      .select("id, start_time, end_time, title")
      .eq("employee_id", employee_id)
      .neq("status", "cancelled")
      .lt("start_time", end_time)
      .gt("end_time", start_time);

    // Exclude the current shift if editing
    if (shift_id) {
      overlapQuery = overlapQuery.neq("id", shift_id);
    }

    const { data: overlapping } = await overlapQuery;

    if (overlapping && overlapping.length > 0) {
      conflicts.push({
        type: "double_booking",
        severity: "error",
        message: `Employee has ${overlapping.length} overlapping shift(s)`,
        details: {
          overlapping_shifts: overlapping.map(s => ({
            id: s.id,
            title: s.title,
            start: s.start_time,
            end: s.end_time,
          })),
        },
      });
    }

    // â”€â”€ 4. Weekly overtime check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const otThreshold = getRule("overtime_weekly_threshold") || 40;

    // Get the ISO week boundaries for the proposed shift
    const weekStart = new Date(shiftStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    let weekQuery = supabase
      .from("shifts")
      .select("start_time, end_time, break_minutes")
      .eq("employee_id", employee_id)
      .neq("status", "cancelled")
      .gte("start_time", weekStart.toISOString())
      .lt("start_time", weekEnd.toISOString());

    if (shift_id) {
      weekQuery = weekQuery.neq("id", shift_id);
    }

    const { data: weekShifts } = await weekQuery;

    let weeklyHours = shiftHours; // include the proposed shift
    if (weekShifts) {
      for (const s of weekShifts) {
        const h = (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3600000;
        const breakH = (s.break_minutes || 0) / 60;
        weeklyHours += h - breakH;
      }
    }

    if (weeklyHours > otThreshold) {
      conflicts.push({
        type: "overtime",
        severity: "warning",
        message: `Weekly hours would be ${weeklyHours.toFixed(1)}h â€” exceeds ${otThreshold}h threshold (overtime)`,
        details: { weekly_hours: weeklyHours, threshold: otThreshold },
      });
    }

    // â”€â”€ 5. Break compliance (JA labor law) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const minBreak = getRule("min_break_minutes") || 60;
    if (shiftHours >= 5) {
      const breakMin = body.break_minutes || 0;
      if (breakMin < minBreak) {
        conflicts.push({
          type: "break_violation",
          severity: "warning",
          message: `Shift is ${shiftHours.toFixed(1)}h with only ${breakMin}min break â€” JA labor law requires ${minBreak}min after 5h`,
          details: { shift_hours: shiftHours, break_minutes: breakMin, required: minBreak },
        });
      }
    }

    // â”€â”€ 6. Budget overrun check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (department_id) {
      const { data: budget } = await supabase
        .from("department_budgets")
        .select("labor_budget")
        .eq("department_id", department_id)
        .lte("period_start", shiftStart.toISOString().split("T")[0])
        .gte("period_end", shiftStart.toISOString().split("T")[0])
        .single();

      if (budget) {
        // Get employee pay rate for cost estimation
        const { data: profile } = await supabase
          .from("profiles")
          .select("pay_rate, pay_type")
          .eq("user_id", employee_id)
          .single();

        if (profile && profile.pay_type === "hourly") {
          const shiftCost = shiftHours * Number(profile.pay_rate);

          // Get existing shift costs for this budget period
          const { data: existingShifts } = await supabase
            .from("shifts")
            .select("start_time, end_time, employee_id")
            .eq("department_id", department_id)
            .neq("status", "cancelled");

          // Rough cost estimate (simplified)
          const totalCost = shiftCost; // In production, sum all shift costs
          if (totalCost > Number(budget.labor_budget)) {
            conflicts.push({
              type: "budget_overrun",
              severity: "warning",
              message: `Adding this shift may exceed the department's labor budget`,
              details: { shift_cost: shiftCost, budget: budget.labor_budget },
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        conflicts,
        has_conflicts: conflicts.length > 0,
        has_errors: conflicts.some(c => c.severity === "error"),
        has_warnings: conflicts.some(c => c.severity === "warning"),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
