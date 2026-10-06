import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { errorHandler, ErrorType } from '@/lib/error-handling';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  context?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
  retryCount: number;
}

/**
 * React Error Boundary component that catches JavaScript errors anywhere in the child
 * component tree and displays a fallback UI instead of crashing the entire app
 */
export class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error using our centralized error handler
    const appError = errorHandler.createError(
      ErrorType.CLIENT,
      `React component error: ${error.message}`,
      error,
      {
        component: this.props.context || 'UnknownComponent',
        action: 'component_render'
      }
    );

    this.setState({
      errorId: appError.id
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Component stack trace is available in appError context
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null as Error | null,
        errorId: null as string | null,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.hash = '#/dashboard';
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-xl text-gray-900">Something went wrong</CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <Alert>
                <Bug className="h-4 w-4" />
                <AlertDescription>
                  An unexpected error occurred in the application. Use the error ID below when requesting support. External error reporting is unavailable.
                </AlertDescription>
              </Alert>

              {this.state.errorId && (
                <div className="text-sm text-gray-500 text-center">
                  Error ID: {this.state.errorId}
                </div>
              )}

              <div className="space-y-2">
                {this.state.retryCount < this.maxRetries && (
                  <Button 
                    onClick={this.handleRetry} 
                    className="w-full"
                    variant="default"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again ({this.maxRetries - this.state.retryCount} attempts left)
                  </Button>
                )}

                <Button 
                  onClick={this.handleGoHome} 
                  className="w-full"
                  variant="outline"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go to Dashboard
                </Button>

                <Button 
                  onClick={this.handleReload} 
                  className="w-full"
                  variant="ghost"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Application
                </Button>
              </div>

              {import.meta.env.DEV && this.state.error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                    Technical Details (Development)
                  </summary>
                  <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-gray-800 overflow-auto max-h-40">
                    <div className="font-bold mb-2">Error Message:</div>
                    <div className="mb-3">{this.state.error.message}</div>
                    
                    {this.state.error.stack && (
                      <>
                        <div className="font-bold mb-2">Stack Trace:</div>
                        <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
                      </>
                    )}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  context?: string
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary context={context || Component.displayName || Component.name}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

/**
 * Specialized error boundary for form components
 */
export const FormErrorBoundary: React.FC<{
  children: ReactNode;
  onError?: (error: Error) => void;
}> = ({ children, onError }) => (
  <ErrorBoundary
    context="FormComponent"
    onError={onError ? (error) => onError(error) : undefined}
    fallback={
      <Alert className="my-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Unable to load this form. Please refresh the page or try again later.
        </AlertDescription>
      </Alert>
    }
  >
    {children}
  </ErrorBoundary>
);

/**
 * Specialized error boundary for data components
 */
export const DataErrorBoundary: React.FC<{
  children: ReactNode;
  onRetry?: () => void;
}> = ({ children, onRetry }) => (
  <ErrorBoundary
    context="DataComponent"
    fallback={
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Loading Error</h3>
        <p className="text-gray-600 mb-4">Unable to load the requested data.</p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);
