import React, { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Database, Download } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/error-handling';
import type { ExportRequest } from '@/lib/export/contracts';

const calendarDate = (date: Date) => date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
export function comprehensiveDateRange(preset: string, startDate: string, endDate: string, now = new Date()): { startDate?: string; endDate?: string } {
  if (preset === 'all') return {};
  if (preset === 'custom') {
    const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    if (!valid(startDate) || !valid(endDate) || startDate > endDate) throw new Error('Choose valid start and end dates in order.');
    return { startDate, endDate };
  }
  const year = now.getFullYear(), month = now.getMonth();
  const firstMonth = preset === 'lastMonth' ? month - 1 : preset === 'thisQuarter' ? Math.floor(month / 3) * 3 : preset === 'thisYear' ? 0 : month;
  const lastMonth = preset === 'thisQuarter' ? firstMonth + 2 : preset === 'thisYear' ? 11 : firstMonth;
  return { startDate: calendarDate(new Date(year, firstMonth, 1)), endDate: calendarDate(new Date(year, lastMonth + 1, 0)) };
}

export const ComprehensiveExport: React.FC<{ className?: string }> = ({ className }) => {
  const { exportData } = useData();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [options, setOptions] = useState({ includeEmployeeDetails: true, includeTipBreakdown: true, includePayrollCalculations: true });
  const handleExport = async () => {
    setBusy(true);
    try {
      const request: ExportRequest = { type: 'comprehensive', format: 'json', options, ...comprehensiveDateRange(range, startDate, endDate) };
      await exportData(request);
      toast.success('Business review export downloaded.');
      setOpen(false);
    } catch (error) { toast.error(errorMessage(error, 'Export failed. Please try again.')); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button className={className}><Database className="h-4 w-4 mr-2" />Comprehensive Export</Button></DialogTrigger>
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Business review export</DialogTitle><DialogDescription>Download selected records as structured JSON for review. This export is not a database recovery backup.</DialogDescription></DialogHeader>
      <p className="text-sm text-muted-foreground">Payroll and withholding estimates require review by your payroll provider before filing or payment. Net pay includes recorded tips already received and is not the remaining amount payable.</p>
      <div className="space-y-2"><Label htmlFor="export-date-range">Time Period</Label><select id="export-date-range" className="h-10 w-full rounded-md border bg-background px-3" disabled={busy} value={range} onChange={event => setRange(event.target.value)}>
        <option value="all">All Time</option><option value="thisMonth">This Month</option><option value="lastMonth">Last Month</option><option value="thisQuarter">This Quarter</option><option value="thisYear">Current Year</option><option value="custom">Custom Range</option>
      </select></div>
      {range === 'custom' && <div className="grid grid-cols-2 gap-4"><div><Label htmlFor="export-start-date">Start Date</Label><Input id="export-start-date" type="date" disabled={busy} value={startDate} onChange={event => setStartDate(event.target.value)} /></div><div><Label htmlFor="export-end-date">End Date</Label><Input id="export-end-date" type="date" disabled={busy} value={endDate} onChange={event => setEndDate(event.target.value)} /></div></div>}
      <p className="text-sm text-muted-foreground">Both dates are included using the business timezone. Overlapping payroll periods are included as whole estimates, including entries outside the requested range.</p>
      <div className="space-y-3">
        {([['includeEmployeeDetails', 'Employee Details'], ['includeTipBreakdown', 'Tip Breakdown'], ['includePayrollCalculations', 'Payroll Calculations']] as const).map(([key, label]) => <div key={key} className="flex items-center gap-2"><Checkbox id={'export-' + key} checked={options[key]} disabled={busy} onCheckedChange={checked => setOptions(previous => ({ ...previous, [key]: checked === true }))} /><Label htmlFor={'export-' + key}>{label}</Label></div>)}
      </div>
      <p className="text-sm text-muted-foreground">JSON preserves separate datasets and their estimate warnings. Individual record exports offer CSV. Excluding employee details removes identifying names and contact details; business-scoped record IDs remain for reconciliation.</p>
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy} onClick={handleExport}><Download className="h-4 w-4 mr-2" />{busy ? 'Exporting...' : 'Export Data'}</Button></div>
    </DialogContent>
  </Dialog>;
};
