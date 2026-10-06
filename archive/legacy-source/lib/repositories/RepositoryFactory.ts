import type { PrismaClient } from '@prisma/client';
import { IEmployeeRepository } from './IEmployeeRepository';
import { IShiftRepository } from './IShiftRepository';
import { ITipRepository } from './ITipRepository';
import { IPayrollRepository } from './IPayrollRepository';
import { PrismaEmployeeRepository } from './PrismaEmployeeRepository';
import { PrismaShiftRepository } from './PrismaShiftRepository';
import { PrismaTipRepository } from './PrismaTipRepository';
import { PrismaPayrollRepository } from './PrismaPayrollRepository';

/**
 * Repository Factory
 *
 * Creates repository instances with dependency injection.
 * Makes it easy to swap implementations (e.g., for testing).
 */
export class RepositoryFactory {
  private employeeRepo?: IEmployeeRepository;
  private shiftRepo?: IShiftRepository;
  private tipRepo?: ITipRepository;
  private payrollRepo?: IPayrollRepository;

  constructor(private prisma: PrismaClient) {}

  /**
   * Get Employee Repository
   * Singleton pattern - returns same instance on subsequent calls
   */
  getEmployeeRepository(): IEmployeeRepository {
    if (!this.employeeRepo) {
      this.employeeRepo = new PrismaEmployeeRepository(this.prisma);
    }
    return this.employeeRepo;
  }

  /**
   * Get Shift Repository
   */
  getShiftRepository(): IShiftRepository {
    if (!this.shiftRepo) {
      this.shiftRepo = new PrismaShiftRepository(this.prisma);
    }
    return this.shiftRepo;
  }

  /**
   * Get Tip Repository
   */
  getTipRepository(): ITipRepository {
    if (!this.tipRepo) {
      this.tipRepo = new PrismaTipRepository(this.prisma);
    }
    return this.tipRepo;
  }

  /**
   * Get Payroll Repository
   */
  getPayrollRepository(): IPayrollRepository {
    if (!this.payrollRepo) {
      this.payrollRepo = new PrismaPayrollRepository(this.prisma);
    }
    return this.payrollRepo;
  }

  /**
   * Get all repositories at once
   */
  getAllRepositories() {
    return {
      employees: this.getEmployeeRepository(),
      shifts: this.getShiftRepository(),
      tips: this.getTipRepository(),
      payroll: this.getPayrollRepository(),
    };
  }
}

/**
 * Create repository factory from Prisma client
 * Usage:
 *   const factory = createRepositoryFactory(prisma);
 *   const employeeRepo = factory.getEmployeeRepository();
 */
export function createRepositoryFactory(prisma: PrismaClient): RepositoryFactory {
  return new RepositoryFactory(prisma);
}
