import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Users, Clock, Calendar, DollarSign, FileText, List, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { ShiftCSVImport } from '@/components/shifts/ShiftCSVImport';
import { EmployeeShiftRecords } from '@/components/shifts/EmployeeShiftRecords';
import { TimeClock } from '@/components/shifts/TimeClock';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { shiftFormRequest, type ShiftFormValues } from '@/lib/shifts/form-request';

const Shifts: React.FC = () => {
  const {
    shifts,
    loadingShifts,
    errorShifts,
    getShifts,
    createShift,
    updateShift,
    deleteShift,
    employees,
    loadingEmployees,
  } = useData();

  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<any>(null);
  const [editingForm, setEditingForm] = useState<ShiftFormValues | null>(null);
  const [formData, setFormData] = useState({
    employeeId: '',
    startTime: '',
    endTime: '',
    jobCode: 'server',
    locationId: 'main',
    status: 'completed',
    notes: '',
    totalSales: 0,
    cashSales: 0,
    creditCardSales: 0,
    totalTips: 0,
    cashTips: 0,
    creditCardTips: 0,
  });

  // Helper function to format date for datetime-local input
  const formatDateTimeForInput = (dateString: string | Date | null | undefined) => {
    if (!dateString) return '';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';

      // Format as YYYY-MM-DDTHH:MM for datetime-local input
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  const handleEdit = (shift: any) => {
    setEditingShift(shift);
    const initialForm = {
      employeeId: shift.employeeId || '',
      startTime: formatDateTimeForInput(shift.startTime),
      endTime: formatDateTimeForInput(shift.endTime),
      jobCode: shift.jobCode || 'server',
      locationId: shift.locationId || 'main',
      status: shift.status || 'completed',
      notes: shift.notes || '',
      totalSales: shift.totalSales || 0,
      cashSales: shift.cashSales || 0,
      creditCardSales: shift.creditCardSales || 0,
      totalTips: shift.totalTips || 0,
      cashTips: shift.cashTips || 0,
      creditCardTips: shift.creditCardTips || 0,
    };
    setFormData(initialForm);
    setEditingForm(initialForm);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employeeId) {
      toast.error('Please select an employee');
      return;
    }

    if (!formData.startTime) {
      toast.error('Please enter a start time');
      return;
    }

    try {
      if (editingShift && editingForm) {
        await updateShift(editingShift.id, shiftFormRequest(formData, editingForm));
        toast.success('Shift updated successfully');
      } else {
        await createShift(shiftFormRequest(formData));
        toast.success('Shift created successfully');
      }

      setIsDialogOpen(false);
      resetForm();
      getShifts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save shift');
    }
  };

  const handleDelete = async (shiftId: string) => {
    if (confirm('Are you sure you want to delete this shift?')) {
      try {
        await deleteShift(shiftId);
        toast.success('Shift deleted successfully');
        getShifts();
      } catch (error: any) {
        toast.error(error.message || 'Failed to delete shift');
      }
    }
  };

  const resetForm = () => {
    setEditingShift(null);
    setEditingForm(null);
    setFormData({
      employeeId: '',
      startTime: '',
      endTime: '',
      jobCode: 'server',
      locationId: 'main',
      status: 'completed',
      notes: '',
      totalSales: 0,
      cashSales: 0,
      creditCardSales: 0,
      totalTips: 0,
      cashTips: 0,
      creditCardTips: 0,
    });
  };

  const formatDateTime = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';

      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const calculateHours = (startTime: any, endTime: any) => {
    if (!startTime || !endTime) return '0';

    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return hours.toFixed(2);
    } catch (error) {
      return '0';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'break': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Shift Management</h1>
        <div className="flex gap-2">
          <ShiftCSVImport onImportComplete={getShifts} />
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Shift
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingShift ? 'Edit Shift' : 'Add New Shift'}</DialogTitle>
              <DialogDescription>
                  {editingShift ? 'Update shift information' : 'Enter shift details'}
                  {' '}Times use this device’s timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Imported records keep their recorded rate and wages.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employee">Employee</Label>
                    <Select
                      value={formData.employeeId}
                      onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeEmployees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.firstName} {employee.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="jobCode">Job Code</Label>
                    <Select
                      value={formData.jobCode}
                      onValueChange={(value) => { if (value) setFormData(previous => ({ ...previous, jobCode: value })); }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="server">Server</SelectItem>
                        <SelectItem value="bartender">Bartender</SelectItem>
                        <SelectItem value="host">Host</SelectItem>
                        <SelectItem value="busser">Busser</SelectItem>
                        <SelectItem value="kitchen">Kitchen</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        {editingShift?.jobCode && !['server', 'bartender', 'host', 'busser', 'kitchen', 'manager'].includes(editingShift.jobCode) && <SelectItem value={editingShift.jobCode}>{editingShift.jobCode} (recorded job code)</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="datetime-local"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="datetime-local"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Select
                      value={formData.locationId}
                      onValueChange={(value) => setFormData({ ...formData, locationId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="main">Main</SelectItem>
                        <SelectItem value="bar">Bar</SelectItem>
                        <SelectItem value="patio">Patio</SelectItem>
                        <SelectItem value="private">Private Dining</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                                        <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending_review">Pending Review</SelectItem>
                  </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Add any notes about this shift..."
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingShift ? 'Update Shift' : 'Create Shift'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>


      {errorShifts && <div role="alert" className="rounded-md border border-destructive p-4"><p>Shift records unavailable. {errorShifts}</p><p>Check your connection and retry before creating replacement records.</p><Button type="button" variant="outline" disabled={loadingShifts} onClick={() => void getShifts()}>Retry shifts</Button></div>}

        <Tabs defaultValue="list" className="space-y-4" aria-busy={loadingShifts || loadingEmployees}>
          <TabsList>
            <TabsTrigger value="list">
              <List className="h-4 w-4 mr-2" />
              All Shifts
            </TabsTrigger>
            <TabsTrigger value="employees">
              <Users className="h-4 w-4 mr-2" />
              Employee Records
            </TabsTrigger>
            <TabsTrigger value="timeclock">
              <Clock className="h-4 w-4 mr-2" />
              Time Clock
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            {(loadingShifts || loadingEmployees) && <p role="status">Refreshing shift records...</p>}
            <Card>
              <CardHeader>
                <CardTitle>Shift Records</CardTitle>
                <CardDescription>View and manage all shift entries</CardDescription>
              </CardHeader>
              <CardContent>
                {errorShifts ? (
                  <p className="text-center py-8">Shift records unavailable. Retry the read above.</p>
                ) : loadingShifts && shifts.length === 0 ? (
                  <p className="text-center py-8">Loading shift records...</p>
                ) : shifts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No shifts recorded yet. Click "Add Shift" to create your first shift.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Job Code</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shifts.map((shift) => {
                        const employee = employees.find(e => e.id === shift.employeeId);
                        return (
                          <TableRow key={shift.id}>
                            <TableCell>
                              {employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown'}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="text-sm">
                                  Start: {formatDateTime(shift.startTime)}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  End: {formatDateTime(shift.endTime)}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {calculateHours(shift.startTime, shift.endTime)} hrs
                            </TableCell>
                            <TableCell className="capitalize">{shift.jobCode}</TableCell>
                            <TableCell className="capitalize">{shift.locationId}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusColor(shift.status)}>
                                {shift.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEdit(shift)}
                                  aria-label={`Edit shift ${shift.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDelete(shift.id)}
                                  aria-label={`Delete shift ${shift.id}`}
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
          </TabsContent>

          <TabsContent value="employees">
            {(loadingShifts || loadingEmployees) && <p role="status">Refreshing shift records...</p>}
            <EmployeeShiftRecords />
          </TabsContent>

          <TabsContent value="timeclock">
            {(loadingShifts || loadingEmployees) && <p role="status">Refreshing shift records...</p>}
            {errorShifts ? <p>Time clock unavailable until shift records load successfully.</p> : <TimeClock />}
          </TabsContent>
        </Tabs>

    </div>
  );
};

export default Shifts;
