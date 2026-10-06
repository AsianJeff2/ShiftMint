
import { ValidationRule, ShiftData, AnomalyResult, PunchData } from '../types';
import { parseTimestamp } from '../utils';

export const impossibleOrderRule: ValidationRule = {
  id: 'EDM-001',
  name: 'Impossible Order',
  validate: (shift: ShiftData, allShifts: ShiftData[], punches?: PunchData[]): AnomalyResult[] => {
    const anomalies: AnomalyResult[] = [];
    
    // Check if OUT < IN
    const startTime = parseTimestamp(shift.start_ts);
    const endTime = parseTimestamp(shift.end_ts);
    
    if (startTime && endTime && endTime < startTime) {
      anomalies.push({
        employee_id: shift.employee_id,
        shift_id: shift.id,
        rule_id: 'EDM-001',
        severity: 'ERROR',
        description: 'Clock-out time is before clock-in time'
      });
    }
    
    // Check punch sequence if available
    if (punches) {
      const shiftPunches = punches
        .filter(p => p.employee_id === shift.employee_id)
        .sort((a, b) => new Date(a.ts_utc).getTime() - new Date(b.ts_utc).getTime());
      
      for (let i = 1; i < shiftPunches.length; i++) {
        const prev = shiftPunches[i - 1];
        const curr = shiftPunches[i];
        
        // Check for consecutive IN/IN or OUT/OUT
        if (
          (prev.punch_type === 'IN' && curr.punch_type === 'IN') ||
          (prev.punch_type === 'OUT' && curr.punch_type === 'OUT')
        ) {
          anomalies.push({
            employee_id: shift.employee_id,
            shift_id: shift.id,
            rule_id: 'EDM-001',
            severity: 'ERROR',
            description: `Consecutive ${prev.punch_type} punches detected`
          });
        }
      }
    }
    
    return anomalies;
  }
};
