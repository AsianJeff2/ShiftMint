export type ExportType = 'tips' | 'shifts' | 'payroll' | 'employees' | 'comprehensive';
export interface ExportOptions {
  includeEmployeeDetails: boolean;
  includeTipBreakdown: boolean;
  includePayrollCalculations: boolean;
}
export interface ExportRequest {
  type: ExportType;
  format: 'csv' | 'json';
  startDate?: string;
  endDate?: string;
  options?: ExportOptions;
}
export interface ExportMetadata {
  taxTreatment?: string;
  warnings?: string[];
}
export interface ExportResponse extends ExportMetadata {
  success: boolean;
  data: Record<string, unknown>[];
  message?: string;
}
