/* eslint-disable @typescript-eslint/no-explicit-any */
 
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * export-ja-remittance â€” Supabase Edge Function
 *
 * Generates CSV export matching MyHR+/HRplus remittance format.
 * Columns: Employee Name, TRN, NIS Number, NHT Number, Gross Earnings,
 *          NIS Deduction, NHT Deduction, Education Tax, PAYE, Net Pay
 *
 * Also supports Sling-style timesheet export format.
 *
 * Input: { pay_period_id, format: 'myhrplus' | 'timesheet' }
 * Output: CSV string with Content-Type: text/csv
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate caller
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify caller is admin/HR
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { data: callerRoles } = await supabase
      .from("user_roles").select("role").eq("user_id", caller.id);
    const roles = (callerRoles || []).map((r: Record<string, any>) => r.role);
    if (!roles.includes("admin") && !roles.includes("hr_manager")) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const body = await req.json();
    const { pay_period_id, format = "myhrplus" } = body;

    if (!pay_period_id) {
      return new Response(
        JSON.stringify({ error: "pay_period_id is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Fetch payroll records with profile data
    const { data: records, error } = await supabase
      .from("payroll_records")
      .select(`
        *,
        profiles!payroll_records_user_id_fkey(
          first_name, last_name, trn, nis_number, nht_number,
          department_id, departments(name)
        ),
        pay_periods(name, start_date, end_date)
      `)
      .eq("pay_period_id", pay_period_id);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    let csv: string;
    let filename: string;

    if (format === "timesheet") {
      // â”€â”€ Sling-style Timesheet Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const headers = [
        "Employee Name", "Department", "Regular Hours", "Overtime Hours",
        "Total Hours", "Pay Rate", "Gross Pay",
      ];
      const rows = (records || []).map((r: Record<string, any>) => [
        `${r.profiles?.first_name || ""} ${r.profiles?.last_name || ""}`,
        r.profiles?.departments?.name || "",
        r.regular_hours,
        r.overtime_hours,
        (Number(r.regular_hours) + Number(r.overtime_hours)).toFixed(2),
        r.pay_rate,
        r.gross_pay,
      ]);
      csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      filename = `timesheet_${pay_period_id.slice(0, 8)}.csv`;
    } else {
      // â”€â”€ MyHR+/HRplus Remittance Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const headers = [
        "Employee Name", "TRN", "NIS Number", "NHT Number",
        "Gross Earnings", "NIS Deduction", "NHT Deduction",
        "Education Tax", "PAYE", "Other Deductions", "Net Pay",
      ];

      const rows = (records || []).map((r: Record<string, any>) => {
        // For now, statutory breakdown comes from the flat deductions
        // Once the statutory engine is wired into payroll, these will be accurate
        const taxDed = Number(r.tax_deductions);
        const benefitDed = Number(r.benefit_deductions);
        const otherDed = Number(r.other_deductions);

        return [
          `"${r.profiles?.first_name || ""} ${r.profiles?.last_name || ""}"`,
          r.profiles?.trn || "",
          r.profiles?.nis_number || "",
          r.profiles?.nht_number || "",
          r.gross_pay,
          (taxDed * 0.136).toFixed(2), // NIS approx portion (to be replaced by statutory engine)
          (taxDed * 0.091).toFixed(2), // NHT approx
          (taxDed * 0.102).toFixed(2), // Ed Tax approx
          (taxDed * 0.671).toFixed(2), // PAYE approx
          otherDed,
          r.net_pay,
        ];
      });

      csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      filename = `remittance_myhrplus_${pay_period_id.slice(0, 8)}.csv`;
    }

    // Log export action
    await supabase.from("audit_logs").insert({
      actor_id: caller.id,
      action: "export_generated",
      entity_type: "payroll_export",
      entity_id: pay_period_id,
      details: { format, filename, record_count: records?.length || 0 },
    });

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
