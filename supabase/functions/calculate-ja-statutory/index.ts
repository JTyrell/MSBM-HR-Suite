import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatutoryRate {
  rate_type: string;
  rate_value: number;
  ceiling_amount: number | null;
  effective_from: string;
  expires_on: string | null;
}

interface StatutoryResult {
  nis_employee: number;
  nis_employer: number;
  nht_employee: number;
  nht_employer: number;
  education_tax_employee: number;
  education_tax_employer: number;
  paye: number;
  total_employee_deductions: number;
  total_employer_contributions: number;
  gross_pay: number;
  net_pay: number;
  breakdown: Record<string, { rate: number; amount: number; ceiling: number | null; capped: boolean }>;
}

/**
 * calculate-ja-statutory Edge Function
 * 
 * Calculates Jamaican statutory deductions using rates from the statutory_rates table.
 * Supports: NIS, NHT, Education Tax, PAYE with ceiling logic.
 * 
 * Input: { gross_pay: number, pay_date?: string, paye_tax_code?: string }
 * Output: StatutoryResult with full breakdown
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { gross_pay, pay_date, paye_tax_code, annual_gross } = await req.json();

    if (typeof gross_pay !== "number" || gross_pay < 0) {
      return new Response(
        JSON.stringify({ error: "gross_pay must be a non-negative number" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine effective date for rate lookup
    const effectiveDate = pay_date || new Date().toISOString().split("T")[0];

    // Fetch all active statutory rates for this date
    const { data: rates, error: ratesError } = await supabase
      .from("statutory_rates")
      .select("*")
      .lte("effective_from", effectiveDate)
      .or(`expires_on.is.null,expires_on.gte.${effectiveDate}`)
      .order("effective_from", { ascending: false });

    if (ratesError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch statutory rates", details: ratesError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Get the most recent rate for each type
    const rateMap = new Map<string, StatutoryRate>();
    for (const rate of (rates || [])) {
      if (!rateMap.has(rate.rate_type)) {
        rateMap.set(rate.rate_type, rate);
      }
    }

    // Calculate each deduction
    const calcDeduction = (rateType: string, base: number): { rate: number; amount: number; ceiling: number | null; capped: boolean } => {
      const rateInfo = rateMap.get(rateType);
      if (!rateInfo) return { rate: 0, amount: 0, ceiling: null, capped: false };

      const rate = Number(rateInfo.rate_value);
      const ceiling = rateInfo.ceiling_amount ? Number(rateInfo.ceiling_amount) : null;
      
      // Apply ceiling: if base exceeds ceiling, only calculate on the ceiling amount
      const taxableBase = ceiling ? Math.min(base, ceiling) : base;
      const amount = Math.round(taxableBase * rate * 100) / 100;
      
      return { rate, amount, ceiling, capped: ceiling !== null && base > ceiling };
    };

    // Use annual gross for ceiling comparisons if provided, otherwise annualize
    const annualGross = annual_gross || gross_pay * 12;

    // NIS Employee (rate applied to gross, with annual ceiling)
    const nisEmployee = calcDeduction("nis_employee", gross_pay);
    // If there's an annual ceiling, we need to check against annualized amount
    const nisEmployeeCeiling = rateMap.get("nis_employee")?.ceiling_amount;
    if (nisEmployeeCeiling && annualGross > Number(nisEmployeeCeiling)) {
      // Cap contribution at ceiling / 12 per month
      const monthlyCeiling = Number(nisEmployeeCeiling) / 12;
      nisEmployee.amount = Math.round(monthlyCeiling * nisEmployee.rate * 100) / 100;
      nisEmployee.capped = true;
    }

    const nisEmployer = calcDeduction("nis_employer", gross_pay);
    const nhtEmployee = calcDeduction("nht_employee", gross_pay);
    const nhtEmployer = calcDeduction("nht_employer", gross_pay);
    const edTaxEmployee = calcDeduction("education_tax_employee", gross_pay);
    const edTaxEmployer = calcDeduction("education_tax_employer", gross_pay);

    // PAYE calculation — uses annual threshold approach
    // Standard JA PAYE: first $1,500,096 JMD exempt, 25% on next portion, 30% above threshold
    const payeRate = calcDeduction("paye_standard", gross_pay);
    let payeAmount = 0;
    
    const payeThreshold = rateMap.get("paye_threshold");
    const payeHigherRate = rateMap.get("paye_higher");
    
    if (payeThreshold) {
      const monthlyThreshold = Number(payeThreshold.ceiling_amount || 0) / 12;
      const taxableIncome = Math.max(0, gross_pay - monthlyThreshold);
      
      if (payeHigherRate && payeHigherRate.ceiling_amount) {
        const higherBracketStart = Number(payeHigherRate.ceiling_amount) / 12;
        const standardBracket = Math.min(taxableIncome, Math.max(0, higherBracketStart - monthlyThreshold));
        const higherBracket = Math.max(0, taxableIncome - standardBracket);
        
        payeAmount = Math.round(
          (standardBracket * Number(payeRate.rate) + higherBracket * Number(payeHigherRate.rate_value)) * 100
        ) / 100;
      } else {
        payeAmount = Math.round(taxableIncome * Number(payeRate.rate) * 100) / 100;
      }
    } else {
      // Fallback: flat rate
      payeAmount = payeRate.amount;
    }

    // Adjust for PAYE tax code
    if (paye_tax_code === "E") {
      payeAmount = 0; // Exempt
    } else if (paye_tax_code === "C") {
      payeAmount = Math.round(payeAmount * 0.5 * 100) / 100; // Pensioner reduced rate
    }

    const totalEmployeeDeductions = nisEmployee.amount + nhtEmployee.amount + edTaxEmployee.amount + payeAmount;
    const totalEmployerContributions = nisEmployer.amount + nhtEmployer.amount + edTaxEmployer.amount;

    const result: StatutoryResult = {
      nis_employee: nisEmployee.amount,
      nis_employer: nisEmployer.amount,
      nht_employee: nhtEmployee.amount,
      nht_employer: nhtEmployer.amount,
      education_tax_employee: edTaxEmployee.amount,
      education_tax_employer: edTaxEmployer.amount,
      paye: payeAmount,
      total_employee_deductions: Math.round(totalEmployeeDeductions * 100) / 100,
      total_employer_contributions: Math.round(totalEmployerContributions * 100) / 100,
      gross_pay,
      net_pay: Math.round((gross_pay - totalEmployeeDeductions) * 100) / 100,
      breakdown: {
        nis_employee: nisEmployee,
        nis_employer: nisEmployer,
        nht_employee: nhtEmployee,
        nht_employer: nhtEmployer,
        education_tax_employee: edTaxEmployee,
        education_tax_employer: edTaxEmployer,
        paye: { rate: payeRate.rate, amount: payeAmount, ceiling: null, capped: false },
      },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
