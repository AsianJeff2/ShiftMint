/**
 * Repository Pattern Implementation
 *
 * This module exports all repository interfaces and implementations.
 * Repositories abstract database access and provide a clean API for data operations.
 *
 * Benefits:
 * - Testable: Easy to mock for unit tests
 * - Maintainable: Database logic isolated from business logic
 * - Flexible: Easy to swap implementations (Prisma → In-Memory for tests)
 * - Type-safe: Full TypeScript support
 */

// Base repository
export type { IRepository } from './IRepository';

// Employee repository
export type { IEmployeeRepository, CreateEmployeeData } from './IEmployeeRepository';
export { PrismaEmployeeRepository } from './PrismaEmployeeRepository';

// Shift repository
export type {
  IShiftRepository,
  CreateShiftData,
  ShiftFilters,
} from './IShiftRepository';
export { PrismaShiftRepository } from './PrismaShiftRepository';

// Tip repository
export type {
  ITipRepository,
  CreateTipData,
  TipFilters,
} from './ITipRepository';
export { PrismaTipRepository } from './PrismaTipRepository';

// Payroll repository
export type {
  IPayrollRepository,
  CreatePayrollPeriodData,
  CreatePayrollEntryData,
  PayrollPeriodWithEntries,
} from './IPayrollRepository';
export { PrismaPayrollRepository } from './PrismaPayrollRepository';

// Repository factory
export { RepositoryFactory } from './RepositoryFactory';
