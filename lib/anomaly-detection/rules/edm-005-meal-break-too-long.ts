
import { ValidationRule, ShiftData, AnomalyResult, PunchData, AnomalyDetectionOptions } from '../types';
import { getMinutesDifference, parseTimestamp } from '../utils';

export const mealBreakTooLongRule: ValidationRule = {
  id: 'EDM-005',
  name: 'Meal Break Too Long',
  validate: (shift: ShiftData, allShifts: ShiftData[], punches?: PunchData[], options?: AnomalyDetectionOptions): AnomalyResult[] => {
    const anomalies: AnomalyResult[] = [];
    
    if (!punches) return anomalies;
    
    // Get break punches for this employee during the shift
    const shiftStart = parseTimestamp(shift.start_ts);
    const shiftEnd = parseTimestamp(shift.end_ts);
    
    if (!shiftStart || !shiftEnd) return anomalies;
    
    const breakPunches = punches
      .filter(p => 
        p.employee_id === shift.employee_id &&
        (p.punch_type === 'BREAK_OUT' || p.punch_type === 'BREAK_IN')
      )
      .map(p => ({ ...p, timestamp: parseTimestamp(p.ts_utc)! }))
      .filter(p => p.timestamp >= shiftStart && p.timestamp <= shiftEnd)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Pair BREAK_OUT with BREAK_IN
    for (let i = 0; i < breakPunches.length - 1; i++) {
      const breakOut = breakPunches[i];
      const breakIn = breakPunches[i + 1];
      
      if (breakOut.punch_type === 'BREAK_OUT' && breakIn.punch_type === 'BREAK_IN') {
        const breakDuration = getMinutesDifference(breakOut.timestamp, breakIn.timestamp);
        
        if (breakDuration > 120) {
          anomalies.push({
            employee_id: shift.employee_id,
            shift_id: shift.id,
            rule_id: 'EDM-005',
            severity: 'WARN',
            description: `Break duration of ${breakDuration.toFixed(0)} minutes exceeds 120 minutes`
          });
        }
      }
    }
    
    return anomalies;
  }
};
