import { describe, it, expect } from 'vitest';
import { calculateJAStatutory, StatutoryRate } from '../lib/ja-statutory';

const mockRates: StatutoryRate[] = [
  { rate_type: 'nis_employee', rate: 0.03, ceiling: 5000000, threshold: 0 },
  { rate_type: 'nis_employer', rate: 0.03, ceiling: 5000000, threshold: 0 },
  { rate_type: 'nht', rate: 0.02, ceiling: null, threshold: 0 },
  { rate_type: 'education_tax', rate: 0.0225, ceiling: null, threshold: 0 },
  { rate_type: 'paye_25', rate: 0.25, ceiling: null, threshold: 1500096 },
  { rate_type: 'paye_30', rate: 0.30, ceiling: null, threshold: 6000000 },
];

describe('Jamaican Statutory Math', () => {
  it('should correctly calculate deductions for average wage', () => {
    // e.g. J$200,000 per month -> J$2,400,000 annual
    // Roughly J$92,307.69 biweekly (26 periods)
    const result = calculateJAStatutory({
      gross_pay: 92307.69,
      pay_periods_per_year: 26,
      rates: mockRates,
    });

    // NIS: 3% of gross = 2769.23
    expect(result.nis_employee).toBeCloseTo(2769.23);
    expect(result.nis_employer).toBeCloseTo(2769.23);
    
    // NHT: 2% of gross = 1846.15
    expect(result.nht).toBeCloseTo(1846.15);
    
    // Ed Tax: 2.25% of gross = 2076.92
    expect(result.education_tax).toBeCloseTo(2076.92);
    
    // PAYE: Taxable in bracket 1 = Math.max(0, 2400000 - 1500096) = 899904
    // 899904 * 25% = 224976 annually
    // 224976 / 26 = 8652.92
    expect(result.paye).toBeCloseTo(8652.92);

    expect(result.total_employee_deductions).toBeCloseTo(15345.22);
  });

  it('should apply NIS ceiling (J$5,000,000 annual) correctly', () => {
    // Earning J$10,000,000 annually (J$384,615.38 biweekly)
    const result = calculateJAStatutory({
      gross_pay: 384615.38,
      pay_periods_per_year: 26,
      rates: mockRates,
    });

    // NIS should max out at 3% of 5,000,000 = 150,000 annually / 26 = 5769.23
    expect(result.nis_employee).toBe(5769.23);
    
    // NHT has no ceiling: 2% of gross
    expect(result.nht).toBeCloseTo(7692.31);
  });

  it('should calculate PAYE correctly for high earners across both brackets', () => {
    // Earning J$10,000,000 annually (J$384,615.38 biweekly)
    const result = calculateJAStatutory({
      gross_pay: 384615.38,
      pay_periods_per_year: 26,
      rates: mockRates,
    });

    // Bracket 1: 1,500,096 to 6,000,000 = 4,499,904 * 25% = 1,124,976
    // Bracket 2: over 6,000,000 = (10,000,000 - 6,000,000) * 30% = 1,200,000
    // Total PAYE annual = 2,324,976
    // Biweekly = 2,324,976 / 26 = 89422.15
    expect(result.paye).toBe(89422.15);
  });

  it('should exempt ict_tsr role from PAYE if below the threshold', () => {
    // Intern earning J$50,000 biweekly -> J$1,300,000 annually (below 1.5M threshold)
    const result = calculateJAStatutory({
      gross_pay: 50000,
      pay_periods_per_year: 26,
      role_tier: 'ict_tsr',
      rates: mockRates,
    });

    expect(result.paye).toBe(0);
    expect(result.breakdown.paye_exempt).toBe(true);
    expect(result.breakdown.paye_exempt_reason).toContain('ICT TSR');
  });

  it('should NOT exempt ict_tsr role from PAYE if above the threshold', () => {
    // Intern earning J$70,000 biweekly -> J$1,820,000 annually (above 1.5M threshold)
    // Wait, by law, do they get standard PAYE on the excess, or lose the full exemption?
    // According to the logic in our calculate-ja-statutory, if annualGross <= bracket1Threshold, it's exempt.
    // Otherwise, they pay standard PAYE.
    const result = calculateJAStatutory({
      gross_pay: 70000,
      pay_periods_per_year: 26,
      role_tier: 'ict_tsr',
      rates: mockRates,
    });

    expect(result.paye).toBeGreaterThan(0);
    expect(result.breakdown.paye_exempt).toBe(false);
  });
});
