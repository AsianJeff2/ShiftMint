// API Client for ShiftMint Desktop - Local Backend Communication
import { errorHandler, ErrorType, handleApiError } from './error-handling';
import type { Employee, Shift, TipEntry, PayrollPeriod, Business, User } from '@prisma/client';
import type { PosConnection, PosConnectInput, PosPreview, PosPreviewInput, PosProvider } from './pos/contracts';
import type { ExportRequest, ExportResponse } from './export/contracts';
import type { TipDistributionSettings } from './tip-distribution';
import type {
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  CreateShiftRequest,
  UpdateShiftRequest,
  CreateTipRequest,
  UpdateTipRequest,
  CreatePayrollPeriodRequest,
  AuthResponse,
  ApiResponse,
} from './types/api-dtos';
import {
  toEmployeeDTO,
  toEmployeeDTOs,
  toShiftDTO,
  toShiftDTOs,
  toTipEntryDTO,
  toTipEntryDTOs,
  toPayrollPeriodDTO,
  toPayrollPeriodDTOs,
  type EmployeeDTO,
  type ShiftDTO,
  type TipEntryDTO,
  type PayrollPeriodDTO,
} from './transformers';

// Auth user type from API responses (subset of full User)
type AuthUser = AuthResponse['user'];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (window.location.protocol === 'file:' ? 'http://localhost:3001/api' : '/api');

interface ApiError extends Error {
  status?: number;
  response?: unknown;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const desktopApi = (window as Window & { electronAPI?: { getApiToken?: () => Promise<string> } }).electronAPI;
      if (desktopApi?.getApiToken) {
        (headers as Record<string, string>)['X-Desktop-Token'] = await desktopApi.getApiToken();
      }
      // Removed console.log for production - using error handler only
      
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Response status handled by error handler if needed

      if (!response.ok) {
        const error: ApiError = new Error(`HTTP error! status: ${response.status}`);
        error.status = response.status;
        try {
          error.response = await response.json();
        } catch (e) {
          error.response = await response.text();
        }
        
        // Use centralized error handling
        const appError = handleApiError(error, {
          component: 'ApiClient',
          action: `${options.method || 'GET'} ${endpoint}`
        });
        
        throw appError;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // If it's already an AppError from our error handler, re-throw it
      if (error && typeof error === 'object' && 'type' in error) {
        throw error;
      }
      
      // Handle other errors (network, parsing, etc.)
      const appError = errorHandler.createError(
        ErrorType.NETWORK,
        error instanceof Error ? error.message : 'Unknown network error',
        error instanceof Error ? error : undefined,
        {
          component: 'ApiClient',
          action: `${options.method || 'GET'} ${endpoint}`
        }
      );
      
      throw appError;
    }
  }

  // Health check
  async healthCheck() {
    return this.request<{ status: string; message: string }>('/health');
  }

  // Authentication endpoints
  async checkSetup() {
    try {
      const response = await this.request<{ 
        success: boolean;
        configured: boolean;
        requiresSetup: boolean;
      }>('/auth/status');
      return { needsSetup: response.requiresSetup };
    } catch (error) {
      console.warn('Setup check failed, assuming needs setup');
      return { needsSetup: true };
    }
  }

  async setup(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    businessName: string;
    phone?: string;
    businessType?: string;
    ein?: string;
    location?: string;
    posSystem?: string;
    usageIntent?: string;
    preferredPayrollFreq?: string;
    preferredTipStyle?: string;
    acceptedTerms?: boolean;
    acceptedPrivacy?: boolean;
    analyticsConsent?: boolean;
    bootstrapToken?: string;
  }): Promise<AuthResponse> {
    const desktop = (window as Window & { electronAPI?: { getBootstrapToken?: () => Promise<string> } }).electronAPI;
    const bootstrapToken = data.bootstrapToken || await desktop?.getBootstrapToken?.();
    return this.request<AuthResponse>('/auth/setup', {
      method: 'POST',
      headers: bootstrapToken ? { 'X-Bootstrap-Token': bootstrapToken } : {},
      body: JSON.stringify({ ...data, bootstrapToken: undefined }),
    });
  }

  async login(email: string, password: string, rememberMe?: boolean): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe }),
    });
  }

  async getCurrentUser(): Promise<{ user: AuthUser }> {
    return this.request<{ user: AuthUser }>('/auth/me');
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ message: string; requiresLogin: boolean }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword: newPassword }),
    });
  }

  async logout() {
    return this.request<{ success: boolean }>('/auth/logout', { method: 'POST' });
  }

  getPosConnections() { return this.request<ApiResponse<PosConnection[]>>('/pos/connections'); }
  connectPos(data: PosConnectInput) { return this.request<ApiResponse<PosConnection>>('/pos/connections', { method: 'POST', body: JSON.stringify(data) }); }
  disconnectPos(provider: PosProvider) { return this.request<ApiResponse<null>>(`/pos/connections/${provider}`, { method: 'DELETE' }); }
  previewPos(provider: PosProvider, data: PosPreviewInput) { return this.request<ApiResponse<PosPreview>>(`/pos/connections/${provider}/preview`, { method: 'POST', body: JSON.stringify(data) }); }

  // Business endpoints
  async getBusiness(): Promise<ApiResponse<Business>> {
    return this.request<ApiResponse<Business>>('/business');
  }

  async updateBusiness(data: Partial<Business>): Promise<ApiResponse<Business>> {
    return this.request<ApiResponse<Business>>('/business', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Employee endpoints
  async getEmployees(): Promise<{ success: boolean; employees: EmployeeDTO[]; count: number }> {
    const response = await this.request<{ success: boolean; employees: Employee[]; count: number }>('/employees');
    return {
      success: response.success,
      employees: toEmployeeDTOs(response.employees || []),
      count: response.count,
    };
  }

  async getEmployee(id: string): Promise<{ employee: EmployeeDTO }> {
    const response = await this.request<{ employee: Employee }>(`/employees/${id}`);
    return {
      employee: toEmployeeDTO(response.employee),
    };
  }

  async createEmployee(data: CreateEmployeeRequest): Promise<{ success: boolean; employee: EmployeeDTO }> {
    const response = await this.request<{ success: boolean; employee: Employee }>('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return {
      success: response.success,
      employee: toEmployeeDTO(response.employee),
    };
  }

  async updateEmployee(id: string, data: UpdateEmployeeRequest): Promise<{ employee: EmployeeDTO }> {
    const response = await this.request<{ employee: Employee }>(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return {
      employee: toEmployeeDTO(response.employee),
    };
  }

  async deleteEmployee(id: string): Promise<{ employee: EmployeeDTO }> {
    const response = await this.request<{ employee: Employee }>(`/employees/${id}`, {
      method: 'DELETE',
    });
    return {
      employee: toEmployeeDTO(response.employee),
    };
  }

  async getEmployeeStats(): Promise<{
    stats: {
      total: number;
      active: number;
      tipEligible: number;
      byRole: Record<string, number>;
      byStatus: Record<string, number>;
    };
  }> {
    return this.request<{
      stats: {
        total: number;
        active: number;
        tipEligible: number;
        byRole: Record<string, number>;
        byStatus: Record<string, number>;
      };
    }>('/employees/stats');
  }

  // Enhanced Tips endpoints
  async getTips(params?: { startDate?: string; endDate?: string; limit?: number; offset?: number }): Promise<TipEntryDTO[]> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const complete = params?.limit === undefined && params?.offset === undefined;
    if (complete) queryParams.set('limit', '500');
    const tips: TipEntry[] = [];
    const ids = new Set<string>();
    for (let page = 0; page < 21; page++) {
      const response = await this.request<{ success: boolean; tips: TipEntry[]; total: number; pagination?: { limit: number; offset: number; hasMore: boolean } }>(`/tips?${queryParams.toString()}`);
      for (const tip of response.tips || []) {
        if (ids.has(tip.id)) throw new Error('Tip records changed during loading. Refresh to obtain complete totals.');
        ids.add(tip.id); tips.push(tip);
      }
      if (tips.length > 10000) throw new Error('More than 10000 tips match this range. Select a shorter date range for complete totals.');
      if (!complete || !response.pagination?.hasMore) return toTipEntryDTOs(tips);
      if (!response.tips?.length || !Number.isInteger(response.pagination.offset) || response.pagination.offset < 0) throw new Error('Tip pagination did not progress. Refresh before using these totals.');
      queryParams.set('offset', String(response.pagination.offset + response.tips.length));
    }
    throw new Error('Tip records changed during loading. Select a shorter date range and refresh.');
  }

  async createTip(data: CreateTipRequest): Promise<TipEntryDTO> {
    const response = await this.request<{
      success: boolean;
      data: TipEntry;
      message: string;
    }>('/tips', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return toTipEntryDTO(response.data);
  }

  async updateTip(id: string, data: UpdateTipRequest): Promise<TipEntryDTO> {
    const response = await this.request<{
      success: boolean;
      data: TipEntry;
      message: string;
    }>(`/tips/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return toTipEntryDTO(response.data);
  }

  async deleteTip(id: string): Promise<ApiResponse<void>> {
    return this.request<ApiResponse<void>>(`/tips/${id}`, {
      method: 'DELETE',
    });
  }

  // Bulk tip operations
  async bulkCreateTips(tips: CreateTipRequest[]): Promise<{
    successful: number;
    failed: number;
    results: TipEntryDTO[];
    errors: Array<{ index: number; error: string }>;
  }> {
    const response = await this.request<{
      success: boolean;
      data: {
        successful: number;
        failed: number;
        results: TipEntry[];
        errors: Array<{ index: number; error: string }>;
      };
      message: string;
    }>('/tips/bulk', {
      method: 'POST',
      body: JSON.stringify({ tips }),
    });
    return {
      successful: response.data.successful,
      failed: response.data.failed,
      results: toTipEntryDTOs(response.data.results || []),
      errors: response.data.errors,
    };
  }

  // Shift validation
  async validateShift(employeeId: string, date: string, createIfMissing: boolean = false): Promise<{
    success: boolean;
    shiftExists: boolean;
    shiftCreated?: boolean;
    shift?: ShiftDTO;
    message?: string;
  }> {
    const response = await this.request<{
      success: boolean;
      shiftExists: boolean;
      shiftCreated?: boolean;
      shift?: Shift;
      message?: string;
    }>('/tips/validate-shift', {
      method: 'POST',
      body: JSON.stringify({ employeeId, date, createIfMissing }),
    });
    return {
      success: response.success,
      shiftExists: response.shiftExists,
      shiftCreated: response.shiftCreated,
      shift: response.shift ? toShiftDTO(response.shift) : undefined,
      message: response.message,
    };
  }

  // Compliance calculations
  async getComplianceCalculation(employeeId: string, period: string): Promise<{
    totalTips: number;
    totalWages: number;
    complianceStatus: string;
    adjustmentsNeeded?: number;
  }> {
    const response = await this.request<{
      success: boolean;
      data: {
        totalTips: number;
        totalWages: number;
        complianceStatus: string;
        adjustmentsNeeded?: number;
      };
    }>(`/tips/compliance/${employeeId}/${period}`);
    return response.data;
  }

  // Analytics
  async getTipAnalytics(startDate?: string, endDate?: string): Promise<{
    totalTips: number;
    tipsByType: Record<string, number>;
    tipsByEmployee: Array<{ employeeId: string; totalTips: number }>;
    dailyAverages: Record<string, number>;
  }> {
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);

    const endpoint = `/tips/analytics/dashboard${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await this.request<{
      success: boolean;
      data: { totalStats: { totalAmount: number }; tipsByType: Array<{ tipType: string; _sum: { amount: number | null } }>; tipsByEmployee: Array<{ employeeId: string; totalTips: number }>; dailyTrends: Array<{ date: string; average: number }> };
    }>(endpoint);
    return { totalTips: response.data.totalStats.totalAmount, tipsByType: Object.fromEntries(response.data.tipsByType.map(row => [row.tipType, row._sum.amount || 0])), tipsByEmployee: response.data.tipsByEmployee || [], dailyAverages: Object.fromEntries(response.data.dailyTrends.map(row => [row.date, row.average])) };
  }

  // Audit history
  async getTipAuditHistory(tipId: string): Promise<Array<{
    id: string;
    action: string;
    performedBy: string;
    performedAt: string;
    oldValue?: string;
    newValue?: string;
  }>> {
    const response = await this.request<{
      success: boolean;
      data: Array<{
        id: string;
        action: string;
        performedBy: string;
        performedAt: string;
        oldValue?: string;
        newValue?: string;
      }>;
    }>(`/tips/${tipId}/audit`);
    return response.data;
  }

  // Legacy tip summary (keeping for backward compatibility)
  async getTipSummary(period: string = '7d'): Promise<{
    totalTips: number;
    tipCount: number;
    averageTip: number;
    tipsByType: Record<string, number>;
  }> {
    const response = await this.request<{
      success: boolean;
      summary: {
        totalTips: number;
        totalAmount: number;
        avgAmount: number;
        cashTips: { amount: number };
        creditTips: { amount: number };
      };
    }>(`/tips/summary?period=${period}`);
    return { totalTips: response.summary.totalAmount, tipCount: response.summary.totalTips, averageTip: response.summary.avgAmount, tipsByType: { cash: response.summary.cashTips.amount, credit: response.summary.creditTips.amount } };
  }

  // Shifts endpoints
  async getShifts(params?: { startDate?: string; endDate?: string; employeeId?: string }): Promise<ShiftDTO[]> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) if (value !== undefined) query.set(key, value);
    const response = await this.request<{ success: boolean; shifts: Shift[] }>(`/shifts${query.size ? `?${query}` : ''}`);
    return toShiftDTOs(response.shifts || []);
  }

  async createShift(data: CreateShiftRequest): Promise<ShiftDTO> {
    const response = await this.request<{ success: boolean; data: Shift }>('/shifts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return toShiftDTO(response.data);
  }

  async updateShift(id: string, data: UpdateShiftRequest): Promise<ShiftDTO> {
    const response = await this.request<{ success: boolean; data: Shift }>(`/shifts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return toShiftDTO(response.data);
  }

  async clockIn(employeeId: string, jobCode?: string): Promise<{ success: boolean; shift: ShiftDTO; message: string }> {
    const response = await this.request<{ success: boolean; data: Shift; message: string }>('/shifts/clock-in', {
      method: 'POST',
      body: JSON.stringify({ employeeId, jobCode }),
    });
    return {
      success: response.success,
      shift: toShiftDTO(response.data),
      message: response.message,
    };
  }

  async clockOut(shiftId: string): Promise<{ success: boolean; shift: ShiftDTO; message: string }> {
    const response = await this.request<{ success: boolean; data: Shift; message: string }>('/shifts/clock-out', {
      method: 'POST',
      body: JSON.stringify({ shiftId }),
    });
    return {
      success: response.success,
      shift: toShiftDTO(response.data),
      message: response.message,
    };
  }

  async deleteShift(id: string): Promise<ApiResponse<void>> {
    return this.request<ApiResponse<void>>(`/shifts/${id}`, {
      method: 'DELETE',
    });
  }

  async deleteAllShifts(confirmation: 'DELETE ALL SHIFTS'): Promise<ApiResponse<{ deletedCount: number }>> {
    return this.request<ApiResponse<{ deletedCount: number }>>('/shifts/all/confirm', {
      method: 'DELETE',
      body: JSON.stringify({ confirmation }),
    });
  }

  async importShiftsFromCSV(csvData: Array<Record<string, unknown>>): Promise<{
    success: boolean;
    imported: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
    message?: string;
    createdEmployees?: number;
    integrationInfo?: any;
    warnings?: string[];
  }> {
    return this.importRows('/shifts/import-csv', csvData);
  }

  async importEmployeesFromCSV(csvData: Array<Record<string, unknown>>): Promise<{
    success: boolean;
    imported: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
    message?: string;
  }> {
    return this.importRows('/employees/import-csv', csvData);
  }

  async importTipsFromCSV(csvData: Array<Record<string, unknown>>): Promise<{
    success: boolean;
    imported: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
    message?: string;
  }> {
    return this.importRows('/tips/import-csv', csvData);
  }

  private async importRows(endpoint: string, csvData: Array<Record<string, unknown>>): Promise<{ success: boolean; imported: number; failed: number; errors: Array<{ row: number; error: string }>; message?: string; createdEmployees?: number; integrationInfo?: unknown; warnings?: string[] }> {
    const result = await this.request<{ success: boolean; imported: number; errors: Array<string | { row: number; error: string }>; message?: string; createdEmployees?: number; integrationInfo?: unknown; warnings?: string[] }>(endpoint, { method: 'POST', body: JSON.stringify({ csvData }) });
    const errors = result.errors.map(error => {
      if (typeof error !== 'string') return error;
      const match = /^Row (\d+):\s*(.*)$/.exec(error);
      return { row: match ? Number(match[1]) : 0, error: match ? match[2] : error };
    });
    return { ...result, errors, failed: errors.length };
  }

  async getShiftsByEmployee(params?: { startDate?: string; endDate?: string }): Promise<Array<{
    employee: EmployeeDTO;
    shifts: ShiftDTO[];
    totalHours: number;
    totalWages: number;
  }>> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const url = `/shifts/by-employee${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.request<{ data: Array<{
      employee: Employee;
      shifts: Shift[];
      totalHours: number;
      totalWages: number;
    }>; complete: boolean; issues?: Array<{ employeeId: string; shiftIds: string[]; message: string }> }>(url);

    if (response.complete === false) throw new Error(`Review overlapping or invalid shift records before using wage totals. ${response.issues?.map(issue => `${issue.employeeId}: ${issue.shiftIds.join(', ')}`).join('; ') || ''}`);
    return response.data.map(item => ({
      employee: toEmployeeDTO(item.employee),
      shifts: toShiftDTOs(item.shifts || []),
      totalHours: item.totalHours,
      totalWages: item.totalWages,
    }));
  }

  async getEmployeeShifts(employeeId: string, params?: { startDate?: string; endDate?: string }): Promise<ShiftDTO[]> {
    return this.getShifts({ employeeId, ...params });
  }

  // Payroll endpoints
  async getPayrollPeriods(): Promise<PayrollPeriodDTO[]> {
    const response = await this.request<{ success: boolean; periods: PayrollPeriod[] }>('/payroll/periods');
    return toPayrollPeriodDTOs(response.periods || []);
  }

  async createPayrollPeriod(data: CreatePayrollPeriodRequest): Promise<PayrollPeriodDTO> {
    const response = await this.request<{
      success: boolean;
      data: PayrollPeriod;
      message: string;
    }>('/payroll/periods', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return toPayrollPeriodDTO(response.data);
  }

  async calculatePayroll(periodId: string): Promise<{
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
  }> {
    const response = await this.request<{
      success: boolean;
      period: PayrollPeriod;
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
    }>(`/payroll/periods/${periodId}/calculate`, {
      method: 'POST',
    });
    return {
      success: response.success,
      period: toPayrollPeriodDTO(response.period),
      entries: response.entries,
      summary: response.summary,
    };
  }

  async updatePayrollPeriod(periodId: string, data: {
    startDate?: string;
    endDate?: string;
    status?: 'open' | 'closed' | 'paid';
    notes?: string;
  }): Promise<ApiResponse<PayrollPeriodDTO>> {
    const result = await this.request<ApiResponse<PayrollPeriod>>(`/payroll/periods/${periodId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return {
      success: result.success,
      data: result.data ? toPayrollPeriodDTO(result.data) : undefined,
      message: result.message,
    };
  }

  async deletePayrollPeriod(periodId: string): Promise<ApiResponse<void>> {
    const result = await this.request<ApiResponse<void>>(`/payroll/periods/${periodId}`, {
      method: 'DELETE',
    });
    return result;
  }

  // Analytics endpoints
  async getAnalyticsSettings(): Promise<{
    success: boolean;
    analyticsEnabled: boolean;
  }> {
    return this.request<{
      success: boolean;
      analyticsEnabled: boolean;
    }>('/analytics/settings');
  }

  async updateAnalyticsSettings(enabled: boolean): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request<{
      success: boolean;
      message: string;
    }>('/analytics/settings', {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  }

  async collectAnalytics(): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request<{
      success: boolean;
      message: string;
    }>('/analytics/collect', {
      method: 'POST',
    });
  }

  async transmitAnalytics(): Promise<{
    success: boolean;
    transmitted: number;
    message: string;
  }> {
    return this.request<{
      success: boolean;
      transmitted: number;
      message: string;
    }>('/analytics/transmit', {
      method: 'POST',
    });
  }

  // Export endpoint - Fixed to match backend expectation
  async exportData(options: ExportRequest): Promise<ExportResponse> {
    return this.request<ExportResponse>('/export', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  // Tip distribution settings
  async getTipDistributionSettings(businessId: string): Promise<TipDistributionSettings> {
    const response = await this.request<{
      success: boolean;
      settings: TipDistributionSettings;
    }>(`/tip-distribution/settings/${businessId}`);
    return response.settings;
  }

  async saveTipDistributionSettings(settings: TipDistributionSettings): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.request<{
      success: boolean;
      message: string;
    }>('/tip-distribution/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
    return response;
  }

  async calculateTipDistribution(periodId: string, settings: TipDistributionSettings): Promise<{
    success: boolean;
    totalTips: number;
    totalEmployees: number;
    distribution: Array<{
      employeeId: string;
      employeeName: string;
      role: string;
      hours: number;
      tipAmount: number;
      percentage: number;
    }>;
    summary: {
      totalDistributed: number;
      averagePerEmployee: number;
    };
  }> {
    const response = await this.request<{
      success: boolean;
      totalTips: number;
      totalEmployees: number;
      distribution: Array<{
        employee: { id: string; firstName: string; lastName: string; role: string };
        hours: number;
        tipAmount: number;
        percentage: number;
      }>;
      summary: {
        totalDistributed: number;
        averageTipPerEmployee: number;
      };
    }>('/tip-distribution/calculate', {
      method: 'POST',
      body: JSON.stringify({ periodId, settings }),
    });
    return { ...response, distribution: response.distribution.map(entry => ({ employeeId: entry.employee.id, employeeName: `${entry.employee.firstName} ${entry.employee.lastName}`, role: entry.employee.role, hours: entry.hours, tipAmount: entry.tipAmount, percentage: entry.percentage })), summary: { totalDistributed: response.summary.totalDistributed, averagePerEmployee: response.summary.averageTipPerEmployee } };
  }

  // Database backup/restore endpoints
  async createDatabaseBackup(customName?: string) {
    return this.request<{
      success: boolean;
      message: string;
      backup: {
        name: string;
        path: string;
        size: number;
        created: string;
      };
    }>('/database/backup', {
      method: 'POST',
      body: JSON.stringify({ customName }),
    });
  }

  async listDatabaseBackups() {
    return this.request<{
      success: boolean;
      backups: Array<{
        name: string;
        path: string;
        size: number;
        sizeFormatted: string;
        created: string;
        createdFormatted: string;
      }>;
    }>('/database/backups', {
      method: 'GET',
    });
  }

  async restoreDatabaseFromBackup(backupName: string) {
    return this.request<{
      success: boolean;
      message: string;
      restoredFrom: string;
    }>('/database/restore', {
      method: 'POST',
      body: JSON.stringify({ backupName }),
    });
  }

  async restoreDatabaseFromFile(filePath: string) {
    return this.request<{
      success: boolean;
      message: string;
    }>('/database/restore-from-file', {
      method: 'POST',
      body: JSON.stringify({ filePath }),
    });
  }

  async deleteDatabaseBackup(backupName: string) {
    return this.request<{
      success: boolean;
      message: string;
      deletedBackup: string;
    }>(`/database/backup/${encodeURIComponent(backupName)}`, {
      method: 'DELETE',
    });
  }

  async getDatabaseInfo() {
    return this.request<{
      success: boolean;
      database: {
        path: string;
        size: number;
        sizeFormatted: string;
        created: string;
        createdFormatted: string;
      };
      backups: {
        directory: string;
        count: number;
        totalSize: number;
        latest: {
          name: string;
          created: string;
        } | null;
      };
    }>('/database/info', {
      method: 'GET',
    });
  }

  async getDatabaseHealth() {
    return this.request<{
      success: boolean;
      health: {
        healthy: boolean;
        version: string;
        tablesCount: number;
        lastBackup?: string;
        issues: string[];
        recommendations: string[];
      };
      timestamp: string;
    }>('/database/health', {
      method: 'GET',
    });
  }
}

const apiClient = new ApiClient();
export default apiClient;
