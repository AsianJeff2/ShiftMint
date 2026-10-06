
import React, { useState, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLocalAuth } from '@/contexts/LocalAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Building, User, Shield, BarChart3, Key, Database, DollarSign, AlertCircle, Download, Info } from 'lucide-react';
import { DatabaseBackupSettings } from '@/components/settings/DatabaseBackupSettings';
import { EnhancedTippingSettings } from '@/components/settings/EnhancedTippingSettings';
import { IntegrationsSettings } from '@/components/settings/IntegrationsSettings';
import apiClient from '@/lib/api-client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { hasPermission, Permission, type UserRole } from '@/lib/security/rbac';
import { errorMessage } from '@/lib/error-handling';
import { tipDistributionError, type TipDistributionSettings } from '@/lib/tip-distribution';

interface BusinessForm {
  name: string;
  type: string;
  phone: string;
  website: string;
  ein: string;
  address: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const Settings: React.FC = () => {
  const { business, loadingBusiness, errorBusiness, getBusiness, updateBusiness, analyticsEnabled, updateAnalyticsSettings } = useData();
  const { user, changePassword } = useLocalAuth();
  const { toast } = useToast();
  const canViewConfig = !!user && hasPermission(user.role as UserRole, Permission.CONFIG_VIEW);
  const canEditConfig = !!user && hasPermission(user.role as UserRole, Permission.CONFIG_UPDATE);
  const canAdminister = !!user && hasPermission(user.role as UserRole, Permission.SYSTEM_ADMIN);
  const canConnectPos = user?.role === 'owner' || user?.role === 'manager';

  const [businessForm, setBusinessForm] = useState<BusinessForm>({
    name: '',
    type: '',
    phone: '',
    website: '',
    ein: '',
    address: '',
  });

  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [isUpdatingBusiness, setIsUpdatingBusiness] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUpdatingAnalytics, setIsUpdatingAnalytics] = useState(false);
  const [tippingSettings, setTippingSettings] = useState<TipDistributionSettings | null>(null);
  const [loadingTipping, setLoadingTipping] = useState(false);
  const [tippingError, setTippingError] = useState<string | null>(null);
  const [tippingReload, setTippingReload] = useState(0);
  const [isUpdatingTipping, setIsUpdatingTipping] = useState(false);

  // Load business data when available
  useEffect(() => {
    if (business) {
      setBusinessForm({
        name: business.name || '',
        type: business.type || '',
        phone: business.phone || '',
        website: business.website || '',
        ein: '',
        address: business.address == null ? '' : typeof business.address === 'string' ? business.address : JSON.stringify(business.address),
      });

    }
  }, [business]);

  useEffect(() => {
    let active = true;
    setTippingSettings(null);
    setTippingError(null);
    setLoadingTipping(false);
    if (!canViewConfig || !business?.id) return;
    setLoadingTipping(true);
    apiClient.getTipDistributionSettings(business.id).then(settings => {
      if (active) setTippingSettings(settings);
    }).catch(error => {
      if (active) setTippingError(errorMessage(error, 'Could not load saved tipping settings.'));
    }).finally(() => { if (active) setLoadingTipping(false); });
    return () => { active = false; };
  }, [business?.id, user?.id, user?.role, canViewConfig, tippingReload]);

  const handleBusinessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditConfig || !business || loadingBusiness || errorBusiness) return;
    setIsUpdatingBusiness(true);
    try {
      await updateBusiness({
        name: businessForm.name,
        type: businessForm.type,
        phone: businessForm.phone,
        website: businessForm.website,
        ...(businessForm.ein.trim() ? { ein: businessForm.ein.trim() } : {}),
        address: businessForm.address,
      });

      alert('Business information updated successfully!');
    } catch (error) {
      console.error('Error updating business:', error);
      alert(errorMessage(error, 'Failed to update business information. Please try again.'));
    } finally {
      setIsUpdatingBusiness(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      alert('New password must be at least 8 characters long');
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      
      // Reset form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      alert('Password changed successfully!');
    } catch (error) {
      console.error('Error changing password:', error);
      alert(errorMessage(error, 'Failed to change password. Please check your current password and try again.'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleAnalyticsToggle = async (enabled: boolean) => {
    if (!canAdminister) return;
    setIsUpdatingAnalytics(true);
    try {
      await updateAnalyticsSettings(enabled);
    } catch (error) {
      console.error('Error updating analytics settings:', error);
      alert(errorMessage(error, 'Failed to update analytics settings.'));
    } finally {
      setIsUpdatingAnalytics(false);
    }
  };

  const handleBusinessInputChange = (field: keyof BusinessForm, value: string) => {
    setBusinessForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordInputChange = (field: keyof PasswordForm, value: string) => {
    setPasswordForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveTippingSettings = async () => {
    if (!canEditConfig || !tippingSettings || loadingTipping) return;
    const problem = tipDistributionError(tippingSettings);
    if (problem) { alert(problem); return; }
    setIsUpdatingTipping(true);
    try {
      await apiClient.saveTipDistributionSettings(tippingSettings);
      alert('Tipping settings saved successfully!');
    } catch (error) {
      alert(errorMessage(error, 'Failed to save tipping settings.'));
    } finally {
      setIsUpdatingTipping(false);
    }
  };

  if (loadingBusiness && canViewConfig) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-700 mt-1 font-medium">Manage your business and account settings</p>
      </div>

      <Tabs key={user?.role} defaultValue={canViewConfig ? "business" : "account"} className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          {canViewConfig && (<TabsTrigger value="business">
            <Building className="h-4 w-4 mr-2" />
            Business
          </TabsTrigger>)}
          <TabsTrigger value="account">
            <User className="h-4 w-4 mr-2" />
            Account
          </TabsTrigger>
          {canViewConfig && (<TabsTrigger value="tipping">
            <DollarSign className="h-4 w-4 mr-2" />
            Tipping
          </TabsTrigger>)}
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
          {canAdminister && (<TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>)}
          {canConnectPos && <TabsTrigger value="integrations">POS connections</TabsTrigger>}
          {canAdminister && (<TabsTrigger value="database">
            <Database className="h-4 w-4 mr-2" />
            Database
          </TabsTrigger>)}
        </TabsList>

        {/* Business Settings */}
        {canViewConfig && (<TabsContent value="business">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Business Information
              </CardTitle>
              <CardDescription>
                Update your business details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(errorBusiness || !business) && <div role="alert" className="mb-4 rounded-md border border-destructive p-4"><p>Business settings unavailable. {errorBusiness || 'Saved business information has not loaded.'}</p><p>Load the saved settings before editing contact information.</p><Button type="button" variant="outline" disabled={loadingBusiness} onClick={() => void getBusiness()}>Retry business settings</Button></div>}
              <form onSubmit={handleBusinessSubmit} className="space-y-4">
                <fieldset disabled={!canEditConfig || isUpdatingBusiness || !business || Boolean(errorBusiness)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Business Name *</Label>
                    <Input
                      id="name"
                      value={businessForm.name}
                      onChange={(e) => handleBusinessInputChange('name', e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Business Type</Label>
                    <Input
                      id="type"
                      placeholder="e.g., Restaurant, Cafe, Bar"
                      value={businessForm.type}
                      onChange={(e) => handleBusinessInputChange('type', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={businessForm.phone}
                      onChange={(e) => handleBusinessInputChange('phone', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://your-business.com"
                      value={businessForm.website}
                      onChange={(e) => handleBusinessInputChange('website', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ein">EIN / Tax ID</Label>
                    <Input
                      id="ein"
                      placeholder="Leave blank to keep the stored tax ID"
                      type="password"
                      autoComplete="off"
                      value={businessForm.ein}
                      onChange={(e) => handleBusinessInputChange('ein', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Business Address</Label>
                  <Textarea
                    id="address"
                    placeholder="123 Main Street, City, State, ZIP"
                    value={businessForm.address}
                    onChange={(e) => handleBusinessInputChange('address', e.target.value)}
                    rows={3}
                  />
                </div>

                <Button type="submit" disabled={isUpdatingBusiness}>
                  {isUpdatingBusiness ? 'Updating...' : 'Update Business Information'}
                </Button>
                </fieldset>
              </form>
            </CardContent>
          </Card>
        </TabsContent>)}

        {/* Account Settings */}
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Information
              </CardTitle>
              <CardDescription>
                View your account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>First Name</Label>
                  <div className="mt-1 p-2 bg-gray-50 rounded">{user?.firstName || 'N/A'}</div>
                </div>
                <div>
                  <Label>Last Name</Label>
                  <div className="mt-1 p-2 bg-gray-50 rounded">{user?.lastName || 'N/A'}</div>
                </div>
                <div>
                  <Label>Email</Label>
                  <div className="mt-1 p-2 bg-gray-50 rounded">{user?.email || 'N/A'}</div>
                </div>
                <div>
                  <Label>Role</Label>
                  <div className="mt-1 p-2 bg-gray-50 rounded">{user?.role || 'N/A'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your account password for security
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password *</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => handlePasswordInputChange('currentPassword', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password *</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="At least 8 characters"
                    value={passwordForm.newPassword}
                    onChange={(e) => handlePasswordInputChange('newPassword', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => handlePasswordInputChange('confirmPassword', e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" disabled={isChangingPassword}>
                  {isChangingPassword ? 'Changing...' : 'Change Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Settings */}
        {canAdminister && (<TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analytics & Privacy
              </CardTitle>
              <CardDescription>
                Control optional usage summaries within this workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="border-blue-200 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  Optional summaries include record counts, aggregate cashflow, business type, and
                  platform details. They remain in this workspace; external sharing is unavailable.
                </AlertDescription>
              </Alert>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Workspace Usage Summaries</Label>
                  <div className="text-sm text-gray-600">
                    Allow collection of usage summaries in this workspace
                  </div>
                </div>
                <Switch
                  checked={analyticsEnabled}
                  onCheckedChange={handleAnalyticsToggle}
                  disabled={isUpdatingAnalytics}
                  className="data-[state=checked]:bg-green-600"
                />
              </div>

              {analyticsEnabled && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={async () => {
                      try {
                        await apiClient.collectAnalytics();
                        toast({
                          title: "Analytics Collected",
                          description: "Usage data has been collected successfully.",
                        });
                      } catch (error) {
                        toast({
                          title: "Collection Failed",
                          description: "Failed to collect analytics data.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Collect Now
                  </Button>
                </div>
              )}

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="font-semibold text-green-700 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    What We Collect
                  </h4>
                  <ul className="text-sm text-slate-700 space-y-2 ml-6">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>Customers served (count only)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>Shifts logged (count only)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>Payroll reports created</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>Total cashflow managed (aggregate)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>Business type & POS system</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>App version & platform</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-red-700 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Usage Summaries Exclude
                  </h4>
                  <ul className="text-sm text-slate-700 space-y-2 ml-6">
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-0.5">✗</span>
                      <span>Personal names or emails</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-0.5">✗</span>
                      <span>Individual tip amounts</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-0.5">✗</span>
                      <span>Employee earnings or wages</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-0.5">✗</span>
                      <span>Customer information</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-0.5">✗</span>
                      <span>Location or IP address</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-0.5">✗</span>
                      <span>Identifiable device info</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-sm text-slate-700">
                  <strong className="font-semibold">How it works:</strong> Optional usage summaries stay
                  in this workspace. Hosted collection is manual; desktop scheduling requires operator
                  configuration. External analytics sharing is unavailable in this release. Disable
                  collection at any time to stop new summaries.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>)}

        {/* Tipping Settings */}
        {canViewConfig && (<TabsContent value="tipping">
          <div className="space-y-6">
            {loadingTipping ? <p role="status">Loading saved tipping settings...</p> :
              tippingError ? <div role="alert"><p>{tippingError}</p><Button variant="outline" onClick={() => setTippingReload(value => value + 1)}>Retry loading settings</Button></div> :
              tippingSettings ? <EnhancedTippingSettings data={tippingSettings} onChange={setTippingSettings} disabled={!canEditConfig || isUpdatingTipping} /> :
              <p>Business configuration is unavailable.</p>}
            {!canEditConfig && <p className="text-sm text-slate-600">Your role can view these settings. The owner can change them.</p>}
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-end">
                  <Button 
                    onClick={handleSaveTippingSettings}
                    disabled={!canEditConfig || isUpdatingTipping || loadingTipping || !tippingSettings || !!tippingError}
                  >
                    {isUpdatingTipping ? 'Saving...' : 'Save Tipping Settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>)}

        {/* Database & Backup Settings */}
        {canConnectPos && <TabsContent value="integrations"><IntegrationsSettings /></TabsContent>}
        {canAdminister && (<TabsContent value="database">
          <DatabaseBackupSettings />
        </TabsContent>)}
      </Tabs>
    </div>
  );
};

export default Settings;
