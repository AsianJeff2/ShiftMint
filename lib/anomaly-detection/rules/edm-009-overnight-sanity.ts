
import { ValidationRule, ShiftData, AnomalyResult, AnomalyDetectionOptions, PunchData } from '../types';
import { parseTimestamp, isTimeBetween, parseTimeString } from '../utils';

export const overnightSanityRule: ValidationRule = {
  id: 'EDM-009',
  name: 'Overnight Sanity',
  validate: (shift: ShiftData, allShifts: ShiftData[], punches?: PunchData[], options?: AnomalyDetectionOptions): AnomalyResult[] => {
    const anomalies: AnomalyResult[] = [];
    
    if (!shift.duration_min) return anomalies;
    
    const hours = shift.duration_min / 60;
    
    // Check if shift > 18 hours
    if (hours > 18) {
      anomalies.push({
        employee_id: shift.employee_id,
        shift_id: shift.id,
        rule_id: 'EDM-009',
        severity: 'ERROR',
        description: `Shift duration of ${hours.toFixed(1)} hours exceeds 18 hours`
      });
    }
    
    // Check overnight shift logic
    const startTime = parseTimestamp(shift.start_ts);
    const endTime = parseTimestamp(shift.end_ts);
    
    if (startTime && endTime && options?.venueClosingTime) {
      const venueClosing = parseTimeString(options.venueClosingTime);
      
      // Check if shift includes more than 3 hours between 2 AM and 5 AM
      let midnightHours = 0;
      const current = new Date(startTime);
      
      while (current < endTime) {
        if (isTimeBetween(current, 2, 5)) {
          midnightHours += 1/60; // Add 1 minute
        }
        current.setMinutes(current.getMinutes() + 1);
      }
      
      // If venue closes before 2 AM and shift has >3h between 2-5 AM
      if (venueClosing.hours < 2 && midnightHours > 3) {
        anomalies.push({
          employee_id: shift.employee_id,
          shift_id: shift.id,
          rule_id: 'EDM-009',
          severity: 'WARN',
          description: `Shift includes ${midnightHours.toFixed(1)} hours between 2-5 AM while venue closes before 2 AM`
        });
      }
    }
    
    return anomalies;
  }
};
