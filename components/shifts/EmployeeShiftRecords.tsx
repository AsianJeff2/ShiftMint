import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Calendar,
  User,
  Filter
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/error-handling';
import type { EmployeeDTO, ShiftDTO } from '@/lib/transformers';

// API response structure from getShiftsByEmployee
interface EmployeeShiftData {
  employee: EmployeeDTO;
  shifts: ShiftDTO[];
  totalHours: number;
  totalWages: number;
}

export const EmployeeShiftRecords: React.FC = () => {
  const [employeeShiftData, setEmployeeShiftData] = useState<EmployeeShiftData[]>([]);
  const [loading, setLoading] = useState(true);
  const [openEmployees, setOpenEmployees] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });

  const loadEmployeeShifts = async (filter = dateFilter) => {
    setLoading(true);
    try {
      const response = await apiClient.getShiftsByEmployee({
        startDate: filter.startDate || undefined,
        endDate: filter.endDate || undefined
      });

      setEmployeeShiftData(response || []);
    } catch (error) {
      console.error('Error loading employee shifts:', error);
      toast.error(errorMessage(error, 'Error loading shift data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployeeShifts();
  }, []);

  const handleDateFilter = () => {
    loadEmployeeShifts();
  };

  const clearFilters = () => {
    setDateFilter({ startDate: '', endDate: '' });
    void loadEmployeeShifts({ startDate: '', endDate: '' });
  };

  const toggleEmployee = (employeeId: string) => {
    const newOpenEmployees = new Set(openEmployees);
    if (newOpenEmployees.has(employeeId)) {
      newOpenEmployees.delete(employeeId);
    } else {
      newOpenEmployees.add(employeeId);
    }
    setOpenEmployees(newOpenEmployees);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Employee Time Clock Records</h2>
          <p className="text-gray-600 mt-1">Detailed shift records grouped by employee</p>
        </div>
      </div>

      {/* Date Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filter Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={dateFilter.startDate}
                onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={dateFilter.endDate}
                onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-40"
              />
            </div>
            <Button onClick={handleDateFilter}>Apply Filter</Button>
            <Button variant="outline" onClick={clearFilters}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {/* Employee Records */}
      {employeeShiftData.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-gray-500">No shift records found for the selected period</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {employeeShiftData.map((empData) => (
            <Card key={empData.employee.id} className="overflow-hidden">
              <Collapsible
                open={openEmployees.has(empData.employee.id)}
                onOpenChange={() => toggleEmployee(empData.employee.id)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {openEmployees.has(empData.employee.id) ? (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        )}
                        <div className="flex items-center space-x-3">
                          <div className="bg-blue-100 p-2 rounded-full">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <CardTitle className="text-xl">
                              {empData.employee.firstName} {empData.employee.lastName}
                            </CardTitle>
                            <CardDescription>
                              {empData.employee.employeeNumber} • ${empData.employee.hourlyRate}/hr
                            </CardDescription>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6 text-sm">
                        <div className="text-center">
                          <div className="flex items-center text-gray-500">
                            <Clock className="h-4 w-4 mr-1" />
                            Total Hours
                          </div>
                          <div className="font-semibold text-lg">{empData.totalHours}h</div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center text-gray-500">
                            <DollarSign className="h-4 w-4 mr-1" />
                            Total Pay
                          </div>
                          <div className="font-semibold text-lg text-green-600">
                            ${empData.totalWages.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center text-gray-500">
                            <Calendar className="h-4 w-4 mr-1" />
                            Shifts
                          </div>
                          <div className="font-semibold text-lg">{empData.shifts.length}</div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{empData.totalHours}h</div>
                        <div className="text-sm text-gray-600">Total Hours</div>
                        <div className="text-xs text-gray-500">${empData.shifts.reduce((sum, s) => sum + s.regularWage, 0).toFixed(2)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{empData.shifts.reduce((sum, s) => sum + (s.overtimeWage / (empData.employee.overtimeRate || empData.employee.hourlyRate * 1.5)), 0).toFixed(1)}h</div>
                        <div className="text-sm text-gray-600">Overtime</div>
                        <div className="text-xs text-gray-500">${empData.shifts.reduce((sum, s) => sum + s.overtimeWage, 0).toFixed(2)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-600">${empData.employee.hourlyRate}</div>
                        <div className="text-sm text-gray-600">Regular Rate</div>
                        <div className="text-xs text-gray-500">per hour</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-600">${empData.employee.overtimeRate || (empData.employee.hourlyRate * 1.5)}</div>
                        <div className="text-sm text-gray-600">Overtime Rate</div>
                        <div className="text-xs text-gray-500">per hour</div>
                      </div>
                    </div>

                    {/* Shift Details Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>Date</TableHead>
                            <TableHead>Start Time</TableHead>
                            <TableHead>End Time</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Position</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Regular Pay</TableHead>
                            <TableHead>Overtime Pay</TableHead>
                            <TableHead className="text-right">Total Pay</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {empData.shifts.map((shift) => (
                            <TableRow key={shift.id} className="hover:bg-gray-50">
                              <TableCell className="font-medium">
                                {formatDate(shift.startTime)}
                              </TableCell>
                              <TableCell className="font-mono">
                                {formatTime(shift.startTime)}
                              </TableCell>
                              <TableCell className="font-mono">
                                {shift.endTime ? formatTime(shift.endTime) : '-'}
                              </TableCell>
                              <TableCell className="font-medium">
                                {shift.hoursWorked ? `${shift.hoursWorked}h` : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{shift.jobCode}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(shift.status)}>
                                  {shift.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono">
                                ${shift.regularWage.toFixed(2)}
                              </TableCell>
                              <TableCell className="font-mono">
                                ${shift.overtimeWage.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                ${shift.totalWage.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Notes */}
                    {empData.shifts.some(s => s.notes) && (
                      <div className="mt-4">
                        <h4 className="font-medium text-gray-900 mb-2">Shift Notes:</h4>
                        <div className="space-y-1">
                          {empData.shifts
                            .filter(s => s.notes)
                            .map((shift) => (
                              <div key={shift.id} className="text-sm text-gray-600">
                                <span className="font-medium">{formatDate(shift.startTime)}:</span> {shift.notes}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
