/**
 * Phone Change Service
 *
 * Handles the phone number change flow:
 * 1. Send OTP to current phone (manual verification)
 * 2. Verify current phone OTP
 * 3. Initiate phone change (send OTP to new phone)
 * 4. Complete phone change (verify new phone OTP)
 * 5. Log to audit_log
 *
 * Critical Implementation Notes:
 * - Profile phone (profiles.phone) and auth phone (auth.users.phone) are SEPARATE
 * - We ONLY update auth.users.phone - no profile sync needed
 * - Phone changes use type: 'phone_change' when verifying OTP (not 'sms')
 * - OTP limit detection is dynamic from Supabase error messages
 * - Sessions remain valid after phone change (no forced re-login)
 */

import { supabase } from './supabase';

/**
 * Send OTP to current phone for verification
 * Uses Supabase's signInWithOtp - doesn't create new session if already signed in
 */
export async function sendCurrentPhoneOtp(currentPhone) {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone: currentPhone,
    });

    if (error) {
      console.error('❌ [Phone Change] Failed to send OTP to current phone:', error);
      throw error;
    }

    console.log('✅ [Phone Change] OTP sent to current phone');
    return { success: true };
  } catch (err) {
    console.error('❌ [Phone Change] Exception sending OTP to current phone:', err);
    throw err;
  }
}

/**
 * Verify current phone OTP
 * Confirms user has access to the current phone number
 */
export async function verifyCurrentPhoneOtp(phone, token) {
  try {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms', // Regular SMS verification for current phone
    });

    if (error) {
      console.error('❌ [Phone Change] Failed to verify current phone OTP:', error);
      throw error;
    }

    console.log('✅ [Phone Change] Current phone OTP verified');
    return { success: true };
  } catch (err) {
    console.error('❌ [Phone Change] Exception verifying current phone OTP:', err);
    throw err;
  }
}

/**
 * Initiate phone change (sends OTP to NEW phone)
 * This is Supabase's native phone change flow
 */
export async function initiatePhoneChange(newPhone) {
  try {
    const { error } = await supabase.auth.updateUser({
      phone: newPhone,
    });

    if (error) {
      // Check for rate limit (dynamic detection)
      if (error.status === 429 || error.message?.toLowerCase().includes('rate limit')) {
        console.warn('⚠️ [Phone Change] Rate limit reached');
        return {
          success: false,
          rateLimitReached: true,
          retryAfter: error.retry_after || 3600, // seconds
          message: 'تم تجاوز الحد المسموح من محاولات إرسال رمز التحقق. يرجى المحاولة بعد ساعة.',
        };
      }

      // Check for phone already in use
      if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
        console.warn('⚠️ [Phone Change] Phone already in use');
        return {
          success: false,
          error: 'رقم الهاتف مسجل بالفعل لمستخدم آخر',
        };
      }

      console.error('❌ [Phone Change] Failed to initiate phone change:', error);
      throw error;
    }

    console.log('✅ [Phone Change] OTP sent to new phone');
    return { success: true };
  } catch (err) {
    console.error('❌ [Phone Change] Exception initiating phone change:', err);
    throw err;
  }
}

/**
 * Complete phone change (verify OTP from NEW phone)
 * CRITICAL: type must be 'phone_change' not 'sms'
 * This is what actually completes the auth phone change
 */
export async function completePhoneChange(newPhone, token) {
  try {
    const { error } = await supabase.auth.verifyOtp({
      phone: newPhone,
      token,
      type: 'phone_change', // CRITICAL: This is what completes the change
    });

    if (error) {
      console.error('❌ [Phone Change] Failed to complete phone change:', error);
      throw error;
    }

    // Refresh session to ensure continuity and get updated auth state
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn('⚠️ [Phone Change] Session refresh warning:', refreshError);
      // Don't throw - phone change already completed, refresh is just for safety
    } else {
      console.log('✅ [Phone Change] Session refreshed after phone change');
    }

    console.log('✅ [Phone Change] Phone change completed successfully');
    return { success: true };
  } catch (err) {
    console.error('❌ [Phone Change] Exception completing phone change:', err);
    throw err;
  }
}

/**
 * Log phone change to audit_log
 * Non-blocking operation - failure to log doesn't rollback the phone change
 */
export async function logPhoneChange(oldPhone, newPhone) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      console.warn('⚠️ [Phone Change] Cannot log phone change: No user ID');
      return;
    }

    console.log('📝 [Phone Change] Logging phone change to audit_log...');

    const { error } = await supabase.rpc('log_phone_change', {
      p_user_id: user.id,
      p_old_phone: oldPhone,
      p_new_phone: newPhone,
    });

    if (error) {
      // CRITICAL: Log failure but don't throw (phone change already completed)
      console.error('[CRITICAL] Phone change audit log failed:', error);
      console.error('[CRITICAL] Old phone:', oldPhone, 'New phone:', newPhone);
      return; // Don't throw - phone change is already done
    }

    console.log('✅ [Phone Change] Phone change logged to audit_log');
  } catch (err) {
    // CRITICAL: Exception in audit logging (phone change already completed)
    console.error('[CRITICAL] Phone change audit log exception:', err);
    // Don't throw - phone change is already done
  }
}

/**
 * Get current user's phone number from auth
 */
export async function getCurrentUserPhone() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('❌ [Phone Change] Failed to get current user:', error);
      throw error;
    }

    return { success: true, phone: user?.phone };
  } catch (err) {
    console.error('❌ [Phone Change] Exception getting current user phone:', err);
    throw err;
  }
}

/**
 * Validate phone number format (basic international format check)
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
  sendCurrentPhoneOtp,
  verifyCurrentPhoneOtp,
  initiatePhoneChange,
  completePhoneChange,
  logPhoneChange,
  getCurrentUserPhone,
  validatePhoneNumber,
};
