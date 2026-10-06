// Stub AuthContext for legacy component compatibility
// ShiftMint Desktop uses LocalAuthContext instead

import { useLocalAuth } from './LocalAuthContext';

console.warn('⚠️  Legacy AuthContext accessed - use LocalAuthContext instead');

export const useAuth = () => {
  console.warn('⚠️  useAuth() called - redirecting to useLocalAuth()');
  return useLocalAuth();
}; 