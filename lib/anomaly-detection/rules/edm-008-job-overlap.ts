
import { ValidationRule, ShiftData, AnomalyResult } from '../types';
import { parseTimestamp, getMinutesDifference } from '../utils';

export const jobOverlapRule: ValidationRule = {
  id: 'EDM-008',
  name: 'Job Overlap',
  validate: (shift: ShiftData, allShifts: ShiftData[]): AnomalyResult[] => {
    const anomalies: AnomalyResult[] = [];
    
    const currentStart = parseTimestamp(shift.start_ts);
    const currentEnd = parseTimestamp(shift.end_ts);
    
    if (!currentStart || !currentEnd) return anomalies;
    
    // Find overlapping shifts for the same employee with different job codes
    const overlappingShifts = allShifts.filter(s => {
      if (s.employee_id !== shift.employee_id || s.id === shift.id || s.job_code === shift.job_code) {
        return false;
      }
      
      const otherStart = parseTimestamp(s.start_ts);
      const otherEnd = parseTimestamp(s.end_ts);
      
      if (!otherStart || !otherEnd) return false;
      
      // Check for overlap
      const overlapStart = new Date(Math.max(currentStart.getTime(), otherStart.getTime()));
      const overlapEnd = new Date(Math.min(currentEnd.getTime(), otherEnd.getTime()));
      
      if (overlapStart < overlapEnd) {
        const overlapMinutes = getMinutesDifference(overlapStart, overlapEnd);
        return overlapMinutes > 5;
      }
      
      return false;
    });
    
    overlappingShifts.forEach(overlappingShift => {
      const otherStart = parseTimestamp(overlappingShift.start_ts)!;
      const otherEnd = parseTimestamp(overlappingShift.end_ts)!;
      
      const overlapStart = new Date(Math.max(currentStart.getTime(), otherStart.getTime()));
      const overlapEnd = new Date(Math.min(currentEnd.getTime(), otherEnd.getTime()));
      const overlapMinutes = getMinutesDifference(overlapStart, overlapEnd);
      
      anomalies.push({
        employee_id: shift.employee_id,
        shift_id: shift.id,
        rule_id: 'EDM-008',
        severity: 'ERROR',
        description: `Job overlap of ${overlapMinutes.toFixed(0)} minutes between ${shift.job_code} and ${overlappingShift.job_code}`
      });
    });
    
    return anomalies;
  }
};
