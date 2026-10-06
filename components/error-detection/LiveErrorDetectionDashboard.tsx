import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle, Info, Shield, RefreshCw, Activity, Users, Clock } from 'lucide-react';
import { AnomalyDetectionEngine } from '@/lib/anomaly-detection/engine';
import { ShiftData } from '@/lib/anomaly-detection/types';
import { toast } from 'sonner';
import { formatDate, formatTime, formatCurrency } from '@/lib/utils';

interface DetectedAnomaly {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'ERROR' | 'WARN' | 'INFO';
  description: string;
  impact: string;
  recommendation: string;
  shiftId?: string;
  employeeId?: string;
  employeeName?: string;
  timestamp: Date;
  metadata?: any;
}

export function shiftDurationMinutes(shift: { startTime: string; endTime?: string }, now = Date.now()): number | undefined {
  const start = new Date(shift.startTime).getTime();
  const end = shift.endTime ? new Date(shift.endTime).getTime() : now;
  return Number.isFinite(start) && Number.isFinite(end) ? (end - start) / 60_000 : undefined;
}

export const LiveErrorDetectionDashboard: React.FC = () => {
  const { shifts = [], employees = [], tips = [], payrollPeriods = [], errorShifts, errorEmployees, errorTips,
    loadingShifts, loadingEmployees, loadingTips, getShifts, getEmployees, getTips } = useData();
  const sourceError = [errorShifts, errorEmployees, errorTips].filter(Boolean).join(' ');
  const loadingSources = loadingShifts || loadingEmployees || loadingTips;
  const [anomalies, setAnomalies] = useState<DetectedAnomaly[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('last7days');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [lastAnalysis, setLastAnalysis] = useState<Date | null>(null);

  // Active employees for mapping
  const activeEmployees = employees.filter(e => e.status === 'active');

  // Filter shifts based on selected period
  const filteredShifts = useMemo(() => {
    const now = new Date();
    let startDate = new Date();

    switch (selectedPeriod) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'last7days':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'last30days':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'all':
        return shifts.filter(shift => shift.status !== 'break');
    }

    return shifts.filter(shift => {
      const shiftDate = new Date(shift.startTime || shift.shiftDate);
      return shift.status !== 'break' && shiftDate >= startDate && shiftDate <= now;
    });
  }, [shifts, selectedPeriod]);

  // Run analysis
  const runAnalysis = async () => {
    if (sourceError || loadingSources) return;
    setIsAnalyzing(true);
    try {
      // Initialize the anomaly detection engine
      const engine = new AnomalyDetectionEngine();

      // Transform shifts for anomaly detection
      const shiftData = filteredShifts.map(shift => ({
        id: shift.id,
        employee_id: shift.employeeId,
        location_id: shift.locationId || 'main',
        job_code: shift.jobCode || 'server',
        start_ts: shift.startTime ? new Date(shift.startTime).toISOString() : null,
        end_ts: shift.endTime ? new Date(shift.endTime).toISOString() : null,
        duration_min: shiftDurationMinutes(shift),
        status: shift.status === 'completed' ? 'CLOSED' : 'OPEN',
        tips_amount: shift.totalTips || 0,
        sales_amount: shift.totalSales || 0,
      } as ShiftData));

      // Run detection
      const results = engine.detectAnomalies(shiftData);

      // Transform results to our format
      const detectedAnomalies: DetectedAnomaly[] = results.map((result, index) => {
        const shift = filteredShifts.find(s => s.id === result.shift_id);
        const employee = employees.find(e => e.id === result.employee_id);

        // Map rule IDs to friendly names
        const ruleNames: Record<string, string> = {
          'EDM-001': 'Impossible Order',
          'EDM-002': 'Too Short Shift',
          'EDM-003': 'Too Long Shift',
          'EDM-004': 'Daily Total Exceeded',
          'EDM-005': 'Meal Break Too Long',
          'EDM-006': 'Micro Gap',
          'EDM-007': 'Schedule Drift',
          'EDM-008': 'Job Overlap',
          'EDM-009': 'Overnight Sanity',
          'EDM-010': 'Tip-Sales Ratio',
          'EDM-011': 'Missing Punch',
          'EDM-012': 'Excessive Weekly Hours',
        };

        return {
          id: `anomaly_${Date.now()}_${index}`,
          ruleId: result.rule_id,
          ruleName: ruleNames[result.rule_id] || result.rule_id,
          severity: result.severity === 'ERROR' ? 'ERROR' : result.severity === 'WARN' ? 'WARN' : 'INFO',
          description: result.description,
          impact: 'May affect payroll accuracy or compliance',
          recommendation: 'Review and verify this data',
          shiftId: result.shift_id,
          employeeId: result.employee_id,
          employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown',
          timestamp: new Date(),
          metadata: {},
        };
      });

      // Additional tip-to-sales ratio check
      filteredShifts.forEach(shift => {
        const shiftTips = tips.filter(tip =>
          tip.shiftId === shift.id ||
          (!tip.shiftId && tip.employeeId === shift.employeeId && shift.endTime &&
           new Date(tip.timestamp) >= new Date(shift.startTime) && new Date(tip.timestamp) <= new Date(shift.endTime))
        );

        const totalTipAmount = shiftTips.reduce((sum, tip) => sum + tip.amount, 0);
        if (shift.totalSales > 0 && totalTipAmount > 0) {
          const tipRatio = (totalTipAmount / shift.totalSales) * 100;
          if (tipRatio > 30) {
            detectedAnomalies.push({
              id: `tip_ratio_${shift.id}`,
              ruleId: 'CUSTOM-001',
              ruleName: 'High Tip-to-Sales Ratio',
              severity: 'WARN',
              description: `Tip percentage (${tipRatio.toFixed(1)}%) is unusually high`,
              impact: 'May indicate data entry error or exceptional service',
              recommendation: 'Verify tip and sales amounts are correct',
              shiftId: shift.id,
              employeeId: shift.employeeId || undefined,
              employeeName: employees.find(e => e.id === shift.employeeId)?.firstName || 'Unknown',
              timestamp: new Date(),
              metadata: { tipRatio, totalTips: totalTipAmount, totalSales: shift.totalSales }
            });
          }
        }
      });

      setAnomalies(detectedAnomalies);
      setLastAnalysis(new Date());

      toast.success(`Analysis complete: Found ${detectedAnomalies.length} anomalies`);
    } catch (error) {
      console.error('Error running analysis:', error);
      toast.error('Failed to run anomaly detection');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Run analysis on component mount and when data changes
  useEffect(() => {
    if (sourceError || loadingSources) { setAnomalies([]); setLastAnalysis(null); return; }
    void runAnalysis();
  }, [filteredShifts, employees, tips, sourceError, loadingSources]);

  // Filter anomalies by severity
  const displayedAnomalies = useMemo(() => {
    if (selectedSeverity === 'all') return anomalies;
    return anomalies.filter(a => a.severity === selectedSeverity);
  }, [anomalies, selectedSeverity]);

  // Count by severity
  const severityCounts = useMemo(() => {
    return {
      ERROR: anomalies.filter(a => a.severity === 'ERROR').length,
      WARN: anomalies.filter(a => a.severity === 'WARN').length,
      INFO: anomalies.filter(a => a.severity === 'INFO').length,
      total: anomalies.length,
    };
  }, [anomalies]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'ERROR': return 'destructive';
      case 'WARN': return 'secondary';
      case 'INFO': return 'outline';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'ERROR': return <AlertTriangle className="h-4 w-4" />;
      case 'WARN': return <Info className="h-4 w-4" />;
      case 'INFO': return <Activity className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  if (sourceError || loadingSources) return (
    <Card><CardHeader><CardTitle>Payroll Error Detection Unavailable</CardTitle></CardHeader><CardContent>
      {sourceError ? <div role="alert"><p>{sourceError}</p><p>Analysis requires complete shift, employee and tip records. Check your connection and retry. History exceeding the record limit cannot be analyzed here.</p>
        <Button disabled={loadingSources} onClick={() => void Promise.allSettled([getShifts(), getEmployees(), getTips()])}>Retry analysis data</Button>
      </div> : <p role="status">Loading records for analysis...</p>}
    </CardContent></Card>
  );

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Payroll Error Detection</h2>
          <p className="text-muted-foreground">
            Automated anomaly detection for shifts, tips, and payroll data
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="last7days">Last 7 Days</SelectItem>
              <SelectItem value="last30days">Last 30 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={runAnalysis} disabled={isAnalyzing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Anomalies</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{severityCounts.total}</div>
            <p className="text-xs text-slate-600">
              {filteredShifts.length} shifts analyzed
            </p>
          </CardContent>
        </Card>

        <Card className={severityCounts.ERROR > 0 ? 'border-red-200' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{severityCounts.ERROR}</div>
            <p className="text-xs text-slate-600">
              Require immediate attention
            </p>
          </CardContent>
        </Card>

        <Card className={severityCounts.WARN > 0 ? 'border-yellow-200' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            <Info className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{severityCounts.WARN}</div>
            <p className="text-xs text-slate-600">
              Should be reviewed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Analysis</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {lastAnalysis ? formatTime(lastAnalysis) : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground">
              {lastAnalysis ? formatDate(lastAnalysis) : 'Run analysis to start'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Status */}
      {lastAnalysis && anomalies.length === 0 && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-700" />
          <AlertTitle className="text-green-900 font-semibold">All Clear!</AlertTitle>
          <AlertDescription className="text-green-800">
            No anomalies detected in the {filteredShifts.length} shifts analyzed. Your data looks good!
          </AlertDescription>
        </Alert>
      )}

      {/* Anomalies Table */}
      {anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detected Anomalies</CardTitle>
            <CardDescription>
              Issues found that may affect payroll accuracy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList>
                <TabsTrigger value="all">
                  All ({severityCounts.total})
                </TabsTrigger>
                <TabsTrigger value="ERROR" className="data-[state=active]:text-red-600">
                  Errors ({severityCounts.ERROR})
                </TabsTrigger>
                <TabsTrigger value="WARN" className="data-[state=active]:text-yellow-600">
                  Warnings ({severityCounts.WARN})
                </TabsTrigger>
                <TabsTrigger value="INFO">
                  Info ({severityCounts.INFO})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <AnomaliesTable anomalies={displayedAnomalies} />
              </TabsContent>
              <TabsContent value="ERROR" className="mt-4">
                <AnomaliesTable anomalies={anomalies.filter(a => a.severity === 'ERROR')} />
              </TabsContent>
              <TabsContent value="WARN" className="mt-4">
                <AnomaliesTable anomalies={anomalies.filter(a => a.severity === 'WARN')} />
              </TabsContent>
              <TabsContent value="INFO" className="mt-4">
                <AnomaliesTable anomalies={anomalies.filter(a => a.severity === 'INFO')} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Anomalies table component
const AnomaliesTable: React.FC<{ anomalies: DetectedAnomaly[] }> = ({ anomalies }) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'ERROR': return 'destructive';
      case 'WARN': return 'secondary';
      case 'INFO': return 'outline';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'ERROR': return <AlertTriangle className="h-4 w-4" />;
      case 'WARN': return <Info className="h-4 w-4" />;
      case 'INFO': return <Activity className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  if (anomalies.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No anomalies in this category
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Severity</TableHead>
          <TableHead>Rule</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Employee</TableHead>
          <TableHead>Impact</TableHead>
          <TableHead>Recommendation</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {anomalies.map(anomaly => (
          <TableRow key={anomaly.id}>
            <TableCell>
              <Badge variant={getSeverityColor(anomaly.severity)} className="flex items-center gap-1 w-fit">
                {getSeverityIcon(anomaly.severity)}
                {anomaly.severity}
              </Badge>
            </TableCell>
            <TableCell className="font-medium">
              <div className="text-sm">{anomaly.ruleName}</div>
              <div className="text-xs text-muted-foreground">{anomaly.ruleId}</div>
            </TableCell>
            <TableCell>{anomaly.description}</TableCell>
            <TableCell>{anomaly.employeeName || '-'}</TableCell>
            <TableCell className="text-sm">{anomaly.impact}</TableCell>
            <TableCell className="text-sm">{anomaly.recommendation}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
