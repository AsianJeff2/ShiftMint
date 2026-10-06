import type { TipEntry } from '@prisma/client';
import { IRepository } from './IRepository';

/**
 * Tip creation data
 */
export interface CreateTipData {
  employeeId: string;
  amount: number;
  tipType: string;
  timestamp: Date;
  shiftId?: string;
  serverName?: string;
  posTransactionId?: string;
  notes?: string;
  isPooled?: boolean;
}

/**
 * Tip query filters
 */
export interface TipFilters {
  employeeId?: string;
  startDate?: Date;
  endDate?: Date;
  tipType?: string;
  isPooled?: boolean;
}

/**
 * Tip repository interface
 */
export interface ITipRepository extends IRepository<TipEntry, CreateTipData> {
  /**
   * Find tips by employee
   * @param employeeId - Employee ID (string for cuid)
   * @param businessId - Business ID (string for cuid)
   * @returns Array of tips
   */
  findByEmployee(employeeId: string, businessId: string): Promise<TipEntry[]>;

  /**
   * Find tips within date range
   * @param startDate - Start date
   * @param endDate - End date
   * @param businessId - Business ID (string for cuid)
   * @returns Array of tips
   */
  findByDateRange(startDate: Date, endDate: Date, businessId: string): Promise<TipEntry[]>;

  /**
   * Find tips with filters
   * @param filters - Query filters
   * @param businessId - Business ID (string for cuid)
   * @returns Array of matching tips
   */
  findWithFilters(filters: TipFilters, businessId: string): Promise<TipEntry[]>;

  /**
   * Find pooled tips
   * @param businessId - Business ID (string for cuid)
   * @returns Array of pooled tips
   */
  findPooled(businessId: string): Promise<TipEntry[]>;

  /**
   * Calculate total tips for employee in date range
   * @param employeeId - Employee ID (string for cuid)
   * @param startDate - Start date
   * @param endDate - End date
   * @param businessId - Business ID (string for cuid)
   * @returns Total tip amount
   */
  calculateTotalTips(
    employeeId: string,
    startDate: Date,
    endDate: Date,
    businessId: string
  ): Promise<number>;

  /**
   * Calculate total tips by type
   * @param startDate - Start date
   * @param endDate - End date
   * @param businessId - Business ID (string for cuid)
   * @returns Object with tips by type (cash, credit, etc.)
   */
  calculateTipsByType(
    startDate: Date,
    endDate: Date,
    businessId: string
  ): Promise<Record<string, number>>;
}
