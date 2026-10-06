
import React, { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CalendarDays, DollarSign, Clock, Calculator, FileText, Edit2, Trash2 } from 'lucide-react';
import { formatCurrency, formatCalendarDate as formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { PayrollDetailsModal } from '@/components/payroll/PayrollDetailsModal';
import type { PayrollPeriodDTOWithEntries } from '@/types/extended';
import { PayrollEditModal } from '@/components/payroll/PayrollEditModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PayrollFormData {
  startDate: string;
  endDate: string;
  notes: string;
}

const Payroll: React.FC = () => {
  const { 
    payrollPeriods, 
    loadingPayroll,
    errorPayroll,
    getPayrollPeriods,
    createPayrollPeriod,
    updatePayrollPeriod,
    deletePayrollPeriod,
    calculatePayroll,
    exportData 
  } = useData();

  const [formData, setFormData] = useState<PayrollFormData>({
    startDate: '',
    endDate: '',
    notes: '',
  });

  const [isCreating, setIsCreating] = useState(false);
  const [calculatingPeriod, setCalculatingPeriod] = useState<string | null>(null);
  const [detailsPeriod, setDetailsPeriod] = useState<any>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [editPeriod, setEditPeriod] = useState<PayrollPeriodDTOWithEntries | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deletePeriod, setDeletePeriod] = useState<PayrollPeriodDTOWithEntries | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.startDate || !formData.endDate) {
      toast.error('Please select start and end dates');
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      toast.error('End date must be on or after start date');
      return;
    }

    setIsCreating(true);
    try {
      await createPayrollPeriod({
        startDate: formData.startDate,
        endDate: formData.endDate,
        notes: formData.notes || undefined,
      });

      // Reset form
      setFormData({
        startDate: '',
        endDate: '',
        notes: '',
      });

      toast.success('Payroll period created successfully!');
    } catch (error: any) {
      console.error('Error creating payroll period:', error);
      const errorMessage = error?.userMessage || error?.message || 'Failed to create payroll period. Please try again.';
      toast.error(errorMessage);  
    } finally {
      setIsCreating(false);
    }
  };

  const handleCalculatePayroll = async (periodId: string) => {
    setCalculatingPeriod(periodId);
    try {
      const result = await calculatePayroll(periodId);

      // Show detailed success message with calculation summary
      if (result?.summary) {
        const { summary } = result;
        toast.success(
          `Payroll calculated successfully! ` +
          `${formatCurrency(summary.totalNetPay)} estimated net compensation including tips`
        );
      } else {
        toast.success('Payroll calculated successfully!');
      }
    } catch (error: any) {
      console.error('Error calculating payroll:', error);
      const errorMessage = error?.userMessage || error?.message || 'Failed to calculate payroll. Please try again.';
      toast.error(errorMessage);
    } finally {
      setCalculatingPeriod(null);
    }
  };

  const handleExport = async (type: 'csv' | 'json') => {
    try {
      // Get the most recent payroll period
      const mostRecentPeriod = payrollPeriods.length > 0 
        ? payrollPeriods.reduce((latest, period) => {
            return new Date(period.endDate) > new Date(latest.endDate) ? period : latest;
          }, payrollPeriods[0])
        : null;
      
      if (!mostRecentPeriod) {
        toast.error('No payroll periods available to export');
        return;
      }
      
      // Export only the most recent period's data
      await exportData({
        type: 'payroll',
        format: type,
        startDate: mostRecentPeriod.startDate,
        endDate: mostRecentPeriod.endDate,
      });
      
      const periodDates = `${formatDate(mostRecentPeriod.startDate)} - ${formatDate(mostRecentPeriod.endDate)}`;
      toast.success(`Payroll data exported for period: ${periodDates}`);
    } catch (error: any) {
      console.error('Export error:', error);
      const errorMessage = error?.userMessage || error?.message || 'Failed to export payroll data. Please try again.';
      toast.error(errorMessage);
    }
  };

  const handleInputChange = (field: keyof PayrollFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEditPeriod = (period: any) => {
    setEditPeriod(period);
    setIsEditModalOpen(true);
  };

  const handleUpdatePeriod = async (periodId: string, data: any) => {
    try {
      await updatePayrollPeriod(periodId, data);
      toast.success('Payroll period updated successfully!');
    } catch (error: any) {
      console.error('Error updating payroll period:', error);
      const errorMessage = error?.userMessage || error?.message || 'Failed to update payroll period';
      toast.error(errorMessage);
      throw error;
    }
  };

  const handleDeleteClick = (period: any) => {
    setDeletePeriod(period);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletePeriod) return;

    setIsDeleting(true);
    try {
      await deletePayrollPeriod(deletePeriod.id);
      toast.success('Payroll period deleted successfully!');
      setIsDeleteDialogOpen(false);
      setDeletePeriod(null);
    } catch (error: any) {
      console.error('Error deleting payroll period:', error);
      const errorMessage = error?.userMessage || error?.message || 'Failed to delete payroll period';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDateRange = (startDate: string | Date, endDate: string | Date): string => {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  // Calculate totals from payroll entries
  const getTotalGrossPay = (): number => {
    const periodsWithEntries = payrollPeriods as PayrollPeriodDTOWithEntries[];
    return periodsWithEntries.reduce((sum, period) => {
      const periodTotal = period.payrollEntries?.reduce((entrySum, entry) => entrySum + entry.grossPay, 0) || 0;
      return sum + periodTotal;
    }, 0);
  };

  const getTotalNetPay = (): number => {
    const periodsWithEntries = payrollPeriods as PayrollPeriodDTOWithEntries[];
    return periodsWithEntries.reduce((sum, period) => {
      const periodTotal = period.payrollEntries?.reduce((entrySum, entry) => entrySum + entry.netPay, 0) || 0;
      return sum + periodTotal;
    }, 0);
  };

  const getTotalTaxes = (): number => {
    const periodsWithEntries = payrollPeriods as PayrollPeriodDTOWithEntries[];
    return periodsWithEntries.reduce((sum, period) => {
      const periodTotal = period.payrollEntries?.reduce((entrySum, entry) => entrySum + entry.totalTaxes, 0) || 0;
      return sum + periodTotal;
    }, 0);
  };

  const getStatusColor = (status: string): "default" | "destructive" | "outline" | "secondary" => {
    switch (status) {
      case 'open': return 'default';
      case 'closed': return 'secondary';
      case 'paid': return 'outline';
      default: return 'default';
    }
  };

  const currentDetailsPeriod = !errorPayroll && !loadingPayroll && detailsPeriod
    ? (payrollPeriods as PayrollPeriodDTOWithEntries[]).find(period => period.id === detailsPeriod.id) || null
    : null;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Payroll Management</h1>
          <p className="text-slate-300 mt-1">Manage payroll periods and calculate wages</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleExport('csv')} disabled={loadingPayroll || Boolean(errorPayroll)} variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Export period CSV
          </Button>
          <Button onClick={() => handleExport('json')} disabled={loadingPayroll || Boolean(errorPayroll)} variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Export period JSON
          </Button>
        </div>
      </div>

      {errorPayroll && <div role="alert" className="rounded-md border border-destructive p-4"><p>Payroll records unavailable. {errorPayroll}</p><p>Check your connection and retry before creating replacement records.</p><Button type="button" variant="outline" disabled={loadingPayroll} onClick={() => void getPayrollPeriods()}>Retry payroll</Button></div>}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gross Wages</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{errorPayroll ? 'Unavailable' : loadingPayroll ? 'Loading...' : formatCurrency(getTotalGrossPay())}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Net Compensation</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{errorPayroll ? 'Unavailable' : loadingPayroll ? 'Loading...' : formatCurrency(getTotalNetPay())}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Withholding</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{errorPayroll ? 'Unavailable' : loadingPayroll ? 'Loading...' : formatCurrency(getTotalTaxes())}</div>
          </CardContent>
        </Card>
      </div>

      <p className="rounded-md border border-amber-500/40 p-4 text-sm">Payroll calculations are estimates. Gross wages exclude tips. Net compensation includes all recorded tips, including cash or tips already received; it is not the remaining amount payable. Estimated withholding is not a tax calculation. Review jurisdiction rules and use your payroll provider to calculate withholding, deductions, filings and payments. Payment finalization is unavailable in ShiftMint.</p>

      {/* Create New Payroll Period */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Create New Payroll Period
          </CardTitle>
          <CardDescription>
            Set up a new payroll period to calculate wages for a specific date range
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                type="text"
                placeholder="e.g., Bi-weekly payroll for March 2024"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
              />
            </div>

            <Button type="submit" disabled={isCreating || loadingPayroll || Boolean(errorPayroll)}>
              {isCreating ? 'Creating...' : 'Create Payroll Period'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Payroll Periods Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Payroll Periods
          </CardTitle>
          <CardDescription>
            Manage existing payroll periods and calculate wages
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorPayroll ? (
            <p className="text-center py-8">Payroll periods unavailable. Retry the read above.</p>
          ) : loadingPayroll ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-slate-300">Loading payroll periods...</p>
            </div>
          ) : payrollPeriods.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-slate-100">No payroll periods</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating your first payroll period above.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Gross Wages</TableHead>
                  <TableHead>Estimated Net Compensation</TableHead>
                  <TableHead>Estimated Withholding</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payrollPeriods as PayrollPeriodDTOWithEntries[]).map((period) => {
                  const grossPay = period.payrollEntries?.reduce((sum, entry) => sum + entry.grossPay, 0) || 0;
                  const netPay = period.payrollEntries?.reduce((sum, entry) => sum + entry.netPay, 0) || 0;
                  const taxes = period.payrollEntries?.reduce((sum, entry) => sum + entry.totalTaxes, 0) || 0;
                  
                  return (
                    <TableRow key={period.id}>
                      <TableCell>
                        {formatDateRange(period.startDate, period.endDate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(period.status)}>
                          {period.status === 'open' ? 'Open' : 
                           period.status === 'closed' ? 'Calculated' : 
                           period.status === 'paid' ? 'Paid' : period.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {grossPay > 0 ? formatCurrency(grossPay) : '-'}
                      </TableCell>
                      <TableCell>
                        {netPay > 0 ? formatCurrency(netPay) : '-'}
                      </TableCell>
                      <TableCell>
                        {taxes > 0 ? formatCurrency(taxes) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          {period.status === 'open' && (
                            <Button
                              size="sm"
                              onClick={() => handleCalculatePayroll(period.id)}
                              disabled={calculatingPeriod === period.id}
                            >
                              {calculatingPeriod === period.id ? 'Calculating...' : 'Calculate'}
                            </Button>
                          )}
                          {period.status === 'closed' && (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setDetailsPeriod(period);
                                  setIsDetailsModalOpen(true);
                                }}
                              >
                                View Details
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleUpdatePeriod(period.id, { status: 'open' }).catch(() => undefined)}>Reopen period</Button>
                            </>
                          )}
                          {period.status === 'paid' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setDetailsPeriod(period);
                                setIsDetailsModalOpen(true);
                              }}
                            >
                              View Details
                            </Button>
                          )}
                          
                          {/* Edit and Delete buttons */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditPeriod(period)}
                            title="Edit period"
                            disabled={period.status !== 'open'}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteClick(period)}
                            disabled={isDeleting || period.status !== 'open'}
                            title="Delete period"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payroll Details Modal */}
      <PayrollDetailsModal 
        period={currentDetailsPeriod}
        isOpen={isDetailsModalOpen && Boolean(currentDetailsPeriod)}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setDetailsPeriod(null);
        }}
      />

      {/* Payroll Edit Modal */}
      <PayrollEditModal
        period={editPeriod}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditPeriod(null);
        }}
        onUpdate={handleUpdatePeriod}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payroll Period</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payroll period? This action cannot be undone.
              {deletePeriod && (
                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-md">
                  <div className="text-sm">
                    <div><strong>Period:</strong> {formatDateRange(deletePeriod.startDate, deletePeriod.endDate)}</div>
                    <div><strong>Status:</strong> {deletePeriod.status}</div>
                    {deletePeriod.payrollEntries && deletePeriod.payrollEntries.length > 0 && (
                      <div className="text-amber-600 dark:text-amber-400 mt-2">
                        ⚠️ This will also delete {deletePeriod.payrollEntries.length} payroll entries
                      </div>
                    )}
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Payroll;
