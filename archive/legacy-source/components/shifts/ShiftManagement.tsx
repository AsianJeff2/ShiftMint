
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, DollarSign, Calendar, Play, Square } from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';

interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'break';
  hoursWorked: number;
  breakTime: number;
  position: string;
}

export const ShiftManagement: React.FC = () => {
  const { employees = [] } = useEmployees();
  const [activeShifts, setActiveShifts] = useState<Shift[]>([
    {
      id: '1',
      employeeId: 'emp1',
      employeeName: 'Sarah Johnson',
      startTime: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      status: 'active',
      hoursWorked: 4.2,
      breakTime: 15,
      position: 'Server'
    },
    {
      id: '2',
      employeeId: 'emp2',
      employeeName: 'Mike Chen',
      startTime: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      status: 'break',
      hoursWorked: 5.5,
      breakTime: 30,
      position: 'Cook'
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'break': return 'bg-yellow-500';
      case 'completed': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  const calculateLaborCost = () => {
    return activeShifts.reduce((total, shift) => {
      const hourlyRate = 15; // This would come from employee data
      return total + (shift.hoursWorked * hourlyRate);
    }, 0);
  };

  const totalHours = activeShifts.reduce((total, shift) => total + shift.hoursWorked, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-600">{activeShifts.length}</p>
              <p className="text-sm text-blue-600/80">Active Shifts</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-600">{totalHours.toFixed(1)}h</p>
              <p className="text-sm text-green-600/80">Total Hours</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <DollarSign className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-2xl font-bold text-purple-600">${calculateLaborCost().toFixed(0)}</p>
              <p className="text-sm text-purple-600/80">Labor Cost</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Calendar className="h-8 w-8 text-orange-600" />
            <div>
              <p className="text-2xl font-bold text-orange-600">{new Date().toLocaleDateString()}</p>
              <p className="text-sm text-orange-600/80">Today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Shifts</CardTitle>
          <CardDescription>Real-time shift tracking and management</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeShifts.map((shift) => (
              <div key={shift.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(shift.status)}`} />
                  <div>
                    <h4 className="font-semibold">{shift.employeeName}</h4>
                    <p className="text-sm text-muted-foreground">{shift.position}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-sm font-medium">{shift.startTime.toLocaleTimeString()}</p>
                    <p className="text-xs text-muted-foreground">Start Time</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-sm font-medium">{shift.hoursWorked.toFixed(1)}h</p>
                    <p className="text-xs text-muted-foreground">Hours Worked</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-sm font-medium">{shift.breakTime}m</p>
                    <p className="text-xs text-muted-foreground">Break Time</p>
                  </div>
                  
                  <Badge variant={shift.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                    {shift.status}
                  </Badge>
                  
                  <div className="flex gap-2">
                    {shift.status === 'active' && (
                      <Button size="sm" variant="outline">
                        <Square className="w-4 h-4 mr-1" />
                        End Shift
                      </Button>
                    )}
                    {shift.status === 'break' && (
                      <Button size="sm" variant="outline">
                        <Play className="w-4 h-4 mr-1" />
                        Resume
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
