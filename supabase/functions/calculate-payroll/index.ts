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
    // ── Authenticate caller (admin/HR only) ─────────────────
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseUrlAuth = Deno.env.get("SUPABASE_URL")!;
    const callerClient = createClient(supabaseUrlAuth, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

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

    // Verify role
    const { data: callerRoles } = await supabase
      .from("user_roles").select("role").eq("user_id", caller.id);
    const roles = (callerRoles || []).map((r: { role: string }) => r.role);
    if (!roles.includes("admin") && !roles.includes("hr_manager")) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Check if JA compliance is enabled
    const { data: jaFlag } = await supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", "enabled_ja_compliance")
      .single();

    const jaComplianceEnabled = jaFlag?.enabled === true;

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

    // If JA compliance is enabled, fetch statutory rates
    interface StatutoryRate {
      rate_type: string;
      rate_value: number;
      ceiling_amount: number | null;
    }
    
    let statutoryRates: StatutoryRate[] = [];
    if (jaComplianceEnabled) {
      const effectiveDate = period.end_date;
      const { data: rates } = await supabase
        .from("statutory_rates")
        .select("*")
        .lte("effective_from", effectiveDate)
        .or(`expires_on.is.null,expires_on.gte.${effectiveDate}`)
        .order("effective_from", { ascending: false });
      statutoryRates = rates || [];
    }

    // Build rate lookup map
    const rateMap = new Map<string, StatutoryRate>();
    for (const rate of statutoryRates) {
      if (!rateMap.has(rate.rate_type)) {
        rateMap.set(rate.rate_type, rate);
      }
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

      let taxDeductions: number;
      let benefitDeductions: number;
      const otherDeductions = 0;
      let notes = "";

      if (jaComplianceEnabled) {
        // Use Jamaican statutory engine
        const calcDeduction = (rateType: string, base: number) => {
          const rateInfo = rateMap.get(rateType);
          if (!rateInfo) return 0;
          const rate = Number(rateInfo.rate_value) / 100; // Convert percentage to decimal
          const ceiling = rateInfo.ceiling_amount ? Number(rateInfo.ceiling_amount) : null;
          const taxableBase = ceiling ? Math.min(base, ceiling) : base;
          return Math.round(taxableBase * rate * 100) / 100;
        };

        const nisEmployee = calcDeduction("nis_employee", grossPay);
        const nhtEmployee = calcDeduction("nht_employee", grossPay);
        const edTaxEmployee = calcDeduction("education_tax_employee", grossPay);

        // PAYE calculation
        let payeAmount = 0;
        const payeThreshold = rateMap.get("paye_threshold");
        const payeStandard = rateMap.get("paye_standard");
        const payeHigher = rateMap.get("paye_higher");

        if (payeThreshold && payeStandard) {
          const monthlyThreshold = Number(payeThreshold.ceiling_amount || 0) / 12;
          const taxableIncome = Math.max(0, grossPay - monthlyThreshold);

          if (payeHigher && payeHigher.ceiling_amount) {
            const higherBracketStart = Number(payeHigher.ceiling_amount) / 12;
            const standardBracket = Math.min(taxableIncome, Math.max(0, higherBracketStart - monthlyThreshold));
            const higherBracket = Math.max(0, taxableIncome - standardBracket);
            payeAmount = Math.round(
              (standardBracket * (Number(payeStandard.rate_value) / 100) + higherBracket * (Number(payeHigher.rate_value) / 100)) * 100
            ) / 100;
          } else {
            payeAmount = Math.round(taxableIncome * (Number(payeStandard.rate_value) / 100) * 100) / 100;
          }
        }

        // Apply PAYE tax code adjustments
        if (employee.paye_tax_code === "E") {
          payeAmount = 0;
        } else if (employee.paye_tax_code === "C") {
          payeAmount = Math.round(payeAmount * 0.5 * 100) / 100;
        }

        taxDeductions = payeAmount;
        benefitDeductions = nisEmployee + nhtEmployee + edTaxEmployee;
        notes = `JA Statutory: NIS=${nisEmployee}, NHT=${nhtEmployee}, EdTax=${edTaxEmployee}, PAYE=${payeAmount}`;
      } else {
        // Legacy: flat rates
        taxDeductions = grossPay * 0.22;
        benefitDeductions = grossPay * 0.05;
      }

      const netPay = grossPay - taxDeductions - benefitDeductions - otherDeductions;

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
          other_deductions: Math.round(otherDeductions * 100) / 100,
          net_pay: Math.round(netPay * 100) / 100,
          status: "calculated",
          notes: notes || null,
        }, { onConflict: "user_id,pay_period_id" });

      if (!upsertError) recordsCreated++;
    }

    // Update pay period status
    await supabase
      .from("pay_periods")
      .update({ status: "processing" })
      .eq("id", pay_period_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        records_created: recordsCreated,
        ja_compliance_enabled: jaComplianceEnabled,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[calculate-payroll] Error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
