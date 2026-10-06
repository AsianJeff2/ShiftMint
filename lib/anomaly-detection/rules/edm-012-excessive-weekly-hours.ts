
import { ValidationRule, ShiftData, AnomalyResult } from '../types';
import { parseTimestamp, getWeekStart, isSameDay } from '../utils';

export const excessiveWeeklyHoursRule: ValidationRule = {
  id: 'EDM-012',
  name: 'Excessive Weekly Hours',
  validate: (shift: ShiftData, allShifts: ShiftData[]): AnomalyResult[] => {
    const anomalies: AnomalyResult[] = [];
    
    const shiftDate = parseTimestamp(shift.start_ts);
    if (!shiftDate) return anomalies;
    
    // Get week start (Sunday)
    const weekStart = getWeekStart(shiftDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    // Get all shifts for this employee in the 7-day window
    const weeklyShifts = allShifts.filter(s => {
      if (s.employee_id !== shift.employee_id || !s.start_ts) return false;
      
      const sDate = parseTimestamp(s.start_ts)!;
      return sDate >= weekStart && sDate < weekEnd;
    });
    
    const totalWeeklyMinutes = weeklyShifts.reduce((sum, s) => sum + (s.duration_min || 0), 0);
    const totalWeeklyHours = totalWeeklyMinutes / 60;
    
    if (totalWeeklyHours > 60) {
      anomalies.push({
        employee_id: shift.employee_id,
        shift_id: shift.id,
        rule_id: 'EDM-012',
        severity: 'WARN',
        description: `Weekly hours (${totalWeeklyHours.toFixed(1)}) exceed 60 hours`
      });
    }
    
    return anomalies;
  }
};
