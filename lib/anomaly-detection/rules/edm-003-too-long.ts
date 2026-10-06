
import { ValidationRule, ShiftData, AnomalyResult, PunchData, AnomalyDetectionOptions } from '../types';

export const tooLongRule: ValidationRule = {
  id: 'EDM-003',
  name: 'Too Long',
  validate: (shift: ShiftData, allShifts: ShiftData[], punches?: PunchData[], options?: AnomalyDetectionOptions): AnomalyResult[] => {
    const anomalies: AnomalyResult[] = [];
    
    if (shift.duration_min) {
      const hours = shift.duration_min / 60;
      
      if (hours > 14) {
        anomalies.push({
          employee_id: shift.employee_id,
          shift_id: shift.id,
          rule_id: 'EDM-003',
          severity: 'ERROR',
          description: `Shift duration of ${hours.toFixed(1)} hours exceeds 14 hours`
        });
      } else if (hours > 12) {
        anomalies.push({
          employee_id: shift.employee_id,
          shift_id: shift.id,
          rule_id: 'EDM-003',
          severity: 'WARN',
          description: `Shift duration of ${hours.toFixed(1)} hours exceeds 12 hours`
        });
      }
    }
    
    return anomalies;
  }
};
