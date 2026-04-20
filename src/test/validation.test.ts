import { describe, it, expect } from 'vitest';
import { 
  trnSchema, 
  nisSchema, 
  payeCodeSchema, 
  contractTypeSchema, 
  roleTierSchema, 
  jaComplianceSchema 
} from '../lib/validation/employee';

describe('Jamaican Statutory Validation Schemas', () => {
  describe('TRN Schema', () => {
    it('should validate a valid 9-digit TRN', () => {
      expect(trnSchema.safeParse('123456789').success).toBe(true);
    });

    it('should reject TRN with less than 9 digits', () => {
      const result = trnSchema.safeParse('12345678');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('TRN must be exactly 9 digits');
      }
    });

    it('should reject TRN with more than 9 digits', () => {
      expect(trnSchema.safeParse('1234567890').success).toBe(false);
    });

    it('should reject TRN containing non-numeric characters', () => {
      expect(trnSchema.safeParse('12345678a').success).toBe(false);
    });

    it('should allow null or empty if optional', () => {
      expect(trnSchema.safeParse(null).success).toBe(true);
      expect(trnSchema.safeParse(undefined).success).toBe(true);
    });
  });

  describe('NIS Schema', () => {
    it('should validate a valid NIS format XX-XXXXXX-X', () => {
      expect(nisSchema.safeParse('A1-123456-7').success).toBe(false); // First two must be digits according to regex ^\d{2}-\d{6}-\d$
      expect(nisSchema.safeParse('12-345678-9').success).toBe(true);
    });

    it('should reject NIS with incorrect formatting', () => {
      expect(nisSchema.safeParse('123456789').success).toBe(false);
      expect(nisSchema.safeParse('12-34567-89').success).toBe(false);
      expect(nisSchema.safeParse('A2-345678-9').success).toBe(false);
    });

    it('should allow null or empty if optional', () => {
      expect(nisSchema.safeParse(null).success).toBe(true);
      expect(nisSchema.safeParse(undefined).success).toBe(true);
    });
  });

  describe('NHT Schema (within jaComplianceSchema)', () => {
    it('should validate NHT number length constraint', () => {
      const validMock = {
        nht_number: '12345678901234567890',
      };
      
      const validation = jaComplianceSchema.safeParse(validMock);
      // Since all other properties are optional/nullable in jaComplianceSchema, this should pass.
      expect(validation.success).toBe(true);
    });

    it('should reject NHT number exceeding 20 characters', () => {
      const invalidMock = {
        nht_number: '123456789012345678901',
      };
      const validation = jaComplianceSchema.safeParse(invalidMock);
      expect(validation.success).toBe(false);
    });
  });

  describe('PAYE Tax Code Schema', () => {
    it('should validate correct PAYE tax codes', () => {
      expect(payeCodeSchema.safeParse('A').success).toBe(true);
      expect(payeCodeSchema.safeParse('C').success).toBe(true);
      expect(payeCodeSchema.safeParse('E').success).toBe(true);
    });

    it('should reject invalid PAYE tax codes', () => {
      expect(payeCodeSchema.safeParse('F').success).toBe(false);
      expect(payeCodeSchema.safeParse('1').success).toBe(false);
    });
  });

  describe('Contract Type Schema', () => {
    it('should validate valid contract types', () => {
      expect(contractTypeSchema.safeParse('permanent').success).toBe(true);
      expect(contractTypeSchema.safeParse('probation').success).toBe(true);
    });

    it('should reject invalid contract types', () => {
      expect(contractTypeSchema.safeParse('full-time').success).toBe(false);
    });
  });

  describe('Role Tier Schema', () => {
    it('should validate valid role tiers', () => {
      expect(roleTierSchema.safeParse('ict_tsr').success).toBe(true);
      expect(roleTierSchema.safeParse('executive').success).toBe(true);
    });

    it('should reject invalid role tiers', () => {
      expect(roleTierSchema.safeParse('intern').success).toBe(false);
    });
  });
});
