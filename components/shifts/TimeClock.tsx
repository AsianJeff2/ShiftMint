import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Clock, LogIn, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const TimeClock: React.FC = () => {
  const { employees, shifts, clockIn, clockOut, loadingEmployees, loadingShifts } = useData();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [employeeId, setEmployeeId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const employee = employees.find(item => item.id === employeeId && item.status === 'active');
  const openShifts = shifts.filter(shift => shift.employeeId === employeeId && !shift.endTime && shift.status !== 'break');
  const recentShifts = useMemo(() => shifts.filter(shift => shift.employeeId === employeeId && shift.status !== 'break')
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).slice(0, 5), [shifts, employeeId]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const submit = async (action: 'in' | 'out') => {
    if (!employee || isSubmitting) return;
    if (action === 'in' && openShifts.length !== 0) return;
    if (action === 'out' && openShifts.length !== 1) return;
    setIsSubmitting(true);
    try {
      if (action === 'in') await clockIn(employee.id, employee.role);
      else await clockOut(openShifts[0].id);
      toast({ title: 'Success', description: action === 'in' ? 'Clocked in successfully' : 'Clocked out successfully' });
    } catch (error) {
      toast({ title: 'Clock action failed', description: (error as { message?: string })?.message || 'Could not save this clock action. Try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="mx-auto max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2"><Clock />Time Clock</CardTitle>
          <p className="text-3xl font-mono">{currentTime.toLocaleTimeString()}</p>
          <p>{currentTime.toLocaleDateString()}</p>
          <CardDescription>Clock actions save to your business records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label htmlFor="clock-employee">Employee</Label>
          <select id="clock-employee" value={employeeId} onChange={event => setEmployeeId(event.target.value)} disabled={isSubmitting || loadingEmployees || loadingShifts} className="w-full rounded border bg-background p-2">
            <option value="">Select an employee</option>
            {employees.filter(item => item.status === 'active').map(item => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}
          </select>
          {employee && <p role="status">{openShifts.length === 0 ? 'No open shift' : openShifts.length === 1 ? `Open shift started ${new Date(openShifts[0].startTime).toLocaleString()}` : 'Multiple open shifts require review before clocking out.'}</p>}
          <div className="flex gap-2">
            <Button onClick={() => void submit('in')} disabled={!employee || isSubmitting || loadingShifts || openShifts.length !== 0}><LogIn className="mr-2 h-4 w-4" />Clock In</Button>
            <Button onClick={() => void submit('out')} disabled={!employee || isSubmitting || loadingShifts || openShifts.length !== 1}><LogOut className="mr-2 h-4 w-4" />Clock Out</Button>
          </div>
          {isSubmitting && <p role="status">Saving clock action…</p>}
          <p className="text-sm text-muted-foreground">Break clock actions are unavailable. Record verified break intervals through the supported import workflow.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recorded Shift Times</CardTitle><CardDescription>Recent saved shifts for the selected employee</CardDescription></CardHeader>
        <CardContent>
          {!employeeId ? <p>Select an employee to view saved shifts.</p> : recentShifts.length === 0 ? <p>No shifts recorded.</p> : <ul className="space-y-3">{recentShifts.map(shift => <li key={shift.id} className="rounded border p-3"><p>{new Date(shift.startTime).toLocaleString()} → {shift.endTime ? new Date(shift.endTime).toLocaleString() : 'Open'}</p><p className="text-sm text-muted-foreground">{employee?.firstName} {employee?.lastName} · {shift.jobCode}</p></li>)}</ul>}
        </CardContent>
      </Card>
    </div>
  );
};
