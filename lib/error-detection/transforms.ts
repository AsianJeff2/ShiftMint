
import { FlagEvent, ErrorDetectionShift, PunchEvent } from '@/types/error-detection';

export const transformFlagEvent = (data: any): FlagEvent => ({
  id: data.id,
  shiftId: data.shift_id,
  ruleId: data.rule_id,
  severity: data.severity,
  description: data.description,
  createdTs: new Date(data.created_ts),
  resolvedTs: data.resolved_ts ? new Date(data.resolved_ts) : undefined,
  resolverId: data.resolver_id,
  resolutionNote: data.resolution_note
});

export const transformShift = (data: any): ErrorDetectionShift => ({
  id: data.id,
  employeeId: data.employee_id,
  startTs: new Date(data.start_ts),
  endTs: data.end_ts ? new Date(data.end_ts) : undefined,
  durationMin: data.duration_min,
  jobCode: data.job_code,
  locationId: data.location_id,
  status: data.status,
  insertedAt: new Date(data.inserted_at)
});

export const transformPunchEvent = (data: any): PunchEvent => ({
  id: data.id,
  employeeId: data.employee_id,
  jobCode: data.job_code,
  punchType: data.punch_type,
  tsUtc: new Date(data.ts_utc),
  source: data.source,
  rawPayload: data.raw_payload,
  locationId: data.location_id,
  insertedAt: new Date(data.inserted_at)
});
