import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useData } from '@/contexts/DataContext';
import { useLocalAuth } from '@/contexts/LocalAuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  Building, 
  Clock,
  Save,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface BusinessConfig {
  id: string;
  businessId: string;
  timezone: string;
  payPeriodStartDay: number;
  payPeriodFrequency: string;
  tipPoolingEnabled: boolean;
  tipOutMethod: string;
  defaultTipPercentage?: number;
  createdAt: Date;
  updatedAt: Date;
}

export const BusinessConfigurationPanel: React.FC = () => {
  const { user } = useLocalAuth();
  const { business, getBusiness, updateBusiness } = useData();
  
  const [config, setConfig] = useState<Partial<BusinessConfig>>({
    timezone: 'America/New_York',
    payPeriodStartDay: 1, // Monday
    payPeriodFrequency: 'bi-weekly',
    tipPoolingEnabled: true,
    tipOutMethod: 'percentage',
    defaultTipPercentage: 18.0,
  });

  const [isSaving, setIsSaving] = useState(false);

  // Load business configuration
  useEffect(() => {
    if (user && !business) {
      getBusiness();
    }
  }, [user, business, getBusiness]);

  const timezones = [
    'America/New_York',
    'America/Chicago', 
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'America/Anchorage',
    'Pacific/Honolulu'
  ];

  const payPeriodFrequencies = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'bi-weekly', label: 'Bi-weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'semi-monthly', label: 'Semi-monthly' }
  ];

  const tipOutMethods = [
    { value: 'percentage', label: 'Percentage' },
    { value: 'points', label: 'Points System' },
    { value: 'fixed', label: 'Fixed Amount' }
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save configuration logic here
      // This would typically call an API to save business configuration
      
      toast.success('Business configuration saved successfully');
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const getComplianceStatus = () => {
    // Mock compliance checks
    const checks = [
      { name: 'Business Registration', status: 'complete' },
      { name: 'Tax Configuration', status: 'complete' },
      { name: 'Payroll Setup', status: 'complete' },
      { name: 'Employee Classifications', status: 'pending' }
    ];
    
    return checks;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Business Configuration
          </CardTitle>
          <CardDescription>
            Configure your business settings, payroll periods, and compliance requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="payroll">Payroll</TabsTrigger>
              <TabsTrigger value="tips">Tips & Service</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={config.timezone}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, timezone: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace('_', ' ').replace('America/', '').replace('Pacific/', '')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="payroll" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payPeriodFrequency">Pay Period Frequency</Label>
                  <Select
                    value={config.payPeriodFrequency}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, payPeriodFrequency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {payPeriodFrequencies.map((freq) => (
                        <SelectItem key={freq.value} value={freq.value}>
                          {freq.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payPeriodStartDay">Pay Period Start Day</Label>
                  <Select
                    value={config.payPeriodStartDay?.toString()}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, payPeriodStartDay: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Monday</SelectItem>
                      <SelectItem value="2">Tuesday</SelectItem>
                      <SelectItem value="3">Wednesday</SelectItem>
                      <SelectItem value="4">Thursday</SelectItem>
                      <SelectItem value="5">Friday</SelectItem>
                      <SelectItem value="6">Saturday</SelectItem>
                      <SelectItem value="0">Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tips" className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="tipPooling"   
                  checked={config.tipPoolingEnabled}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, tipPoolingEnabled: checked }))}
                />
                <Label htmlFor="tipPooling">Enable Tip Pooling</Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipOutMethod">Tip Distribution Method</Label>
                  <Select
                    value={config.tipOutMethod}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, tipOutMethod: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tipOutMethods.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultTipPercentage">Default Tip Percentage</Label>
                  <Input
                    id="defaultTipPercentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={config.defaultTipPercentage}
                    onChange={(e) => setConfig(prev => ({ ...prev, defaultTipPercentage: parseFloat(e.target.value) }))}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="compliance" className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Compliance Status</h3>
                <div className="space-y-3">
                  {getComplianceStatus().map((check, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <span className="font-medium">{check.name}</span>
                      <Badge variant={check.status === 'complete' ? 'default' : 'outline'}>
                        {check.status === 'complete' ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complete
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Pending
                          </>
                        )}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <Separator className="my-6" />

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
