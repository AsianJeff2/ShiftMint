import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import type { AuthResponse } from '@/lib/types/api-dtos';

// Auth user type from API responses (subset of full User)
type AuthUser = AuthResponse['user'];

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isConfigured: boolean;
  requiresSetup: boolean;
  error: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  setup: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    businessName: string;
    phone?: string;
    businessType?: string;
    ein?: string;
    location?: string;
    posSystem?: string;
    usageIntent?: string;
    preferredPayrollFreq?: string;
    preferredTipStyle?: string;
    acceptedTerms?: boolean;
    acceptedPrivacy?: boolean;
    analyticsConsent?: boolean;
    bootstrapToken?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const LocalAuthContext = createContext<AuthContextType | undefined>(undefined);

export const useLocalAuth = (): AuthContextType => {
  const context = useContext(LocalAuthContext);
  if (context === undefined) {
    throw new Error('useLocalAuth must be used within a LocalAuthProvider');
  }
  return context;
};

export const LocalAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [requiresSetup, setRequiresSetup] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check auth status on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      setLoading(true);
      setError(null);

      try {
        // First, check if backend is healthy
        await apiClient.healthCheck();

        // Check if setup is required
        const setupStatus = await apiClient.checkSetup();
        
        setRequiresSetup(setupStatus.needsSetup);
        setIsConfigured(!setupStatus.needsSetup);

        // If setup is not required, check for existing auth
        if (!setupStatus.needsSetup) {
          const token = localStorage.getItem('auth_token');
          if (token) {
            apiClient.setToken(token);
            try {
              const userResponse = await apiClient.getCurrentUser();
              setUser(userResponse.user);
            } catch (error) {
              localStorage.removeItem('auth_token');
              apiClient.setToken(null);
            }
          }
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Authentication check failed');
        // Set defaults for offline or connection issues
        setRequiresSetup(true);
        setIsConfigured(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const setup = async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    businessName: string;
    phone?: string;
    businessType?: string;
    ein?: string;
    location?: string;
    posSystem?: string;
    usageIntent?: string;
    preferredPayrollFreq?: string;
    preferredTipStyle?: string;
    acceptedTerms?: boolean;
    acceptedPrivacy?: boolean;
    analyticsConsent?: boolean;
    bootstrapToken?: string;
  }) => {
    setError(null);
    
    try {
      const response = await apiClient.setup(data);
      
      apiClient.setToken(response.token);
      setUser(response.user);
      setIsConfigured(true);
      setRequiresSetup(false);
      
    } catch (error) {
      throw error;
    }
  };

  const login = async (email: string, password: string, rememberMe?: boolean) => {
    setError(null);
    
    try {
      const response = await apiClient.login(email, password, rememberMe);
      
      apiClient.setToken(response.token);
      setUser(response.user);
      
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
    } finally {
      setUser(null);
      apiClient.setToken(null);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    setError(null);
    
    try {
      await apiClient.changePassword(currentPassword, newPassword);
      apiClient.setToken(null);
      setUser(null);
    } catch (error) {
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isConfigured,
    requiresSetup,
    error,
    login,
    setup,
    logout,
    changePassword,
  };

  return (
    <LocalAuthContext.Provider value={value}>
      {children}
    </LocalAuthContext.Provider>
  );
};
