import type { Shift } from '@prisma/client';
import { IRepository } from './IRepository';

/**
 * Shift creation data
 */
export interface CreateShiftData {
  employeeId: string;
  shiftDate: string; // Date as string (YYYY-MM-DD)
  startTime: Date;
  endTime?: Date;
  breakDuration?: number;
  durationMin?: number;
  totalSales?: number;
  status?: string;
  notes?: string;
}

/**
 * Shift query filters
 */
export interface ShiftFilters {
  employeeId?: string;
  startDate?: string; // Date as string (YYYY-MM-DD)
  endDate?: string; // Date as string (YYYY-MM-DD)
  status?: string;
}

/**
 * Shift repository interface
 */
export interface IShiftRepository extends IRepository<Shift, CreateShiftData> {
  /**
   * Find shifts by employee
   * @param employeeId - Employee ID (string for cuid)
   * @param businessId - Business ID (string for cuid)
   * @returns Array of shifts
   */
  findByEmployee(employeeId: string, businessId: string): Promise<Shift[]>;

  /**
   * Find shifts within date range
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   * @param businessId - Business ID (string for cuid)
   * @returns Array of shifts
   */
  findByDateRange(startDate: string, endDate: string, businessId: string): Promise<Shift[]>;

  /**
   * Find shifts with filters
   * @param filters - Query filters
   * @param businessId - Business ID (string for cuid)
   * @returns Array of matching shifts
   */
  findWithFilters(filters: ShiftFilters, businessId: string): Promise<Shift[]>;

  /**
   * Find active (ongoing) shifts
   * @param businessId - Business ID (string for cuid)
   * @returns Array of active shifts
   */
  findActive(businessId: string): Promise<Shift[]>;

  /**
   * Calculate total hours for employee in date range
   * @param employeeId - Employee ID (string for cuid)
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   * @param businessId - Business ID (string for cuid)
   * @returns Total hours worked
   */
  calculateTotalHours(
    employeeId: string,
    startDate: string,
    endDate: string,
    businessId: string
  ): Promise<number>;
}
