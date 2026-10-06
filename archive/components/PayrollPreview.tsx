import React, { useState, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { useEmployees } from '@/hooks/useEmployees';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, Clock, Users, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface EmployeePayrollPreview {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  grossPay: number;
  totalTips: number;
  estimatedTaxes: number;
  netPay: number;
  hourlyRate: number;
  overtimeRate: number;
  shiftsCount: number;
  tipsCount: number;
}

interface PayrollPreviewSummary {
  totalEmployees: number;
  totalHours: number;
  totalGrossPay: number;
  totalTips: number;
  totalTaxes: number;
  totalNetPay: number;
  employees: EmployeePayrollPreview[];
}

export const PayrollPreview: React.FC = () => {
  const { shifts, tips, loadingShifts } = useData();
  const { employees } = useEmployees();
  const activeEmployees = employees.filter(e => e.status === 'active');
  const [preview, setPreview] = useState<PayrollPreviewSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculatePreview();
  }, [shifts, tips, activeEmployees]);

  const calculatePreview = () => {
    if (loadingShifts || !shifts || !tips || !activeEmployees) {
      setLoading(true);
      return;
    }

    try {
      setLoading(true);

      // Get data for the current week (or you could make this configurable)
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // Start of current week
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Filter shifts and tips for current period
      const currentShifts = shifts.filter(shift => {
        const shiftDate = new Date(shift.startTime || shift.shiftDate);
        return shiftDate >= weekStart && shiftDate <= weekEnd;
      });

      const currentTips = tips.filter(tip => {
        const tipDate = new Date(tip.createdAt || tip.timestamp);
        return tipDate >= weekStart && tipDate <= weekEnd;
      });

      // Group data by employee
      const employeeData = new Map();

      // Initialize employee data
      activeEmployees.forEach(employee => {
        employeeData.set(employee.id, {
          employee,
          shifts: [],
          tips: [],
          totalHours: 0,
          totalTips: 0,
        });
      });

      // Associate shifts with employees
      currentShifts.forEach(shift => {
        if (shift.employeeId && employeeData.has(shift.employeeId)) {
          const empData = employeeData.get(shift.employeeId);
          empData.shifts.push(shift);
          
          // Calculate hours from shift data
          if (shift.startTime && shift.endTime) {
            const duration = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
            empData.totalHours += duration;
          } else if (shift.durationMin) {
            // Use durationMin if available (stored in database)
            empData.totalHours += shift.durationMin / 60;
          }
        }
      });

      // Associate tips with employees
      currentTips.forEach(tip => {
        if (tip.employeeId && employeeData.has(tip.employeeId)) {
          const empData = employeeData.get(tip.employeeId);
          empData.tips.push(tip);
          empData.totalTips += tip.amount;
        }
      });

      // Calculate payroll for each employee
      let totalEmployees = 0;
      let totalHours = 0;
      let totalGrossPay = 0;
      let totalTips = 0;
      let totalTaxes = 0;
      let totalNetPay = 0;
      
      const employeeResults: EmployeePayrollPreview[] = [];

      for (const [employeeId, empData] of employeeData) {
        if (empData.shifts.length === 0) continue; // Skip employees with no shifts
        
        const { employee } = empData;
        const employeeHours = empData.totalHours;
        const employeeTips = empData.totalTips;
        
        // Use actual employee wage data
        const hourlyRate = employee.hourlyRate || 15.0;
        const overtimeRate = employee.overtimeRate || (hourlyRate * 1.5);
        
        // Calculate regular and overtime hours PER DAY (8-hour daily overtime)
        // Process each shift individually for proper daily overtime calculation
        let totalRegularHours = 0;
        let totalOvertimeHours = 0;

        empData.shifts.forEach((shift: any) => {
          let shiftHours = 0;
          
          if (shift.startTime && shift.endTime) {
            shiftHours = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
          } else if (shift.hoursWorked) {
            shiftHours = typeof shift.hoursWorked === 'string' ? parseFloat(shift.hoursWorked) : shift.hoursWorked;
          }
          
          if (shiftHours > 0) {
            const dailyRegularHours = Math.min(shiftHours, 8);
            const dailyOvertimeHours = Math.max(shiftHours - 8, 0);
            
            totalRegularHours += dailyRegularHours;
            totalOvertimeHours += dailyOvertimeHours;
          }
        });
        
        const regularHours = totalRegularHours;
        const overtimeHours = totalOvertimeHours;
        
        const regularPay = regularHours * hourlyRate;
        const overtimePay = overtimeHours * overtimeRate;
        const grossPay = regularPay + overtimePay;
        
        // Estimate taxes (22% combined rate)
        const estimatedTaxes = grossPay * 0.22;
        const netPay = grossPay - estimatedTaxes + employeeTips;
        
        // Add to totals
        totalEmployees++;
        totalHours += employeeHours;
        totalGrossPay += grossPay;
        totalTips += employeeTips;
        totalTaxes += estimatedTaxes;
        totalNetPay += netPay;
        
        employeeResults.push({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          totalHours: employeeHours,
          regularHours,
          overtimeHours,
          regularPay,
          overtimePay,
          grossPay,
          totalTips: employeeTips,
          estimatedTaxes,
          netPay,
          hourlyRate,
          overtimeRate,
          shiftsCount: empData.shifts.length,
          tipsCount: empData.tips.length,
        });
      }

      setPreview({
        totalEmployees,
        totalHours,
        totalGrossPay,
        totalTips,
        totalTaxes,
        totalNetPay,
        employees: employeeResults,
      });

    } catch (error) {
      console.error('Error calculating payroll preview:', error);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Live Payroll Preview
          </CardTitle>
          <CardDescription>Loading current week estimates...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!preview || preview.totalEmployees === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Live Payroll Preview
          </CardTitle>
          <CardDescription>Current week estimates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No shifts recorded this week. Start adding shifts to see payroll estimates.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Live Payroll Preview
          </CardTitle>
          <CardDescription>Current week estimates - updates automatically</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                Employees
              </div>
              <div className="text-2xl font-bold">{preview.totalEmployees}</div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Total Hours
              </div>
              <div className="text-2xl font-bold">{preview.totalHours.toFixed(1)}</div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Gross Pay
              </div>
              <div className="text-2xl font-bold">{formatCurrency(preview.totalGrossPay)}</div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Net Pay
              </div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(preview.totalNetPay)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Tips</div>
              <div className="text-lg font-semibold">{formatCurrency(preview.totalTips)}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Estimated Taxes</div>
              <div className="text-lg font-semibold text-red-600">{formatCurrency(preview.totalTaxes)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employee Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Tips</TableHead>
                <TableHead>Est. Net</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.employees.map((emp) => (
                <TableRow key={emp.employeeId}>
                  <TableCell className="font-medium">{emp.employeeName}</TableCell>
                  <TableCell>
                    <div>
                      {emp.totalHours.toFixed(1)}h
                      {emp.overtimeHours > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {emp.overtimeHours.toFixed(1)}h OT
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(emp.grossPay)}</TableCell>
                  <TableCell>{formatCurrency(emp.totalTips)}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(emp.netPay)}</TableCell>
                  <TableCell>
                    <Badge variant={emp.totalHours > 40 ? "destructive" : "default"}>
                      {emp.totalHours > 40 ? "Overtime" : "Regular"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};