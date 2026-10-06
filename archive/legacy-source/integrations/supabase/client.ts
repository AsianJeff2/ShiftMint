// Stub Supabase client for legacy component compatibility
// ShiftMint Desktop uses local storage instead of Supabase

console.warn('⚠️  Supabase client accessed - ShiftMint Desktop uses local storage instead');

export const supabase = {
  from: () => ({
    select: () => Promise.reject(new Error('Supabase not available - use local API instead')),
    insert: () => Promise.reject(new Error('Supabase not available - use local API instead')),
    update: () => Promise.reject(new Error('Supabase not available - use local API instead')),
    delete: () => Promise.reject(new Error('Supabase not available - use local API instead')),
  }),
  auth: {
    getUser: () => Promise.reject(new Error('Supabase auth not available - use LocalAuthContext instead')),
    signIn: () => Promise.reject(new Error('Supabase auth not available - use LocalAuthContext instead')),
    signOut: () => Promise.reject(new Error('Supabase auth not available - use LocalAuthContext instead')),
  },
}; 