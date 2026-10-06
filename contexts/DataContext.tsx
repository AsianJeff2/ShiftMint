import { downloadExport } from '@/lib/export/download';

import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocalAuth } from './LocalAuthContext';
import apiClient from '@/lib/api-client';
import { errorMessage } from '@/lib/error-handling';
import { hasPermission, Permission, type UserRole } from '@/lib/security/rbac';
import type { ExportRequest } from '@/lib/export/contracts';
import type { Business } from '@prisma/client';
import type {
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  CreateShiftRequest,
  UpdateShiftRequest,
  CreateTipRequest,
  UpdateTipRequest,
  CreatePayrollPeriodRequest,
} from '@/lib/types/api-dtos';
import type {
  EmployeeDTO,
  ShiftDTO,
  TipEntryDTO,
  PayrollPeriodDTO,
} from '@/lib/transformers';


interface DataContextType {
  // State
  employees: EmployeeDTO[];
  loadingEmployees: boolean;
  errorEmployees: string | null;
  tips: TipEntryDTO[];
  loadingTips: boolean;
  errorTips: string | null;
  shifts: ShiftDTO[];
  loadingShifts: boolean;
  errorShifts: string | null;
  payrollPeriods: PayrollPeriodDTO[];
  loadingPayroll: boolean;
  errorPayroll: string | null;
  business: Business | null;
  loadingBusiness: boolean;
  errorBusiness: string | null;
  analyticsEnabled: boolean;

  // Employee methods
  getEmployees: () => Promise<void>;
  createEmployee: (employeeData: CreateEmployeeRequest) => Promise<EmployeeDTO>;
  updateEmployee: (id: string, employeeData: UpdateEmployeeRequest) => Promise<EmployeeDTO>;
  deleteEmployee: (id: string) => Promise<void>;
  importEmployeesFromCSV: (csvData: Array<Record<string, unknown>>) => Promise<{
    success: boolean;
    imported: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  }>;

  // Enhanced Tips methods
  getTips: (params?: { startDate?: string; endDate?: string }) => Promise<TipEntryDTO[]>;
  createTip: (tipData: CreateTipRequest) => Promise<void>;
  updateTip: (id: string, tipData: UpdateTipRequest) => Promise<void>;
  deleteTip: (id: string) => Promise<void>;

  // New enhanced tip methods
  bulkCreateTips: (tips: CreateTipRequest[]) => Promise<{
    successful: number;
    failed: number;
    results: TipEntryDTO[];
    errors: Array<{ index: number; error: string }>;
  }>;
  validateShift: (employeeId: string, date: string, createIfMissing?: boolean) => Promise<{
    success: boolean;
    shiftExists: boolean;
    shiftCreated?: boolean;
    shift?: ShiftDTO;
    message?: string;
  }>;
  getComplianceCalculation: (employeeId: string, period: string) => Promise<{
    totalTips: number;
    totalWages: number;
    complianceStatus: string;
    adjustmentsNeeded?: number;
  }>;
  getTipAnalytics: (startDate?: string, endDate?: string) => Promise<{
    totalTips: number;
    tipsByType: Record<string, number>;
    tipsByEmployee: Array<{ employeeId: string; totalTips: number }>;
    dailyAverages: Record<string, number>;
  }>;
  getTipAuditHistory: (tipId: string) => Promise<Array<{
    id: string;
    action: string;
    performedBy: string;
    performedAt: string;
    oldValue?: string;
    newValue?: string;
  }>>;
  getTipSummary: (period?: string) => Promise<{
    totalTips: number;
    tipCount: number;
    averageTip: number;
    tipsByType: Record<string, number>;
  }>;

  // Shifts methods
  getShifts: (params?: { startDate?: string; endDate?: string }) => Promise<ShiftDTO[]>;
  createShift: (shiftData: CreateShiftRequest) => Promise<void>;
  updateShift: (id: string, shiftData: UpdateShiftRequest) => Promise<void>;
  deleteShift: (id: string) => Promise<void>;
  clockIn: (employeeId: string, jobCode?: string) => Promise<void>;
  clockOut: (shiftId: string) => Promise<void>;

  // Payroll methods
  getPayrollPeriods: () => Promise<void>;
  createPayrollPeriod: (periodData: CreatePayrollPeriodRequest) => Promise<void>;
  updatePayrollPeriod: (periodId: string, periodData: { startDate?: string; endDate?: string; status?: 'open' | 'closed' | 'paid'; notes?: string }) => Promise<void>;
  deletePayrollPeriod: (periodId: string) => Promise<void>;
  calculatePayroll: (periodId: string) => Promise<{
    success: boolean;
    period: PayrollPeriodDTO;
    entries: Array<{
      employeeId: string;
      regularHours: number;
      overtimeHours: number;
      totalTips: number;
      grossPay: number;
      netPay: number;
    }>;
    summary: {
      totalGrossPay: number;
      totalTips: number;
      totalTaxes: number;
      totalNetPay: number;
    };
  }>;

  // Business methods
  getBusiness: () => Promise<void>;
  updateBusiness: (businessData: Partial<Business>) => Promise<void>;

  // Analytics methods
  updateAnalyticsSettings: (enabled: boolean) => Promise<void>;

  // Export methods
  exportData: (options: ExportRequest) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataContextProvider');
  }
  return context;
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useLocalAuth();
  const session = useRef(user);
  session.current = user;
  const allowed = (permission: Permission) => !!user && hasPermission(user.role as UserRole, permission);
  const currentSession = () => !!user && session.current === user;

  const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [errorEmployees, setErrorEmployees] = useState<string | null>(null);

  const [tips, setTips] = useState<TipEntryDTO[]>([]);
  const [loadingTips, setLoadingTips] = useState(false);
  const [errorTips, setErrorTips] = useState<string | null>(null);

  const [shifts, setShifts] = useState<ShiftDTO[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [errorShifts, setErrorShifts] = useState<string | null>(null);

  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriodDTO[]>([]);
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const [errorPayroll, setErrorPayroll] = useState<string | null>(null);

  const [business, setBusiness] = useState<Business | null>(null);
  const [loadingBusiness, setLoadingBusiness] = useState(false);
  const [errorBusiness, setErrorBusiness] = useState<string | null>(null);

  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  const getEmployees = async () => {
    if (!currentSession()) return;
    if (!allowed(Permission.EMPLOYEES_VIEW)) { setEmployees([]); return; }
    setLoadingEmployees(true);
    setErrorEmployees(null);
    try {
      const response = await apiClient.getEmployees();
      if (currentSession()) setEmployees(response.employees || []);
    } catch (err: any) {
      if (currentSession()) { setEmployees([]); setErrorEmployees(errorMessage(err, 'Failed to fetch employees')); }
    } finally {
      if (currentSession()) setLoadingEmployees(false);
    }
  };

  const createEmployee = async (employeeData: CreateEmployeeRequest): Promise<EmployeeDTO> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    const response = await apiClient.createEmployee(employeeData);
    await getEmployees();
    return response.employee;
  };

  const updateEmployee = async (id: string, employeeData: UpdateEmployeeRequest): Promise<EmployeeDTO> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    const response = await apiClient.updateEmployee(id, employeeData);
    await getEmployees();
    return response.employee;
  };

  const deleteEmployee = async (id: string) => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    await apiClient.deleteEmployee(id);
    await getEmployees();
  };
  
  const importEmployeesFromCSV = async (csvData: Array<Record<string, unknown>>): Promise<{
    success: boolean;
    imported: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  }> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    const result = await apiClient.importEmployeesFromCSV(csvData);
    await getEmployees(); // Refresh list after import
    return result;
  };


  const getTips = useCallback(async (params?: { startDate?: string; endDate?: string }): Promise<TipEntryDTO[]> => {
    if (!currentSession()) return [];
    if (!allowed(Permission.TIPS_VIEW)) { setTips([]); return []; }
    const completeRead = !params?.startDate && !params?.endDate;
    if (completeRead) { setLoadingTips(true); setErrorTips(null); }
    try {
      const response = await apiClient.getTips(params);
      const records = Array.isArray(response) ? response : [];
      if (!currentSession()) return [];
      if (completeRead) setTips(records);
      return records;
    } catch (err: any) {
      if (currentSession() && completeRead) { setTips([]); setErrorTips(errorMessage(err, 'Failed to fetch tips')); }
      if (!completeRead) throw err;
      return [];
    } finally {
      if (currentSession() && completeRead) setLoadingTips(false);
    }
  }, [user]);
  
  const createTip = async (tipData: CreateTipRequest): Promise<void> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    await apiClient.createTip(tipData);
    await getTips();
  };

  const updateTip = async (id: string, tipData: UpdateTipRequest): Promise<void> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    await apiClient.updateTip(id, tipData);
    await getTips();
  };

  const deleteTip = async (id: string) => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    await apiClient.deleteTip(id);
    await getTips();
  };


  const getShifts = useCallback(async (params?: { startDate?: string; endDate?: string }): Promise<ShiftDTO[]> => {
    if (!currentSession()) return [];
    if (!allowed(Permission.SHIFTS_VIEW)) { setShifts([]); return []; }
    const completeRead = !params?.startDate && !params?.endDate;
    if (completeRead) { setLoadingShifts(true); setErrorShifts(null); }
    try {
      const response = await apiClient.getShifts(params);
      const records = Array.isArray(response) ? response : [];
      if (!currentSession()) return [];
      if (completeRead) setShifts(records);
      return records;
    } catch (err: any) {
      if (currentSession() && completeRead) { setShifts([]); setErrorShifts(errorMessage(err, 'Failed to fetch shifts')); }
      if (!completeRead) throw err;
      return [];
    } finally {
      if (currentSession() && completeRead) setLoadingShifts(false);
    }
  }, [user]);
  
  const createShift = async (shiftData: CreateShiftRequest): Promise<void> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    await apiClient.createShift(shiftData);
    await getShifts();
  };

  const updateShift = async (id: string, shiftData: UpdateShiftRequest): Promise<void> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    await apiClient.updateShift(id, shiftData);
    await getShifts();
  };

  const deleteShift = async (id: string) => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    await apiClient.deleteShift(id);
    await getShifts();
  };


  const getPayrollPeriods = async () => {
    if (!currentSession()) return;
    if (!allowed(Permission.PAYROLL_VIEW)) { setPayrollPeriods([]); return; }
    setLoadingPayroll(true);
    setErrorPayroll(null);
    try {
      const response = await apiClient.getPayrollPeriods();
      if (currentSession()) setPayrollPeriods(Array.isArray(response) ? response : []);
    } catch (err: any) {
      if (currentSession()) { setPayrollPeriods([]); setErrorPayroll(errorMessage(err, 'Failed to fetch payroll periods')); }
    } finally {
      if (currentSession()) setLoadingPayroll(false);
    }
  };
  
  const createPayrollPeriod = async (periodData: CreatePayrollPeriodRequest): Promise<void> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    await apiClient.createPayrollPeriod(periodData);
    await getPayrollPeriods();
  };

  const updatePayrollPeriod = async (periodId: string, periodData: { 
    startDate?: string; 
    endDate?: string; 
    status?: 'open' | 'closed' | 'paid'; 
    notes?: string 
  }) => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    setLoadingPayroll(true);
    setErrorPayroll(null);
    try {
      await apiClient.updatePayrollPeriod(periodId, periodData);
      await getPayrollPeriods();
    } catch (err: any) {
      if (currentSession()) setErrorPayroll(errorMessage(err, 'Failed to update payroll period'));
      throw err;
    } finally {
      if (currentSession()) setLoadingPayroll(false);
    }
  };

  const deletePayrollPeriod = async (periodId: string) => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    setLoadingPayroll(true);
    setErrorPayroll(null);
    try {
      await apiClient.deletePayrollPeriod(periodId);
      await getPayrollPeriods();
    } catch (err: any) {
      if (currentSession()) setErrorPayroll(errorMessage(err, 'Failed to delete payroll period'));
      throw err;
    } finally {
      if (currentSession()) setLoadingPayroll(false);
    }
  };

  const calculatePayroll = async (periodId: string): Promise<{
    success: boolean;
    period: PayrollPeriodDTO;
    entries: Array<{
      employeeId: string;
      regularHours: number;
      overtimeHours: number;
      totalTips: number;
      grossPay: number;
      netPay: number;
    }>;
    summary: {
      totalGrossPay: number;
      totalTips: number;
      totalTaxes: number;
      totalNetPay: number;
    };
  }> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    try {
      return await apiClient.calculatePayroll(periodId);
    } finally {
      await getPayrollPeriods();
    }
  };


  const getBusiness = async () => {
    if (!currentSession()) return;
    if (!allowed(Permission.CONFIG_VIEW)) { setBusiness(null); return; }
    setLoadingBusiness(true);
    setErrorBusiness(null);
    try {
      const response = await apiClient.getBusiness();
      if (currentSession()) setBusiness(response.data || null);
    } catch (err: any) {
      if (currentSession()) { setBusiness(null); setErrorBusiness(errorMessage(err, 'Failed to fetch business data')); }
    } finally {
      if (currentSession()) setLoadingBusiness(false);
    }
  };

  const updateBusiness = async (businessData: Partial<Business>) => {
    if (!currentSession()) throw new Error('The session changed. Sign in before changing records.');
    const response = await apiClient.updateBusiness(businessData);
    if (currentSession()) setBusiness(response.data || null);
  };

  const getAnalyticsSettings = async () => {
    if (!currentSession()) return;
    if (!allowed(Permission.SYSTEM_ADMIN)) { setAnalyticsEnabled(false); return; }
    try {
      const settings = await apiClient.getAnalyticsSettings();
      if (currentSession()) setAnalyticsEnabled(settings.analyticsEnabled || false);
    } catch (error) {
      console.error('Failed to load analytics settings:', error);
      if (currentSession()) setAnalyticsEnabled(false);
    }
  };

  const updateAnalyticsSettings = async (enabled: boolean) => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    try {
      await apiClient.updateAnalyticsSettings(enabled);
      if (currentSession()) setAnalyticsEnabled(enabled);
      
      // If enabling, trigger initial data collection
      if (enabled && currentSession()) {
        try {
          await apiClient.collectAnalytics();
        } catch (error) {
          console.error('Failed to trigger initial analytics collection:', error);
          // Don't throw - analytics collection failure shouldn't break the setting update
        }
      }
    } catch (error) {
      console.error('Failed to update analytics settings:', error);
      throw error;
    }
  };

  const exportData = async (options: ExportRequest): Promise<void> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    if (!currentSession() || !allowed(Permission.REPORTS_EXPORT)) throw new Error('You do not have permission to export records.');
    if (options.type === 'comprehensive' && options.format !== 'json') throw new Error('Comprehensive exports require JSON to preserve separate datasets.');
    try {
      const result = await apiClient.exportData(options);
      if (!result.success || !Array.isArray(result.data)) throw new Error(result.message || "Export failed");
      if (!currentSession()) throw new Error('The session changed before the export completed.');
      downloadExport(result.data, options.type, options.format, { taxTreatment: result.taxTreatment, warnings: result.warnings });
    } catch (error: any) {
      console.error('Export error:', error);
      throw error;
    }
  };

  // Enhanced tip methods implementations
  const bulkCreateTips = async (tips: CreateTipRequest[]): Promise<{
    successful: number;
    failed: number;
    results: TipEntryDTO[];
    errors: Array<{ index: number; error: string }>;
  }> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    const result = await apiClient.bulkCreateTips(tips);
    await getTips(); // Refresh tips after bulk creation
    return result;
  };

  const validateShift = async (employeeId: string, date: string, createIfMissing: boolean = false): Promise<{
    success: boolean;
    shiftExists: boolean;
    shiftCreated?: boolean;
    shift?: ShiftDTO;
    message?: string;
  }> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    return await apiClient.validateShift(employeeId, date, createIfMissing);
  };

  const getComplianceCalculation = async (employeeId: string, period: string): Promise<{
    totalTips: number;
    totalWages: number;
    complianceStatus: string;
    adjustmentsNeeded?: number;
  }> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    return await apiClient.getComplianceCalculation(employeeId, period);
  };

  const getTipAnalytics = async (startDate?: string, endDate?: string): Promise<{
    totalTips: number;
    tipsByType: Record<string, number>;
    tipsByEmployee: Array<{ employeeId: string; totalTips: number }>;
    dailyAverages: Record<string, number>;
  }> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    return await apiClient.getTipAnalytics(startDate, endDate);
  };

  const getTipAuditHistory = async (tipId: string): Promise<Array<{
    id: string;
    action: string;
    performedBy: string;
    performedAt: string;
    oldValue?: string;
    newValue?: string;
  }>> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    return await apiClient.getTipAuditHistory(tipId);
  };

  const getTipSummary = async (period?: string): Promise<{
    totalTips: number;
    tipCount: number;
    averageTip: number;
    tipsByType: Record<string, number>;
  }> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    return await apiClient.getTipSummary(period || '7d');
  };

  const clockIn = async (employeeId: string, jobCode?: string): Promise<void> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    await apiClient.clockIn(employeeId, jobCode);
    await getShifts(); // Refresh shifts after clock in
  };

  const clockOut = async (shiftId: string): Promise<void> => {
    if (!currentSession()) throw new Error("The session changed. Sign in before changing records.");
    await apiClient.clockOut(shiftId);
    await getShifts(); // Refresh shifts after clock out
  };

  useEffect(() => {
    session.current = user;
    setEmployees([]); setTips([]); setShifts([]); setPayrollPeriods([]); setBusiness(null); setAnalyticsEnabled(false);
    setLoadingEmployees(false); setLoadingTips(false); setLoadingShifts(false); setLoadingPayroll(false); setLoadingBusiness(false);
    setErrorEmployees(null); setErrorTips(null); setErrorShifts(null); setErrorPayroll(null); setErrorBusiness(null);
    if (user) {
      getEmployees();
      void getShifts().catch(() => {});
      void getTips().catch(() => {});
      getPayrollPeriods();
      getBusiness();
      getAnalyticsSettings();
    }
    return () => { if (session.current === user) session.current = null; };
  }, [user]);

  const value = useMemo(() => ({
    employees, loadingEmployees, errorEmployees,
    tips, loadingTips, errorTips,
    shifts, loadingShifts, errorShifts,
    payrollPeriods, loadingPayroll, errorPayroll,
    business, loadingBusiness, errorBusiness,
    analyticsEnabled,
    getEmployees, createEmployee, updateEmployee, deleteEmployee, importEmployeesFromCSV,
    getTips, createTip, updateTip, deleteTip,
    getShifts, createShift, updateShift, deleteShift,
    getPayrollPeriods, createPayrollPeriod, updatePayrollPeriod, deletePayrollPeriod, calculatePayroll,
    getBusiness, updateBusiness,
    exportData,
    bulkCreateTips,
    validateShift,
    getComplianceCalculation,
    getTipAnalytics,
    getTipAuditHistory,
    getTipSummary,
    clockIn,
    clockOut,
    updateAnalyticsSettings,
  }), [
    employees, loadingEmployees, errorEmployees,
    tips, loadingTips, errorTips,
    shifts, loadingShifts, errorShifts,
    payrollPeriods, loadingPayroll, errorPayroll,
    business, loadingBusiness, errorBusiness,
    analyticsEnabled, user
  ]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};
