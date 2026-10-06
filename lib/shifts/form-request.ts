import type { CreateShiftRequest, UpdateShiftRequest } from '@/lib/types/api-dtos';

export interface ShiftFormValues {
  employeeId: string;
  startTime: string;
  endTime: string;
  jobCode: string;
  locationId: string;
  status: string;
  notes: string;
}

/** The datetime-local value supplies the operator's calendar date; ISO supplies the instant. */
export function shiftFormRequest(form: ShiftFormValues): CreateShiftRequest;
export function shiftFormRequest(form: ShiftFormValues, original: ShiftFormValues): UpdateShiftRequest;
export function shiftFormRequest(form: ShiftFormValues, original?: ShiftFormValues): CreateShiftRequest | UpdateShiftRequest {
  const start = new Date(form.startTime);
  const end = form.endTime ? new Date(form.endTime) : undefined;
  if (!Number.isFinite(start.getTime()) || (end && (!Number.isFinite(end.getTime()) || end < start))) throw new Error('Shift times must be valid and the end must follow the start');
  if (form.status === 'completed' && !end) throw new Error('Completed shifts require an end time');
  const request: UpdateShiftRequest = {};
  for (const key of ['employeeId', 'jobCode', 'locationId', 'status', 'notes'] as const) {
    if (!original || form[key] !== original[key]) (request as Record<string, unknown>)[key] = form[key];
  }
  if (!original || form.startTime !== original.startTime) {
    request.startTime = start.toISOString();
    request.shiftDate = form.startTime.slice(0, 10);
  }
  if (!original || form.endTime !== original.endTime) request.endTime = end?.toISOString() ?? '';
  // Rates and recorded wages belong to the stored shift. This form does not edit them.
  return request;
}
