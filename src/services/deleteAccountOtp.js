/**
 * Delete Account OTP Service
 *
 * Handles OTP verification for secure account deletion:
 * 1. Send OTP to current phone
 * 2. Verify OTP code
 * 3. Check rate limits
 *
 * Pattern reuses phoneChange.js for consistency
 */

import { supabase } from './supabase';

/**
 * Send OTP to user's current phone for account deletion verification
 * Uses Supabase's signInWithOtp with account_deletion context
 */
export async function sendAccountDeletionOtp(phone) {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        data: {
          purpose: 'account_deletion',
          timestamp: Date.now(),
        },
      },
    });

    if (error) {
      console.error('[DeleteAccount] Failed to send OTP:', error);
      throw error;
    }

    console.log('[DeleteAccount] OTP sent successfully');

    // Log attempt (non-blocking)
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      supabase.rpc('log_account_deletion_attempt', {
        p_user_id: user.id,
        p_step: 'otp_sent',
        p_success: true,
      }).catch(err => console.error('[DeleteAccount] Log failed:', err));
    }

    return { success: true };
  } catch (err) {
    console.error('[DeleteAccount] Exception sending OTP:', err);
    throw err;
  }
}

/**
 * Verify OTP code for account deletion
 * CRITICAL: Must use type: 'sms' for standard OTP verification
 */
export async function verifyAccountDeletionOtp(phone, token) {
  try {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    if (error) {
      console.error('[DeleteAccount] Failed to verify OTP:', error);

      // Log failure (non-blocking)
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await supabase.rpc('log_account_deletion_attempt', {
          p_user_id: user.id,
          p_step: 'otp_verified',
          p_success: false,
          p_error_message: error.message,
        }).catch(err => console.error('[DeleteAccount] Log failed:', err));
      }

      throw error;
    }

    console.log('[DeleteAccount] OTP verified successfully');

    // Log success (non-blocking)
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      await supabase.rpc('log_account_deletion_attempt', {
        p_user_id: user.id,
        p_step: 'otp_verified',
        p_success: true,
      }).catch(err => console.error('[DeleteAccount] Log failed:', err));
    }

    return {
      success: true,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    };
  } catch (err) {
    console.error('[DeleteAccount] Exception verifying OTP:', err);
    throw err;
  }
}

/**
 * Check deletion rate limit before allowing deletion attempt
 * Limit: 3 attempts per 24 hours
 */
export async function checkDeletionRateLimit() {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data } = await supabase.rpc('check_deletion_rate_limit', {
      p_user_id: user.id,
    });

    return data || { allowed: false, reason: 'unknown' };
  } catch (err) {
    console.error('[DeleteAccount] Rate limit check error:', err);
    return { allowed: false, reason: 'error', error: err.message };
  }
}

/**
 * Validate phone number format (basic international format check)
 * Reused from phoneChange service
 */
export function validatePhoneNumber(phone) {
  // Remove all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Check if it starts with + and has at least 10 digits total
  if (!cleaned.startsWith('+')) {
    return { valid: false, error: 'رقم الهاتف يجب أن يبدأ برمز الدول' };
  }

  const digitsOnly = cleaned.slice(1);
  if (digitsOnly.length < 7) {
    return { valid: false, error: 'رقم الهاتف قصير جداً' };
  }

  if (digitsOnly.length > 15) {
    return { valid: false, error: 'رقم الهاتف طويل جداً' };
  }

  return { valid: true };
}

export default {
  sendAccountDeletionOtp,
  verifyAccountDeletionOtp,
  checkDeletionRateLimit,
  validatePhoneNumber,
};
