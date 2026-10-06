import { Request } from 'express';

/**
 * Authenticated request with user context
 * This is the base for all protected routes
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    userId: string;
    email: string;
    role: string;
    businessId: string;
  };
}

/**
 * Request with pagination query parameters
 */
export interface PaginatedRequest extends AuthenticatedRequest {
  query: {
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
}

/**
 * Request with ID parameter
 */
export interface IdParamRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
}

/**
 * Request with date range query parameters
 */
export interface DateRangeRequest extends AuthenticatedRequest {
  query: {
    startDate?: string;
    endDate?: string;
  };
}

/**
 * Request with employee ID parameter
 */
export interface EmployeeIdRequest extends AuthenticatedRequest {
  params: {
    employeeId: string;
  };
}

/**
 * Type guard to ensure user is authenticated
 * Throws error if user is not authenticated
 */
export function requireAuth(
  req: AuthenticatedRequest
): asserts req is Required<AuthenticatedRequest> & {
  user: NonNullable<AuthenticatedRequest['user']>;
} {
  if (!req.user?.businessId) {
    throw new Error('Authentication required');
  }
}

/**
 * Safe getter for business ID from authenticated request
 * Throws if user is not authenticated
 */
export function getBusinessId(req: AuthenticatedRequest): string {
  requireAuth(req);
  return req.user.businessId;
}

/**
 * Safe getter for user ID from authenticated request
 * Throws if user is not authenticated
 */
export function getUserId(req: AuthenticatedRequest): string {
  requireAuth(req);
  return req.user.userId;
}
