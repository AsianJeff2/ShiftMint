
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Brain, AlertTriangle, TrendingUp, Clock, DollarSign } from 'lucide-react';
import { LiveErrorDetectionDashboard } from '@/components/error-detection/LiveErrorDetectionDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ErrorDetection: React.FC = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics & Error Detection</h1>
        <p className="text-gray-600 mt-1">
          Automated anomaly detection and analytics for payroll accuracy
        </p>
      </div>

      {/* Tabbed Interface */}
      <Tabs defaultValue="error-detection" className="w-full">
        <TabsList>
          <TabsTrigger value="error-detection">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Error Detection
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="error-detection" className="mt-4">
          <LiveErrorDetectionDashboard />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          {/* Analytics Notice */}
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <Brain className="h-5 w-5" />
                Advanced Analytics - Coming Soon
              </CardTitle>
              <CardDescription className="text-amber-800 font-medium">
                Advanced analytics features are being developed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-amber-900 mb-4 font-medium">
                While error detection is fully functional, advanced analytics features are still in development:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-amber-900">Coming Soon:</h4>
                  <ul className="text-sm text-amber-800 space-y-1 font-medium">
                    <li>• Tip trend analysis</li>
                    <li>• Peak hours identification</li>
                    <li>• Revenue patterns</li>
                    <li>• Seasonal insights</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-amber-900">Future Features:</h4>
                  <ul className="text-sm text-amber-800 space-y-1 font-medium">
                    <li>• Performance metrics</li>
                    <li>• Predictive analytics</li>
                    <li>• Custom reporting</li>
                    <li>• Export capabilities</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Basic Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Insights</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming Soon</div>
            <p className="text-xs text-muted-foreground">
              Revenue and tip analytics
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pattern Recognition</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming Soon</div>
            <p className="text-xs text-muted-foreground">
              Identify trends and patterns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Smart Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming Soon</div>
            <p className="text-xs text-muted-foreground">
              Anomaly detection and alerts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Feature Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time Analysis
            </CardTitle>
            <CardDescription>
              Analyze your work patterns and optimize scheduling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm">Peak Hours Detection</span>
                <span className="text-xs text-gray-500">Coming Soon</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm">Shift Pattern Analysis</span>
                <span className="text-xs text-gray-500">Coming Soon</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm">Productivity Insights</span>
                <span className="text-xs text-gray-500">Coming Soon</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Revenue Intelligence
            </CardTitle>
            <CardDescription>
              Understand your earning patterns and optimize income
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm">Tip Trend Analysis</span>
                <span className="text-xs text-gray-500">Coming Soon</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm">Revenue Forecasting</span>
                <span className="text-xs text-gray-500">Coming Soon</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-xs text-gray-500">Coming Soon</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call to Action */}
      <Card>
        <CardHeader>
          <CardTitle>Stay Updated</CardTitle>
          <CardDescription>
            These analytics features are being developed for the desktop version
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-slate-700 mb-4 font-medium">
            Advanced analytics and intelligent insights will be available in future updates. 
            The desktop version focuses on core functionality first, with advanced features 
            coming in subsequent releases.
          </p>
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <p className="text-sm text-blue-900 font-medium">
              <strong className="font-bold">Current Focus:</strong> The desktop version prioritizes reliable local data 
              management, tip tracking, shift logging, and payroll calculations. Advanced analytics 
              will be added once the core features are stable and tested.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ErrorDetection;
