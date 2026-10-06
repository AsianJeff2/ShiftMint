
import { ShiftData, PunchData, AnomalyResult, ValidationRule, AnomalyDetectionOptions } from './types';

// Import all validation rules
import { impossibleOrderRule } from './rules/edm-001-impossible-order';
import { tooShortRule } from './rules/edm-002-too-short';
import { tooLongRule } from './rules/edm-003-too-long';
import { dailyTotalRule } from './rules/edm-004-daily-total';
import { mealBreakTooLongRule } from './rules/edm-005-meal-break-too-long';
import { microGapRule } from './rules/edm-006-micro-gap';
import { scheduleDriftRule } from './rules/edm-007-schedule-drift';
import { jobOverlapRule } from './rules/edm-008-job-overlap';
import { overnightSanityRule } from './rules/edm-009-overnight-sanity';
import { tipSalesRatioRule } from './rules/edm-010-tip-sales-ratio';
import { missingPunchRule } from './rules/edm-011-missing-punch';
import { excessiveWeeklyHoursRule } from './rules/edm-012-excessive-weekly-hours';
import { incompleteDataRule } from './rules/edm-013-incomplete-data';

/**
 * Anomaly Detection Engine for Payroll Validation
 * 
 * This system replaces the AI component in the payroll error detection dashboard
 * with a rule-based anomaly detection algorithm.
 */
export class AnomalyDetectionEngine {
  private rules: ValidationRule[];
  private options: AnomalyDetectionOptions;

  constructor(options: AnomalyDetectionOptions = {}) {
    this.options = {
      venueClosingTime: '02:00',
      tipSalesRatioMin: 0.01,
      tipSalesRatioMax: 0.40,
      ...options
    };

    // Initialize all validation rules
    this.rules = [
      impossibleOrderRule,
      tooShortRule,
      tooLongRule,
      dailyTotalRule,
      mealBreakTooLongRule,
      microGapRule,
      scheduleDriftRule,
      jobOverlapRule,
      overnightSanityRule,
      tipSalesRatioRule,
      missingPunchRule,
      excessiveWeeklyHoursRule,
      incompleteDataRule
    ];
  }

  /**
   * Main validation function that processes shifts and returns anomalies
   * @param shifts - Array of shift data to validate
   * @param punches - Optional array of punch events for advanced validation
   * @returns Array of detected anomalies
   */
  public detectAnomalies(shifts: ShiftData[], punches?: PunchData[]): AnomalyResult[] {
    const allAnomalies: AnomalyResult[] = [];

    // Process each shift through all validation rules
    for (const shift of shifts) {
      for (const rule of this.rules) {
        try {
          const anomalies = rule.validate(shift, shifts, punches, this.options);
          allAnomalies.push(...anomalies);
        } catch (error) {
          console.error(`Error in rule ${rule.id}:`, error);
          // Continue with other rules even if one fails
        }
      }
    }

    return allAnomalies;
  }

  /**
   * Get all available validation rules
   */
  public getRules(): ValidationRule[] {
    return [...this.rules];
  }

  /**
   * Enable or disable specific rules
   */
  public setRuleStatus(ruleId: string, enabled: boolean): void {
    if (enabled) {
      // Add rule back if it was removed
      const allRules = [
        impossibleOrderRule,
        tooShortRule,
        tooLongRule,
        dailyTotalRule,
        mealBreakTooLongRule,
        microGapRule,
        scheduleDriftRule,
        jobOverlapRule,
        overnightSanityRule,
        tipSalesRatioRule,
        missingPunchRule,
        excessiveWeeklyHoursRule,
        incompleteDataRule
      ];
      
      const rule = allRules.find(r => r.id === ruleId);
      if (rule && !this.rules.find(r => r.id === ruleId)) {
        this.rules.push(rule);
      }
    } else {
      // Remove rule from active rules
      this.rules = this.rules.filter(r => r.id !== ruleId);
    }
  }

  /**
   * Update detection options
   */
  public updateOptions(newOptions: Partial<AnomalyDetectionOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}

/**
 * Convenience function for quick anomaly detection
 * @param shifts - Array of shift data to validate
 * @param punches - Optional array of punch events
 * @param options - Optional configuration options
 * @returns Array of detected anomalies
 */
export function detectPayrollAnomalies(
  shifts: ShiftData[], 
  punches?: PunchData[], 
  options?: AnomalyDetectionOptions
): AnomalyResult[] {
  const engine = new AnomalyDetectionEngine(options);
  return engine.detectAnomalies(shifts, punches);
}
