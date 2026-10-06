
import { ValidationRule, ShiftData, AnomalyResult } from '../types';
import { getTimeDifferenceInMinutes } from '../utils';

export const scheduleDriftRule: ValidationRule = {
  id: 'EDM-007',
  name: 'Schedule Drift',
  validate: (shift: ShiftData): AnomalyResult[] => {
    const anomalies: AnomalyResult[] = [];
    
    // Check clock-in drift
    if (shift.scheduled_start && shift.start_ts) {
      const clockInDrift = getTimeDifferenceInMinutes(shift.scheduled_start, shift.start_ts);
      
      if (clockInDrift < -30) { // More than 30 min early
        anomalies.push({
          employee_id: shift.employee_id,
          shift_id: shift.id,
          rule_id: 'EDM-007',
          severity: 'WARN',
          description: `Clocked in ${Math.abs(clockInDrift).toFixed(0)} minutes early (>30 min)`
        });
      } else if (clockInDrift > 10) { // More than 10 min late
        anomalies.push({
          employee_id: shift.employee_id,
          shift_id: shift.id,
          rule_id: 'EDM-007',
          severity: 'WARN',
          description: `Clocked in ${clockInDrift.toFixed(0)} minutes late (>10 min)`
        });
      }
    }
    
    // Check clock-out drift
    if (shift.scheduled_end && shift.end_ts) {
      const clockOutDrift = getTimeDifferenceInMinutes(shift.scheduled_end, shift.end_ts);
      
      if (clockOutDrift < -30) { // More than 30 min early
        anomalies.push({
          employee_id: shift.employee_id,
          shift_id: shift.id,
          rule_id: 'EDM-007',
          severity: 'WARN',
          description: `Clocked out ${Math.abs(clockOutDrift).toFixed(0)} minutes early (>30 min)`
        });
      } else if (clockOutDrift > 90) { // More than 90 min late
        anomalies.push({
          employee_id: shift.employee_id,
          shift_id: shift.id,
          rule_id: 'EDM-007',
          severity: 'WARN',
          description: `Clocked out ${clockOutDrift.toFixed(0)} minutes late (>90 min)`
        });
      }
    }
    
    return anomalies;
  }
};
