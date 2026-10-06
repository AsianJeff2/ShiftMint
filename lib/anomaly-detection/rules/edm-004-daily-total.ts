
import { ValidationRule, ShiftData, AnomalyResult } from '../types';
import { parseTimestamp, isSameDay } from '../utils';

export const dailyTotalRule: ValidationRule = {
  id: 'EDM-004',
  name: 'Daily Total',
  validate: (shift: ShiftData, allShifts: ShiftData[]): AnomalyResult[] => {
    const anomalies: AnomalyResult[] = [];
    
    const shiftDate = parseTimestamp(shift.start_ts);
    if (!shiftDate) return anomalies;
    
    // Get all shifts for this employee on the same day
    const dailyShifts = allShifts.filter(s => 
      s.employee_id === shift.employee_id &&
      s.start_ts &&
      isSameDay(parseTimestamp(s.start_ts)!, shiftDate)
    );
    
    const totalDailyMinutes = dailyShifts.reduce((sum, s) => sum + (s.duration_min || 0), 0);
    const totalDailyHours = totalDailyMinutes / 60;
    
    if (totalDailyHours > 14) {
      anomalies.push({
        employee_id: shift.employee_id,
        shift_id: shift.id,
        rule_id: 'EDM-004',
        severity: 'WARN',
        description: `Total daily hours (${totalDailyHours.toFixed(1)}) exceed 14 hours`
      });
    }
    
    return anomalies;
  }
};
