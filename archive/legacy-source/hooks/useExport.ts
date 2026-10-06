import { useState } from 'react';
import apiClient from '@/lib/api-client';
import { downloadExport } from '@/lib/export/download';

interface ExportOptions {
  type: 'tips' | 'shifts' | 'payroll' | 'employees' | 'comprehensive';
  format: 'csv' | 'json';
  startDate?: string;
  endDate?: string;
  exportOptions?: {
    includeEmployeeDetails?: boolean;
    includeTipBreakdown?: boolean;
    includePayrollCalculations?: boolean;
  };
}

export const useExport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportData = async (options: ExportOptions): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.exportData(options);
      
      // Handle the export result
      if (!result.success || !Array.isArray(result.data)) throw new Error(result.message || "Export failed");
      downloadExport(result.data, options.type, options.format);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    exportData,
    loading,
    error,
  };
};
