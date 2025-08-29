import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use environment variables or fallback to hardcoded values
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ezkioroyhzpavmbfavyn.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6a2lvcm95aHpwYXZtYmZhdnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0OTI2MjAsImV4cCI6MjA3MjA2ODYyMH0.-9bUFjeXEwAcdl1d8fj7dX1ZmHMCpuX5TdzmFTOwO-Q';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper function to handle errors
export const handleSupabaseError = (error) => {
  console.error('Supabase error:', error);
  
  if (error.code === 'PGRST301') {
    return 'No data found';
  }
  
  if (error.code === '23505') {
    return 'This record already exists';
  }
  
  if (error.code === '23503') {
    return 'Cannot delete - this record is referenced by other data';
  }
  
  return error.message || 'An unexpected error occurred';
};