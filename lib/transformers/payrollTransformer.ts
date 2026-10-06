/**
 * Payroll Period Transformer
 *
 * Handles conversion between Prisma PayrollPeriod models and API DTOs
 */

import type { PayrollPeriod, PayrollEntry } from '@prisma/client';
import type { CreatePayrollPeriodRequest } from '@/lib/types/api-dtos';
import { toIso, type WireDates } from './wireDates';

/**
 * PayrollPeriod DTO for frontend use
 */
export interface PayrollPeriodDTO {
  id: string;
  businessId: string;
  startDate: string;
  endDate: string;
  status: string;
  totalTips: number;
  totalSales: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  payrollEntries?: PayrollEntry[];
}

/**
 * Normalize UTC calendar markers from Prisma or HTTP to YYYY-MM-DD for UI and export requests.
 */
export function toPayrollPeriodDTO(period: WireDates<PayrollPeriod, 'startDate' | 'endDate' | 'createdAt' | 'updatedAt'> & { payrollEntries?: PayrollEntry[] }): PayrollPeriodDTO {
  return {
    id: period.id,
    businessId: period.businessId,
    startDate: toIso(period.startDate).slice(0, 10),
    endDate: toIso(period.endDate).slice(0, 10),
    status: period.status,
    totalTips: period.totalTips,
    totalSales: period.totalSales,
    notes: period.notes ?? undefined,
    createdAt: toIso(period.createdAt),
    updatedAt: toIso(period.updatedAt),
    payrollEntries: period.payrollEntries,
  };
}

/**
 * Convert array of Prisma PayrollPeriods to DTOs
 */
export function toPayrollPeriodDTOs(periods: Parameters<typeof toPayrollPeriodDTO>[0][]): PayrollPeriodDTO[] {
  return periods.map(toPayrollPeriodDTO);
}

/**
 * Convert CreatePayrollPeriodRequest to Prisma input
 */
export function fromCreatePayrollPeriodDTO(dto: CreatePayrollPeriodRequest): Omit<PayrollPeriod, 'id' | 'createdAt' | 'updatedAt' | 'businessId'> {
  return {
    startDate: dto.startDate,
    endDate: dto.endDate,
    status: 'open',
    totalTips: 0,
    totalSales: 0,
    notes: dto.notes ?? null,
  } as any;
}

/**
 * Convert update data to Prisma update input
 */
export function fromUpdatePayrollPeriodDTO(dto: Partial<PayrollPeriodDTO>): Partial<PayrollPeriod> {
  const update: any = {};

  if (dto.startDate !== undefined) update.startDate = dto.startDate;
  if (dto.endDate !== undefined) update.endDate = dto.endDate;
  if (dto.status !== undefined) update.status = dto.status;
  if (dto.totalTips !== undefined) update.totalTips = dto.totalTips;
  if (dto.totalSales !== undefined) update.totalSales = dto.totalSales;
  if (dto.notes !== undefined) update.notes = dto.notes ?? null;

  return update;
}
