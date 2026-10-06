
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, AlertTriangle, FileText, Archive } from 'lucide-react';

interface ComplianceSettingsProps {
  data: any;
  onChange: (data: any) => void;
}

export const ComplianceSettings: React.FC<ComplianceSettingsProps> = ({ data, onChange }) => {
  const [dailyTipDeclaration, setDailyTipDeclaration] = useState(data.dailyTipDeclaration || false);
  const [tipDiscrepancyThreshold, setTipDiscrepancyThreshold] = useState(data.tipDiscrepancyThreshold || [10]);
  const [autoExportReports, setAutoExportReports] = useState(data.autoExportReports || false);
  const [dataRetentionPeriod, setDataRetentionPeriod] = useState(data.dataRetentionPeriod || 2);
  const [dataRetentionUnit, setDataRetentionUnit] = useState(data.dataRetentionUnit || 'years');

  const updateData = (updates: any) => {
    const newData = { ...data, ...updates };
    onChange(newData);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Compliance Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Daily Tip Declaration */}
          <div className="flex items-center space-x-2">
            <Switch
              id="daily-tip-declaration"
              checked={dailyTipDeclaration}
              onCheckedChange={(checked) => {
                setDailyTipDeclaration(checked);
                updateData({ dailyTipDeclaration: checked });
              }}
            />
            <Label htmlFor="daily-tip-declaration" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Daily Tip Declaration (Form 4070)
            </Label>
          </div>

          {/* Tip Discrepancy Threshold */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Tip Discrepancy Alert Threshold
            </Label>
            <div className="space-y-2">
              <Slider
                value={tipDiscrepancyThreshold}
                onValueChange={(value) => {
                  setTipDiscrepancyThreshold(value);
                  updateData({ tipDiscrepancyThreshold: value });
                }}
                max={50}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>1%</span>
                <span className="font-medium">{tipDiscrepancyThreshold[0]}%</span>
                <span>50%</span>
              </div>
              <p className="text-sm text-gray-600">
                Alert when reported tips differ from expected tips by more than this percentage
              </p>
            </div>
          </div>

          {/* Auto-export Reports */}
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-export-reports"
              checked={autoExportReports}
              onCheckedChange={(checked) => {
                setAutoExportReports(checked);
                updateData({ autoExportReports: checked });
              }}
            />
            <Label htmlFor="auto-export-reports">Auto-export compliance reports</Label>
          </div>

          {/* Data Retention Policy */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <Archive className="w-4 h-4" />
              Data Retention Policy
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={dataRetentionPeriod}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 1;
                  setDataRetentionPeriod(value);
                  updateData({ dataRetentionPeriod: value });
                }}
                className="w-20"
                min="1"
              />
              <Select value={dataRetentionUnit} onValueChange={(value) => {
                setDataRetentionUnit(value);
                updateData({ dataRetentionUnit: value });
              }}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="months">Months</SelectItem>
                  <SelectItem value="years">Years</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-gray-600">
              Keep employee data and records for regulatory compliance. 
              Most jurisdictions require 2-7 years retention.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Monitoring</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="font-medium">Tip Reporting</span>
              </div>
              <p className="text-sm text-gray-600">
                Monitor daily tip declarations and flag discrepancies
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <span className="font-medium">Form Generation</span>
              </div>
              <p className="text-sm text-gray-600">
                Automatically generate required tax forms and reports
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
