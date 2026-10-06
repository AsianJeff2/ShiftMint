
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, DollarSign, Clock, Users, Target } from 'lucide-react';

export const LaborCostAnalysis: React.FC = () => {
  const laborMetrics = {
    currentCost: 1847,
    budgetedCost: 2000,
    dailyTarget: 1800,
    hoursScheduled: 120,
    hoursWorked: 118.5,
    laborPercentage: 28.5,
    overtime: 8.5,
    efficiency: 96.7
  };

  const costTrend = laborMetrics.currentCost < laborMetrics.budgetedCost ? 'under' : 'over';
  const budgetVariance = ((laborMetrics.currentCost - laborMetrics.budgetedCost) / laborMetrics.budgetedCost * 100);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-600">
                ${laborMetrics.currentCost.toLocaleString()}
              </p>
              <p className="text-sm text-green-600/80">Current Labor Cost</p>
              <div className="flex items-center gap-1 mt-1">
                {costTrend === 'under' ? (
                  <TrendingDown className="w-3 h-3 text-green-500" />
                ) : (
                  <TrendingUp className="w-3 h-3 text-red-500" />
                )}
                <span className={`text-xs ${costTrend === 'under' ? 'text-green-500' : 'text-red-500'}`}>
                  {Math.abs(budgetVariance).toFixed(1)}% vs budget
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-600">{laborMetrics.hoursWorked}h</p>
              <p className="text-sm text-blue-600/80">Hours Worked</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-muted-foreground">
                  vs {laborMetrics.hoursScheduled}h scheduled
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-2xl font-bold text-purple-600">{laborMetrics.laborPercentage}%</p>
              <p className="text-sm text-purple-600/80">Labor Percentage</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-muted-foreground">of total sales</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Target className="h-8 w-8 text-orange-600" />
            <div>
              <p className="text-2xl font-bold text-orange-600">{laborMetrics.efficiency}%</p>
              <p className="text-sm text-orange-600/80">Efficiency</p>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3 text-green-500" />
                <span className="text-xs text-green-500">+2.3% vs avg</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Budget Analysis</CardTitle>
            <CardDescription>Daily labor cost vs budget targets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Current Cost</span>
                <span className="font-medium">${laborMetrics.currentCost}</span>
              </div>
              <Progress 
                value={(laborMetrics.currentCost / laborMetrics.budgetedCost) * 100} 
                className="h-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>$0</span>
                <span>Budget: ${laborMetrics.budgetedCost}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Daily Target</span>
                <span className="font-medium">${laborMetrics.dailyTarget}</span>
              </div>
              <Progress 
                value={(laborMetrics.currentCost / laborMetrics.dailyTarget) * 100} 
                className="h-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>$0</span>
                <span>Target: ${laborMetrics.dailyTarget}</span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Budget Status</span>
                <Badge variant={costTrend === 'under' ? 'default' : 'destructive'}>
                  {costTrend === 'under' ? 'Under Budget' : 'Over Budget'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overtime Analysis</CardTitle>
            <CardDescription>Overtime hours and cost breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium">Regular Hours</p>
                  <p className="text-sm text-muted-foreground">Standard rate</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{(laborMetrics.hoursWorked - laborMetrics.overtime).toFixed(1)}h</p>
                  <p className="text-sm text-muted-foreground">$15.00/hr</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <div>
                  <p className="font-medium text-red-600">Overtime Hours</p>
                  <p className="text-sm text-red-600/80">1.5x rate</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-red-600">{laborMetrics.overtime}h</p>
                  <p className="text-sm text-red-600/80">$22.50/hr</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overtime Percentage</span>
                  <span className="font-medium">
                    {((laborMetrics.overtime / laborMetrics.hoursWorked) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department Labor Breakdown</CardTitle>
          <CardDescription>Labor costs by department and position</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { department: 'Kitchen', hours: 45.5, cost: 682, positions: ['Cook', 'Prep Cook', 'Dishwasher'] },
              { department: 'Front of House', hours: 38.0, cost: 570, positions: ['Server', 'Host', 'Busser'] },
              { department: 'Management', hours: 35.0, cost: 595, positions: ['Manager', 'Assistant Manager'] }
            ].map((dept, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{dept.department}</h4>
                  <div className="flex gap-4 text-sm">
                    <span className="font-medium">{dept.hours}h</span>
                    <span className="font-medium">${dept.cost}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {dept.positions.map((position, posIndex) => (
                    <Badge key={posIndex} variant="outline" className="text-xs">
                      {position}
                    </Badge>
                  ))}
                </div>
                <Progress value={(dept.cost / laborMetrics.currentCost) * 100} className="h-1 mt-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
