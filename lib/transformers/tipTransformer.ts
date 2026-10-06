/**
 * Tip Entry Transformer
 *
 * Handles conversion between Prisma TipEntry models and API DTOs
 */

import type { TipEntry } from '@prisma/client';
import type { CreateTipRequest, UpdateTipRequest } from '@/lib/types/api-dtos';
import { toIso, type WireDates } from './wireDates';

/**
 * TipEntry DTO for frontend use
 */
export interface TipEntryDTO {
  id: string;
  businessId: string;
  employeeId?: string;
  shiftId?: string;
  amount: number;
  tipType: 'pos_pretax' | 'pos_posttax' | 'pos_pooled' | 'cash' | 'credit' | 'hourly' | 'table_server' | 'bulk' | 'other';
  source: 'manual' | 'pos' | 'csv_import' | 'bulk_entry' | 'auto_hourly';
  timestamp: string;
  tableNumber?: string;
  serverName?: string;
  posTransactionId?: string;
  isPooled: boolean;
  poolDistributionId?: string;
  taxableAmount?: number;
  notes?: string;
  processed: boolean;
  processedAt?: string;
  complianceStatus: 'pending' | 'compliant' | 'flagged' | 'requires_adjustment';
  wageCreditUsed: number;
  irsReportable: boolean;
  version: number;
  lastModifiedBy?: string;
  originalAmount?: number;
  changeReason?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Convert Prisma TipEntry to DTO
 */
export function toTipEntryDTO(tip: WireDates<TipEntry, 'timestamp' | 'processedAt' | 'createdAt' | 'updatedAt'>): TipEntryDTO {
  return {
    id: tip.id,
    businessId: tip.businessId,
    employeeId: tip.employeeId ?? undefined,
    shiftId: tip.shiftId ?? undefined,
    amount: tip.amount,
    tipType: tip.tipType as any,
    source: tip.source as any,
    timestamp: toIso(tip.timestamp),
    tableNumber: tip.tableNumber ?? undefined,
    serverName: tip.serverName ?? undefined,
    posTransactionId: tip.posTransactionId ?? undefined,
    isPooled: tip.isPooled,
    poolDistributionId: tip.poolDistributionId ?? undefined,
    taxableAmount: tip.taxableAmount ?? undefined,
    notes: tip.notes ?? undefined,
    processed: tip.processed,
    processedAt: tip.processedAt ? toIso(tip.processedAt) : undefined,
    complianceStatus: tip.complianceStatus as any,
    wageCreditUsed: tip.wageCreditUsed,
    irsReportable: tip.irsReportable,
    version: tip.version,
    lastModifiedBy: tip.lastModifiedBy ?? undefined,
    originalAmount: tip.originalAmount ?? undefined,
    changeReason: tip.changeReason ?? undefined,
    createdAt: toIso(tip.createdAt),
    updatedAt: toIso(tip.updatedAt),
  };
}

/**
 * Convert array of Prisma TipEntries to DTOs
 */
export function toTipEntryDTOs(tips: Parameters<typeof toTipEntryDTO>[0][]): TipEntryDTO[] {
  return tips.map(toTipEntryDTO);
}

/**
 * Convert CreateTipRequest to Prisma input
 */
export function fromCreateTipDTO(dto: CreateTipRequest): Omit<TipEntry, 'id' | 'createdAt' | 'updatedAt' | 'businessId'> {
  return {
    employeeId: dto.employeeId ?? null,
    shiftId: dto.shiftId ?? null,
    amount: dto.amount,
    tipType: dto.tipType ?? 'credit',
    source: dto.source ?? 'manual',
    timestamp: dto.timestamp ?? new Date().toISOString(),
    tableNumber: dto.tableNumber ?? null,
    serverName: dto.serverName ?? null,
    posTransactionId: dto.posTransactionId ?? null,
    isPooled: dto.isPooled ?? false,
    poolDistributionId: null,
    taxableAmount: dto.taxableAmount ?? null,
    notes: dto.notes ?? null,
    processed: false,
    processedAt: null,
    complianceStatus: 'pending',
    wageCreditUsed: 0,
    irsReportable: true,
    version: 1,
    lastModifiedBy: null,
    originalAmount: null,
    changeReason: dto.changeReason ?? null,
  } as any;
}

/**
 * Convert UpdateTipRequest to Prisma update input
 */
export function fromUpdateTipDTO(dto: UpdateTipRequest): Partial<TipEntry> {
  const update: any = {};

  if (dto.employeeId !== undefined) update.employeeId = dto.employeeId ?? null;
  if (dto.shiftId !== undefined) update.shiftId = dto.shiftId ?? null;
  if (dto.amount !== undefined) update.amount = dto.amount;
  if (dto.tipType !== undefined) update.tipType = dto.tipType;
  if (dto.source !== undefined) update.source = dto.source;
  if (dto.timestamp !== undefined) update.timestamp = dto.timestamp;
  if (dto.tableNumber !== undefined) update.tableNumber = dto.tableNumber ?? null;
  if (dto.serverName !== undefined) update.serverName = dto.serverName ?? null;
  if (dto.posTransactionId !== undefined) update.posTransactionId = dto.posTransactionId ?? null;
  if (dto.isPooled !== undefined) update.isPooled = dto.isPooled;
  if (dto.taxableAmount !== undefined) update.taxableAmount = dto.taxableAmount ?? null;
  if (dto.notes !== undefined) update.notes = dto.notes ?? null;
  if (dto.changeReason !== undefined) update.changeReason = dto.changeReason ?? null;

  return update;
}
