import type { Employee } from '@prisma/client';
import { IRepository } from './IRepository';

/**
 * Employee creation data (without auto-generated fields)
 */
export interface CreateEmployeeData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string; // Changed from phoneNumber to match Prisma
  hourlyRate: number;
  overtimeRate?: number;
  role: string;
  status?: string;
  startDate: Date;
  terminationDate?: Date; // Changed from endDate to match Prisma
  ssn?: string;
  tipEligible?: boolean;
}

/**
 * Employee repository interface
 * Extends base repository with employee-specific operations
 */
export interface IEmployeeRepository extends IRepository<Employee, CreateEmployeeData> {
  /**
   * Find employee by email
   * @param email - Employee email
   * @param businessId - Business ID (string for cuid)
   * @returns Employee or null if not found
   */
  findByEmail(email: string, businessId: string): Promise<Employee | null>;

  /**
   * Find active employees
   * @param businessId - Business ID (string for cuid)
   * @returns Array of active employees
   */
  findActive(businessId: string): Promise<Employee[]>;

  /**
   * Find tip-eligible employees
   * @param businessId - Business ID (string for cuid)
   * @returns Array of tip-eligible employees
   */
  findTipEligible(businessId: string): Promise<Employee[]>;

  /**
   * Find employees by role
   * @param role - Employee role
   * @param businessId - Business ID (string for cuid)
   * @returns Array of employees with specified role
   */
  findByRole(role: string, businessId: string): Promise<Employee[]>;
}
