
import { ValidationRule, ShiftData, AnomalyResult, AnomalyDetectionOptions, PunchData } from '../types';

export const tipSalesRatioRule: ValidationRule = {
  id: 'EDM-010',
  name: 'Tip-to-Sales Ratio',
  validate: (shift: ShiftData, allShifts: ShiftData[], punches?: PunchData[], options?: AnomalyDetectionOptions): AnomalyResult[] => {
    const anomalies: AnomalyResult[] = [];
    
    if (!shift.tips_amount || !shift.sales_amount || shift.sales_amount === 0) {
      return anomalies;
    }
    
    const ratio = shift.tips_amount / shift.sales_amount;
    const minRatio = options?.tipSalesRatioMin ?? 0.01; // 1%
    const maxRatio = options?.tipSalesRatioMax ?? 0.40; // 40%
    
    if (ratio < minRatio) {
      anomalies.push({
        employee_id: shift.employee_id,
        shift_id: shift.id,
        rule_id: 'EDM-010',
        severity: 'WARN',
        description: `Tip-to-sales ratio of ${(ratio * 100).toFixed(1)}% is below ${(minRatio * 100)}%`
      });
    } else if (ratio > maxRatio) {
      anomalies.push({
        employee_id: shift.employee_id,
        shift_id: shift.id,
        rule_id: 'EDM-010',
        severity: 'WARN',
        description: `Tip-to-sales ratio of ${(ratio * 100).toFixed(1)}% exceeds ${(maxRatio * 100)}%`
      });
    }
    
    return anomalies;
  }
};
