/**
 * Shift Transformer
 *
 * Handles conversion between Prisma Shift models and API DTOs
 *
 * Key transformations:
 * - Prisma: Date fields → DTO: string date fields
 * - Prisma: null → DTO: undefined
 * - Add computed fields (hoursWorked) when needed
 */

import type { Shift } from '@prisma/client';
import type { CreateShiftRequest, UpdateShiftRequest } from '@/lib/types/api-dtos';
import { calculateHoursWorked } from '@/types/extended';
import { toIso, type WireDates } from './wireDates';

/**
 * Shift DTO for frontend use
 * Matches the shape expected by UI components
 */
export interface ShiftDTO {
  id: string;
  businessId: string;
  employeeId?: string;
  shiftDate: string;
  startTime: string;
  endTime?: string;
  durationMin?: number;
  jobCode: string;
  position?: string;
  employeeType?: string;
  stationNumber?: string;
  locationId: string;
  status: 'active' | 'completed' | 'pending_review' | 'break';
  hourlyRate: number;
  regularWage: number;
  overtimeWage: number;
  totalWage: number;
  totalSales: number;
  cashSales: number;
  creditCardSales: number;
  totalTips: number;
  cashTips: number;
  creditCardTips: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Computed fields
  hoursWorked?: number;
}

/**
 * Convert Prisma Shift to DTO for frontend consumption
 *
 * @param shift - Prisma Shift model
 * @returns ShiftDTO for frontend use
 */
export function toShiftDTO(shift: WireDates<Shift, 'startTime' | 'endTime' | 'createdAt' | 'updatedAt'>): ShiftDTO {
  const hoursWorked = calculateHoursWorked({ ...shift, startTime: new Date(shift.startTime), endTime: shift.endTime ? new Date(shift.endTime) : null, createdAt: new Date(shift.createdAt), updatedAt: new Date(shift.updatedAt) });

  return {
    id: shift.id,
    businessId: shift.businessId,
    employeeId: shift.employeeId ?? undefined,
    shiftDate: shift.shiftDate,
    startTime: toIso(shift.startTime),
    endTime: shift.endTime ? toIso(shift.endTime) : undefined,
    durationMin: shift.durationMin ?? undefined,
    jobCode: shift.jobCode,
    position: shift.position ?? undefined,
    employeeType: shift.employeeType ?? undefined,
    stationNumber: shift.stationNumber ?? undefined,
    locationId: shift.locationId,
    status: shift.status as 'active' | 'completed' | 'pending_review' | 'break',
    hourlyRate: shift.hourlyRate,
    regularWage: shift.regularWage,
    overtimeWage: shift.overtimeWage,
    totalWage: shift.totalWage,
    totalSales: shift.totalSales,
    cashSales: shift.cashSales,
    creditCardSales: shift.creditCardSales,
    totalTips: shift.totalTips,
    cashTips: shift.cashTips,
    creditCardTips: shift.creditCardTips,
    notes: shift.notes ?? undefined,
    createdAt: toIso(shift.createdAt),
    updatedAt: toIso(shift.updatedAt),
    hoursWorked,
  };
}

/**
 * Convert array of Prisma Shifts to DTOs
 */
export function toShiftDTOs(shifts: Parameters<typeof toShiftDTO>[0][]): ShiftDTO[] {
  return shifts.map(toShiftDTO);
}

/**
 * Convert CreateShiftRequest DTO to Prisma create input
 *
 * @param dto - CreateShiftRequest from frontend
 * @returns Data ready for Prisma create
 */
export function fromCreateShiftDTO(dto: CreateShiftRequest): Omit<Shift, 'id' | 'createdAt' | 'updatedAt' | 'businessId'> {
  return {
    employeeId: dto.employeeId ?? null,
    shiftDate: dto.shiftDate,
    startTime: dto.startTime,
    endTime: dto.endTime ?? null,
    durationMin: dto.durationMin ?? null,
    jobCode: dto.jobCode ?? 'server',
    position: dto.position ?? null,
    employeeType: dto.employeeType ?? null,
    stationNumber: dto.stationNumber ?? null,
    locationId: dto.locationId ?? 'main',
    status: dto.status ?? 'active',
    hourlyRate: dto.hourlyRate ?? 0,
    regularWage: dto.regularWage ?? 0,
    overtimeWage: dto.overtimeWage ?? 0,
    totalWage: dto.totalWage ?? 0,
    totalSales: dto.totalSales ?? 0,
    cashSales: dto.cashSales ?? 0,
    creditCardSales: dto.creditCardSales ?? 0,
    totalTips: dto.totalTips ?? 0,
    cashTips: dto.cashTips ?? 0,
    creditCardTips: dto.creditCardTips ?? 0,
    notes: dto.notes ?? null,
  } as any;
}

/**
 * Convert UpdateShiftRequest DTO to Prisma update input
 */
export function fromUpdateShiftDTO(dto: UpdateShiftRequest): Partial<Shift> {
  const update: any = {};

  if (dto.employeeId !== undefined) update.employeeId = dto.employeeId ?? null;
  if (dto.shiftDate !== undefined) update.shiftDate = dto.shiftDate;
  if (dto.startTime !== undefined) update.startTime = dto.startTime;
  if (dto.endTime !== undefined) update.endTime = dto.endTime ?? null;
  if (dto.durationMin !== undefined) update.durationMin = dto.durationMin ?? null;
  if (dto.jobCode !== undefined) update.jobCode = dto.jobCode;
  if (dto.position !== undefined) update.position = dto.position ?? null;
  if (dto.employeeType !== undefined) update.employeeType = dto.employeeType ?? null;
  if (dto.stationNumber !== undefined) update.stationNumber = dto.stationNumber ?? null;
  if (dto.locationId !== undefined) update.locationId = dto.locationId;
  if (dto.status !== undefined) update.status = dto.status;
  if (dto.hourlyRate !== undefined) update.hourlyRate = dto.hourlyRate;
  if (dto.regularWage !== undefined) update.regularWage = dto.regularWage;
  if (dto.overtimeWage !== undefined) update.overtimeWage = dto.overtimeWage;
  if (dto.totalWage !== undefined) update.totalWage = dto.totalWage;
  if (dto.totalSales !== undefined) update.totalSales = dto.totalSales;
  if (dto.cashSales !== undefined) update.cashSales = dto.cashSales;
  if (dto.creditCardSales !== undefined) update.creditCardSales = dto.creditCardSales;
  if (dto.totalTips !== undefined) update.totalTips = dto.totalTips;
  if (dto.cashTips !== undefined) update.cashTips = dto.cashTips;
  if (dto.creditCardTips !== undefined) update.creditCardTips = dto.creditCardTips;
  if (dto.notes !== undefined) update.notes = dto.notes ?? null;

  return update;
}
