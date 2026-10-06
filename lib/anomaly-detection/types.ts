
export interface ShiftData {
  id: string;
  employee_id: string;
  location_id: string;
  job_code: string;
  start_ts: string | null;
  end_ts: string | null;
  duration_min?: number;
  status: 'OPEN' | 'CLOSED';
  scheduled_start?: string;
  scheduled_end?: string;
  tips_amount?: number;
  sales_amount?: number;
}

export interface PunchData {
  id: string;
  employee_id: string;
  punch_type: 'IN' | 'OUT' | 'BREAK_IN' | 'BREAK_OUT';
  ts_utc: string;
  job_code: string;
}

export interface AnomalyResult {
  employee_id: string;
  shift_id: string;
  rule_id: string;
  severity: 'WARN' | 'ERROR';
  description: string;
}

export interface ValidationRule {
  id: string;
  name: string;
  validate: (shift: ShiftData, allShifts: ShiftData[], punches?: PunchData[], options?: AnomalyDetectionOptions) => AnomalyResult[];
}

export interface AnomalyDetectionOptions {
  venueClosingTime?: string; // Format: "HH:MM" (24-hour)
  tipSalesRatioMin?: number; // Default: 0.01 (1%)
  tipSalesRatioMax?: number; // Default: 0.40 (40%)
}
