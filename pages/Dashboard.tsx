import React, { useEffect, useMemo, useState } from 'react';
import { useLocalAuth } from '@/contexts/LocalAuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Clock, Calculator, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ComprehensiveExport } from '@/components/export/ComprehensiveExport';
import { hasPermission, Permission, type UserRole } from '@/lib/security/rbac';
import { errorMessage } from '@/lib/error-handling';
import type { TipEntryDTO, ShiftDTO } from '@/lib/transformers';

const currency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const hours = (value: number) => value.toFixed(1) + 'h';

const Dashboard: React.FC = () => {
  const { user } = useLocalAuth();
  const { tips: allTips, shifts: allShifts, payrollPeriods, business, loadingPayroll, errorPayroll, getTips, getShifts } = useData();
  const allowed = (permission: Permission) => !!user && hasPermission(user.role as UserRole, permission);
  const canTips = allowed(Permission.TIPS_VIEW);
  const canShifts = allowed(Permission.SHIFTS_VIEW);
  const canPayroll = allowed(Permission.PAYROLL_VIEW);
  const range = useMemo(() => ({ startDate: new Date(Date.now() - 30 * 86400000).toISOString(), endDate: new Date().toISOString() }), [user?.id, user?.role]);
  const [tips, setTips] = useState<TipEntryDTO[]>([]);
  const [shifts, setShifts] = useState<ShiftDTO[]>([]);
  const [tipState, setTipState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [shiftState, setShiftState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [tipError, setTipError] = useState<string | null>(null);
  const [shiftError, setShiftError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setTips([]); setTipError(null);
    if (!canTips) { setTipState('ready'); return; }
    setTipState('loading');
    getTips(range).then(records => { if (active) { setTips(records); setTipState('ready'); } }).catch(error => {
      if (active) { setTipState('failed'); setTipError(errorMessage(error, 'Could not load the last 30 days of tips.')); }
    });
    return () => { active = false; };
  }, [getTips, allTips, range, canTips]);

  useEffect(() => {
    let active = true;
    setShifts([]); setShiftError(null);
    if (!canShifts) { setShiftState('ready'); return; }
    setShiftState('loading');
    getShifts(range).then(records => { if (active) { setShifts(records); setShiftState('ready'); } }).catch(error => {
      if (active) { setShiftState('failed'); setShiftError(errorMessage(error, 'Could not load the last 30 days of shifts.')); }
    });
    return () => { active = false; };
  }, [getShifts, allShifts, range, canShifts]);

  const firstInstant = Date.parse(range.startDate);
  const lastInstant = Date.parse(range.endDate);
  const recentTips = tips.filter(tip => {
    const timestamp = Date.parse(tip.timestamp);
    return Number.isFinite(timestamp) && timestamp >= firstInstant && timestamp <= lastInstant;
  }).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const workedShifts = shifts.filter(shift => shift.status === 'completed' && !!shift.endTime && Number.isFinite(Date.parse(shift.startTime)) && Number.isFinite(Date.parse(shift.endTime)) && Date.parse(shift.endTime) > firstInstant && Date.parse(shift.startTime) < lastInstant);
  const workHours = (shift: ShiftDTO) => Math.max(0, Math.min(Date.parse(shift.endTime!), lastInstant) - Math.max(Date.parse(shift.startTime), firstInstant)) / 3600000;
  const totalTips = recentTips.reduce((sum, tip) => sum + tip.amount, 0);
  const totalHours = workedShifts.reduce((sum, shift) => sum + workHours(shift), 0);
  const result = (permitted: boolean, state: 'loading' | 'ready' | 'failed', value: string) => !permitted ? 'No access' : state === 'loading' ? 'Loading...' : state === 'failed' ? 'Unavailable' : value;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div><h1 className="text-3xl font-bold text-slate-900">Welcome back, {user?.firstName}!</h1><p className="text-slate-700">{business?.name || 'Your business dashboard'}</p></div>
        {allowed(Permission.REPORTS_EXPORT) && <ComprehensiveExport />}
      </div>
      {(tipError || shiftError) && <div role="alert" className="text-red-700">{tipError && <p>{tipError}</p>}{shiftError && <p>{shiftError}</p>}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card><CardHeader><CardTitle className="flex gap-2 text-sm"><DollarSign className="h-4 w-4" />Total Tips (30d)</CardTitle></CardHeader><CardContent><div data-testid="dashboard-tip-total" className="text-2xl font-bold">{result(canTips, tipState, currency(totalTips))}</div>{canTips && tipState === 'ready' && <p className="text-xs text-slate-600">{recentTips.length} tip entries</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex gap-2 text-sm"><Clock className="h-4 w-4" />Hours Worked (30d)</CardTitle></CardHeader><CardContent><div data-testid="dashboard-work-hours" className="text-2xl font-bold">{result(canShifts, shiftState, hours(totalHours))}</div>{canShifts && shiftState === 'ready' && <p className="text-xs text-slate-600">Completed work time within this range; breaks excluded</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex gap-2 text-sm"><TrendingUp className="h-4 w-4" />Average Tip (30d)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{result(canTips, tipState, currency(recentTips.length ? totalTips / recentTips.length : 0))}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex gap-2 text-sm"><Calculator className="h-4 w-4" />Payroll Periods</CardTitle></CardHeader><CardContent><div data-testid="dashboard-payroll-count" className="text-2xl font-bold">{!canPayroll ? 'No access' : loadingPayroll ? 'Loading...' : errorPayroll ? 'Unavailable' : payrollPeriods.length}</div><p className="text-xs text-slate-600">All periods accessible to your role</p></CardContent></Card>
      </div>
      <div className="flex flex-wrap gap-3">
        {canTips && <Link className="text-blue-700 underline" to="/tips">View tips</Link>}
        {canShifts && <Link className="text-blue-700 underline" to="/shifts">View shifts</Link>}
        {canPayroll && <Link className="text-blue-700 underline" to="/payroll">View payroll</Link>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {canTips && <Card><CardHeader><CardTitle>Recent Tips</CardTitle><CardDescription>Occurrences within the last 30 days</CardDescription></CardHeader><CardContent>{tipState !== 'ready' ? <p>{result(true, tipState, '')}</p> : recentTips.length ? recentTips.slice(0, 5).map(tip => <div key={tip.id} className="flex justify-between py-2"><span>{currency(tip.amount)} · {tip.tipType}</span><span>{new Date(tip.timestamp).toLocaleDateString()}</span></div>) : <p>No tips in this range.</p>}</CardContent></Card>}
        {canShifts && <Card><CardHeader><CardTitle>Recent Work Shifts</CardTitle><CardDescription>Completed work within the last 30 days</CardDescription></CardHeader><CardContent>{shiftState !== 'ready' ? <p>{result(true, shiftState, '')}</p> : workedShifts.length ? [...workedShifts].sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime)).slice(0, 5).map(shift => <div key={shift.id} className="flex justify-between py-2"><span>{hours(workHours(shift))}</span><span>{new Date(shift.startTime).toLocaleDateString()}</span></div>) : <p>No completed work shifts in this range.</p>}</CardContent></Card>}
      </div>
    </div>
  );
};
export default Dashboard;
