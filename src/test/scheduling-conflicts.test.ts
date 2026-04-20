import { describe, it, expect } from 'vitest';
import { evaluateSchedulingRules, checkOverlappingShifts, SchedulingRule, ShiftDetails } from '../lib/scheduling';

const globalRules: SchedulingRule[] = [
  { rule_type: 'max_shift_hours', value: 8 },
  { rule_type: 'overtime_weekly_threshold', value: 40 },
  { rule_type: 'min_break_minutes', value: 60 },
];

describe('Scheduling Conflicts Math', () => {
  describe('evaluateSchedulingRules', () => {
    it('should return no conflicts for a valid 8-hour shift', () => {
      const shift: ShiftDetails = {
        start_time: '2023-10-10T09:00:00Z',
        end_time: '2023-10-10T17:00:00Z', // 8 hours
        break_minutes: 60,
      };

      const existingShifts: ShiftDetails[] = [];

      const conflicts = evaluateSchedulingRules(shift, existingShifts, globalRules);
      expect(conflicts).toHaveLength(0);
    });

    it('should flag a max_shift violation if shift exceeds 8 hours', () => {
      const shift: ShiftDetails = {
        start_time: '2023-10-10T09:00:00Z',
        end_time: '2023-10-10T19:00:00Z', // 10 hours
        break_minutes: 60,
      };

      const conflicts = evaluateSchedulingRules(shift, [], globalRules);
      expect(conflicts).toContainEqual(
        expect.objectContaining({ type: 'max_shift', severity: 'warning' })
      );
    });

    it('should flag a break violation if shift >= 5 hours and break < 60 mins', () => {
      const shift: ShiftDetails = {
        start_time: '2023-10-10T09:00:00Z',
        end_time: '2023-10-10T15:00:00Z', // 6 hours
        break_minutes: 30, // less than 60
      };

      const conflicts = evaluateSchedulingRules(shift, [], globalRules);
      expect(conflicts).toContainEqual(
        expect.objectContaining({ type: 'break_violation', severity: 'warning' })
      );
    });

    it('should flag overtime if weekly hours exceed 40', () => {
      const shift: ShiftDetails = {
        start_time: '2023-10-14T09:00:00Z',
        end_time: '2023-10-14T17:00:00Z', // 8 hours, 1 hour break = 7 payable hours
        break_minutes: 60,
      };

      // Existing 35 payable hours in the week
      const existingShifts: ShiftDetails[] = [
        {
          start_time: '2023-10-09T09:00:00Z',
          end_time: '2023-10-09T17:00:00Z',
          break_minutes: 60,
        },
        {
          start_time: '2023-10-10T09:00:00Z',
          end_time: '2023-10-10T17:00:00Z',
          break_minutes: 60,
        },
        {
          start_time: '2023-10-11T09:00:00Z',
          end_time: '2023-10-11T17:00:00Z',
          break_minutes: 60,
        },
        {
          start_time: '2023-10-12T09:00:00Z',
          end_time: '2023-10-12T17:00:00Z',
          break_minutes: 60,
        },
        {
          start_time: '2023-10-13T09:00:00Z',
          end_time: '2023-10-13T17:00:00Z',
          break_minutes: 60,
        },
      ]; // 5 days * 7 hours = 35 hours

      // Proposed + existing = 42 payable hours => over 40 limit
      const conflicts = evaluateSchedulingRules(shift, existingShifts, globalRules);
      expect(conflicts).toContainEqual(
        expect.objectContaining({ type: 'overtime', severity: 'warning' })
      );
    });
  });

  describe('checkOverlappingShifts', () => {
    it('should detect overlap when a proposed shift overlaps existing shift completely', () => {
      const shift: ShiftDetails = { start_time: '2023-10-10T10:00:00Z', end_time: '2023-10-10T16:00:00Z', break_minutes: 60 };
      const existing: ShiftDetails[] = [{ start_time: '2023-10-10T09:00:00Z', end_time: '2023-10-10T17:00:00Z', break_minutes: 60 }];
      expect(checkOverlappingShifts(shift, existing)).toBe(true);
    });

    it('should detect overlap when proposed intersects start of existing', () => {
      const shift: ShiftDetails = { start_time: '2023-10-10T08:00:00Z', end_time: '2023-10-10T12:00:00Z', break_minutes: 0 };
      const existing: ShiftDetails[] = [{ start_time: '2023-10-10T11:00:00Z', end_time: '2023-10-10T17:00:00Z', break_minutes: 60 }];
      expect(checkOverlappingShifts(shift, existing)).toBe(true);
    });

    it('should NOT detect overlap when back-to-back', () => {
      const shift: ShiftDetails = { start_time: '2023-10-10T08:00:00Z', end_time: '2023-10-10T12:00:00Z', break_minutes: 0 };
      const existing: ShiftDetails[] = [{ start_time: '2023-10-10T12:00:00Z', end_time: '2023-10-10T17:00:00Z', break_minutes: 60 }];
      expect(checkOverlappingShifts(shift, existing)).toBe(false);
    });
  });
});
