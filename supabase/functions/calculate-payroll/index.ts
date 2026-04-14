import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { pay_period_id } = await req.json();

    if (!pay_period_id) {
      return new Response(
        JSON.stringify({ error: "Missing pay_period_id" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get pay period
    const { data: period, error: periodError } = await supabase
      .from("pay_periods")
      .select("*")
      .eq("id", pay_period_id)
      .single();

    if (periodError || !period) {
      return new Response(
        JSON.stringify({ error: "Pay period not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Get all active employees
    const { data: employees } = await supabase
      .from("profiles")
      .select("*")
      .eq("status", "active");

    if (!employees || employees.length === 0) {
      return new Response(
        JSON.stringify({ error: "No active employees found", records_created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let recordsCreated = 0;

    for (const employee of employees) {
      // Get attendance records for this employee in this period
      const { data: attendance } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", employee.user_id)
        .eq("status", "valid")
        .gte("clock_in", period.start_date)
        .lte("clock_in", period.end_date + "T23:59:59.999Z")
        .not("clock_out", "is", null);

      if (!attendance || attendance.length === 0) continue;

      // Calculate total hours
      let totalHours = 0;
      for (const record of attendance) {
        const clockIn = new Date(record.clock_in).getTime();
        const clockOut = new Date(record.clock_out).getTime();
        totalHours += (clockOut - clockIn) / 3600000;
      }

      // Calculate overtime (over 40 hours per week)
      const weeksDuration = Math.max(1, Math.ceil(
        (new Date(period.end_date).getTime() - new Date(period.start_date).getTime()) / (7 * 24 * 3600000)
      ));
      const weeklyThreshold = 40;
      const totalThreshold = weeklyThreshold * weeksDuration;

      const regularHours = Math.min(totalHours, totalThreshold);
      const overtimeHours = Math.max(0, totalHours - totalThreshold);

      const payRate = Number(employee.pay_rate);
      let grossPay: number;

      if (employee.pay_type === "hourly") {
        grossPay = (regularHours * payRate) + (overtimeHours * payRate * 1.5);
      } else {
        // Salary: pay_rate is annual, divide by pay periods per year (assume 26 biweekly)
        grossPay = payRate / 26;
      }

      // Simple deductions (placeholder percentages)
      const taxDeductions = grossPay * 0.22; // ~22% combined tax
      const benefitDeductions = grossPay * 0.05; // ~5% benefits
      const netPay = grossPay - taxDeductions - benefitDeductions;

      // Upsert payroll record
      const { error: upsertError } = await supabase
        .from("payroll_records")
        .upsert({
          user_id: employee.user_id,
          pay_period_id: pay_period_id,
          regular_hours: Math.round(regularHours * 100) / 100,
          overtime_hours: Math.round(overtimeHours * 100) / 100,
          pay_rate: payRate,
          gross_pay: Math.round(grossPay * 100) / 100,
          tax_deductions: Math.round(taxDeductions * 100) / 100,
          benefit_deductions: Math.round(benefitDeductions * 100) / 100,
          other_deductions: 0,
          net_pay: Math.round(netPay * 100) / 100,
          status: "calculated",
        }, { onConflict: "user_id,pay_period_id" });

      if (!upsertError) recordsCreated++;
    }

    // Update pay period status
    await supabase
      .from("pay_periods")
      .update({ status: "processing" })
      .eq("id", pay_period_id);

    return new Response(
      JSON.stringify({ success: true, records_created: recordsCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
