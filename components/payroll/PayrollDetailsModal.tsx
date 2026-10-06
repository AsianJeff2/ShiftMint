import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatCalendarDate as formatDate, formatTime } from '@/lib/utils';
import { DollarSign, Users, Clock, Calculator, FileText, User, Calendar, Briefcase } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/error-handling';
import type { PayrollPeriodDTOWithEntries } from '@/types/extended';

interface PayrollDetailsModalProps {
  period: PayrollPeriodDTOWithEntries | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PayrollDetailsModal: React.FC<PayrollDetailsModalProps> = ({ period, isOpen, onClose }) => {
  const { exportData } = useData();
  
  if (!period) return null;

  const totalGrossPay = period.payrollEntries?.reduce((sum: number, entry: any) => sum + entry.grossPay, 0) || 0;
  const totalNetPay = period.payrollEntries?.reduce((sum: number, entry: any) => sum + entry.netPay, 0) || 0;
  const totalTaxes = period.payrollEntries?.reduce((sum: number, entry: any) => sum + entry.totalTaxes, 0) || 0;
  const totalTips = period.payrollEntries?.reduce((sum: number, entry: any) => sum + entry.totalTips, 0) || 0;
  const totalRegularHours = period.payrollEntries?.reduce((sum: number, entry: any) => sum + entry.regularHours, 0) || 0;
  const totalOvertimeHours = period.payrollEntries?.reduce((sum: number, entry: any) => sum + entry.overtimeHours, 0) || 0;

  const handleExportPeriod = async (format: 'csv' | 'json') => {
    try {
      await exportData({
        type: 'payroll',
        format,
        startDate: period.startDate,
        endDate: period.endDate,
      });
      const periodDates = `${formatDate(period.startDate)} - ${formatDate(period.endDate)}`;
      toast.success(`Payroll data exported for period: ${periodDates}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(errorMessage(error, 'Failed to export payroll period'));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Payroll Estimate Report</DialogTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleExportPeriod('csv')}>
              <FileText className="h-4 w-4 mr-2" />
              Export period CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleExportPeriod('json')}>
              <FileText className="h-4 w-4 mr-2" />
              Export period JSON
            </Button>
          </div>
        </DialogHeader>

        <p className="rounded-md border border-amber-500/40 p-3 text-sm">Gross wages exclude tips. Estimated net compensation includes all recorded tips, including cash or tips already received; it is not the remaining amount payable. Withholding requires review by your payroll provider.</p>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Employee Details</TabsTrigger>
            <TabsTrigger value="breakdown">Pay Breakdown</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Period Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Period Summary</CardTitle>
                <CardDescription>
                  {formatDate(period.startDate)} - {formatDate(period.endDate)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={period.status === 'paid' ? 'outline' : 'default'}>
                      {period.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Employees</p>
                    <p className="text-lg font-semibold">{period.payrollEntries?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Hours</p>
                    <p className="text-lg font-semibold">
                      {(totalRegularHours + totalOvertimeHours).toFixed(1)}h
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Regular/OT Hours</p>
                    <p className="text-lg font-semibold">
                      {totalRegularHours.toFixed(1)}h / {totalOvertimeHours.toFixed(1)}h
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="text-sm">{period.notes || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Gross Wages</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalGrossPay)}</div>
                  <p className="text-xs text-muted-foreground">Base wages before tips</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Tips</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalTips)}</div>
                  <p className="text-xs text-muted-foreground">All employee tips</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Estimated Withholding</CardTitle>
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalTaxes)}</div>
                  <p className="text-xs text-muted-foreground">Estimated withholdings</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Estimated Net Compensation</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalNetPay)}</div>
                  <p className="text-xs text-muted-foreground">After taxes + tips</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Summary Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Employee Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {period.payrollEntries && period.payrollEntries.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Gross Wages</TableHead>
                        <TableHead>Tips</TableHead>
                        <TableHead>Estimated Net Compensation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {period.payrollEntries.map((entry: any) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            {entry.employee?.firstName} {entry.employee?.lastName}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{entry.employee?.role || 'N/A'}</Badge>
                          </TableCell>
                          <TableCell>
                            {entry.hoursWorked.toFixed(1)}h
                          </TableCell>
                          <TableCell>{formatCurrency(entry.grossPay)}</TableCell>
                          <TableCell>{formatCurrency(entry.totalTips)}</TableCell>
                          <TableCell className="font-bold">{formatCurrency(entry.netPay)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    No payroll entries for this period.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employee Details Tab */}
          <TabsContent value="details" className="space-y-4">
            {period.payrollEntries?.map((entry: any) => (
              <Card key={entry.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {entry.employee?.firstName} {entry.employee?.lastName}
                  </CardTitle>
                  <CardDescription>
                    {entry.employee?.role} • {entry.employee?.department || 'General'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Employee Info */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2">Employee Information</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Employee #</span>
                            <span className="text-sm font-medium">{entry.employee?.employeeNumber}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Current Default Rate</span>
                            <span className="text-sm font-medium">{formatCurrency(entry.employee?.hourlyRate || 0)}/hr</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Effective Overtime Rate</span>
                            <span className="text-sm font-medium">{entry.overtimeHours > 0 ? `${formatCurrency(entry.overtimePay / entry.overtimeHours)}/hr` : '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Pay Type</span>
                            <span className="text-sm font-medium capitalize">{entry.employee?.payType || 'hourly'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Hours Breakdown */}
                      <div>
                        <h4 className="font-semibold mb-2">Hours Breakdown</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Regular Hours</span>
                            <span className="text-sm font-medium">{entry.regularHours.toFixed(1)}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Overtime Hours</span>
                            <span className="text-sm font-medium">{entry.overtimeHours.toFixed(1)}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Total Hours</span>
                            <span className="text-sm font-bold">{entry.hoursWorked.toFixed(1)}h</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pay Breakdown */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2">Pay Calculation</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Regular Pay</span>
                            <span className="text-sm font-medium">{formatCurrency(entry.regularPay)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Overtime Pay</span>
                            <span className="text-sm font-medium">{formatCurrency(entry.overtimePay)}</span>
                          </div>
                          <Separator className="my-2" />
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">Gross Wages</span>
                            <span className="text-sm font-bold">{formatCurrency(entry.grossPay)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Deductions & Net */}
                      <div>
                        <h4 className="font-semibold mb-2">Estimated Withholding & Net Compensation</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Tips Received</span>
                            <span className="text-sm font-medium text-green-600">+{formatCurrency(entry.totalTips)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Estimated Taxes</span>
                            <span className="text-sm font-medium text-red-600">-{formatCurrency(entry.totalTaxes)}</span>
                          </div>
                          <Separator className="my-2" />
                          <div className="flex justify-between">
                            <span className="text-sm font-bold">Estimated Net Compensation</span>
                            <span className="text-lg font-bold text-green-600">{formatCurrency(entry.netPay)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {entry.notes && (
                    <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-md">
                      <p className="text-sm text-slate-700 font-medium">
                        <span className="font-semibold">Notes:</span> {entry.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Pay Breakdown Tab */}
          <TabsContent value="breakdown" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Pay Breakdown</CardTitle>
                <CardDescription>
                  Complete breakdown of all pay components for this period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">Reg Hours</TableHead>
                      <TableHead className="text-right">OT Hours</TableHead>
                      <TableHead className="text-right">Effective Regular Rate</TableHead>
                      <TableHead className="text-right">Regular Pay</TableHead>
                      <TableHead className="text-right">Overtime Pay</TableHead>
                      <TableHead className="text-right">Tips</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Taxes</TableHead>
                      <TableHead className="text-right">Estimated Net Compensation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {period.payrollEntries?.map((entry: any) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.employee?.firstName} {entry.employee?.lastName}
                        </TableCell>
                        <TableCell className="text-right">{entry.regularHours.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{entry.overtimeHours.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{entry.regularHours > 0 ? formatCurrency(entry.regularPay / entry.regularHours) : '—'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(entry.regularPay)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(entry.overtimePay)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(entry.totalTips)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(entry.grossPay)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(entry.totalTaxes)}</TableCell>
                        <TableCell className="text-right font-bold text-green-600">{formatCurrency(entry.netPay)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold">
                      <TableCell>TOTALS</TableCell>
                      <TableCell className="text-right">{totalRegularHours.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{totalOvertimeHours.toFixed(1)}</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(period.payrollEntries?.reduce((sum: number, e: any) => sum + e.regularPay, 0) || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(period.payrollEntries?.reduce((sum: number, e: any) => sum + e.overtimePay, 0) || 0)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(totalTips)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totalGrossPay)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(totalTaxes)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(totalNetPay)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
