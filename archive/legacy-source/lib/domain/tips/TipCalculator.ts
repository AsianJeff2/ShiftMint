/**
 * Tip distribution and validation logic - Domain Layer
 *
 * CRITICAL PRINCIPLES:
 * - Pure functions - no side effects
 * - No database dependencies
 * - All business rules for tip pooling and distribution
 * - 100% testable without mocks
 *
 * Tip distribution methods supported:
 * - Percentage: Fixed percentage by role
 * - Hours: Proportional to hours worked
 * - Hybrid: Combination of percentage and hours
 */

export type TipDistributionMethod = 'percentage' | 'hours' | 'hybrid';

export interface TipDistributionRule {
  method: TipDistributionMethod;
  percentages?: Record<string, number>; // role -> percentage (e.g., { server: 60, bartender: 40 })
  minimumHours?: number; // Minimum hours to qualify for tip pool
}

export interface EmployeeTipShare {
  employeeId: string;
  employeeName: string;
  role: string;
  hoursWorked: number;
  shareAmount: number;
  sharePercentage: number;
}

export interface TipPoolEmployee {
  id: string;
  name: string;
  role: string;
  hoursWorked: number;
}

/**
 * Distributes a tip pool among employees based on distribution rules
 *
 * PURE FUNCTION - deterministic and testable
 *
 * @param totalTips - Total tips to distribute
 * @param employees - Employees eligible for tip pool
 * @param rule - Distribution rule to apply
 * @returns Array of employee tip shares
 * @throws Error if validation fails
 */
export function distributeTipPool(
  totalTips: number,
  employees: TipPoolEmployee[],
  rule: TipDistributionRule
): EmployeeTipShare[] {
  // Validation
  if (totalTips < 0) {
    throw new Error('Total tips cannot be negative');
  }

  if (!employees || employees.length === 0) {
    return [];
  }

  // Filter by minimum hours
  const eligibleEmployees = filterByMinimumHours(employees, rule.minimumHours || 0);

  if (eligibleEmployees.length === 0) {
    return [];
  }

  // Distribute based on method
  switch (rule.method) {
    case 'percentage':
      return distributeByPercentage(totalTips, eligibleEmployees, rule.percentages || {});
    case 'hours':
      return distributeByHours(totalTips, eligibleEmployees);
    case 'hybrid':
      return distributeHybrid(totalTips, eligibleEmployees, rule.percentages || {});
    default:
      throw new Error(`Unknown distribution method: ${rule.method}`);
  }
}

/**
 * Filters employees who meet minimum hours requirement
 */
function filterByMinimumHours(employees: TipPoolEmployee[], minimumHours: number): TipPoolEmployee[] {
  return employees.filter(emp => emp.hoursWorked >= minimumHours);
}

/**
 * Distributes tips based on fixed percentages by role
 * Each role gets a predetermined percentage of the pool
 */
function distributeByPercentage(
  totalTips: number,
  employees: TipPoolEmployee[],
  percentages: Record<string, number>
): EmployeeTipShare[] {
  return employees.map(emp => {
    const rolePercentage = percentages[emp.role] || 0;
    const shareAmount = (totalTips * rolePercentage) / 100;

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      role: emp.role,
      hoursWorked: emp.hoursWorked,
      shareAmount: roundToCents(shareAmount),
      sharePercentage: rolePercentage,
    };
  });
}

/**
 * Distributes tips proportionally based on hours worked
 * More hours = larger share of pool
 */
function distributeByHours(totalTips: number, employees: TipPoolEmployee[]): EmployeeTipShare[] {
  const totalHours = employees.reduce((sum, emp) => sum + emp.hoursWorked, 0);

  if (totalHours === 0) {
    // No hours worked - equal split or no distribution
    return employees.map(emp => ({
      employeeId: emp.id,
      employeeName: emp.name,
      role: emp.role,
      hoursWorked: emp.hoursWorked,
      shareAmount: 0,
      sharePercentage: 0,
    }));
  }

  return employees.map(emp => {
    const sharePercentage = (emp.hoursWorked / totalHours) * 100;
    const shareAmount = (totalTips * emp.hoursWorked) / totalHours;

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      role: emp.role,
      hoursWorked: emp.hoursWorked,
      shareAmount: roundToCents(shareAmount),
      sharePercentage: roundToCents(sharePercentage),
    };
  });
}

/**
 * Hybrid distribution: 50% by role percentage, 50% by hours
 * Balances fairness with role-based compensation
 */
function distributeHybrid(
  totalTips: number,
  employees: TipPoolEmployee[],
  percentages: Record<string, number>
): EmployeeTipShare[] {
  // Split pool in half
  const halfPool = totalTips / 2;

  // Distribute each half differently
  const byPercentage = distributeByPercentage(halfPool, employees, percentages);
  const byHours = distributeByHours(halfPool, employees);

  // Combine results
  return employees.map((emp, index) => {
    const percentageShare = byPercentage[index].shareAmount;
    const hoursShare = byHours[index].shareAmount;
    const totalShare = percentageShare + hoursShare;

    const percentageFromPercentage = byPercentage[index].sharePercentage;
    const percentageFromHours = byHours[index].sharePercentage;
    const avgPercentage = (percentageFromPercentage + percentageFromHours) / 2;

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      role: emp.role,
      hoursWorked: emp.hoursWorked,
      shareAmount: roundToCents(totalShare),
      sharePercentage: roundToCents(avgPercentage),
    };
  });
}

/**
 * Validates that tip distribution totals match the pool
 *
 * Invariant: Sum of all shares ≈ total tips (within rounding tolerance)
 */
export function validateTipDistribution(
  shares: EmployeeTipShare[],
  totalTips: number
): boolean {
  const tolerance = 0.05; // 5 cents tolerance for rounding
  const distributedTotal = shares.reduce((sum, share) => sum + share.shareAmount, 0);

  return Math.abs(distributedTotal - totalTips) <= tolerance;
}

/**
 * Calculates tip-to-sales ratio for anomaly detection
 * Typical range: 15-20% for full-service restaurants
 *
 * @param tips - Total tips
 * @param sales - Total sales
 * @returns Ratio as decimal (e.g., 0.18 for 18%)
 */
export function calculateTipToSalesRatio(tips: number, sales: number): number {
  if (sales <= 0) {
    return 0;
  }

  return roundToPercent(tips / sales);
}

/**
 * Validates tip-to-sales ratio is within acceptable range
 *
 * @param ratio - Tip-to-sales ratio
 * @param minRatio - Minimum acceptable ratio (default 0.01 = 1%)
 * @param maxRatio - Maximum acceptable ratio (default 0.40 = 40%)
 */
export function isValidTipRatio(
  ratio: number,
  minRatio: number = 0.01,
  maxRatio: number = 0.40
): boolean {
  return ratio >= minRatio && ratio <= maxRatio;
}

/**
 * Rounds a monetary value to cents (2 decimal places)
 */
function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Rounds a percentage to 2 decimal places
 */
function roundToPercent(value: number): number {
  return Math.round(value * 10000) / 10000; // 4 decimal places for percentages
}

/**
 * Calculates total tips for an employee across multiple entries
 */
export function aggregateTips(tipAmounts: number[]): number {
  const total = tipAmounts.reduce((sum, amount) => sum + amount, 0);
  return roundToCents(total);
}

/**
 * Splits a tip amount among multiple employees equally
 */
export function splitTipEqually(tipAmount: number, numberOfEmployees: number): number {
  if (numberOfEmployees <= 0) {
    throw new Error('Number of employees must be positive');
  }

  return roundToCents(tipAmount / numberOfEmployees);
}
