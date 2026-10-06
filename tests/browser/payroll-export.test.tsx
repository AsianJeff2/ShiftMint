// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../setup';
import apiClient from '../../lib/api-client';
import { PayrollPeriodResponseSchema } from '../../lib/types/api-dtos';
import Payroll from '../../pages/Payroll';
import { PayrollDetailsModal } from '../../components/payroll/PayrollDetailsModal';

const fixture = vi.hoisted(() => ({ periods: [] as any[], exportData: vi.fn(), toast: vi.fn() }));
vi.mock('@/contexts/DataContext', () => ({ useData: () => ({ payrollPeriods: fixture.periods, loadingPayroll: false, exportData: fixture.exportData }) }));
vi.mock('sonner', () => ({ toast: { success: fixture.toast, error: fixture.toast } }));
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  vi.clearAllMocks();
  // Prisma DateTime values serialize to these full timestamps in GET /payroll/periods.
  const wire = PayrollPeriodResponseSchema.parse(JSON.parse(JSON.stringify({ id: 'period', businessId: 'business', startDate: new Date('2026-09-01T00:00:00.000Z'), endDate: new Date('2026-09-30T23:59:59.999Z'), status: 'closed', totalTips: 0, totalSales: 0, notes: null, createdAt: new Date('2026-10-01T00:00:00.000Z'), updatedAt: new Date('2026-10-01T00:00:00.000Z'), payrollEntries: [] })));
  fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.endsWith('/payroll/periods') ? { success: true, periods: [wire] } : { success: true, data: [], taxTreatment: 'estimate', warnings: ['Review with your payroll provider.'] }))));
  vi.stubGlobal('fetch', fetchMock);
  fixture.periods = await apiClient.getPayrollPeriods();
  fixture.exportData.mockImplementation(options => apiClient.exportData(options));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('payroll period export HTTP contract', () => {
  for (const caller of ['page', 'details'] as const) {
    it(`sends calendar markers from an ISO HTTP period through both ${caller} export bodies`, async () => {
      if (caller === 'page') render(<Payroll />);
      else render(<PayrollDetailsModal period={fixture.periods[0]} isOpen onClose={() => undefined} />);
      for (const format of ['csv', 'json'] as const) {
        fireEvent.click(screen.getByRole('button', { name: `Export period ${format.toUpperCase()}` }));
        await waitFor(() => expect(fixture.exportData).toHaveBeenCalledTimes(format === 'csv' ? 1 : 2));
        const request = fetchMock.mock.calls.findLast(call => String(call[0]).endsWith('/export'));
        expect(JSON.parse(request![1].body)).toEqual({ type: 'payroll', format, startDate: '2026-09-01', endDate: '2026-09-30' });
      }
    });
  }
});
