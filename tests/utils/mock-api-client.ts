import { vi } from 'vitest';

/**
 * Creates a mock ApiClient for testing
 * All methods are vi.fn() so you can assert on calls and provide return values
 */
export const createMockApiClient = () => {
  return {
    setToken: vi.fn(),

    // Auth methods
    login: vi.fn(),
    setup: vi.fn(),
    getCurrentUser: vi.fn(),
    changePassword: vi.fn(),

    // Employee methods
    getEmployees: vi.fn(),
    createEmployee: vi.fn(),
    updateEmployee: vi.fn(),
    deleteEmployee: vi.fn(),
    importEmployeesFromCSV: vi.fn(),

    // Shift methods
    getShifts: vi.fn(),
    createShift: vi.fn(),
    updateShift: vi.fn(),
    deleteShift: vi.fn(),
    clockIn: vi.fn(),
    clockOut: vi.fn(),

    // Tip methods
    getTips: vi.fn(),
    createTip: vi.fn(),
    updateTip: vi.fn(),
    deleteTip: vi.fn(),
    bulkCreateTips: vi.fn(),

    // Payroll methods
    getPayrollPeriods: vi.fn(),
    createPayrollPeriod: vi.fn(),
    calculatePayroll: vi.fn(),
    getPayrollSummary: vi.fn(),

    // Business methods
    getBusiness: vi.fn(),
    updateBusiness: vi.fn(),
    getBusinessConfiguration: vi.fn(),
    updateBusinessConfiguration: vi.fn(),

    // Export methods
    exportData: vi.fn(),
  };
};

export type MockApiClient = ReturnType<typeof createMockApiClient>;
