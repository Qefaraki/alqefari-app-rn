import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { wrapRPCWithLogging } from '../utils/rpcLogger';

// Use environment variables or fallback to hardcoded values
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ezkioroyhzpavmbfavyn.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6a2lvcm95aHpwYXZtYmZhdnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0OTI2MjAsImV4cCI6MjA3MjA2ODYyMH0.-9bUFjeXEwAcdl1d8fj7dX1ZmHMCpuX5TdzmFTOwO-Q';

// Create Supabase client
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Wrap RPC with comprehensive logging (only in development)
const originalRpc = supabaseClient.rpc.bind(supabaseClient);
if (__DEV__) {
  supabaseClient.rpc = wrapRPCWithLogging(originalRpc);
}

export const supabase = supabaseClient;

/**
 * Handle Supabase errors with network-aware detection
 *
 * Returns structured error object with:
 * - type: 'network' | 'timeout' | 'server' | 'validation' | 'unknown'
 * - message: User-friendly Arabic error message
 * - originalError: Original error object for debugging
 *
 * Network error types detected:
 * - NETWORK_OFFLINE: Device is offline
 * - NETWORK_TIMEOUT: Timeout or slow connection
 * - Network request failed: Fetch error
 * - TypeError: Likely network-related
 *
 * @param {Error} error - Error object from Supabase or fetch
 * @returns {Object} - Structured error { type, message, originalError }
 */
export const handleSupabaseError = (error) => {
  console.error('Supabase error:', error);

  const errorMessage = error?.message || '';
  const errorCode = error?.code || '';

  // Network error: Explicit offline
  if (errorMessage === 'NETWORK_OFFLINE') {
    return {
      type: 'network',
      message: 'لا يوجد اتصال بالإنترنت. تحقق من اتصالك وحاول مرة أخرى',
      originalError: error,
    };
  }

  // Network error: Timeout
  if (errorMessage.includes('NETWORK_TIMEOUT') || errorMessage.includes('timeout')) {
    return {
      type: 'timeout',
      message: 'الاتصال بطيء جداً. حاول مرة أخرى',
      originalError: error,
    };
  }

  // Network error: Fetch failed
  if (
    errorMessage.includes('Network request failed') ||
    errorMessage.includes('fetch') ||
    error?.name === 'TypeError'
  ) {
    return {
      type: 'network',
      message: 'لا يوجد اتصال بالإنترنت. تحقق من اتصالك وحاول مرة أخرى',
      originalError: error,
    };
  }

  // Database validation errors
  if (errorCode === 'PGRST301') {
    return {
      type: 'validation',
      message: 'لم تجد البيانات. قد تكون تم حذفها',
      originalError: error,
    };
  }

  if (errorCode === '23505') {
    return {
      type: 'validation',
      message: 'هذا السجل موجود بالفعل',
      originalError: error,
    };
  }

  if (errorCode === '23503') {
    return {
      type: 'validation',
      message: 'لا يمكن حذفه - هناك بيانات أخرى تعتمد عليه',
      originalError: error,
    };
  }

  // Permission errors
  if (errorCode === 'PGRST204' || errorMessage.includes('permission')) {
    return {
      type: 'validation',
      message: 'ليس لديك الصلاحيات اللازمة لهذه العملية',
      originalError: error,
    };
  }

  // Generic server error
  return {
    type: 'server',
    message: errorMessage || 'حدث خطأ غير متوقع. حاول مرة أخرى',
    originalError: error,
  };
};