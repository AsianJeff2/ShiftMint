import { useState, useCallback, useRef, useEffect } from 'react';
import { errorHandler, ErrorType, withErrorHandling, handleApiError } from '@/lib/error-handling';
import { useToast } from '@/hooks/use-toast';

export interface ApiCallOptions {
  showErrorToast?: boolean;
  showSuccessToast?: boolean;
  successMessage?: string;
  retryOnFailure?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  context?: string;
}

export interface ApiCallState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isRetrying: boolean;
  retryCount: number;
}

/**
 * Enhanced hook for API calls with error handling, retry logic, and loading states
 */
export function useApiCall<T = any>(
  defaultOptions: ApiCallOptions = {}
) {
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [state, setState] = useState<ApiCallState<T>>({
    data: null,
    loading: false,
    error: null,
    isRetrying: false,
    retryCount: 0
  });

  const execute = useCallback(async (
    apiCall: () => Promise<T>,
    options: ApiCallOptions = {}
  ): Promise<T | null> => {
    // Merge default options with call-specific options
    const finalOptions = { ...defaultOptions, ...options };
    
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      isRetrying: prev.retryCount > 0
    }));

    try {
      let result: T;
      
      if (finalOptions.retryOnFailure) {
        // Use error handler's retry logic
        result = await errorHandler.handleNetworkError(apiCall, {
          retryable: true,
          maxRetries: finalOptions.maxRetries || 3,
          retryDelay: finalOptions.retryDelay || 1000
        });
      } else {
        // Single attempt
        result = await withErrorHandling(apiCall, {
          component: finalOptions.context,
          action: 'api_call'
        });
      }

      // Success
      setState(prev => ({
        ...prev,
        data: result,
        loading: false,
        error: null,
        retryCount: 0
      }));

      // Success toast
      if (finalOptions.showSuccessToast && finalOptions.successMessage) {
        toast({
          title: "Success",
          description: finalOptions.successMessage,
          variant: "default"
        });
      }

      // Success callback
      if (finalOptions.onSuccess) {
        finalOptions.onSuccess(result);
      }

      return result;

    } catch (error: any) {
      // Handle aborted requests
      if (error.name === 'AbortError') {
        return null;
      }

      // Create structured error
      const appError = handleApiError(error, {
        component: finalOptions.context,
        action: 'api_call'
      });

      setState(prev => ({
        ...prev,
        data: null,
        loading: false,
        error: appError.userMessage,
        retryCount: prev.retryCount + 1
      }));

      // Error toast
      if (finalOptions.showErrorToast !== false) {
        toast({
          title: "Error",
          description: appError.userMessage,
          variant: "destructive"
        });
      }

      // Error callback
      if (finalOptions.onError) {
        finalOptions.onError(appError);
      }

      return null;
    }
  }, [defaultOptions, toast]);

  const retry = useCallback(async (apiCall: () => Promise<T>) => {
    return execute(apiCall, { ...defaultOptions, retryOnFailure: false });
  }, [execute, defaultOptions]);

  const reset = useCallback(() => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setState({
      data: null,
      loading: false,
      error: null,
      isRetrying: false,
      retryCount: 0
    });
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setState(prev => ({
      ...prev,
      loading: false,
      isRetrying: false
    }));
  }, []);

  return {
    ...state,
    execute,
    retry,
    reset,
    cancel
  };
}

/**
 * Specialized hook for form submissions with validation
 */
export function useFormSubmission<T = any>(options: ApiCallOptions = {}) {
  const apiCall = useApiCall<T>({
    showErrorToast: true,
    showSuccessToast: true,
    retryOnFailure: false,
    ...options
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const submit = useCallback(async (
    submitFn: () => Promise<T>,
    formContext?: string
  ): Promise<T | null> => {
    // Clear previous validation errors
    setValidationErrors({});
    
    try {
      return await apiCall.execute(submitFn, {
        context: formContext || 'form_submission'
      });
    } catch (error: any) {
      // Handle validation errors
      if (error.type === ErrorType.VALIDATION && error.details?.issues) {
        const fieldErrors: Record<string, string> = {};
        error.details.issues.forEach((issue: any) => {
          if (issue.path && issue.path.length > 0) {
            fieldErrors[issue.path[0]] = issue.message;
          }
        });
        setValidationErrors(fieldErrors);
      }
      return null;
    }
  }, [apiCall]);

  const clearValidationErrors = useCallback(() => {
    setValidationErrors({});
  }, []);

  return {
    ...apiCall,
    validationErrors,
    submit,
    clearValidationErrors
  };
}

/**
 * Hook for data fetching with automatic loading states
 */
export function useDataFetch<T = any>(
  fetchFn: () => Promise<T>,
  dependencies: any[] = [],
  options: ApiCallOptions = {}
) {
  const apiCall = useApiCall<T>({
    showErrorToast: false, // Don't show toast for data fetching by default
    retryOnFailure: true,
    maxRetries: 2,
    ...options
  });

  const [hasLoaded, setHasLoaded] = useState(false);

  const fetch = useCallback(async () => {
    const result = await apiCall.execute(fetchFn, {
      context: options.context || 'data_fetch'
    });
    
    if (result !== null) {
      setHasLoaded(true);
    }
    
    return result;
  }, [apiCall, fetchFn, options.context]);

  const refetch = useCallback(() => {
    setHasLoaded(false);
    return fetch();
  }, [fetch]);

  // Auto-fetch on mount and dependency changes
  useEffect(() => {
    fetch();
  }, dependencies);

  return {
    ...apiCall,
    fetch,
    refetch,
    hasLoaded,
    isEmpty: hasLoaded && !apiCall.loading && !apiCall.data
  };
}

/**
 * Hook for optimistic updates with rollback on failure
 */
export function useOptimisticUpdate<T = any>(options: ApiCallOptions = {}) {
  const apiCall = useApiCall<T>(options);
  const [optimisticData, setOptimisticData] = useState<T | null>(null);
  const [originalData, setOriginalData] = useState<T | null>(null);

  const executeOptimistic = useCallback(async (
    updateFn: () => Promise<T>,
    optimisticValue: T,
    context?: string
  ): Promise<T | null> => {
    // Store original data for rollback
    setOriginalData(apiCall.data);
    
    // Apply optimistic update
    setOptimisticData(optimisticValue);
    
    try {
      const result = await apiCall.execute(updateFn, {
        context: context || 'optimistic_update'
      });
      
      // Success - clear optimistic data
      setOptimisticData(null);
      setOriginalData(null);
      
      return result;
    } catch (error) {
      // Failure - rollback to original data
      setOptimisticData(null);
      if (originalData !== null) {
        // The apiCall state will be updated with error, but we could restore data here if needed
      }
      return null;
    }
  }, [apiCall, originalData]);

  return {
    ...apiCall,
    data: optimisticData || apiCall.data,
    executeOptimistic,
    isOptimistic: optimisticData !== null
  };
}