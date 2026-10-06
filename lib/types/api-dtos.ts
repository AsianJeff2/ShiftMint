/**
 * API Data Transfer Objects (DTOs) with Zod validation
 *
 * IMPORTANT: These types define the API contracts between frontend and backend.
 * Any changes here should be versioned and backward compatible.
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * Standard API response wrapper
 */
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  });

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

/**
 * Pagination parameters
 */
export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(50),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type PaginationParams = z.infer<typeof PaginationSchema>;

/**
 * Paginated response wrapper
 */
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  });

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// ============================================================================
// Employee DTOs
// ============================================================================

/**
 * Employee roles
 */
export const EmployeeRoleSchema = z.enum([
  'server',
  'bartender',
  'cook',
  'host',
  'manager',
  'busser',
  'dishwasher',
  'runner',
  'other',
]);

export type EmployeeRole = z.infer<typeof EmployeeRoleSchema>;

/**
 * Employee status
 */
export const EmployeeStatusSchema = z.enum(['active', 'inactive', 'terminated']);

export type EmployeeStatus = z.infer<typeof EmployeeStatusSchema>;

/**
 * Create employee request
 */
const EmployeeRequestBaseSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  hourlyRate: z.number().positive('Hourly rate must be positive'),
  role: EmployeeRoleSchema,
  department: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required').refine(value => Number.isFinite(new Date(value).getTime()), 'Valid start date is required'),
  terminationDate: z.string().refine(value => Number.isFinite(new Date(value).getTime()), 'Valid termination date is required').optional(),
  status: EmployeeStatusSchema,
  tipEligible: z.boolean(),
  payType: z.enum(['hourly', 'salary']),
  overtimeRate: z.number().min(0).optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  taxExemptions: z.number().int().min(0),
  bankRoutingNumber: z.string().optional(),
  bankAccountNumber: z.string().optional(),
});
export const CreateEmployeeRequestSchema = EmployeeRequestBaseSchema.extend({ status: EmployeeStatusSchema.default('active'), tipEligible: z.boolean().default(true), payType: z.enum(['hourly', 'salary']).default('hourly'), taxExemptions: z.number().int().min(0).default(0) });

export type CreateEmployeeRequest = z.infer<typeof CreateEmployeeRequestSchema>;

/**
 * Update employee request (all fields optional)
 */
export const UpdateEmployeeRequestSchema = EmployeeRequestBaseSchema.partial();

export type UpdateEmployeeRequest = z.infer<typeof UpdateEmployeeRequestSchema>;

/**
 * Employee response
 */
export const EmployeeResponseSchema = z.object({
  id: z.string().min(1),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  hourlyRate: z.number(),
  role: EmployeeRoleSchema,
  startDate: z.string().datetime(),
  status: EmployeeStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type EmployeeResponse = z.infer<typeof EmployeeResponseSchema>;

// ============================================================================
// Shift DTOs
// ============================================================================

/**
 * Shift status
 */
export const ShiftStatusSchema = z.enum(['active', 'completed', 'pending_review', 'break']);

export type ShiftStatus = z.infer<typeof ShiftStatusSchema>;

/**
 * Create shift request - matches actual backend implementation
 */
const isoInstant = z.iso.datetime({ offset: true });
/** Explicit offsets keep hosted and desktop writes on the same instant. */
export const OffsetTimestampSchema = z.string().refine(value => {
  const normalized = value.replace(/(T\d{2}:\d{2})(Z|[+-]\d{2}:\d{2})$/, '$1:00$2');
  return isoInstant.safeParse(normalized).success && Number.isFinite(new Date(value).getTime());
}, 'Use a valid ISO timestamp with Z or an explicit timezone offset');
const ShiftRequestBaseSchema = z.object({
  startTime: OffsetTimestampSchema,
  endTime: OffsetTimestampSchema.or(z.literal('')).optional(),
  jobCode: z.string().optional(),
  locationId: z.string().optional(),
  status: ShiftStatusSchema,
  notes: z.string().optional(),
  businessId: z.string().optional(),
  employeeId: z.string().optional(),
  shiftDate: z.string().optional(),
  durationMin: z.number().optional(),
  totalSales: z.number().optional(),
  cashSales: z.number().optional(),
  creditCardSales: z.number().optional(),
  totalTips: z.number().optional(),
  cashTips: z.number().optional(),
  creditCardTips: z.number().optional(),
  hourlyRate: z.number().positive().optional(),
}).passthrough();
export const CreateShiftRequestSchema = ShiftRequestBaseSchema.extend({ status: ShiftStatusSchema.default('active') });

export type CreateShiftRequest = z.infer<typeof CreateShiftRequestSchema>;

/**
 * Update shift request
 */
export const UpdateShiftRequestSchema = ShiftRequestBaseSchema.partial();

export type UpdateShiftRequest = z.infer<typeof UpdateShiftRequestSchema>;

/**
 * Clock in request
 */
export const ClockInRequestSchema = z.object({
  employeeId: z.string().min(1, 'An employee is required'),
  jobCode: z.string().optional(),
});

export type ClockInRequest = z.infer<typeof ClockInRequestSchema>;

/**
 * Clock out request
 */
export const ClockOutRequestSchema = z.object({
  shiftId: z.string(),
});

export type ClockOutRequest = z.infer<typeof ClockOutRequestSchema>;

/**
 * Shift response - matches actual database model
 */
export const ShiftResponseSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  employeeId: z.string().nullable(),
  shiftDate: z.string(), // Date as string (YYYY-MM-DD)
  startTime: z.string().datetime(),
  endTime: z.string().datetime().nullable(),
  durationMin: z.number().nullable(),
  jobCode: z.string(),
  position: z.string().nullable(),
  employeeType: z.string().nullable(),
  stationNumber: z.string().nullable(),
  locationId: z.string(),
  status: z.string(),
  hourlyRate: z.number(),
  regularWage: z.number(),
  overtimeWage: z.number(),
  totalWage: z.number(),
  totalSales: z.number(),
  cashSales: z.number(),
  creditCardSales: z.number(),
  totalTips: z.number(),
  cashTips: z.number(),
  creditCardTips: z.number(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ShiftResponse = z.infer<typeof ShiftResponseSchema>;

// ============================================================================
// Tip DTOs
// ============================================================================

/**
 * Tip type - Enhanced with all 9 types
 */
export const TipTypeSchema = z.enum([
  'pos_pretax',
  'pos_posttax',
  'pos_pooled',
  'cash',
  'credit',
  'hourly',
  'table_server',
  'bulk',
  'other',
]);

export type TipType = z.infer<typeof TipTypeSchema>;

/**
 * Tip source
 */
export const TipSourceSchema = z.enum([
  'manual',
  'pos',
  'csv_import',
  'bulk_entry',
  'auto_hourly',
]);

export type TipSource = z.infer<typeof TipSourceSchema>;

/**
 * Create tip request - matches actual backend implementation
 */
const TipRequestBaseSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  tipType: TipTypeSchema,
  source: TipSourceSchema,
  notes: z.string().optional(),
  timestamp: OffsetTimestampSchema.optional(),
  tableNumber: z.string().optional(),
  serverName: z.string().optional(),
  employeeId: z.string().optional(),
  shiftId: z.string().optional(),
  posTransactionId: z.string().optional(),
  isPooled: z.boolean(),
  taxableAmount: z.number().optional(),
  changeReason: z.string().optional(),
});
export const CreateTipRequestSchema = TipRequestBaseSchema.extend({ tipType: TipTypeSchema.default('credit'), source: TipSourceSchema.default('manual'), isPooled: z.boolean().default(false) });

export type CreateTipRequest = z.infer<typeof CreateTipRequestSchema>;

/**
 * Update tip request
 */
export const UpdateTipRequestSchema = TipRequestBaseSchema.partial();

export type UpdateTipRequest = z.infer<typeof UpdateTipRequestSchema>;

/**
 * Tip response - matches actual TipEntry model
 */
export const TipResponseSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  employeeId: z.string().nullable(),
  shiftId: z.string().nullable(),
  amount: z.number(),
  tipType: z.string(),
  source: z.string(),
  tableNumber: z.string().nullable(),
  serverName: z.string().nullable(),
  posTransactionId: z.string().nullable(),
  isPooled: z.boolean(),
  poolDistributionId: z.string().nullable(),
  taxableAmount: z.number().nullable(),
  notes: z.string().nullable(),
  timestamp: z.string().datetime(),
  processed: z.boolean(),
  processedAt: z.string().datetime().nullable(),
  complianceStatus: z.string(),
  wageCreditUsed: z.number(),
  irsReportable: z.boolean(),
  version: z.number().int(),
  lastModifiedBy: z.string().nullable(),
  originalAmount: z.number().nullable(),
  changeReason: z.string().nullable(),
  transactionId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TipResponse = z.infer<typeof TipResponseSchema>;

// ============================================================================
// Payroll DTOs
// ============================================================================

/**
 * Payroll period status
 */
export const PayrollPeriodStatusSchema = z.enum(['open', 'closed', 'paid']);

export type PayrollPeriodStatus = z.infer<typeof PayrollPeriodStatusSchema>;

/**
 * Create payroll period request - matches actual backend implementation
 */
export const CreatePayrollPeriodRequestSchema = z.object({
  startDate: z.string().transform((val) => {
    // Handle both date strings (YYYY-MM-DD) and datetime strings
    if (val.includes('T')) {
      return val; // Already datetime format
    }
    return `${val}T00:00:00.000Z`; // Convert date to datetime
  }).refine(val => Number.isFinite(new Date(val).getTime()), 'Invalid payroll start date'),
  endDate: z.string().transform((val) => {
    // Handle both date strings (YYYY-MM-DD) and datetime strings
    if (val.includes('T')) {
      return val; // Already datetime format
    }
    return `${val}T23:59:59.999Z`; // Convert date to end of day datetime
  }).refine(val => Number.isFinite(new Date(val).getTime()), 'Invalid payroll end date'),
  notes: z.string().optional(),
});

export type CreatePayrollPeriodRequest = z.infer<typeof CreatePayrollPeriodRequestSchema>;

/**
 * Payroll entry response
 */
export const PayrollEntryResponseSchema = z.object({
  id: z.string().min(1),
  employeeId: z.string().min(1),
  payrollPeriodId: z.string().min(1),
  regularHours: z.number().nonnegative(),
  overtimeHours: z.number().nonnegative(),
  regularPay: z.number().nonnegative(),
  overtimePay: z.number().nonnegative(),
  totalTips: z.number().nonnegative(),
  grossPay: z.number().nonnegative(),
  totalTaxes: z.number().nonnegative(),
  netPay: z.number(), // Estimates can be negative when deductions exceed wages.
  hoursWorked: z.number().nonnegative(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PayrollEntryResponse = z.infer<typeof PayrollEntryResponseSchema>;

/**
 * Payroll period response
 */
export const PayrollPeriodResponseSchema = z.object({
  id: z.string().min(1),
  businessId: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  status: PayrollPeriodStatusSchema,
  totalTips: z.number().nonnegative(),
  totalSales: z.number().nonnegative(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  payrollEntries: z.array(PayrollEntryResponseSchema).optional(),
});

export type PayrollPeriodResponse = z.infer<typeof PayrollPeriodResponseSchema>;

// ============================================================================
// Auth DTOs
// ============================================================================

/**
 * User role
 */
export const UserRoleSchema = z.enum(['owner', 'admin', 'manager', 'staff']);

export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * Login request
 */
export const LoginRequestSchema = z.object({
  email: z.string().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/**
 * Setup request (first-time business setup)
 */
export const SetupRequestSchema = z.object({
  // Business info
  businessName: z.string().min(1, 'Business name is required').max(100),
  businessType: z.string().optional(),
  ein: z.string().optional(),
  location: z.string().optional(),
  posSystem: z.string().optional(),
  usageIntent: z.string().optional(),
  timezone: z.string().default('America/New_York'),

  // Owner account
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),

  // User preferences
  preferredPayrollFreq: z.string().default('bi-weekly'),
  preferredTipStyle: z.string().default('hybrid'),

  // Legal acceptance
  acceptedTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the Terms of Service',
  }),
  acceptedPrivacy: z.boolean().refine(val => val === true, {
    message: 'You must accept the Privacy Policy',
  }),
  analyticsConsent: z.boolean().default(false),

  // Payroll config (optional)
  payrollConfig: z
    .object({
      payFrequency: z.enum(['weekly', 'biweekly', 'monthly']).default('biweekly'),
      overtimeThreshold: z.number().positive().default(40),
      overtimeRate: z.number().min(1).default(1.5),
    })
    .optional(),
});

export type SetupRequest = z.infer<typeof SetupRequestSchema>;

/**
 * Auth response
 */
export const AuthResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(), // cuid from Prisma
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    role: UserRoleSchema,
    businessId: z.string(), // cuid from Prisma
  }),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/**
 * Change password request
 */
export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

// ============================================================================
// Business Configuration DTOs
// ============================================================================

/**
 * Tip distribution method
 */
export const TipDistributionMethodSchema = z.enum(['percentage', 'hours', 'hybrid']);

export type TipDistributionMethod = z.infer<typeof TipDistributionMethodSchema>;

/**
 * Update business config request
 */
export const UpdateBusinessConfigRequestSchema = z.object({
  businessName: z.string().min(1).max(100).optional(),
  timezone: z.string().optional(),
  payrollConfig: z
    .object({
      payFrequency: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
      overtimeThreshold: z.number().positive().optional(),
      overtimeRate: z.number().min(1).optional(),
    })
    .optional(),
  tipDistribution: z
    .object({
      method: TipDistributionMethodSchema.optional(),
      percentages: z.record(z.string(), z.number()).optional(),
      minimumHours: z.number().nonnegative().optional(),
    })
    .optional(),
});

export type UpdateBusinessConfigRequest = z.infer<typeof UpdateBusinessConfigRequestSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates data against a Zod schema and returns type-safe result
 */
export function validateRequest<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`),
  };
}
