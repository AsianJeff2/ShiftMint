import { describe, it, expect } from 'vitest';
import { requireAuth, getBusinessId, getUserId, AuthenticatedRequest } from './express';

describe('Express Type Guards', () => {
  describe('requireAuth', () => {
    it('throws when user is undefined', () => {
      const req = { user: undefined } as AuthenticatedRequest;
      expect(() => requireAuth(req)).toThrow('Authentication required');
    });

    it('throws when user.businessId is undefined', () => {
      const req = {
        user: { id: '1', userId: '1', email: 'test@test.com', role: 'admin', businessId: '' }
      } as AuthenticatedRequest;
      expect(() => requireAuth(req)).toThrow('Authentication required');
    });

    it('passes when user exists with businessId', () => {
      const req = {
        user: {
          id: '1',
          userId: '1',
          email: 'test@test.com',
          role: 'admin',
          businessId: 'biz_1'
        }
      } as AuthenticatedRequest;

      expect(() => requireAuth(req)).not.toThrow();
    });
  });

  describe('getBusinessId', () => {
    it('throws when user is not authenticated', () => {
      const req = { user: undefined } as AuthenticatedRequest;
      expect(() => getBusinessId(req)).toThrow('Authentication required');
    });

    it('returns business ID when authenticated', () => {
      const req = {
        user: {
          id: '1',
          userId: '1',
          email: 'test@test.com',
          role: 'admin',
          businessId: 'biz_123'
        }
      } as AuthenticatedRequest;

      expect(getBusinessId(req)).toBe('biz_123');
    });
  });

  describe('getUserId', () => {
    it('throws when user is not authenticated', () => {
      const req = { user: undefined } as AuthenticatedRequest;
      expect(() => getUserId(req)).toThrow('Authentication required');
    });

    it('returns user ID when authenticated', () => {
      const req = {
        user: {
          id: 'user_456',
          userId: 'user_456',
          email: 'test@test.com',
          role: 'admin',
          businessId: 'biz_123'
        }
      } as AuthenticatedRequest;

      expect(getUserId(req)).toBe('user_456');
    });
  });
});
