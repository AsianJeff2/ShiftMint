/**
 * Centralized Error Handling System for ShiftMint
 * Provides consistent error handling, user-friendly messages, and logging
 */

export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION', 
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  DATABASE = 'DATABASE',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM', 
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  details?: any;
  timestamp: Date;
  context?: {
    component?: string;
    action?: string;
    userId?: string;
    sessionId?: string;
  };
  originalError?: Error;
  stack?: string;
}

export interface ErrorRecoveryOptions {
  retryable: boolean;
  maxRetries?: number;
  retryDelay?: number;
  fallbackAction?: () => void;
  userAction?: string;
}

/**
 * Error Handler class for creating, logging, and managing application errors
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: AppError[] = [];
  private maxLogSize = 1000;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Create a structured application error
   */
  createError(
    type: ErrorType,
    message: string,
    originalError?: Error,
    context?: AppError['context'],
    explicitUserMessage?: string
  ): AppError {
    const userMessage = explicitUserMessage || this.generateUserFriendlyMessage(type, message);
    const severity = this.determineSeverity(type, originalError);

    const appError: AppError = {
      id: this.generateErrorId(),
      type,
      severity,
      message,
      userMessage,
      timestamp: new Date(),
      context,
      originalError,
      stack: originalError?.stack || new Error().stack
    };

    this.logError(appError);
    return appError;
  }

  /**
   * Handle network errors with automatic retry logic
   */
  async handleNetworkError<T>(
    operation: () => Promise<T>,
    options: ErrorRecoveryOptions = { retryable: true, maxRetries: 3, retryDelay: 1000 }
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= (options.maxRetries || 1); attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (!this.isRetryableError(error) || attempt === (options.maxRetries || 1)) {
          break;
        }
        
        // Wait before retry
        if (options.retryDelay !== undefined) {
          await new Promise(resolve => setTimeout(resolve, options.retryDelay! * attempt));
        }
      }
    }
    
    // All retries failed, create structured error
    const appError = this.createError(
      ErrorType.NETWORK,
      `Network operation failed after ${options.maxRetries} attempts`,
      lastError!,
      { action: 'network_retry' }
    );
    
    throw appError;
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors that are worth retrying
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /connection/i,
      /server.*temporarily/i,
      /503/,
      /502/,
      /504/
    ];

    const errorMessage = error?.message || error?.toString() || '';
    const statusCode = error?.status || error?.response?.status;

    // Don't retry 4xx errors (except 408 - timeout)
    if (statusCode >= 400 && statusCode < 500 && statusCode !== 408) {
      return false;
    }

    return retryablePatterns.some(pattern => pattern.test(errorMessage)) ||
           [502, 503, 504, 408].includes(statusCode);
  }

  /**
   * Generate user-friendly error messages
   */
  private generateUserFriendlyMessage(type: ErrorType, originalMessage: string): string {
    const messageMap: Record<ErrorType, string> = {
      [ErrorType.NETWORK]: 'Unable to connect to the server. Please check your internet connection and try again.',
      [ErrorType.VALIDATION]: 'Please check the information you entered and try again.',
      [ErrorType.AUTHENTICATION]: 'Your session has expired. Please log in again.',
      [ErrorType.AUTHORIZATION]: 'You don\'t have permission to perform this action.',
      [ErrorType.NOT_FOUND]: 'The requested information could not be found.',
      [ErrorType.SERVER]: 'A server error occurred. Please try again in a few moments.',
      [ErrorType.CLIENT]: 'Something went wrong. Please try again.',
      [ErrorType.DATABASE]: 'Database error occurred. Please try again or contact support.',
      [ErrorType.BUSINESS_LOGIC]: 'This action cannot be completed due to business rules.'
    };

    // Try to extract more specific user-friendly messages from common patterns
    if (originalMessage.toLowerCase().includes('duplicate')) {
      return 'This item already exists. Please use a different name or identifier.';
    }
    
    if (originalMessage.toLowerCase().includes('required')) {
      return 'Please fill in all required fields.';
    }
    
    if (originalMessage.toLowerCase().includes('invalid email')) {
      return 'Please enter a valid email address.';
    }
    
    if (originalMessage.toLowerCase().includes('password')) {
      return 'Please check your password and try again.';
    }

    return messageMap[type] || 'An unexpected error occurred. Please try again.';
  }

  /**
   * Determine error severity based on type and context
   */
  private determineSeverity(type: ErrorType, originalError?: Error): ErrorSeverity {
    // Critical errors that break core functionality
    if (type === ErrorType.DATABASE || originalError?.name === 'DatabaseError') {
      return ErrorSeverity.CRITICAL;
    }
    
    // High severity for auth and server errors
    if ([ErrorType.AUTHENTICATION, ErrorType.SERVER].includes(type)) {
      return ErrorSeverity.HIGH;
    }
    
    // Medium for business logic and authorization
    if ([ErrorType.BUSINESS_LOGIC, ErrorType.AUTHORIZATION, ErrorType.NOT_FOUND].includes(type)) {
      return ErrorSeverity.MEDIUM;
    }
    
    // Low for validation and network (recoverable)
    return ErrorSeverity.LOW;
  }

  /**
   * Log error to console and internal log
   */
  private logError(error: AppError): void {
    // Add to internal log
    this.errorLog.unshift(error);
    
    // Maintain log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }
    
    // Console logging based on severity
    const logData = {
      id: error.id,
      type: error.type,
      severity: error.severity,
      message: error.message,
      userMessage: error.userMessage,
      context: error.context,
      timestamp: error.timestamp
    };
    
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('🚨 CRITICAL ERROR:', logData);
        break;
      case ErrorSeverity.HIGH:
        console.error('❌ HIGH SEVERITY ERROR:', logData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('⚠️ MEDIUM SEVERITY ERROR:', logData);
        break;
      default:
        console.log('ℹ️ LOW SEVERITY ERROR:', logData);
    }
    
    // In production, you could send critical errors to monitoring service
    if (error.severity === ErrorSeverity.CRITICAL) {
      this.reportCriticalError(error);
    }
  }

  /**
   * Report critical errors (placeholder for monitoring integration)
   */
  private reportCriticalError(error: AppError): void {
    // In production, integrate with error monitoring services like:
    // - Sentry
    // - LogRocket  
    // - Bugsnag
    // - Or send to analytics endpoint
    
    console.log('Critical error retained in this local session:', error.id);
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get recent errors (for debugging or error reporting UI)
   */
  getRecentErrors(count: number = 50): AppError[] {
    return this.errorLog.slice(0, count);
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    bySeverity: Record<ErrorSeverity, number>;
    byType: Record<ErrorType, number>;
    recent24Hours: number;
  } {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const bySeverity = Object.values(ErrorSeverity).reduce((acc, severity) => {
      acc[severity] = this.errorLog.filter(e => e.severity === severity).length;
      return acc;
    }, {} as Record<ErrorSeverity, number>);
    
    const byType = Object.values(ErrorType).reduce((acc, type) => {
      acc[type] = this.errorLog.filter(e => e.type === type).length;
      return acc;
    }, {} as Record<ErrorType, number>);
    
    return {
      total: this.errorLog.length,
      bySeverity,
      byType,
      recent24Hours: this.errorLog.filter(e => e.timestamp > yesterday).length
    };
  }
}

// Singleton instance
export const errorHandler = ErrorHandler.getInstance();

/**
 * Utility functions for common error handling patterns
 */

/**
 * Wrap async operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: AppError['context']
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const appError = errorHandler.createError(
      ErrorType.CLIENT,
      errorMessage(error, 'Unknown error'),
      error instanceof Error ? error : undefined,
      context
    );
    throw appError;
  }
}

/**
 * Create validation error from Zod errors
 */
export function createValidationError(zodError: any, context?: AppError['context']): AppError {
  const message = zodError.issues?.map((issue: any) => issue.message).join(', ') || 'Validation failed';
  
  return errorHandler.createError(
    ErrorType.VALIDATION,
    message,
    zodError,
    context
  );
}

/**
 * Handle API errors consistently
 */
export function handleApiError(error: any, context?: AppError['context']): AppError {
  let errorType = ErrorType.SERVER;
  let message = 'Server error occurred';
  
  const status = Number(error?.status);
  const response = error?.response && typeof error.response === 'object' ? error.response : undefined;
  const publicMessage = status >= 400 && status < 500 && typeof response?.message === 'string' && response.message.trim()
    ? response.message.replace(/[\x00-\x1F\x7F]/g, ' ').slice(0, 1000).trim() : undefined;
  if (status) {
    if (error.status === 401) {
      errorType = ErrorType.AUTHENTICATION;
      message = 'Authentication failed';
    } else if (error.status === 403) {
      errorType = ErrorType.AUTHORIZATION;
      message = 'Access denied';
    } else if (error.status === 404) {
      errorType = ErrorType.NOT_FOUND;
      message = 'Resource not found';
    } else if (error.status >= 400 && error.status < 500) {
      errorType = ErrorType.CLIENT;
      message = error.response?.message || 'Client error';
    }
  }

  if (publicMessage) message = publicMessage;
  
  if (!status && (error?.message?.includes('fetch') || error?.message?.includes('network'))) {
    errorType = ErrorType.NETWORK;
    message = 'Network connection failed';
  }
  
  const result = errorHandler.createError(errorType, message, error, context, publicMessage);
  if (status >= 400 && status < 500 && response) result.details = response;
  return result;
}

export function errorMessage(error: unknown, fallback = 'The request failed. Please try again.'): string {
  if (error && typeof error === 'object') {
    const value = error as { userMessage?: unknown; message?: unknown; details?: { shiftIds?: unknown } };
    const message = typeof value.userMessage === 'string' && value.userMessage.trim() ? value.userMessage : typeof value.message === 'string' && value.message.trim() ? value.message : fallback;
    const shiftIds = Array.isArray(value.details?.shiftIds) ? value.details.shiftIds.filter((id): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id)).slice(0, 20) : [];
    return shiftIds.length ? message + ' Shift IDs: ' + shiftIds.join(', ') + '.' : message;
  }
  return fallback;
}
