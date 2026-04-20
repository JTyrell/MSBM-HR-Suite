export interface StatutoryRate {
  rate_type: string;
  rate: number;
  ceiling: number | null;
  threshold: number;
}

export interface StatutoryInput {
  gross_pay: number;
  annualized_gross?: number;
  role_tier?: string;
  paye_tax_code?: string;
  pay_periods_per_year?: number;
  rates: StatutoryRate[];
}

export interface StatutoryResult {
  nis_employee: number;
  nis_employer: number;
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

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateJAStatutory(input: StatutoryInput): StatutoryResult {
  const {
    gross_pay,
    annualized_gross,
    role_tier,
    pay_periods_per_year = 26,
    rates,
  } = input;

  const getRate = (type: string): StatutoryRate | undefined => rates.find(r => r.rate_type === type);

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
    if (annualGross <= bracket1Threshold) {
      payeExempt = true;
      payeExemptReason = "ICT TSR (student intern) — income below PAYE annual threshold";
    }
  }

  if (!payeExempt) {
    const taxableInBracket1 = Math.min(
      Math.max(0, annualGross - bracket1Threshold),
      bracket2Threshold - bracket1Threshold
    );
    const taxableInBracket2 = Math.max(0, annualGross - bracket2Threshold);
    const annualPaye = (taxableInBracket1 * bracket1Rate) + (taxableInBracket2 * bracket2Rate);
    paye = round2(annualPaye / pay_periods_per_year);
  }

  const total_employee_deductions = round2(nis_employee + nht + education_tax + paye);
  const total_employer_contributions = round2(nis_employer + nht);

  return {
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
}
