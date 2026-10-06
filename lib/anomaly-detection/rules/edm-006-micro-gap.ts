
import { ValidationRule, ShiftData, AnomalyResult } from '../types';
import { parseTimestamp, getMinutesDifference } from '../utils';

export const microGapRule: ValidationRule = {
  id: 'EDM-006',
  name: 'Micro-gap',
  validate: (shift: ShiftData, allShifts: ShiftData[]): AnomalyResult[] => {
    const anomalies: AnomalyResult[] = [];
    
    const currentEnd = parseTimestamp(shift.end_ts);
    if (!currentEnd) return anomalies;
    
    // Find other shifts for the same employee
    const employeeShifts = allShifts
      .filter(s => 
        s.employee_id === shift.employee_id && 
        s.id !== shift.id &&
        s.start_ts
      )
      .map(s => ({ ...s, startTime: parseTimestamp(s.start_ts)! }))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    // Check for shifts starting shortly after this one ends
    const closeShifts = employeeShifts.filter(s => {
      const gap = getMinutesDifference(currentEnd, s.startTime);
      return gap > 0 && gap < 4;
    });
    
    closeShifts.forEach(closeShift => {
      const gap = getMinutesDifference(currentEnd, closeShift.startTime);
      anomalies.push({
        employee_id: shift.employee_id,
        shift_id: shift.id,
        rule_id: 'EDM-006',
        severity: 'WARN',
        description: `Gap of ${gap.toFixed(0)} minutes between shifts is less than 4 minutes`
      });
    });
    
    return anomalies;
  }
};
