
export interface PunchEvent {
  id: string;
  employeeId: string;
  jobCode: string;
  punchType: 'IN' | 'OUT';
  tsUtc: Date;
  source: 'POS' | 'WEB' | 'MOBILE';
  rawPayload: Record<string, any>;
  locationId: string;
  insertedAt: Date;
}

export interface ErrorDetectionShift {
  id: string;
  employeeId: string;
  startTs: Date;
  endTs?: Date;
  durationMin?: number;
  jobCode: string;
  locationId: string;
  status: 'OPEN' | 'CLOSED' | 'FLAGGED' | 'APPROVED';
  insertedAt: Date;
}

export interface FlagEvent {
  id: string;
  shiftId?: string;
  ruleId: string;
  severity: 'ERROR' | 'WARN';
  description: string;
  createdTs: Date;
  resolvedTs?: Date;
  resolverId?: string;
  resolutionNote?: string;
}

export interface VenueRule {
  id: number;
  locationId: string;
  ruleId: string;
  threshold: Record<string, any>;
  createdTs: Date;
}

export interface ShiftOverride {
  id: string;
  shiftId: string;
  beforeState: Record<string, any>;
  afterState: Record<string, any>;
  resolverId: string;
  reason: string;
  createdTs: Date;
}

export interface ValidationResult {
  isValid: boolean;
  flags: FlagEvent[];
  suggestedFixes?: string[];
}

export interface ErrorDetectionValidationRequest {
  punchEvents: PunchEvent[];
  locationId: string;
  employeeId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}
