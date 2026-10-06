import { useState, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import type { PayrollEntry } from '@prisma/client';
import type { PayrollPeriodDTOWithEntries } from '@/types/extended';

export const usePayrollEntries = () => {
  const { payrollPeriods } = useData();
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Extract all payroll entries from payroll periods
    const allEntries: PayrollEntry[] = [];
    const periodsWithEntries = payrollPeriods as PayrollPeriodDTOWithEntries[];
    periodsWithEntries.forEach(period => {
      if (period.payrollEntries && Array.isArray(period.payrollEntries)) {
        allEntries.push(...period.payrollEntries);
      }
    });
    setPayrollEntries(allEntries);
  }, [payrollPeriods]);

  return {
    payrollEntries,
    loading,
  };
}; 