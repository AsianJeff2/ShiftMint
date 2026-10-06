import { describe, it, expect } from 'vitest';
import {
  distributeTipPool,
  validateTipDistribution,
  calculateTipToSalesRatio,
  isValidTipRatio,
  aggregateTips,
  splitTipEqually,
  type TipPoolEmployee,
} from './TipCalculator';

describe('TipCalculator', () => {
  const mockEmployees: TipPoolEmployee[] = [
    { id: '1', name: 'Alice', role: 'server', hoursWorked: 8 },
    { id: '2', name: 'Bob', role: 'server', hoursWorked: 6 },
    { id: '3', name: 'Carol', role: 'bartender', hoursWorked: 8 },
  ];

  describe('distributeTipPool', () => {
    describe('hours-based distribution', () => {
      it('distributes tips proportionally by hours worked', () => {
        const result = distributeTipPool(220, mockEmployees, { method: 'hours' });

        // Total hours: 8 + 6 + 8 = 22
        // Alice: 8/22 * 220 = 80
        // Bob: 6/22 * 220 = 60
        // Carol: 8/22 * 220 = 80
        expect(result).toHaveLength(3);
        expect(result[0].shareAmount).toBe(80);
        expect(result[1].shareAmount).toBe(60);
        expect(result[2].shareAmount).toBe(80);
      });

      it('calculates correct share percentages', () => {
        const result = distributeTipPool(100, mockEmployees, { method: 'hours' });

        // Total hours: 22
        // Alice: 8/22 = 36.36%
        // Bob: 6/22 = 27.27%
        // Carol: 8/22 = 36.36%
        expect(result[0].sharePercentage).toBeCloseTo(36.36, 1);
        expect(result[1].sharePercentage).toBeCloseTo(27.27, 1);
        expect(result[2].sharePercentage).toBeCloseTo(36.36, 1);
      });

      it('handles zero hours gracefully', () => {
        const employees: TipPoolEmployee[] = [
          { id: '1', name: 'Alice', role: 'server', hoursWorked: 0 },
          { id: '2', name: 'Bob', role: 'server', hoursWorked: 0 },
        ];

        const result = distributeTipPool(100, employees, { method: 'hours' });

        expect(result[0].shareAmount).toBe(0);
        expect(result[1].shareAmount).toBe(0);
      });

      it('handles single employee', () => {
        const singleEmployee: TipPoolEmployee[] = [
          { id: '1', name: 'Alice', role: 'server', hoursWorked: 8 },
        ];

        const result = distributeTipPool(100, singleEmployee, { method: 'hours' });

        expect(result[0].shareAmount).toBe(100);
        expect(result[0].sharePercentage).toBe(100);
      });
    });

    describe('percentage-based distribution', () => {
      it('distributes tips based on role percentages', () => {
        const result = distributeTipPool(200, mockEmployees, {
          method: 'percentage',
          percentages: { server: 30, bartender: 40 },
        });

        // Alice (server): 30% of 200 = 60
        // Bob (server): 30% of 200 = 60
        // Carol (bartender): 40% of 200 = 80
        expect(result[0].shareAmount).toBe(60);
        expect(result[1].shareAmount).toBe(60);
        expect(result[2].shareAmount).toBe(80);
      });

      it('gives 0 to roles not in percentages map', () => {
        const employees: TipPoolEmployee[] = [
          { id: '1', name: 'Alice', role: 'server', hoursWorked: 8 },
          { id: '2', name: 'Bob', role: 'cook', hoursWorked: 8 }, // No percentage defined
        ];

        const result = distributeTipPool(100, employees, {
          method: 'percentage',
          percentages: { server: 100 },
        });

        expect(result[0].shareAmount).toBe(100);
        expect(result[1].shareAmount).toBe(0);
      });

      it('handles percentage splits that exceed 100%', () => {
        // This is allowed - percentages don't have to sum to 100
        const result = distributeTipPool(100, mockEmployees, {
          method: 'percentage',
          percentages: { server: 50, bartender: 50 },
        });

        // Each server gets 50
        // Bartender gets 50
        // Total distributed: 150 (more than pool)
        expect(result[0].shareAmount).toBe(50);
        expect(result[1].shareAmount).toBe(50);
        expect(result[2].shareAmount).toBe(50);
      });
    });

    describe('hybrid distribution', () => {
      it('combines percentage and hours methods', () => {
        const result = distributeTipPool(200, mockEmployees, {
          method: 'hybrid',
          percentages: { server: 30, bartender: 40 },
        });

        // Half by percentage (100):
        //   Alice (server): 30
        //   Bob (server): 30
        //   Carol (bartender): 40
        // Half by hours (100):
        //   Alice: 8/22 * 100 = 36.36
        //   Bob: 6/22 * 100 = 27.27
        //   Carol: 8/22 * 100 = 36.36
        // Total:
        //   Alice: 30 + 36.36 = 66.36
        //   Bob: 30 + 27.27 = 57.27
        //   Carol: 40 + 36.36 = 76.36
        expect(result[0].shareAmount).toBeCloseTo(66.36, 1);
        expect(result[1].shareAmount).toBeCloseTo(57.27, 1);
        expect(result[2].shareAmount).toBeCloseTo(76.36, 1);
      });
    });

    describe('minimum hours filter', () => {
      it('filters out employees below minimum hours', () => {
        const result = distributeTipPool(100, mockEmployees, {
          method: 'hours',
          minimumHours: 7,
        });

        // Bob has 6 hours - excluded
        // Alice and Carol split 100: 50 each
        expect(result).toHaveLength(2);
        expect(result[0].employeeName).toBe('Alice');
        expect(result[1].employeeName).toBe('Carol');
        expect(result[0].shareAmount).toBe(50);
        expect(result[1].shareAmount).toBe(50);
      });

      it('returns empty array when no employees meet minimum', () => {
        const result = distributeTipPool(100, mockEmployees, {
          method: 'hours',
          minimumHours: 20,
        });

        expect(result).toHaveLength(0);
      });

      it('includes all employees when minimum is 0', () => {
        const result = distributeTipPool(100, mockEmployees, {
          method: 'hours',
          minimumHours: 0,
        });

        expect(result).toHaveLength(3);
      });
    });

    describe('edge cases', () => {
      it('handles zero tips', () => {
        const result = distributeTipPool(0, mockEmployees, { method: 'hours' });

        expect(result[0].shareAmount).toBe(0);
        expect(result[1].shareAmount).toBe(0);
        expect(result[2].shareAmount).toBe(0);
      });

      it('throws on negative tips', () => {
        expect(() =>
          distributeTipPool(-10, mockEmployees, { method: 'hours' })
        ).toThrow('Total tips cannot be negative');
      });

      it('handles empty employee array', () => {
        const result = distributeTipPool(100, [], { method: 'hours' });

        expect(result).toHaveLength(0);
      });

      it('throws on unknown distribution method', () => {
        expect(() =>
          distributeTipPool(100, mockEmployees, { method: 'invalid' as any })
        ).toThrow('Unknown distribution method');
      });
    });
  });

  describe('validateTipDistribution', () => {
    it('validates correct distribution', () => {
      const shares = distributeTipPool(220, mockEmployees, { method: 'hours' });
      const isValid = validateTipDistribution(shares, 220);

      expect(isValid).toBe(true);
    });

    it('detects incorrect distribution', () => {
      const shares = distributeTipPool(220, mockEmployees, { method: 'hours' });
      const isValid = validateTipDistribution(shares, 300); // Wrong total

      expect(isValid).toBe(false);
    });

    it('allows small rounding differences', () => {
      const shares = distributeTipPool(100, mockEmployees, { method: 'hours' });
      // Adjust one share slightly
      shares[0].shareAmount += 0.02;

      const isValid = validateTipDistribution(shares, 100);

      expect(isValid).toBe(true); // Within 5 cent tolerance
    });

    it('validates empty distribution', () => {
      const isValid = validateTipDistribution([], 0);

      expect(isValid).toBe(true);
    });
  });

  describe('calculateTipToSalesRatio', () => {
    it('calculates correct ratio', () => {
      const ratio = calculateTipToSalesRatio(180, 1000);

      expect(ratio).toBe(0.18); // 18%
    });

    it('handles zero sales', () => {
      const ratio = calculateTipToSalesRatio(100, 0);

      expect(ratio).toBe(0);
    });

    it('handles negative sales gracefully', () => {
      const ratio = calculateTipToSalesRatio(100, -1000);

      expect(ratio).toBe(0);
    });

    it('handles very small ratios', () => {
      const ratio = calculateTipToSalesRatio(5, 1000);

      expect(ratio).toBe(0.005); // 0.5%
    });

    it('handles ratios over 100%', () => {
      const ratio = calculateTipToSalesRatio(1500, 1000);

      expect(ratio).toBe(1.5); // 150%
    });
  });

  describe('isValidTipRatio', () => {
    it('validates typical tip ratios', () => {
      expect(isValidTipRatio(0.15)).toBe(true); // 15%
      expect(isValidTipRatio(0.20)).toBe(true); // 20%
      expect(isValidTipRatio(0.25)).toBe(true); // 25%
    });

    it('rejects too low ratios', () => {
      expect(isValidTipRatio(0.005)).toBe(false); // 0.5%
      expect(isValidTipRatio(0)).toBe(false);
    });

    it('rejects too high ratios', () => {
      expect(isValidTipRatio(0.50)).toBe(false); // 50%
      expect(isValidTipRatio(1.0)).toBe(false); // 100%
    });

    it('accepts edge cases at boundaries', () => {
      expect(isValidTipRatio(0.01)).toBe(true); // Exactly min
      expect(isValidTipRatio(0.40)).toBe(true); // Exactly max
    });

    it('supports custom min/max ratios', () => {
      expect(isValidTipRatio(0.50, 0.10, 0.60)).toBe(true); // 50% with custom range
      expect(isValidTipRatio(0.05, 0.10, 0.30)).toBe(false); // 5% below custom min
    });
  });

  describe('aggregateTips', () => {
    it('sums tip amounts correctly', () => {
      const total = aggregateTips([50, 75, 125]);

      expect(total).toBe(250);
    });

    it('handles single tip', () => {
      const total = aggregateTips([100]);

      expect(total).toBe(100);
    });

    it('handles empty array', () => {
      const total = aggregateTips([]);

      expect(total).toBe(0);
    });

    it('rounds to cents', () => {
      const total = aggregateTips([10.123, 20.456, 30.789]);

      expect(total).toBe(61.37); // Rounded properly
    });

    it('handles negative tips (refunds)', () => {
      const total = aggregateTips([100, -20, 50]);

      expect(total).toBe(130);
    });
  });

  describe('splitTipEqually', () => {
    it('splits tip among employees equally', () => {
      const share = splitTipEqually(100, 4);

      expect(share).toBe(25);
    });

    it('rounds to cents', () => {
      const share = splitTipEqually(100, 3);

      expect(share).toBe(33.33);
    });

    it('handles single employee', () => {
      const share = splitTipEqually(100, 1);

      expect(share).toBe(100);
    });

    it('throws on zero employees', () => {
      expect(() => splitTipEqually(100, 0)).toThrow('Number of employees must be positive');
    });

    it('throws on negative employees', () => {
      expect(() => splitTipEqually(100, -3)).toThrow('Number of employees must be positive');
    });
  });

  describe('Tip distribution invariants', () => {
    it('distributed total approximately equals pool total for hours method', () => {
      const shares = distributeTipPool(100, mockEmployees, { method: 'hours' });

      const distributedTotal = shares.reduce((sum, s) => sum + s.shareAmount, 0);

      // For hours method, total should match pool
      expect(Math.abs(distributedTotal - 100)).toBeLessThan(0.10);
    });

    it('distributed total for percentage method depends on percentages', () => {
      // Note: percentage method can distribute more or less than pool total
      // if percentages don't sum to 100%
      const shares = distributeTipPool(100, mockEmployees, {
        method: 'percentage',
        percentages: { server: 50, bartender: 50 },
      });

      const distributedTotal = shares.reduce((sum, s) => sum + s.shareAmount, 0);

      // Two servers at 50% each + bartender at 50% = 150% of pool
      expect(distributedTotal).toBeCloseTo(150, 0);
    });

    it('hybrid method distributes based on combined percentage and hours', () => {
      const shares = distributeTipPool(100, mockEmployees, {
        method: 'hybrid',
        percentages: { server: 40, bartender: 20 },
      });

      const distributedTotal = shares.reduce((sum, s) => sum + s.shareAmount, 0);

      // Hybrid: 50% by percentage (server: 40%, bartender: 20%) + 50% by hours
      // Expected total depends on the percentages given
      // With 2 servers at 40% each + 1 bartender at 20% = 100% for percentage half
      // Plus hours-based distribution for the other half = approximately 100 total
      expect(Math.abs(distributedTotal - 100)).toBeLessThan(1); // Tighter tolerance since percentages sum to 100%
    });

    it('share percentages sum to approximately 100% for hours method', () => {
      const shares = distributeTipPool(100, mockEmployees, { method: 'hours' });

      const totalPercentage = shares.reduce((sum, s) => sum + s.sharePercentage, 0);

      expect(Math.abs(totalPercentage - 100)).toBeLessThan(0.1);
    });

    it('all shares are non-negative', () => {
      const shares = distributeTipPool(100, mockEmployees, { method: 'hours' });

      shares.forEach(share => {
        expect(share.shareAmount).toBeGreaterThanOrEqual(0);
        expect(share.sharePercentage).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
