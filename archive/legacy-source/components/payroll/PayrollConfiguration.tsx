import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Users, 
  DollarSign, 
  Clock, 
  Receipt, 
  Calendar,
  Download,
  Shield,
  FileText,
  Settings
} from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useLocalAuth } from '@/contexts/LocalAuthContext';

interface PayrollConfig {
  // Business Setup
  businessName: string;
  ein: string;
  stateOfIncorporation: string;
  timezone: string;
  businessHours: string;
  defaultPaySchedule: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
  workweekStartDay: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  posIntegration: string;

  // Wage & Compensation
  defaultOvertimeRule: 'flsa' | 'california' | 'custom';
  overtimeThreshold: number;
  overtimeMultiplier: number;
  doubleTimeThreshold: number;
  doubleTimeMultiplier: number;
  tipHandlingMethod: 'pooled' | 'direct' | 'hybrid';
  tipCreditEnabled: boolean;
  tipCreditAmount: number;
  minWageCompliance: boolean;
  holidayPayEnabled: boolean;

  // Time & Attendance
  clockRounding: 'none' | '5min' | '10min' | '15min';
  autoBreakDeduction: boolean;
  breakDuration: number;
  mealBreakEnabled: boolean;
  mealBreakDuration: number;
  tieeEnabled: boolean;
  missedPunchWorkflow: boolean;

  // Tax & Withholding
  federalTaxEnabled: boolean;
  stateTaxEnabled: boolean;
  localTaxEnabled: boolean;
  socialSecurityEnabled: boolean;
  medicareEnabled: boolean;
  futaEnabled: boolean;
  sutaEnabled: boolean;
  w2GenerationEnabled: boolean;
  form1099Enabled: boolean;

  // Pay Period Controls
  autoClosePeriods: boolean;
  retroactiveCorrections: boolean;
  gracePeriodDays: number;
  lockPeriodsAutomatically: boolean;

  // Distribution & Exports
  defaultPaymentMethod: 'directdeposit' | 'check' | 'cash';
  paystubGeneration: boolean;
  payrollRegisterExport: boolean;
  quickbooksIntegration: boolean;
  adpIntegration: boolean;
  gustoIntegration: boolean;

  // Permissions & Access
  dualApprovalRequired: boolean;
  auditLogsEnabled: boolean;
  viewOnlyAccessEnabled: boolean;
  roleBasedAccess: boolean;

  // Reporting & Analytics
  laborCostTracking: boolean;
  tipSalesRatioTracking: boolean;
  overtimeCostTracking: boolean;
  anomalyTracking: boolean;
  taxLiabilityForecasting: boolean;

  // Compliance & Documentation
  historicalDataRetention: number;
  auditTrailEnabled: boolean;
  formSubmissionTracking: boolean;
  tipAllocationCompliance: boolean;
  stateSpecificRules: boolean;
}

export const PayrollConfiguration: React.FC = () => {
  const { business, loadingBusiness, updateBusiness } = useData();
  const { user } = useLocalAuth();
  const [config, setConfig] = useState<PayrollConfig>({
    // Business Setup defaults
    businessName: '',
    ein: '',
    stateOfIncorporation: '',
    timezone: 'America/New_York',
    businessHours: '9:00 AM - 10:00 PM',
    defaultPaySchedule: 'weekly',
    workweekStartDay: 'monday',
    posIntegration: 'none',

    // Wage & Compensation defaults
    defaultOvertimeRule: 'flsa',
    overtimeThreshold: 40,
    overtimeMultiplier: 1.5,
    doubleTimeThreshold: 0,
    doubleTimeMultiplier: 2.0,
    tipHandlingMethod: 'direct',
    tipCreditEnabled: false,
    tipCreditAmount: 2.13,
    minWageCompliance: true,
    holidayPayEnabled: false,

    // Time & Attendance defaults
    clockRounding: '5min',
    autoBreakDeduction: true,
    breakDuration: 30,
    mealBreakEnabled: true,
    mealBreakDuration: 30,
    tieeEnabled: true,
    missedPunchWorkflow: true,

    // Tax & Withholding defaults
    federalTaxEnabled: true,
    stateTaxEnabled: true,
    localTaxEnabled: false,
    socialSecurityEnabled: true,
    medicareEnabled: true,
    futaEnabled: true,
    sutaEnabled: true,
    w2GenerationEnabled: true,
    form1099Enabled: false,

    // Pay Period Controls defaults
    autoClosePeriods: false,
    retroactiveCorrections: true,
    gracePeriodDays: 3,
    lockPeriodsAutomatically: false,

    // Distribution & Exports defaults
    defaultPaymentMethod: 'directdeposit',
    paystubGeneration: true,
    payrollRegisterExport: true,
    quickbooksIntegration: false,
    adpIntegration: false,
    gustoIntegration: false,

    // Permissions & Access defaults
    dualApprovalRequired: false,
    auditLogsEnabled: true,
    viewOnlyAccessEnabled: false,
    roleBasedAccess: true,

    // Reporting & Analytics defaults
    laborCostTracking: true,
    tipSalesRatioTracking: true,
    overtimeCostTracking: true,
    anomalyTracking: true,
    taxLiabilityForecasting: false,

    // Compliance & Documentation defaults
    historicalDataRetention: 7,
    auditTrailEnabled: true,
    formSubmissionTracking: true,
    tipAllocationCompliance: true,
    stateSpecificRules: false,
  });
  
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('business');

  useEffect(() => {
    if (business) {
      setConfig(prev => ({
        ...prev,
        businessName: business.name || '',
        ein: business.ein || '',
        stateOfIncorporation: business.type || '',
      }));
    }
  }, [business]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save configuration to business settings
      await updateBusiness({
        name: config.businessName,
        ein: config.ein,
        type: config.stateOfIncorporation,
        // Store full config in a separate field or service in real implementation
        // Note: payrollConfig will be handled separately
      });
      
      alert('Payroll configuration saved successfully!');
    } catch (error) {
      console.error('Error saving payroll configuration:', error);
      alert('Failed to save payroll configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (field: keyof PayrollConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  if (loadingBusiness) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Payroll Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Configure your payroll system settings across all categories
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="business">
            <Building2 className="h-4 w-4 mr-2" />
            Business
          </TabsTrigger>
          <TabsTrigger value="employees">
            <Users className="h-4 w-4 mr-2" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="wages">
            <DollarSign className="h-4 w-4 mr-2" />
            Wages
          </TabsTrigger>
          <TabsTrigger value="time">
            <Clock className="h-4 w-4 mr-2" />
            Time
          </TabsTrigger>
          <TabsTrigger value="more">
            <Settings className="h-4 w-4 mr-2" />
            More
          </TabsTrigger>
        </TabsList>

        {/* Business Setup & Defaults */}
        <TabsContent value="business" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business Setup & Defaults
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessName">Business Legal Name</Label>
                  <Input
                    id="businessName"
                    value={config.businessName}
                    onChange={(e) => updateConfig('businessName', e.target.value)}
                    placeholder="Your Business LLC"
                  />
                </div>
                <div>
                  <Label htmlFor="ein">Employer Identification Number (EIN)</Label>
                  <Input
                    id="ein"
                    value={config.ein}
                    onChange={(e) => updateConfig('ein', e.target.value)}
                    placeholder="XX-XXXXXXX"
                  />
                </div>
                <div>
                  <Label htmlFor="stateOfIncorporation">State of Incorporation</Label>
                  <Select value={config.stateOfIncorporation} onValueChange={(value) => updateConfig('stateOfIncorporation', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AL">Alabama</SelectItem>
                      <SelectItem value="AK">Alaska</SelectItem>
                      <SelectItem value="AZ">Arizona</SelectItem>
                      <SelectItem value="CA">California</SelectItem>
                      <SelectItem value="FL">Florida</SelectItem>
                      <SelectItem value="NY">New York</SelectItem>
                      <SelectItem value="TX">Texas</SelectItem>
                      {/* Add more states as needed */}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="timezone">Time Zone</Label>
                  <Select value={config.timezone} onValueChange={(value) => updateConfig('timezone', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="businessHours">Business Hours</Label>
                  <Input
                    id="businessHours"
                    value={config.businessHours}
                    onChange={(e) => updateConfig('businessHours', e.target.value)}
                    placeholder="9:00 AM - 10:00 PM"
                  />
                </div>
                <div>
                  <Label htmlFor="defaultPaySchedule">Default Pay Schedule</Label>
                  <Select value={config.defaultPaySchedule} onValueChange={(value) => updateConfig('defaultPaySchedule', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-weekly</SelectItem>
                      <SelectItem value="semimonthly">Semi-monthly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="workweekStartDay">Workweek Start Day (FLSA/Overtime)</Label>
                  <Select value={config.workweekStartDay} onValueChange={(value) => updateConfig('workweekStartDay', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monday">Monday</SelectItem>
                      <SelectItem value="tuesday">Tuesday</SelectItem>
                      <SelectItem value="wednesday">Wednesday</SelectItem>
                      <SelectItem value="thursday">Thursday</SelectItem>
                      <SelectItem value="friday">Friday</SelectItem>
                      <SelectItem value="saturday">Saturday</SelectItem>
                      <SelectItem value="sunday">Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="posIntegration">POS Integration</Label>
                  <Select value={config.posIntegration} onValueChange={(value) => updateConfig('posIntegration', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="square">Square</SelectItem>
                      <SelectItem value="clover">Clover</SelectItem>
                      <SelectItem value="toast">Toast</SelectItem>
                      <SelectItem value="resy">Resy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employee Configuration */}
        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Employee Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                Employee management is handled in the dedicated Employees section. Here you can configure default settings for new employees.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Auto-assign roles and departments</Label>
                    <div className="text-sm text-muted-foreground">
                      Automatically suggest roles based on job codes
                    </div>
                  </div>
                  <Switch
                    checked={config.roleBasedAccess}
                    onCheckedChange={(checked) => updateConfig('roleBasedAccess', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Multi-location support</Label>
                    <div className="text-sm text-muted-foreground">
                      Enable location-based pay assignments
                    </div>
                  </div>
                  <Switch
                    checked={false}
                    onCheckedChange={() => {}}
                    disabled
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>PTO accrual tracking</Label>
                    <div className="text-sm text-muted-foreground">
                      Track paid time off accruals
                    </div>
                  </div>
                  <Switch
                    checked={false}
                    onCheckedChange={() => {}}
                    disabled
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Custom deductions</Label>
                    <div className="text-sm text-muted-foreground">
                      Health, garnishment, retirement deductions
                    </div>
                  </div>
                  <Switch
                    checked={false}
                    onCheckedChange={() => {}}
                    disabled
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wages & Compensation */}
        <TabsContent value="wages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Wages & Compensation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Overtime Rules */}
              <div>
                <h4 className="text-sm font-medium mb-3">Overtime Configuration</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="defaultOvertimeRule">Overtime Rule</Label>
                    <Select value={config.defaultOvertimeRule} onValueChange={(value) => updateConfig('defaultOvertimeRule', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flsa">FLSA (1.5x after 40 hours)</SelectItem>
                        <SelectItem value="california">California (double-time)</SelectItem>
                        <SelectItem value="custom">Custom Rules</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="overtimeThreshold">Overtime Threshold (hours)</Label>
                    <Input
                      id="overtimeThreshold"
                      type="number"
                      value={config.overtimeThreshold}
                      onChange={(e) => updateConfig('overtimeThreshold', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="overtimeMultiplier">Overtime Multiplier</Label>
                    <Input
                      id="overtimeMultiplier"
                      type="number"
                      step="0.1"
                      value={config.overtimeMultiplier}
                      onChange={(e) => updateConfig('overtimeMultiplier', parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Tip Handling */}
              <div>
                <h4 className="text-sm font-medium mb-3">Tip Handling</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tipHandlingMethod">Tip Method</Label>
                    <Select value={config.tipHandlingMethod} onValueChange={(value) => updateConfig('tipHandlingMethod', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="direct">Direct Attribution</SelectItem>
                        <SelectItem value="pooled">Pooled Tips</SelectItem>
                        <SelectItem value="hybrid">Hybrid System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>Tip Credit Enabled</Label>
                      <div className="text-sm text-muted-foreground">
                        Use federal tip credit (e.g., $2.13/hour)
                      </div>
                    </div>
                    <Switch
                      checked={config.tipCreditEnabled}
                      onCheckedChange={(checked) => updateConfig('tipCreditEnabled', checked)}
                    />
                  </div>
                  {config.tipCreditEnabled && (
                    <div>
                      <Label htmlFor="tipCreditAmount">Tip Credit Amount ($)</Label>
                      <Input
                        id="tipCreditAmount"
                        type="number"
                        step="0.01"
                        value={config.tipCreditAmount}
                        onChange={(e) => updateConfig('tipCreditAmount', parseFloat(e.target.value))}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>Minimum Wage Auto Top-off</Label>
                      <div className="text-sm text-muted-foreground">
                        Automatically top-off to minimum wage
                      </div>
                    </div>
                    <Switch
                      checked={config.minWageCompliance}
                      onCheckedChange={(checked) => updateConfig('minWageCompliance', checked)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Holiday & Bonus Pay */}
              <div>
                <h4 className="text-sm font-medium mb-3">Additional Compensation</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>Holiday Pay Rules</Label>
                      <div className="text-sm text-muted-foreground">
                        Enable holiday pay calculations
                      </div>
                    </div>
                    <Switch
                      checked={config.holidayPayEnabled}
                      onCheckedChange={(checked) => updateConfig('holidayPayEnabled', checked)}
                    />
                  </div>
                  <div className="p-3 border rounded-lg">
                    <Label>Bonus/Commission Entry</Label>
                    <div className="text-sm text-muted-foreground">
                      Manual entry supported in payroll periods
                    </div>
                    <Badge variant="outline" className="mt-2">Available</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time & Attendance */}
        <TabsContent value="time" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time & Attendance Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Clock Settings */}
              <div>
                <h4 className="text-sm font-medium mb-3">Clock-in/Clock-out Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="clockRounding">Rounding Rules</Label>
                    <Select value={config.clockRounding} onValueChange={(value) => updateConfig('clockRounding', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Rounding</SelectItem>
                        <SelectItem value="5min">Round to 5 minutes</SelectItem>
                        <SelectItem value="10min">Round to 10 minutes</SelectItem>
                        <SelectItem value="15min">Round to 15 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>Manual Punch Override</Label>
                      <div className="text-sm text-muted-foreground">
                        Allow managers to edit punches
                      </div>
                    </div>
                    <Switch
                      checked={true}
                      onCheckedChange={() => {}}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Break Settings */}
              <div>
                <h4 className="text-sm font-medium mb-3">Break & Meal Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>Auto-break Detection</Label>
                      <div className="text-sm text-muted-foreground">
                        Automatically detect and deduct breaks
                      </div>
                    </div>
                    <Switch
                      checked={config.autoBreakDeduction}
                      onCheckedChange={(checked) => updateConfig('autoBreakDeduction', checked)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="breakDuration">Default Break Duration (minutes)</Label>
                    <Input
                      id="breakDuration"
                      type="number"
                      value={config.breakDuration}
                      onChange={(e) => updateConfig('breakDuration', parseInt(e.target.value))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>Meal Break Enforcement</Label>
                      <div className="text-sm text-muted-foreground">
                        Enforce meal break rules
                      </div>
                    </div>
                    <Switch
                      checked={config.mealBreakEnabled}
                      onCheckedChange={(checked) => updateConfig('mealBreakEnabled', checked)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mealBreakDuration">Meal Break Duration (minutes)</Label>
                    <Input
                      id="mealBreakDuration"
                      type="number"
                      value={config.mealBreakDuration}
                      onChange={(e) => updateConfig('mealBreakDuration', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* TIEE & Anomaly Detection */}
              <div>
                <h4 className="text-sm font-medium mb-3">TIEE Anomaly Detection</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>TIEE Anomaly Flagging</Label>
                      <div className="text-sm text-muted-foreground">
                        Enable intelligent anomaly detection
                      </div>
                    </div>
                    <Switch
                      checked={config.tieeEnabled}
                      onCheckedChange={(checked) => updateConfig('tieeEnabled', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>Missed Punch Workflow</Label>
                      <div className="text-sm text-muted-foreground">
                        Handle missed clock-in/out events
                      </div>
                    </div>
                    <Switch
                      checked={config.missedPunchWorkflow}
                      onCheckedChange={(checked) => updateConfig('missedPunchWorkflow', checked)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* More Settings */}
        <TabsContent value="more" className="space-y-4">
          {/* Tax & Withholding */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Tax & Withholding Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Federal Tax</Label>
                    <div className="text-sm text-muted-foreground">Auto-calculate federal taxes</div>
                  </div>
                  <Switch
                    checked={config.federalTaxEnabled}
                    onCheckedChange={(checked) => updateConfig('federalTaxEnabled', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>State Tax</Label>
                    <div className="text-sm text-muted-foreground">Auto-calculate state taxes</div>
                  </div>
                  <Switch
                    checked={config.stateTaxEnabled}
                    onCheckedChange={(checked) => updateConfig('stateTaxEnabled', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Social Security</Label>
                    <div className="text-sm text-muted-foreground">Auto-calculate FICA</div>
                  </div>
                  <Switch
                    checked={config.socialSecurityEnabled}
                    onCheckedChange={(checked) => updateConfig('socialSecurityEnabled', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Medicare</Label>
                    <div className="text-sm text-muted-foreground">Auto-calculate Medicare tax</div>
                  </div>
                  <Switch
                    checked={config.medicareEnabled}
                    onCheckedChange={(checked) => updateConfig('medicareEnabled', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>W-2 Generation</Label>
                    <div className="text-sm text-muted-foreground">Generate W-2 forms</div>
                  </div>
                  <Switch
                    checked={config.w2GenerationEnabled}
                    onCheckedChange={(checked) => updateConfig('w2GenerationEnabled', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>1099 Forms</Label>
                    <div className="text-sm text-muted-foreground">Generate 1099 forms</div>
                  </div>
                  <Switch
                    checked={config.form1099Enabled}
                    onCheckedChange={(checked) => updateConfig('form1099Enabled', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pay Period Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Pay Period Controls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Auto-close Pay Periods</Label>
                    <div className="text-sm text-muted-foreground">Automatically close periods</div>
                  </div>
                  <Switch
                    checked={config.autoClosePeriods}
                    onCheckedChange={(checked) => updateConfig('autoClosePeriods', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Retroactive Corrections</Label>
                    <div className="text-sm text-muted-foreground">Allow retroactive changes</div>
                  </div>
                  <Switch
                    checked={config.retroactiveCorrections}
                    onCheckedChange={(checked) => updateConfig('retroactiveCorrections', checked)}
                  />
                </div>
                <div>
                  <Label htmlFor="gracePeriodDays">Grace Period (days)</Label>
                  <Input
                    id="gracePeriodDays"
                    type="number"
                    value={config.gracePeriodDays}
                    onChange={(e) => updateConfig('gracePeriodDays', parseInt(e.target.value))}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Lock Periods Automatically</Label>
                    <div className="text-sm text-muted-foreground">Auto-lock after grace period</div>
                  </div>
                  <Switch
                    checked={config.lockPeriodsAutomatically}
                    onCheckedChange={(checked) => updateConfig('lockPeriodsAutomatically', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Distribution & Exports */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Payroll Distribution & Exports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="defaultPaymentMethod">Default Payment Method</Label>
                  <Select value={config.defaultPaymentMethod} onValueChange={(value) => updateConfig('defaultPaymentMethod', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="directdeposit">Direct Deposit</SelectItem>
                      <SelectItem value="check">Paper Check</SelectItem>
                      <SelectItem value="cash">Cash (with receipts)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Pay Stub Generation</Label>
                    <div className="text-sm text-muted-foreground">Generate PDF pay stubs</div>
                  </div>
                  <Switch
                    checked={config.paystubGeneration}
                    onCheckedChange={(checked) => updateConfig('paystubGeneration', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>QuickBooks Integration</Label>
                    <div className="text-sm text-muted-foreground">Export to QuickBooks</div>
                  </div>
                  <Switch
                    checked={config.quickbooksIntegration}
                    onCheckedChange={(checked) => updateConfig('quickbooksIntegration', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>ADP Integration</Label>
                    <div className="text-sm text-muted-foreground">Export to ADP</div>
                  </div>
                  <Switch
                    checked={config.adpIntegration}
                    onCheckedChange={(checked) => updateConfig('adpIntegration', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Compliance & Documentation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Compliance & Documentation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="historicalDataRetention">Historical Data Retention (years)</Label>
                  <Input
                    id="historicalDataRetention"
                    type="number"
                    value={config.historicalDataRetention}
                    onChange={(e) => updateConfig('historicalDataRetention', parseInt(e.target.value))}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Audit Trail</Label>
                    <div className="text-sm text-muted-foreground">Track all changes with audit logs</div>
                  </div>
                  <Switch
                    checked={config.auditTrailEnabled}
                    onCheckedChange={(checked) => updateConfig('auditTrailEnabled', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Form Submission Tracking</Label>
                    <div className="text-sm text-muted-foreground">Track W-2, 1099 submissions</div>
                  </div>
                  <Switch
                    checked={config.formSubmissionTracking}
                    onCheckedChange={(checked) => updateConfig('formSubmissionTracking', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Tip Allocation Compliance</Label>
                    <div className="text-sm text-muted-foreground">FLSA 80/20 rule checker</div>
                  </div>
                  <Switch
                    checked={config.tipAllocationCompliance}
                    onCheckedChange={(checked) => updateConfig('tipAllocationCompliance', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}; 