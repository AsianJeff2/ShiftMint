import { describe, it, expect } from 'vitest';
import {
  CreateEmployeeRequestSchema,
  LoginRequestSchema,
  CreateShiftRequestSchema,
  CreateTipRequestSchema,
  SetupRequestSchema,
  validateRequest,
  EmployeeRoleSchema,
  ShiftStatusSchema,
  PaginationSchema,
  EmployeeResponseSchema,
  PayrollPeriodStatusSchema,
  ClockInRequestSchema,
  CreatePayrollPeriodRequestSchema,
} from './api-dtos';

describe('API DTOs', () => {
  describe('runtime API contract alignment', () => {
    it('requires a selected employee for clock-in', () => {
      expect(ClockInRequestSchema.safeParse({ jobCode: 'server' }).success).toBe(false);
      expect(ClockInRequestSchema.safeParse({ employeeId: 'employee-cuid', jobCode: 'server' }).success).toBe(true);
    });
    it('matches backend payroll period states', () => {
      expect(PayrollPeriodStatusSchema.safeParse('open').success).toBe(true);
      expect(PayrollPeriodStatusSchema.safeParse('closed').success).toBe(true);
      expect(PayrollPeriodStatusSchema.safeParse('paid').success).toBe(true);
      expect(PayrollPeriodStatusSchema.safeParse('draft').success).toBe(false);
    });
    it('accepts opaque string employee identifiers returned by Prisma', () => {
      const employee = { id: 'cmployee123', firstName: 'Taylor', lastName: 'Vale', email: 'employee@example.test', phone: null, hourlyRate: 20, role: 'server', startDate: '2026-10-05T00:00:00Z', status: 'active', createdAt: '2026-10-05T00:00:00Z', updatedAt: '2026-10-05T00:00:00Z' };
      expect(EmployeeResponseSchema.safeParse(employee).success).toBe(true);
      expect(EmployeeResponseSchema.safeParse({ ...employee, id: 1 }).success).toBe(false);
    });
    it('rejects invalid timestamps and accepts one business-day payroll marker', () => {
      expect(CreateShiftRequestSchema.safeParse({ startTime: 'not-a-date' }).success).toBe(false);
      expect(CreatePayrollPeriodRequestSchema.safeParse({ startDate: 'invalid', endDate: '2026-10-05' }).success).toBe(false);
      expect(CreatePayrollPeriodRequestSchema.safeParse({ startDate: '2026-10-05', endDate: '2026-10-05' }).success).toBe(true);
    });
  });
  describe('CreateEmployeeRequestSchema', () => {
    it('validates valid employee data', () => {
      const validEmployee = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        hourlyRate: 15.50,
        role: 'server' as const,
        startDate: new Date().toISOString(),
      };

      const result = CreateEmployeeRequestSchema.safeParse(validEmployee);
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const invalidEmployee = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'not-an-email',
        hourlyRate: 15.50,
        role: 'server' as const,
        startDate: new Date().toISOString(),
      };

      const result = CreateEmployeeRequestSchema.safeParse(invalidEmployee);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessage = result.error.issues[0]?.message || '';
        expect(errorMessage).toContain('Invalid email');
      }
    });

    it('rejects negative hourly rate', () => {
      const invalidEmployee = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        hourlyRate: -5,
        role: 'server' as const,
        startDate: new Date().toISOString(),
      };

      const result = CreateEmployeeRequestSchema.safeParse(invalidEmployee);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessage = result.error.issues[0]?.message || '';
        expect(errorMessage).toContain('positive');
      }
    });

    it('accepts optional banking info', () => {
      const employeeWithBanking = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        hourlyRate: 15.50,
        role: 'server' as const,
        startDate: new Date().toISOString(),
        bankingInfo: {
          accountNumber: '123456789',
          routingNumber: '987654321',
          accountType: 'checking' as const,
        },
      };

      const result = CreateEmployeeRequestSchema.safeParse(employeeWithBanking);
      expect(result.success).toBe(true);
    });

    it('validates employee roles', () => {
      const validRoles = ['server', 'bartender', 'cook', 'host', 'manager', 'busser', 'dishwasher', 'runner', 'other'];

      for (const role of validRoles) {
        const employee = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          hourlyRate: 15,
          role,
          startDate: new Date().toISOString(),
        };

        const result = CreateEmployeeRequestSchema.safeParse(employee);
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid role', () => {
      const employee = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        hourlyRate: 15,
        role: 'invalid-role',
        startDate: new Date().toISOString(),
      };

      const result = CreateEmployeeRequestSchema.safeParse(employee);
      expect(result.success).toBe(false);
    });
  });

  describe('LoginRequestSchema', () => {
    it('validates valid login credentials', () => {
      const validLogin = {
        email: 'user@example.com',
        password: 'securePassword123',
      };

      const result = LoginRequestSchema.safeParse(validLogin);
      expect(result.success).toBe(true);
    });

    it('accepts any password for login (validation happens against database)', () => {
      const loginWithShortPassword = {
        email: 'user@example.com',
        password: 'short',
      };

      const result = LoginRequestSchema.safeParse(loginWithShortPassword);
      expect(result.success).toBe(true);
    });

    it('accepts any email format for login (allows phone number login)', () => {
      const loginWithPhone = {
        email: '555-1234',
        password: 'securePassword123',
      };

      const result = LoginRequestSchema.safeParse(loginWithPhone);
      expect(result.success).toBe(true);
    });
  });

  describe('CreateShiftRequestSchema', () => {
    it('validates valid shift data', () => {
      const now = new Date();
      const later = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours later

      const validShift = {
        startTime: now.toISOString(),
        endTime: later.toISOString(),
        jobCode: 'server',
        status: 'completed' as const,
        notes: 'Test shift',
      };

      const result = CreateShiftRequestSchema.safeParse(validShift);
      expect(result.success).toBe(true);
    });

    it('applies default values', () => {
      const now = new Date();

      const minimalShift = {
        startTime: now.toISOString(),
      };

      const result = CreateShiftRequestSchema.safeParse(minimalShift);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('active');
      }
    });

    it('rejects invalid datetime format', () => {
      const invalidShift = {
        startTime: 'not-a-date',
      };

      const result = CreateShiftRequestSchema.safeParse(invalidShift);
      expect(result.success).toBe(false);
    });
  });

  describe('CreateTipRequestSchema', () => {
    it('validates valid tip data', () => {
      const validTip = {
        amount: 25.50,
        tipType: 'credit' as const,
        source: 'manual' as const,
        employeeId: 'emp_123',
        shiftId: 'shift_456',
        notes: 'Good service',
      };

      const result = CreateTipRequestSchema.safeParse(validTip);
      expect(result.success).toBe(true);
    });

    it('rejects negative tip amount', () => {
      const invalidTip = {
        amount: -10,
        tipType: 'cash' as const,
      };

      const result = CreateTipRequestSchema.safeParse(invalidTip);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessage = result.error.issues[0]?.message || '';
        expect(errorMessage).toContain('positive');
      }
    });

    it('validates all 9 tip types', () => {
      const validTypes = ['pos_pretax', 'pos_posttax', 'pos_pooled', 'cash', 'credit', 'hourly', 'table_server', 'bulk', 'other'];

      for (const tipType of validTypes) {
        const tip = {
          amount: 20,
          tipType,
        };

        const result = CreateTipRequestSchema.safeParse(tip);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('SetupRequestSchema', () => {
    it('validates complete setup data', () => {
      const validSetup = {
        businessName: 'My Restaurant',
        businessType: 'restaurant',
        timezone: 'America/Los_Angeles',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@restaurant.com',
        password: 'securePassword123',
        acceptedTerms: true,
        acceptedPrivacy: true,
        payrollConfig: {
          payFrequency: 'biweekly' as const,
          overtimeThreshold: 40,
          overtimeRate: 1.5,
        },
      };

      const result = SetupRequestSchema.safeParse(validSetup);
      expect(result.success).toBe(true);
    });

    it('applies default values', () => {
      const minimalSetup = {
        businessName: 'My Restaurant',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@restaurant.com',
        password: 'securePassword123',
        acceptedTerms: true,
        acceptedPrivacy: true,
      };

      const result = SetupRequestSchema.safeParse(minimalSetup);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timezone).toBe('America/New_York');
        expect(result.data.preferredPayrollFreq).toBe('bi-weekly');
        expect(result.data.analyticsConsent).toBe(false);
      }
    });

    it('rejects weak password', () => {
      const invalidSetup = {
        businessName: 'My Restaurant',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@restaurant.com',
        password: 'weak',
        acceptedTerms: true,
        acceptedPrivacy: true,
      };

      const result = SetupRequestSchema.safeParse(invalidSetup);
      expect(result.success).toBe(false);
    });

    it('rejects when terms not accepted', () => {
      const invalidSetup = {
        businessName: 'My Restaurant',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@restaurant.com',
        password: 'securePassword123',
        acceptedTerms: false,
        acceptedPrivacy: true,
      };

      const result = SetupRequestSchema.safeParse(invalidSetup);
      expect(result.success).toBe(false);
    });
  });

  describe('PaginationSchema', () => {
    it('applies default values', () => {
      const result = PaginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(50);
        expect(result.data.sortOrder).toBe('asc');
      }
    });

    it('validates page and limit', () => {
      const validPagination = {
        page: 2,
        limit: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc' as const,
      };

      const result = PaginationSchema.safeParse(validPagination);
      expect(result.success).toBe(true);
    });

    it('rejects negative page', () => {
      const result = PaginationSchema.safeParse({ page: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects limit over 100', () => {
      const result = PaginationSchema.safeParse({ limit: 150 });
      expect(result.success).toBe(false);
    });
  });

  describe('validateRequest helper', () => {
    it('returns success for valid data', () => {
      const result = validateRequest(LoginRequestSchema, {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('returns formatted errors for invalid data', () => {
      const result = validateRequest(CreateEmployeeRequestSchema, {
        firstName: 'John',
        // Missing required fields: lastName, email, hourlyRate, role, startDate
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain(':');
      }
    });
  });

  describe('Enum schemas', () => {
    it('validates employee roles', () => {
      expect(EmployeeRoleSchema.safeParse('server').success).toBe(true);
      expect(EmployeeRoleSchema.safeParse('bartender').success).toBe(true);
      expect(EmployeeRoleSchema.safeParse('invalid').success).toBe(false);
    });

    it('validates shift statuses', () => {
      expect(ShiftStatusSchema.safeParse('active').success).toBe(true);
      expect(ShiftStatusSchema.safeParse('completed').success).toBe(true);
      expect(ShiftStatusSchema.safeParse('break').success).toBe(true);
      expect(ShiftStatusSchema.safeParse('invalid').success).toBe(false);
    });
  });
});
