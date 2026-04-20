import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

<<<<<<< HEAD
/**
 * calculate-ja-statutory — Supabase Edge Function
 *
 * Calculates Jamaican statutory deductions for a given gross pay amount.
 * Pulls rates from the `statutory_rates` table (date-stamped, never hardcoded).
 *
 * Special handling:
 *   - ict_tsr (student interns): PAYE-exempt below monthly threshold
 *   - NIS has an annual ceiling of J$5,000,000
 *   - PAYE has two brackets: 25% (J$1.5M-6M) and 30% (above J$6M)
 *
 * Input: { gross_pay, annualized_gross?, role_tier?, paye_tax_code?, pay_periods_per_year? }
 * Output: { nis_employee, nis_employer, nht, education_tax, paye, total_employee, total_employer }
 */

interface StatutoryRate {
  rate_type: string;
  rate: number;
  ceiling: number | null;
  threshold: number;
=======
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatutoryRate {
  rate_type: string;
  rate_value: number;
  ceiling_amount: number | null;
>>>>>>> d3ab0c2fa7bcd4cde3e95267f945363666e2a063
  effective_from: string;
  expires_on: string | null;
}

interface StatutoryResult {
  nis_employee: number;
  nis_employer: number;
<<<<<<< HEAD
  nht: number;
  education_tax: number;
  paye: number;
  total_employee_deductions: number;
  total_employer_contributions: number;
  breakdown: {
    nis_employee_rate: number;
    nis_ceiling: number | null;
    nht_rate: number;
    education_tax_rate: number;
    paye_rate_bracket_1: number;
    paye_rate_bracket_2: number;
    paye_threshold_bracket_1: number;
    paye_threshold_bracket_2: number;
    paye_exempt: boolean;
    paye_exempt_reason: string | null;
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

=======
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
>>>>>>> d3ab0c2fa7bcd4cde3e95267f945363666e2a063
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
<<<<<<< HEAD
    const body = await req.json();
    const {
      gross_pay,
      annualized_gross,
      role_tier,
      paye_tax_code,
      pay_periods_per_year = 26, // default biweekly
      rate_date, // optional: lookup rates as of this date
    } = body;

    if (gross_pay === undefined || gross_pay === null) {
      return new Response(
        JSON.stringify({ error: "gross_pay is required" }),
=======
    const { gross_pay, pay_date, paye_tax_code, annual_gross } = await req.json();

    if (typeof gross_pay !== "number" || gross_pay < 0) {
      return new Response(
        JSON.stringify({ error: "gross_pay must be a non-negative number" }),
>>>>>>> d3ab0c2fa7bcd4cde3e95267f945363666e2a063
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

<<<<<<< HEAD
    // ── Fetch active statutory rates ──────────────────────────
    const asOfDate = rate_date || new Date().toISOString().split("T")[0];

    const { data: rates, error: ratesError } = await supabase
      .from("statutory_rates")
      .select("*")
      .lte("effective_from", asOfDate)
      .or(`expires_on.is.null,expires_on.gt.${asOfDate}`)
=======
    // Determine effective date for rate lookup
    const effectiveDate = pay_date || new Date().toISOString().split("T")[0];

    // Fetch all active statutory rates for this date
    const { data: rates, error: ratesError } = await supabase
      .from("statutory_rates")
      .select("*")
      .lte("effective_from", effectiveDate)
      .or(`expires_on.is.null,expires_on.gte.${effectiveDate}`)
>>>>>>> d3ab0c2fa7bcd4cde3e95267f945363666e2a063
      .order("effective_from", { ascending: false });

    if (ratesError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch statutory rates", details: ratesError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

<<<<<<< HEAD
    // Get the most recent active rate for each type
    const getRate = (type: string): StatutoryRate | undefined =>
      (rates as StatutoryRate[])?.find(r => r.rate_type === type);

    // ── Calculate annualized gross ────────────────────────────
    const annualGross = annualized_gross || (gross_pay * pay_periods_per_year);

    // ── NIS: Employee & Employer (3% each, ceiling J$5M/yr) ──
    const nisRate = getRate("nis_employee");
    const nisCeiling = nisRate?.ceiling || 5000000;
    const nisAnnualBase = Math.min(annualGross, nisCeiling);
    const nisPerPeriod = (nisAnnualBase * (nisRate?.rate || 0.03)) / pay_periods_per_year;
    const nis_employee = round2(nisPerPeriod);

    const nisEmployerRate = getRate("nis_employer");
    const nis_employer = round2(
      (Math.min(annualGross, nisEmployerRate?.ceiling || nisCeiling) *
        (nisEmployerRate?.rate || 0.03)) / pay_periods_per_year
    );

    // ── NHT: 2% of gross, no ceiling ─────────────────────────
    const nhtRate = getRate("nht");
    const nht = round2(gross_pay * (nhtRate?.rate || 0.02));

    // ── Education Tax: 2.25% of gross ─────────────────────────
    const edTaxRate = getRate("education_tax");
    const education_tax = round2(gross_pay * (edTaxRate?.rate || 0.0225));

    // ── PAYE: Progressive brackets ────────────────────────────
    // Special case: ict_tsr (student interns) are PAYE-exempt
    // below the monthly threshold because they're officially student interns.
    let paye = 0;
    let payeExempt = false;
    let payeExemptReason: string | null = null;

    const payeBracket1 = getRate("paye_25");
    const payeBracket2 = getRate("paye_30");
    const bracket1Threshold = payeBracket1?.threshold || 1500096;
    const bracket2Threshold = payeBracket2?.threshold || 6000000;
    const bracket1Rate = payeBracket1?.rate || 0.25;
    const bracket2Rate = payeBracket2?.rate || 0.30;

    if (role_tier === "ict_tsr") {
      // ICT Student Interns (TSR): exempt from PAYE if annual income
      // is below the personal income threshold (bracket 1 threshold)
      if (annualGross <= bracket1Threshold) {
        payeExempt = true;
        payeExemptReason = "ICT TSR (student intern) — income below PAYE annual threshold";
      }
    }

    if (!payeExempt) {
      // Bracket 1: 25% on income between J$1,500,096 and J$6,000,000
      const taxableInBracket1 = Math.min(
        Math.max(0, annualGross - bracket1Threshold),
        bracket2Threshold - bracket1Threshold
      );

      // Bracket 2: 30% on income above J$6,000,000
      const taxableInBracket2 = Math.max(0, annualGross - bracket2Threshold);

      const annualPaye = (taxableInBracket1 * bracket1Rate) + (taxableInBracket2 * bracket2Rate);
      paye = round2(annualPaye / pay_periods_per_year);
    }

    // ── Totals ────────────────────────────────────────────────
    const total_employee_deductions = round2(nis_employee + nht + education_tax + paye);
    const total_employer_contributions = round2(nis_employer + nht);

    const result: StatutoryResult = {
      nis_employee,
      nis_employer,
      nht,
      education_tax,
      paye,
      total_employee_deductions,
      total_employer_contributions,
      breakdown: {
        nis_employee_rate: nisRate?.rate || 0.03,
        nis_ceiling: nisCeiling,
        nht_rate: nhtRate?.rate || 0.02,
        education_tax_rate: edTaxRate?.rate || 0.0225,
        paye_rate_bracket_1: bracket1Rate,
        paye_rate_bracket_2: bracket2Rate,
        paye_threshold_bracket_1: bracket1Threshold,
        paye_threshold_bracket_2: bracket2Threshold,
        paye_exempt: payeExempt,
        paye_exempt_reason: payeExemptReason,
      },
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
=======
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

      const ratePercent = Number(rateInfo.rate_value);
      const rate = ratePercent / 100; // Convert percentage to decimal
      const ceiling = rateInfo.ceiling_amount ? Number(rateInfo.ceiling_amount) : null;
      
      // Apply ceiling: if base exceeds ceiling, only calculate on the ceiling amount
      const taxableBase = ceiling ? Math.min(base, ceiling) : base;
      const amount = Math.round(taxableBase * rate * 100) / 100;
      
      return { rate: ratePercent, amount, ceiling, capped: ceiling !== null && base > ceiling };
    };

    // Use annual gross for ceiling comparisons if provided, otherwise annualize
    const annualGross = annual_gross || gross_pay * 12;

    // NIS Employee (rate applied to gross, with annual ceiling)
    const nisEmployee = calcDeduction("nis_employee", gross_pay);
    // If there's an annual ceiling, we need to check against annualized amount
    const nisEmployeeCeiling = rateMap.get("nis_employee")?.ceiling_amount;
    if (nisEmployeeCeiling && annualGross > Number(nisEmployeeCeiling)) {
      const monthlyCeiling = Number(nisEmployeeCeiling) / 12;
      nisEmployee.amount = Math.round(monthlyCeiling * (nisEmployee.rate / 100) * 100) / 100;
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
          (standardBracket * (Number(payeRate.rate) / 100) + higherBracket * (Number(payeHigherRate.rate_value) / 100)) * 100
        ) / 100;
      } else {
        payeAmount = Math.round(taxableIncome * (Number(payeRate.rate) / 100) * 100) / 100;
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
>>>>>>> d3ab0c2fa7bcd4cde3e95267f945363666e2a063
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
