import { ValidationRule, ShiftData, AnomalyResult, PunchData, AnomalyDetectionOptions } from '../types';

export const incompleteDataRule: ValidationRule = {
  id: 'EDM-013',
  name: 'Incomplete Shift Data',
  validate: (shift: ShiftData, allShifts: ShiftData[], punches?: PunchData[], options?: AnomalyDetectionOptions): AnomalyResult[] => {
    const anomalies: AnomalyResult[] = [];
    
    // Check for missing employee assignment
    if (!shift.employee_id) {
      anomalies.push({
        employee_id: shift.employee_id || 'unknown',
        shift_id: shift.id,
        rule_id: 'EDM-013',
        severity: 'ERROR',
        description: 'Unassigned shift - no employee specified'
      });
    }
    
    // Check for missing end time on closed shifts
    if (!shift.end_ts && shift.status === 'CLOSED') {
      anomalies.push({
        employee_id: shift.employee_id || 'unknown',
        shift_id: shift.id,
        rule_id: 'EDM-013',
        severity: 'WARN',
        description: 'Closed shift missing end time'
      });
    }
    
    // Check for open shift without end time (expected but flag as info)
    if (!shift.end_ts && shift.status === 'OPEN') {
      anomalies.push({
        employee_id: shift.employee_id || 'unknown',
        shift_id: shift.id,
        rule_id: 'EDM-013',
        severity: 'WARN',
        description: 'Open shift - no end time yet'
      });
    }
    
    // Check for missing start time
    if (!shift.start_ts) {
      anomalies.push({
        employee_id: shift.employee_id || 'unknown',
        shift_id: shift.id,
        rule_id: 'EDM-013',
        severity: 'ERROR',
        description: 'Missing shift start time'
      });
    }
    
    // Check for suspiciously short duration
    if (shift.duration_min !== undefined && shift.duration_min < 5) {
      anomalies.push({
        employee_id: shift.employee_id || 'unknown',
        shift_id: shift.id,
        rule_id: 'EDM-013',
        severity: 'WARN',
        description: `Extremely short shift duration: ${shift.duration_min} minutes`
      });
    }
    
    // Check for missing job code
    if (!shift.job_code || shift.job_code === 'general' || shift.job_code === 'unspecified') {
      anomalies.push({
        employee_id: shift.employee_id || 'unknown',
        shift_id: shift.id,
        rule_id: 'EDM-013',
        severity: 'WARN',
        description: 'Missing or generic job code'
      });
    }
    
    // Check for zero tips with sales (possible data issue)
    if (shift.sales_amount && shift.sales_amount > 0 && (!shift.tips_amount || shift.tips_amount === 0)) {
      anomalies.push({
        employee_id: shift.employee_id || 'unknown',
        shift_id: shift.id,
        rule_id: 'EDM-013',
        severity: 'WARN',
        description: 'Sales recorded but no tips - possible data issue'
      });
    }
    
    return anomalies;
  }
};