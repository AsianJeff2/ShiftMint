import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Plus, Edit2, Trash2, FileText, User, Calendar } from 'lucide-react';
import { formatCurrency, formatDate, formatTime, createMinimalTip } from '@/lib/utils';
import { toast } from 'sonner';
import { TipCSVImport } from '@/components/tips/TipCSVImport';
import type { TipType, UpdateTipRequest } from '@/lib/types/api-dtos';
import { TipTypeSchema } from '@/lib/types/api-dtos';
import type { TipEntryDTO } from '@/lib/transformers';
import { errorMessage } from '@/lib/error-handling';

interface TipFormData {
  amount: string;
  tipType: TipType;
  source: 'manual';
  tableNumber: string;
  employeeId: string;
  serverName: string;
  shiftId: string;
  notes: string;
  recordedAt: string;
}

function dateTimeInput(value: string | Date): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}

const Tips: React.FC = () => {
  const {
    getTips,
    createTip,
    updateTip,
    deleteTip,
    employees = [],
    shifts = [],
  } = useData();

  // Filtered reads return their own records without narrowing the shared lifetime collection.
  const [range, setRange] = useState(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 30);
    return { startDate: dateTimeInput(start).slice(0, 10), endDate: dateTimeInput(today).slice(0, 10) };
  });
  const [draftRange, setDraftRange] = useState(range);
  const [rangeProblem, setRangeProblem] = useState<string | null>(null);
  const [tips, setTips] = useState<TipEntryDTO[]>([]);
  const [loadingTips, setLoadingTips] = useState(true);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const errorTips = rangeProblem || queryError;
  const refreshTips = () => setReload(value => value + 1);

  useEffect(() => {
    let active = true;
    setLoadingTips(true);
    setQueryError(null);
    setTips([]);
    getTips(range).then(records => {
      if (active) setTips(records);
    }).catch(error => {
      if (active) setQueryError(errorMessage(error, 'Could not load tip history. Check your connection and retry.'));
    }).finally(() => { if (active) setLoadingTips(false); });
    return () => { active = false; };
  }, [getTips, range.startDate, range.endDate, reload]);

  const applyRange = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draftRange.startDate || !draftRange.endDate || draftRange.startDate > draftRange.endDate) {
      setRangeProblem('Choose a start date on or before the end date.');
      return;
    }
    setRangeProblem(null);
    setRange(draftRange);
    refreshTips();
  };

  const summaryAmount = (amount: number) => errorTips ? 'Unavailable' : loadingTips ? 'Loading...' : formatCurrency(amount);

  const [formData, setFormData] = useState<TipFormData>({
    amount: '',
    tipType: 'credit',
    source: 'manual',
    tableNumber: '',
    employeeId: '',
    serverName: '',
    shiftId: '',
    notes: '',
    recordedAt: dateTimeInput(new Date()),
  });

  const [editingTip, setEditingTip] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeEmployees = useMemo(() => employees.filter(emp => emp.status === 'active'), [employees]);
  const employeeShifts = useMemo(() => shifts.filter(shift =>
        shift.employeeId === formData.employeeId &&
        shift.status === 'completed'
      ).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    [formData.employeeId, shifts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!formData.employeeId) {
      toast.error('Please select an employee');
      return;
    }

    const recordedAt = new Date(formData.recordedAt);
    if (!editingTip && (!Number.isFinite(recordedAt.getTime()) || dateTimeInput(recordedAt).slice(0, formData.recordedAt.length) !== formData.recordedAt)) {
      toast.error('Choose a valid recorded time in this device’s timezone');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingTip) {
        const changes: UpdateTipRequest = {};
        if (amount !== editingTip.amount) changes.amount = amount;
        for (const key of ['tipType', 'tableNumber', 'serverName', 'employeeId', 'shiftId', 'notes'] as const) {
          if (formData[key] !== (editingTip[key] ?? '')) (changes as Record<string, unknown>)[key] = formData[key];
        }
        await updateTip(editingTip.id, changes);
        setEditingTip(null);
      } else {
        await createTip({ ...createMinimalTip({
          amount,
          tipType: formData.tipType,
          source: 'manual',
          tableNumber: formData.tableNumber,
          serverName: formData.serverName,
          notes: formData.notes,
          employeeId: formData.employeeId,
          shiftId: formData.shiftId || undefined,
        }), timestamp: recordedAt.toISOString() });
      }

      // Reset form
      setFormData({
        amount: '',
        tipType: 'credit',
        source: 'manual',
        tableNumber: '',
        employeeId: '',
        serverName: '',
        shiftId: '',
        notes: '',
        recordedAt: dateTimeInput(new Date()),
      });
      toast.success(editingTip ? 'Tip updated successfully!' : 'Tip added successfully!');
      refreshTips();
    } catch (error: any) {
      console.error('Error saving tip:', error);
      toast.error(error.message || 'Failed to save tip');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (tip: any) => {
    setEditingTip(tip);
    setFormData({
      amount: tip.amount.toFixed(2),
      tipType: tip.tipType,
      source: 'manual',
      tableNumber: tip.tableNumber || '',
      employeeId: tip.employeeId || '',
      serverName: tip.serverName || '',
      shiftId: tip.shiftId || '',
      notes: tip.notes || '',
      recordedAt: dateTimeInput(tip.timestamp),
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tip?')) return;

    try {
      await deleteTip(id);
      toast.success('Tip deleted successfully!');
      refreshTips();
    } catch (error: any) {
      console.error('Error deleting tip:', error);
      toast.error(error.message || 'Failed to delete tip');
    }
  };

  const cancelEdit = () => {
    setEditingTip(null);
    setFormData({
      amount: '',
      tipType: 'credit',
      source: 'manual',
      tableNumber: '',
      employeeId: '',
      serverName: '',
      shiftId: '',
      notes: '',
      recordedAt: dateTimeInput(new Date()),
    });
  };

  const handleInputChange = (field: keyof TipFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getTipTypeColor = (tipType: string) => {
    switch (tipType) {
      case 'cash': return 'default';
      case 'credit': return 'secondary';
      default: return 'outline';
    }
  };

  // Calculate summary stats safely
  const totalTips = Array.isArray(tips) ? tips.reduce((sum, tip) => sum + (tip.amount || 0), 0) : 0;
  const avgTip = Array.isArray(tips) && tips.length > 0 ? totalTips / tips.length : 0;
  const cashTips = Array.isArray(tips) ? tips.filter(tip => tip.tipType === 'cash').reduce((sum, tip) => sum + (tip.amount || 0), 0) : 0;
  const creditTips = Array.isArray(tips) ? tips.filter(tip => tip.tipType === 'credit').reduce((sum, tip) => sum + (tip.amount || 0), 0) : 0;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Tip Management</h1>
          <p className="text-slate-300 mt-1">Track and manage your tips</p>
        </div>
        <div className="flex gap-2">
          <fieldset disabled={loadingTips || Boolean(errorTips)}><TipCSVImport onImportComplete={refreshTips} /></fieldset>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Tip history date range</CardTitle><CardDescription>Totals and records below cover {range.startDate} through {range.endDate}, inclusive. Calendar dates use your business timezone.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={applyRange} noValidate className="flex flex-wrap items-end gap-4">
            <div><Label htmlFor="tipRangeStart">Tip history start date</Label><Input id="tipRangeStart" type="date" value={draftRange.startDate} onChange={event => setDraftRange(previous => ({ ...previous, startDate: event.target.value }))} /></div>
            <div><Label htmlFor="tipRangeEnd">Tip history end date</Label><Input id="tipRangeEnd" type="date" value={draftRange.endDate} onChange={event => setDraftRange(previous => ({ ...previous, endDate: event.target.value }))} /></div>
            <Button type="submit">Apply tip range</Button>
            <Button type="button" variant="outline" disabled={loadingTips || Boolean(rangeProblem)} onClick={refreshTips}>{errorTips ? 'Retry tips' : 'Refresh tips'}</Button>
          </form>
          {errorTips && <div role="alert" className="mt-4 rounded-md border border-destructive p-4"><p>Tip history unavailable. {errorTips}</p><p>Retry after checking your connection, or select a shorter range if too many records match. Check saved records before importing replacements.</p></div>}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tips</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryAmount(totalTips)}</div>
            {!errorTips && !loadingTips && <p className="text-xs text-muted-foreground">{tips.length} entries in this date range</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Tip</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryAmount(avgTip)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Tips</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryAmount(cashTips)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credit Tips</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryAmount(creditTips)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Tip Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {editingTip ? 'Edit Tip' : 'Add New Tip'}
          </CardTitle>
          <CardDescription>
            {editingTip ? 'Update the tip details' : 'Record a new tip entry'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipType">Tip Type</Label>
                <Select
                  value={formData.tipType}
                  onValueChange={(value) => { if (TipTypeSchema.safeParse(value).success) handleInputChange('tipType', value); }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tip type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TipTypeSchema.options.map(type => <SelectItem key={type} value={type}>{type === 'cash' ? 'Cash Tips' : type === 'credit' ? 'Credit Card Tips' : type === 'other' ? 'Other' : `${type} (recorded type)`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee *</Label>
                <Select
                  value={formData.employeeId}
                  onValueChange={(value) => {
                    if (!value) return;
                    const employee = employees.find(item => item.id === value);
                    setFormData(previous => previous.employeeId === value ? previous : ({ ...previous, employeeId: value, shiftId: '', serverName: employee ? `${employee.firstName} ${employee.lastName}` : '' }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeEmployees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          {emp.firstName} {emp.lastName} - {emp.role}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tableNumber">Table Number</Label>
                <Input
                  id="tableNumber"
                  type="text"
                  placeholder="e.g., Table 5"
                  value={formData.tableNumber}
                  onChange={(e) => handleInputChange('tableNumber', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shiftId">Link to Shift (Optional)</Label>
                <Select
                  value={formData.shiftId}
                  onValueChange={(value) => { if (value) handleInputChange('shiftId', value); }}
                  disabled={!formData.employeeId || employeeShifts.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={!formData.employeeId ? "Select employee first" : "Select a shift"} />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.shiftId && !employeeShifts.some(shift => shift.id === formData.shiftId) && (
                      <SelectItem value={formData.shiftId}>Recorded shift {formData.shiftId}</SelectItem>
                    )}
                    {employeeShifts.map(shift => (
                      <SelectItem key={shift.id} value={shift.id}>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          {formatDate(shift.startTime)} - {formatTime(shift.startTime)} to {shift.endTime ? formatTime(shift.endTime) : 'Missing end time'}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.shiftId && <Button type="button" variant="outline" size="sm" onClick={() => handleInputChange('shiftId', '')}>Remove shift link</Button>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="serverName">Server Name (Auto-filled)</Label>
                <Input
                  id="serverName"
                  type="text"
                  placeholder="Automatically filled from employee"
                  value={formData.serverName}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recordedAt">Recorded At *</Label>
              <Input id="recordedAt" type="datetime-local" step="1" value={formData.recordedAt} onChange={event => handleInputChange('recordedAt', event.target.value)} readOnly={Boolean(editingTip)} required />
              <p className="text-sm text-muted-foreground">Times use this device’s timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). {editingTip ? 'The original recorded timestamp is preserved during edits.' : 'Enter when the tip was received, including historical entries.'}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isSubmitting || !formData.amount || !formData.employeeId}
              >
                {isSubmitting ? 'Saving...' : editingTip ? 'Update Tip' : 'Add Tip'}
              </Button>

              {editingTip && (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Tips Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tips in Selected Date Range</CardTitle>
          <CardDescription>
            View and manage your tip entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorTips ? (
            <p className="text-center py-8">Tip records unavailable. Retry or narrow the date range above.</p>
          ) : loadingTips ? (
            <div className="text-center py-8">Loading tips...</div>
          ) : !Array.isArray(tips) || tips.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No tips recorded in this date range.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Server</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tips.map((tip) => (
                  <TableRow key={tip.id}>
                    <TableCell className="font-medium">
                      {formatCurrency(tip.amount || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTipTypeColor(tip.tipType)}>
                        {tip.tipType}
                      </Badge>
                    </TableCell>
                    <TableCell>{tip.serverName || '-'}</TableCell>
                    <TableCell>{tip.tableNumber || '-'}</TableCell>
                    <TableCell>
                      <div>
                        <div>{formatDate(tip.timestamp)}</div>
                        <div className="text-xs text-gray-500">
                          {formatTime(tip.timestamp)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(tip)}
                          aria-label={`Edit tip ${tip.id}`}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(tip.id)}
                          aria-label={`Delete tip ${tip.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Tips;
