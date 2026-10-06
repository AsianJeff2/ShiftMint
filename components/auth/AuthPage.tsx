import React, { useState, useEffect } from 'react';
import { useLocalAuth } from '@/contexts/LocalAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { errorMessage } from '@/lib/error-handling';
import { 
  AlertCircle, 
  Building, 
  User, 
  Mail, 
  Lock, 
  Phone, 
  MapPin,
  CreditCard,
  Target,
  Shield,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';

interface AuthFormData {
  // Account basics
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  rememberMe: boolean;
  
  // Personal info
  firstName: string;
  lastName: string;
  
  // Business info
  businessName: string;
  businessType: string;
  ein: string;
  location: string;
  posSystem: string;
  usageIntent: string;
  
  // Profile preferences
  preferredPayrollFreq: string;
  preferredTipStyle: string;
  
  // Legal compliance
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  analyticsConsent: boolean;
}

const businessTypes = [
  'restaurant',
  'bar',
  'café',
  'food_truck',
  'catering',
  'hotel',
  'other'
];

const posSystemOptions = [
  'square', 'toast', 'clover', 'resy', 'aloha', 'micros', 'other', 'none'
];

const usageIntentOptions = [
  'tip_tracking',
  'payroll_management', 
  'labor_analytics',
  'compliance',
  'all_features'
];

const payrollFrequencies = [
  'weekly',
  'bi-weekly',
  'semi-monthly',
  'monthly'
];

const tipStyles = [
  'cash',
  'pos',
  'hybrid',
  'hourly'
];

const AuthPage: React.FC = () => {
  const isDesktop = 'electronAPI' in window;
  const [bootstrapToken, setBootstrapToken] = useState('');
  const { login, setup, loading } = useLocalAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<'auth' | 'business' | 'profile' | 'complete'>(mode === 'login' ? 'auth' : 'auth');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const MAX_ATTEMPTS = 5;
  
  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    rememberMe: false,
    firstName: '',
    lastName: '',
    businessName: '',
    businessType: '',
    ein: '',
    location: '',
    posSystem: '',
    usageIntent: '',
    preferredPayrollFreq: 'bi-weekly',
    preferredTipStyle: 'hybrid',
    acceptedTerms: false,
    acceptedPrivacy: false,
    analyticsConsent: false
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: ''
  });

  // Calculate progress for multi-step signup
  const getProgress = () => {
    if (mode === 'login') return 100;
    
    switch (step) {
      case 'auth': return 25;
      case 'business': return 50;
      case 'profile': return 75;
      case 'complete': return 100;
      default: return 0;
    }
  };

  // Password strength validation
  useEffect(() => {
    if (formData.password) {
      let score = 0;
      let feedback = '';
      
      if (formData.password.length >= 8) score += 1;
      if (/[A-Z]/.test(formData.password)) score += 1;
      if (/[a-z]/.test(formData.password)) score += 1;
      if (/[0-9]/.test(formData.password)) score += 1;
      if (/[^A-Za-z0-9]/.test(formData.password)) score += 1;
      
      if (score < 2) feedback = 'Weak - Add uppercase, numbers, or symbols';
      else if (score < 4) feedback = 'Fair - Consider adding more variety';
      else feedback = 'Strong - Great password!';
      
      setPasswordStrength({ score, feedback });
    }
  }, [formData.password]);

  // Email validation with debounce
  const [emailDebounceTimer, setEmailDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    if (formData.email && emailDebounceTimer) {
      clearTimeout(emailDebounceTimer);
    }
    
    if (formData.email) {
      const timer = setTimeout(() => {
        validateEmail(formData.email);
      }, 500);
      setEmailDebounceTimer(timer);
    }
    
    return () => {
      if (emailDebounceTimer) clearTimeout(emailDebounceTimer);
    };
  }, [formData.email]);

  const validateEmail = (email: string) => {
    if (!email) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
    } else {
      setErrors(prev => ({ ...prev, email: '' }));
    }
  };

  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 'auth') {
      // Email validation
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }

      // Phone validation for signup
      if (mode === 'signup' && formData.phone && !/^\+?[\d\s\-\(\)]+$/.test(formData.phone)) {
        newErrors.phone = 'Please enter a valid phone number';
      }

      // Password validation
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (mode === 'signup' && formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters long';
      }

      // Confirm password for signup
      if (mode === 'signup') {
        if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = 'Passwords do not match';
        }
        
        if (!formData.firstName.trim()) {
          newErrors.firstName = 'First name is required';
        }
        
        if (!formData.lastName.trim()) {
          newErrors.lastName = 'Last name is required';
        }
      }
    }
    
    if (step === 'business' && mode === 'signup') {
      if (!formData.businessName.trim()) {
        newErrors.businessName = 'Business name is required';
      }
      
      if (!formData.businessType) {
        newErrors.businessType = 'Please select your business type';
      }
    }
    
    if (step === 'profile' && mode === 'signup') {
      if (!formData.acceptedTerms) {
        newErrors.acceptedTerms = 'Please acknowledge the payroll estimate notice';
      }
      
      if (!formData.acceptedPrivacy) {
        newErrors.acceptedPrivacy = 'Please acknowledge the workspace privacy notice';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof AuthFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    
    if (step === 'auth') setStep('business');
    else if (step === 'business') setStep('profile');
    else if (step === 'profile') setStep('complete');
  };

  const handleBack = () => {
    if (step === 'business') setStep('auth');
    else if (step === 'profile') setStep('business');
    else if (step === 'complete') setStep('profile');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (failedAttempts >= MAX_ATTEMPTS) {
      setErrors({ submit: 'Too many failed attempts. Please wait before trying again.' });
      return;
    }

    if (!validateCurrentStep()) return;

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await login(formData.email.trim().toLowerCase(), formData.password, formData.rememberMe);
        
        // Reset failed attempts on successful login
        setFailedAttempts(0);
      } else {
        // Multi-step signup completion
        if (step !== 'complete') {
          handleNext();
          return;
        }
        
        await setup({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          businessName: formData.businessName.trim(),
          phone: formData.phone.trim(),
          businessType: formData.businessType,
          ein: formData.ein.trim(),
          location: formData.location.trim(),
          posSystem: formData.posSystem,
          usageIntent: formData.usageIntent,
          preferredPayrollFreq: formData.preferredPayrollFreq,
          preferredTipStyle: formData.preferredTipStyle,
          acceptedTerms: formData.acceptedTerms,
          acceptedPrivacy: formData.acceptedPrivacy,
          bootstrapToken: bootstrapToken || undefined,
          analyticsConsent: formData.analyticsConsent
        });
      }
    } catch (error) {
      setFailedAttempts(prev => prev + 1);
      setErrors({
        submit: errorMessage(error, mode === 'login' ? 'Login failed. Please check your credentials.' : 'Setup failed. Please try again.')
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e as any);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <Building className="w-8 h-8 text-white" />
          </div>
          
          <CardTitle className="text-2xl">
            {mode === 'login' ? 'Welcome Back' : 'Welcome to ShiftMint'}
          </CardTitle>
          
          <CardDescription>
            {mode === 'login' 
              ? 'Sign in to your ShiftMint account'
              : 'Set up your tip tracking and payroll management system'
            }
          </CardDescription>
          
          {mode === 'signup' && (
            <div className="mt-4">
              <Progress value={getProgress()} className="w-full" />
              <p className="text-sm text-gray-500 mt-2">
                Step {step === 'auth' ? '1' : step === 'business' ? '2' : step === 'profile' ? '3' : '4'} of 4
              </p>
            </div>
          )}
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Auth Step */}
            {step === 'auth' && (
              <div className="space-y-4">
                {/* Mode Toggle */}
                <div className="flex justify-center space-x-1 bg-gray-100 rounded-lg p-1">
                  <Button
                    type="button"
                    variant={mode === 'login' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setMode('login');
                      setStep('auth');
                      setErrors({});
                    }}
                    className="flex-1"
                  >
                    Sign In
                  </Button>
                  <Button
                    type="button"
                    variant={mode === 'signup' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setMode('signup');
                      setStep('auth');
                      setErrors({});
                    }}
                    className="flex-1"
                  >
                    Sign Up
                  </Button>
                </div>

                {/* Personal Info for Signup */}
                {mode === 'signup' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        First Name *
                      </Label>
                      <Input
                        id="firstName"
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className={errors.firstName ? 'border-red-500' : ''}
                        placeholder="John"
                        autoFocus
                      />
                      {errors.firstName && (
                        <p className="text-sm text-red-500">{errors.firstName}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className={errors.lastName ? 'border-red-500' : ''}
                        placeholder="Doe"
                      />
                      {errors.lastName && (
                        <p className="text-sm text-red-500">{errors.lastName}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Address *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    onKeyDown={handleKeyDown}
                    className={errors.email ? 'border-red-500' : ''}
                    placeholder="your.email@restaurant.com"
                    autoComplete="email"
                    autoFocus={mode === 'login'}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500">{errors.email}</p>
                  )}
                </div>

                {/* Phone for Signup */}
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Phone Number (Optional)
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className={errors.phone ? 'border-red-500' : ''}
                      placeholder="+1 (555) 123-4567"
                    />
                    {errors.phone && (
                      <p className="text-sm text-red-500">{errors.phone}</p>
                    )}
                  </div>
                )}

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Password *
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      onKeyDown={handleKeyDown}
                      className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
                      placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  {/* Password Strength for Signup */}
                  {mode === 'signup' && formData.password && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded ${
                              level <= passwordStrength.score
                                ? passwordStrength.score < 3
                                  ? 'bg-red-500'
                                  : passwordStrength.score < 4
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                                : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">{passwordStrength.feedback}</p>
                    </div>
                  )}
                  
                  {errors.password && (
                    <p className="text-sm text-red-500">{errors.password}</p>
                  )}
                </div>

                {/* Confirm Password for Signup */}
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        className={errors.confirmPassword ? 'border-red-500 pr-10' : 'pr-10'}
                        placeholder="Confirm your password"
                        autoComplete="new-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-sm text-red-500">{errors.confirmPassword}</p>
                    )}
                  </div>
                )}

                {/* Remember Me for Login */}
                {mode === 'login' && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="rememberMe"
                      checked={formData.rememberMe}
                      onCheckedChange={(checked) => handleInputChange('rememberMe', checked as boolean)}
                    />
                    <Label htmlFor="rememberMe" className="text-sm">
                      Remember me for 30 days
                    </Label>
                  </div>
                )}
              </div>
            )}

            {/* Business Step */}
            {step === 'business' && mode === 'signup' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Building className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">Business Information</h3>
                </div>

                <div className="space-y-2">
                      <Label htmlFor="bootstrapToken">Workspace setup code</Label>
                      <Input id="bootstrapToken" type="password" autoComplete="off" value={bootstrapToken} onChange={event => setBootstrapToken(event.target.value)} />
                      <p className="text-xs text-muted-foreground">Required for the first account on a hosted workspace. Your deployment administrator supplies this code.</p>
                    </div>
                    <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input
                    id="businessName"
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => handleInputChange('businessName', e.target.value)}
                    className={errors.businessName ? 'border-red-500' : ''}
                    placeholder="e.g., Joe's Restaurant"
                  />
                  {errors.businessName && (
                    <p className="text-sm text-red-500">{errors.businessName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessType">Business Type *</Label>
                  <Select value={formData.businessType} onValueChange={(value) => handleInputChange('businessType', value)}>
                    <SelectTrigger className={errors.businessType ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select your business type" />
                    </SelectTrigger>
                    <SelectContent>
                      {businessTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.businessType && (
                    <p className="text-sm text-red-500">{errors.businessType}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ein">EIN (Optional)</Label>
                    <Input
                      id="ein"
                      type="text"
                      value={formData.ein}
                      onChange={(e) => handleInputChange('ein', e.target.value)}
                      placeholder="12-3456789"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="location" className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Location
                    </Label>
                    <Input
                      id="location"
                      type="text"
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      placeholder="City, State"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="posSystem" className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    POS System (Optional)
                  </Label>
                  <Select value={formData.posSystem} onValueChange={(value) => handleInputChange('posSystem', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="What POS system do you use?" />
                    </SelectTrigger>
                    <SelectContent>
                      {posSystemOptions.map((pos) => (
                        <SelectItem key={pos} value={pos}>
                          {pos.charAt(0).toUpperCase() + pos.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="usageIntent" className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Why are you using ShiftMint?
                  </Label>
                  <Select value={formData.usageIntent} onValueChange={(value) => handleInputChange('usageIntent', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your primary use case" />
                    </SelectTrigger>
                    <SelectContent>
                      {usageIntentOptions.map((intent) => (
                        <SelectItem key={intent} value={intent}>
                          {intent.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Profile Step */}
            {step === 'profile' && mode === 'signup' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">Profile Preferences</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="preferredPayrollFreq">Payroll Frequency</Label>
                    <Select value={formData.preferredPayrollFreq} onValueChange={(value) => handleInputChange('preferredPayrollFreq', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {payrollFrequencies.map((freq) => (
                          <SelectItem key={freq} value={freq}>
                            {freq.charAt(0).toUpperCase() + freq.slice(1).replace('-', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preferredTipStyle">Tip Tracking Style</Label>
                    <Select value={formData.preferredTipStyle} onValueChange={(value) => handleInputChange('preferredTipStyle', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tipStyles.map((style) => (
                          <SelectItem key={style} value={style}>
                            {style.charAt(0).toUpperCase() + style.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Legal Compliance */}
                <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <h4 className="font-semibold">Workspace Use & Privacy</h4>
                  </div>

                  <p className="text-sm text-gray-700">
                    Payroll figures are estimates for review. ShiftMint does not pay employees or file taxes.
                    Desktop workspaces store records on the device; hosted workspaces store records on the
                    configured server. Connecting a POS provider sends requests to that provider when you
                    validate credentials or preview data. External analytics sharing is unavailable in this release.
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="acceptedTerms"
                        checked={formData.acceptedTerms}
                        onCheckedChange={(checked) => handleInputChange('acceptedTerms', checked as boolean)}
                        className={errors.acceptedTerms ? 'border-red-500' : ''}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="acceptedTerms" className="text-sm leading-relaxed">
                          I understand payroll figures require review before payment. *
                        </Label>
                        {errors.acceptedTerms && (
                          <p className="text-xs text-red-500">{errors.acceptedTerms}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="acceptedPrivacy"
                        checked={formData.acceptedPrivacy}
                        onCheckedChange={(checked) => handleInputChange('acceptedPrivacy', checked as boolean)}
                        className={errors.acceptedPrivacy ? 'border-red-500' : ''}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="acceptedPrivacy" className="text-sm leading-relaxed">
                          I understand where workspace records are stored and how connected POS data is accessed. *
                        </Label>
                        {errors.acceptedPrivacy && (
                          <p className="text-xs text-red-500">{errors.acceptedPrivacy}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="analyticsConsent"
                        checked={formData.analyticsConsent}
                        onCheckedChange={(checked) => handleInputChange('analyticsConsent', checked as boolean)}
                      />
                      <Label htmlFor="analyticsConsent" className="text-sm leading-relaxed">
                        Allow optional usage summaries within this workspace (Optional)
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Complete Step */}
            {step === 'complete' && mode === 'signup' && (
              <div className="text-center space-y-4">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold">Ready to Complete Setup</h3>
                  <p className="text-gray-600">
                    Review your information and click below to create your ShiftMint account.
                  </p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg text-left space-y-2">
                  <p><strong>Business:</strong> {formData.businessName}</p>
                  <p><strong>Owner:</strong> {formData.firstName} {formData.lastName}</p>
                  <p><strong>Email:</strong> {formData.email}</p>
                  <p><strong>Type:</strong> {formData.businessType}</p>
                </div>
              </div>
            )}

            {/* Error Messages */}
            {errors.submit && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors.submit}</AlertDescription>
              </Alert>
            )}

            {/* Rate Limiting Warning */}
            {failedAttempts >= 3 && failedAttempts < MAX_ATTEMPTS && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {MAX_ATTEMPTS - failedAttempts} attempt(s) remaining before account is temporarily locked.
                </AlertDescription>
              </Alert>
            )}

            {/* Local Security Notice */}
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Workspace privacy:</strong> {isDesktop
                  ? 'Records are stored on this device. Connected POS features use the internet.'
                  : 'Records are stored on the server hosting this workspace. Connected POS features access the selected provider.'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {step !== 'auth' && mode === 'signup' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1"
                >
                  Back
                </Button>
              )}
              
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitting || failedAttempts >= MAX_ATTEMPTS}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {mode === 'login' ? 'Signing in...' : 
                     step === 'complete' ? 'Creating Account...' : 'Continue'}
                  </>
                ) : (
                  mode === 'login' ? 'Sign In' :
                  step === 'complete' ? 'Create Account' : 'Continue'
                )}
              </Button>
            </div>

            {/* Footer Links */}
            {mode === 'login' && (
              <div className="text-center text-sm text-gray-600">
                <p>Forgot your password? Contact your system administrator.</p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
