/**
 * Transformers Index
 *
 * Central export point for all DTO transformers
 *
 * Usage:
 * ```typescript
 * import { toEmployeeDTO, toShiftDTO } from '@/lib/transformers';
 * ```
 */

// Employee transformers
export {
  toEmployeeDTO,
  toEmployeeDTOs,
  type EmployeeDTO,
} from './employeeDTO';

// Shift transformers
export {
  toShiftDTO,
  toShiftDTOs,
  fromCreateShiftDTO,
  fromUpdateShiftDTO,
  type ShiftDTO,
} from './shiftTransformer';

// Tip transformers
export {
  toTipEntryDTO,
  toTipEntryDTOs,
  fromCreateTipDTO,
  fromUpdateTipDTO,
  type TipEntryDTO,
} from './tipTransformer';

// Payroll transformers
export {
  toPayrollPeriodDTO,
  toPayrollPeriodDTOs,
  fromCreatePayrollPeriodDTO,
  fromUpdatePayrollPeriodDTO,
  type PayrollPeriodDTO,
} from './payrollTransformer';
