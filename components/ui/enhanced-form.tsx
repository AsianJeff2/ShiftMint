import React from 'react';
import { useForm, UseFormReturn, FieldValues, DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useFormSubmission } from '@/hooks/useApiCall';
import { createValidationError } from '@/lib/error-handling';

export interface EnhancedFormProps<T extends FieldValues> {
  schema: z.ZodType<T, T>;
  defaultValues: DefaultValues<T>;
  onSubmit: (data: T) => Promise<any>;
  children: (form: UseFormReturn<T>) => React.ReactNode;
  className?: string;
  submitButtonText?: string;
  showSuccessMessage?: boolean;
  successMessage?: string;
  context?: string;
  disabled?: boolean;
}

/**
 * Enhanced form component with built-in error handling, validation, and loading states
 */
export function EnhancedForm<T extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  children,
  className,
  submitButtonText = 'Submit',
  showSuccessMessage = true,
  successMessage,
  context,
  disabled = false
}: EnhancedFormProps<T>) {
  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onChange' // Enable real-time validation
  });

  const {
    submit,
    loading,
    error,
    validationErrors,
    clearValidationErrors
  } = useFormSubmission({
    showSuccessToast: showSuccessMessage,
    successMessage: successMessage || 'Operation completed successfully',
    context: context || 'form'
  });

  const handleSubmit = async (data: T) => {
    // Clear any previous validation errors
    clearValidationErrors();
    
    try {
      await submit(() => onSubmit(data), context);
      
      // Reset form on successful submission (optional)
      // form.reset();
    } catch (err) {
      // Additional error handling if needed
      console.error('Form submission error:', err);
    }
  };

  // Apply server-side validation errors to form fields
  React.useEffect(() => {
    Object.entries(validationErrors).forEach(([field, message]) => {
      form.setError(field as any, {
        type: 'server',
        message: message as string
      });
    });
  }, [validationErrors, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className={className}>
        {/* General error message */}
        {error && (
          <Alert className="mb-4" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Form fields */}
        {children(form)}

        {/* Submit button */}
        <Button 
          type="submit" 
          disabled={disabled || loading || !form.formState.isValid}
          className="w-full mt-6"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitButtonText}
        </Button>
      </form>
    </Form>
  );
}

/**
 * Enhanced form field component with better error handling
 */
export interface EnhancedFormFieldProps {
  form: UseFormReturn<any>;
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function EnhancedFormField({
  form,
  name,
  label,
  type = 'text',
  placeholder,
  description,
  required = false,
  disabled = false,
  className
}: EnhancedFormFieldProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={className}>
          <FormLabel className={required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>
            {label}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              type={type}
              placeholder={placeholder}
              disabled={disabled}
              className={fieldState.error ? 'border-red-500' : ''}
              value={field.value || ''}
              onChange={(e) => {
                field.onChange(type === 'number' ? parseFloat(e.target.value) : e.target.value);
              }}
            />
          </FormControl>
          {description && (
            <p className="text-sm text-gray-600">{description}</p>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Enhanced textarea field
 */
export interface EnhancedTextareaFieldProps {
  form: UseFormReturn<any>;
  name: string;
  label: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  className?: string;
}

export function EnhancedTextareaField({
  form,
  name,
  label,
  placeholder,
  description,
  required = false,
  disabled = false,
  rows = 3,
  className
}: EnhancedTextareaFieldProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={className}>
          <FormLabel className={required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>
            {label}
          </FormLabel>
          <FormControl>
            <Textarea
              {...field}
              placeholder={placeholder}
              disabled={disabled}
              rows={rows}
              className={fieldState.error ? 'border-red-500' : ''}
              value={field.value || ''}
            />
          </FormControl>
          {description && (
            <p className="text-sm text-gray-600">{description}</p>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Enhanced select field
 */
export interface EnhancedSelectFieldProps {
  form: UseFormReturn<any>;
  name: string;
  label: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  options: { value: string; label: string }[];
  className?: string;
}

export function EnhancedSelectField({
  form,
  name,
  label,
  placeholder = "Select an option",
  description,
  required = false,
  disabled = false,
  options,
  className
}: EnhancedSelectFieldProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={className}>
          <FormLabel className={required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>
            {label}
          </FormLabel>
          <Select 
            onValueChange={field.onChange} 
            defaultValue={field.value}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger className={fieldState.error ? 'border-red-500' : ''}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && (
            <p className="text-sm text-gray-600">{description}</p>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Enhanced switch field
 */
export interface EnhancedSwitchFieldProps {
  form: UseFormReturn<any>;
  name: string;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function EnhancedSwitchField({
  form,
  name,
  label,
  description,
  disabled = false,
  className
}: EnhancedSwitchFieldProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={`flex flex-row items-center justify-between rounded-lg border p-4 ${className}`}>
          <div className="space-y-0.5">
            <FormLabel className="text-base">{label}</FormLabel>
            {description && (
              <p className="text-sm text-gray-600">{description}</p>
            )}
          </div>
          <FormControl>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

/**
 * Form validation helper functions
 */
export const commonValidation = {
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number'),
  currency: z.number().min(0, 'Amount must be positive').max(999999, 'Amount is too large'),
  percentage: z.number().min(0, 'Percentage must be positive').max(100, 'Percentage cannot exceed 100%'),
  required: z.string().min(1, 'This field is required'),
  optionalString: z.string().optional(),
  positiveNumber: z.number().min(0, 'Value must be positive'),
  date: z.string().refine((date) => {
    return new Date(date).toString() !== 'Invalid Date';
  }, 'Please enter a valid date')
};

/**
 * Pre-built validation schemas for common forms
 */
export const validationSchemas = {
  employee: z.object({
    firstName: commonValidation.required,
    lastName: commonValidation.required,
    email: commonValidation.email,
    phone: commonValidation.optionalString,
    hourlyRate: commonValidation.currency,
    role: commonValidation.required,
    department: commonValidation.optionalString,
    startDate: commonValidation.date,
    status: z.enum(['active', 'inactive', 'terminated']),
    tipEligible: z.boolean(),
    payType: z.enum(['hourly', 'salary'])
  }),
  
  tip: z.object({
    amount: commonValidation.currency,
    tipType: z.enum(['cash', 'credit', 'other']),
    notes: commonValidation.optionalString,
    tableNumber: commonValidation.optionalString
  }),
  
  shift: z.object({
    startTime: z.string().min(1, 'Start time is required'),
    endTime: z.string().min(1, 'End time is required'),
    jobCode: commonValidation.required,
    totalSales: commonValidation.currency,
    totalTips: commonValidation.currency,
    notes: commonValidation.optionalString
  })
};
