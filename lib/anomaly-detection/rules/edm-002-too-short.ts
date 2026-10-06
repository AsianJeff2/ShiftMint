
import { ValidationRule, ShiftData, AnomalyResult, PunchData, AnomalyDetectionOptions } from '../types';

export const tooShortRule: ValidationRule = {
  id: 'EDM-002',
  name: 'Too Short',
  validate: (shift: ShiftData, allShifts: ShiftData[], punches?: PunchData[], options?: AnomalyDetectionOptions): AnomalyResult[] => {
    const anomalies: AnomalyResult[] = [];
    
    if (shift.duration_min && shift.duration_min < 60) {
      anomalies.push({
        employee_id: shift.employee_id,
        shift_id: shift.id,
        rule_id: 'EDM-002',
        severity: 'WARN',
        description: `Shift duration of ${shift.duration_min} minutes is less than 60 minutes`
      });
    }
    
    return anomalies;
  }
};
