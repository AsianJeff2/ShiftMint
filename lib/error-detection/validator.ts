
import { ErrorDetectionValidationRequest, ValidationResult, FlagEvent } from '@/types/error-detection';
import { AnomalyDetectionEngine, detectPayrollAnomalies } from '../anomaly-detection/engine';
import { ShiftData } from '../anomaly-detection/types';

export class ErrorDetectionValidator {
  private anomalyEngine: AnomalyDetectionEngine;

  constructor() {
    this.anomalyEngine = new AnomalyDetectionEngine({
      venueClosingTime: '02:00', // Default venue closing time
      tipSalesRatioMin: 0.01,
      tipSalesRatioMax: 0.40
    });
  }

  async validatePunchEvents(request: ErrorDetectionValidationRequest): Promise<ValidationResult> {
    const flags: FlagEvent[] = [];
    
    try {
      // Convert punch events to shifts for validation
      const shifts: ShiftData[] = this.convertPunchEventsToShifts(request.punchEvents);
      
      // Convert punch events to the format expected by anomaly detection
      const punches = request.punchEvents.map(event => ({
        id: event.id,
        employee_id: event.employeeId,
        punch_type: event.punchType as 'IN' | 'OUT',
        ts_utc: event.tsUtc.toISOString(),
        job_code: event.jobCode
      }));

      // Run anomaly detection
      const anomalies = this.anomalyEngine.detectAnomalies(shifts, punches);
      
      // Convert anomalies to flag events
      anomalies.forEach(anomaly => {
        flags.push({
          id: Math.random().toString(36).substr(2, 9),
          ruleId: anomaly.rule_id,
          severity: anomaly.severity,
          description: anomaly.description,
          createdTs: new Date(),
          shiftId: anomaly.shift_id
        });
      });

    } catch (error) {
      console.error('Validation error:', error);
      // Return a generic error flag
      flags.push({
        id: Math.random().toString(36).substr(2, 9),
        ruleId: 'SYSTEM_ERROR',
        severity: 'ERROR',
        description: 'System error during validation',
        createdTs: new Date(),
        shiftId: undefined
      });
    }
    
    return {
      isValid: flags.length === 0,
      flags,
      suggestedFixes: flags.length > 0 ? ['Review flagged shifts for accuracy'] : undefined
    };
  }

  private convertPunchEventsToShifts(punchEvents: any[]): ShiftData[] {
    const shifts: ShiftData[] = [];
    const employeeShifts = new Map<string, any>();

    // Group punch events by employee and create shift objects
    punchEvents.forEach(event => {
      const key = `${event.employeeId}_${event.jobCode}`;
      
      if (!employeeShifts.has(key)) {
        employeeShifts.set(key, {
          id: `shift_${Math.random().toString(36).substr(2, 9)}`,
          employee_id: event.employeeId,
          location_id: event.locationId,
          job_code: event.jobCode,
          start_ts: null,
          end_ts: null,
          status: 'OPEN' as const
        });
      }

      const shift = employeeShifts.get(key);
      
      if (event.punchType === 'IN' && !shift.start_ts) {
        shift.start_ts = event.tsUtc.toISOString();
      } else if (event.punchType === 'OUT') {
        shift.end_ts = event.tsUtc.toISOString();
        shift.status = 'CLOSED';
        
        // Calculate duration if both timestamps exist
        if (shift.start_ts) {
          const start = new Date(shift.start_ts);
          const end = new Date(shift.end_ts);
          shift.duration_min = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
        }
      }
    });

    // Convert map values to array
    shifts.push(...Array.from(employeeShifts.values()));
    
    return shifts;
  }
}
