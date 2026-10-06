
import { ValidationRule, ShiftData, AnomalyResult, PunchData, AnomalyDetectionOptions } from '../types';

export const missingPunchRule: ValidationRule = {
  id: 'EDM-011',
  name: 'Missing Punch',
  validate: (shift: ShiftData, allShifts: ShiftData[], punches?: PunchData[], options?: AnomalyDetectionOptions): AnomalyResult[] => {
    const anomalies: AnomalyResult[] = [];
    
    if (!shift.start_ts) {
      anomalies.push({
        employee_id: shift.employee_id,
        shift_id: shift.id,
        rule_id: 'EDM-011',
        severity: 'ERROR',
        description: 'Missing clock-in timestamp'
      });
    }
    
    if (shift.status === 'CLOSED' && !shift.end_ts) {
      anomalies.push({
        employee_id: shift.employee_id,
        shift_id: shift.id,
        rule_id: 'EDM-011',
        severity: 'ERROR',
        description: 'Missing clock-out timestamp for closed shift'
      });
    }
    
    return anomalies;
  }
};
