import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Users, DollarSign, FileText, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEmployees } from '@/hooks/useEmployees'; // Reverted to useEmployees
import { toast } from 'sonner';
import { EmployeeCSVImport } from '@/components/employees/EmployeeCSVImport';
import type { EmployeeDTO } from '@/lib/transformers';
import { EmployeeRoleSchema } from '@/lib/types/api-dtos';

const employeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  hourlyRate: z.number().positive('Hourly rate must be positive'),
  role: z.string().trim().toLowerCase().pipe(EmployeeRoleSchema),
  department: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  status: z.enum(['active', 'inactive', 'terminated']),
  tipEligible: z.boolean(),
  payType: z.enum(['hourly', 'salary']),
  overtimeRate: z.number().min(0).optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  taxExemptions: z.number().int().min(0),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;
type EmployeeFormInput = z.input<typeof employeeSchema>;

export const EmployeeList: React.FC = () => {
  const { 
    employees, 
    loading, 
    error,
    createEmployee, 
    updateEmployee, 
    deleteEmployee,
    refreshEmployees // Get the refresh function
  } = useEmployees();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'terminated'>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeDTO | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EmployeeFormInput, unknown, EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      hourlyRate: 15.00,
      role: '',
      department: '',
      startDate: new Date().toISOString().split('T')[0],
      status: 'active',
      tipEligible: true,
      payType: 'hourly',
      overtimeRate: 22.50, // This will be recalculated when hourlyRate changes
      address: '',
      emergencyContact: '',
      emergencyPhone: '',
      taxExemptions: 0,
    },
  });

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleSubmit = async (data: EmployeeFormData) => {
    if (error || loading) return;
    setIsSubmitting(true);
    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, data as any);
        toast.success('Employee updated successfully!');
        setEditingEmployee(null);
      } else {
        await createEmployee(data as any);
        toast.success('Employee created successfully!');
      }
      setIsAddDialogOpen(false);
      form.reset();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${editingEmployee ? 'update' : 'create'} employee.`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleEdit = (employee: EmployeeDTO) => {
    setEditingEmployee(employee);
    // Calculate correct overtime rate if not set
    const calculatedOvertimeRate = employee.overtimeRate || (employee.hourlyRate * 1.5);
    form.reset({
      ...employee,
      startDate: employee.startDate,
      phone: employee.phone || '',
      department: employee.department || '',
      overtimeRate: calculatedOvertimeRate,
      address: employee.address || '',
      emergencyContact: employee.emergencyContact || '',
      emergencyPhone: employee.emergencyPhone || '',
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (employee: EmployeeDTO) => {
    if (!confirm(`Are you sure you want to terminate ${employee.firstName} ${employee.lastName}?`)) {
      return;
    }
    try {
      await deleteEmployee(employee.id);
      toast.success('Employee terminated successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to terminate employee.');
    }
  };

  const filteredEmployees = useMemo(() => employees.filter(employee => {
    const matchesSearch = `${employee.firstName} ${employee.lastName} ${employee.email} ${employee.role}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || employee.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [employees, searchTerm, statusFilter]);

  const activeEmployeesCount = useMemo(() => employees.filter(emp => emp.status === 'active').length, [employees]);
  const tipEligibleEmployeesCount = useMemo(() => employees.filter(emp => emp.status === 'active' && emp.tipEligible).length, [employees]);

  const getStatusColor = (status: string): "default" | "destructive" | "outline" | "secondary" => {
    switch (status) {
      case 'active': return 'default';
      case 'inactive': return 'secondary';
      case 'terminated': return 'destructive';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Employee Management</h2>
      <div role="alert" className="rounded-md border border-destructive p-4">
        <p>Employee records unavailable. {error}</p>
        <p>Check your connection and load the saved roster before adding or importing replacement records.</p>
        <Button type="button" variant="outline" onClick={() => void refreshEmployees()}>Retry employees</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['Total Employees', 'Active Employees', 'Tip Eligible'].map(label => <Card key={label}>
          <CardHeader><CardTitle className="text-sm font-medium">{label}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">Unavailable</div></CardContent>
        </Card>)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Employee Management</h2>
          <p className="text-slate-300 mt-1">Manage your team members and their information</p>
        </div>
        <div className="flex gap-2">
          <EmployeeCSVImport onImportComplete={refreshEmployees} />
          <Button variant="outline" size="sm" disabled>
            <FileText className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => { setEditingEmployee(null); form.reset(); setIsAddDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeEmployeesCount} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeEmployeesCount}</div>
            <p className="text-xs text-muted-foreground">
              Currently working
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tip Eligible</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tipEligibleEmployeesCount}</div>
            <p className="text-xs text-muted-foreground">
              Can receive tips
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employees ({filteredEmployees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((employee) => (
                <div key={employee.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{employee.firstName} {employee.lastName}</p>
                    <p className="text-sm text-muted-foreground">{employee.email} • {employee.role} • ${employee.hourlyRate}/hr</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusColor(employee.status)}>{employee.status}</Badge>
                    <Button variant="outline" size="sm" aria-label={`Edit ${employee.firstName} ${employee.lastName}`} onClick={() => handleEdit(employee)}><Edit className="h-4 w-4" /></Button>
                    {employee.status !== 'terminated' && (
                      <Button variant="outline" size="sm" onClick={() => handleDelete(employee)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No employees found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField name="firstName" control={form.control} render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="lastName" control={form.control} render={({ field }) => (<FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="email" control={form.control} render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="hourlyRate" control={form.control} render={({ field }) => (<FormItem><FormLabel>Hourly Rate</FormLabel><FormControl><Input type="number" {...field} onChange={e => {
                const hourlyRate = parseFloat(e.target.value) || 0;
                field.onChange(hourlyRate);
                // Automatically update overtime rate to 1.5x hourly rate
                form.setValue('overtimeRate', hourlyRate * 1.5);
              }} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="role" control={form.control} render={({ field }) => (<FormItem><FormLabel>Role</FormLabel><FormControl><Input list="employee-role-options" {...field} /></FormControl><datalist id="employee-role-options">{EmployeeRoleSchema.options.map(role => <option key={role} value={role} />)}</datalist><FormMessage /></FormItem>)} />
              <FormField name="startDate" control={form.control} render={({ field }) => (<FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="status" control={form.control} render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="terminated">Terminated</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField name="tipEligible" control={form.control} render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel>Tip Eligible</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
