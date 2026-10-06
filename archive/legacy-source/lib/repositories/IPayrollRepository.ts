import type { PayrollPeriod, PayrollEntry } from '@prisma/client';
import { IRepository } from './IRepository';

/**
 * Payroll period creation data
 */
export interface CreatePayrollPeriodData {
  startDate: Date;
  endDate: Date;
  status?: string;
  totalTips?: number;
  totalSales?: number;
  notes?: string;
}

/**
 * Payroll entry creation data
 */
export interface CreatePayrollEntryData {
  payrollPeriodId: string;
  employeeId: string;
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  grossPay: number;
  totalTips: number;
  totalTaxes: number;
  netPay: number;
  federalTax?: number;
  stateTax?: number;
  socialSecurityTax?: number;
  medicareTax?: number;
}

/**
 * Payroll period with entries
 */
export interface PayrollPeriodWithEntries extends PayrollPeriod {
  payrollEntries: PayrollEntry[];
}

/**
 * Payroll repository interface
 */
export interface IPayrollRepository {
  /**
   * Find payroll period by ID
   * @param id - Period ID (string for cuid)
   * @param businessId - Business ID (string for cuid)
   * @returns Payroll period or null
   */
  findPeriodById(id: string, businessId: string): Promise<PayrollPeriod | null>;

  /**
   * Find all payroll periods
   * @param businessId - Business ID (string for cuid)
   * @returns Array of payroll periods
   */
  findAllPeriods(businessId: string): Promise<PayrollPeriod[]>;

  /**
   * Find payroll period with entries
   * @param id - Period ID (string for cuid)
   * @param businessId - Business ID (string for cuid)
   * @returns Payroll period with entries or null
   */
  findPeriodWithEntries(id: string, businessId: string): Promise<PayrollPeriodWithEntries | null>;

  /**
   * Find payroll periods by status
   * @param status - Period status
   * @param businessId - Business ID (string for cuid)
   * @returns Array of payroll periods
   */
  findPeriodsByStatus(status: string, businessId: string): Promise<PayrollPeriod[]>;

  /**
   * Create payroll period
   * @param data - Period data
   * @param businessId - Business ID (string for cuid)
   * @returns Created payroll period
   */
  createPeriod(data: CreatePayrollPeriodData, businessId: string): Promise<PayrollPeriod>;

  /**
   * Update payroll period
   * @param id - Period ID (string for cuid)
   * @param data - Updated data
   * @param businessId - Business ID (string for cuid)
   * @returns Updated payroll period
   */
  updatePeriod(
    id: string,
    data: Partial<CreatePayrollPeriodData>,
    businessId: string
  ): Promise<PayrollPeriod>;

  /**
   * Delete payroll period
   * @param id - Period ID (string for cuid)
   * @param businessId - Business ID (string for cuid)
   */
  deletePeriod(id: string, businessId: string): Promise<void>;

  /**
   * Find payroll entries for period
   * @param periodId - Period ID (string for cuid)
   * @param businessId - Business ID (string for cuid)
   * @returns Array of payroll entries
   */
  findEntriesByPeriod(periodId: string, businessId: string): Promise<PayrollEntry[]>;

  /**
   * Find payroll entries for employee
   * @param employeeId - Employee ID (string for cuid)
   * @param businessId - Business ID (string for cuid)
   * @returns Array of payroll entries
   */
  findEntriesByEmployee(employeeId: string, businessId: string): Promise<PayrollEntry[]>;

  /**
   * Create payroll entry
   * @param data - Entry data
   * @param businessId - Business ID (string for cuid)
   * @returns Created payroll entry
   */
  createEntry(data: CreatePayrollEntryData, businessId: string): Promise<PayrollEntry>;

  /**
   * Update payroll entry
   * @param id - Entry ID (string for cuid)
   * @param data - Updated data
   * @param businessId - Business ID (string for cuid)
   * @returns Updated payroll entry
   */
  updateEntry(
    id: string,
    data: Partial<CreatePayrollEntryData>,
    businessId: string
  ): Promise<PayrollEntry>;

  /**
   * Delete payroll entry
   * @param id - Entry ID (string for cuid)
   * @param businessId - Business ID (string for cuid)
   */
  deleteEntry(id: string, businessId: string): Promise<void>;
}
