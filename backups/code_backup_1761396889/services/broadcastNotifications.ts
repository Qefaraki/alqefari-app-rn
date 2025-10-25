/**
 * Broadcast Notification Service
 *
 * Service layer for super admin broadcast notification functionality
 * All functions require super_admin role
 */

import { supabase } from './supabase';
import type {
  BroadcastCriteria,
  BroadcastRecipient,
  BroadcastHistoryItem,
  BroadcastStatistics,
  CreateBroadcastParams,
  CreateBroadcastResponse,
} from '../types/notifications';

/**
 * Error response type
 */
interface ErrorResponse {
  message: string;
  code?: string;
  details?: string;
}

/**
 * Success/error response wrapper
 */
type ServiceResponse<T> = {
  data: T | null;
  error: ErrorResponse | null;
};

/**
 * Handle Supabase errors with user-friendly Arabic messages
 */
function handleError(error: any): ErrorResponse {
  if (typeof error === 'string') {
    return { message: error };
  }

  if (error?.message) {
    // Map common Supabase errors to Arabic
    if (error.message.includes('super_admin')) {
      return {
        message: 'هذه الميزة متاحة فقط للمشرفين الرئيسيين',
        code: 'PERMISSION_DENIED',
      };
    }

    if (error.message.includes('No recipients')) {
      return {
        message: 'لا يوجد مستخدمين يطابقون المعايير المحددة',
        code: 'NO_RECIPIENTS',
      };
    }

    if (error.message.includes('too large')) {
      return {
        message: 'عدد المستلمين كبير جداً. الرجاء تضييق نطاق البحث',
        code: 'TOO_MANY_RECIPIENTS',
      };
    }

    if (error.message.includes('concurrent')) {
      return {
        message: 'يتم إرسال إشعار آخر حالياً. الرجاء الانتظار',
        code: 'CONCURRENT_BROADCAST',
      };
    }

    return { message: error.message, details: error.details };
  }

  return { message: 'حدث خطأ غير متوقع' };
}

// ============================================================================
// RECIPIENT TARGETING
// ============================================================================

/**
 * Preview list of users who would receive a broadcast
 * Super admin only
 *
 * @param criteria - Targeting criteria
 * @returns List of recipients or error
 */
export async function previewBroadcastRecipients(
  criteria: BroadcastCriteria
): Promise<ServiceResponse<BroadcastRecipient[]>> {
  try {
    // Validate criteria
    if (!criteria.type) {
      throw new Error('يجب تحديد نوع المعايير');
    }

    if (
      criteria.type !== 'all' &&
      (!criteria.values || criteria.values.length === 0)
    ) {
      throw new Error('يجب تحديد قيمة واحدة على الأقل للمعايير');
    }

    const { data, error } = await supabase.rpc('get_broadcast_recipients', {
      p_criteria: criteria as any,
    });

    if (error) throw error;

    return {
      data: (data || []) as BroadcastRecipient[],
      error: null,
    };
  } catch (error) {
    console.error('Error previewing broadcast recipients:', error);
    return {
      data: null,
      error: handleError(error),
    };
  }
}

// ============================================================================
// BROADCAST CREATION
// ============================================================================

/**
 * Create and send a broadcast notification
 * Super admin only
 *
 * @param params - Broadcast parameters
 * @returns Broadcast response with statistics or error
 */
export async function createBroadcast(
  params: CreateBroadcastParams
): Promise<ServiceResponse<CreateBroadcastResponse>> {
  try {
    // Validate inputs
    if (!params.title || params.title.trim().length < 3) {
      throw new Error('العنوان يجب أن يكون 3 أحرف على الأقل');
    }

    if (params.title.length > 200) {
      throw new Error('العنوان طويل جداً (الحد الأقصى 200 حرف)');
    }

    if (!params.body || params.body.trim().length < 10) {
      throw new Error('الرسالة يجب أن تكون 10 أحرف على الأقل');
    }

    if (params.body.length > 1000) {
      throw new Error('الرسالة طويلة جداً (الحد الأقصى 1000 حرف)');
    }

    if (!params.criteria) {
      throw new Error('يجب تحديد معايير المستلمين');
    }

    const priority = params.priority || 'normal';

    if (!['normal', 'high', 'urgent'].includes(priority)) {
      throw new Error('الأولوية يجب أن تكون: normal, high, أو urgent');
    }

    const { data, error } = await supabase.rpc('create_broadcast_notification', {
      p_title: params.title.trim(),
      p_body: params.body.trim(),
      p_criteria: params.criteria as any,
      p_priority: priority,
      p_expires_at: params.expiresAt || null,
    });

    if (error) throw error;

    if (!data || !data.success) {
      throw new Error(data?.message || 'فشل إرسال الإشعار');
    }

    return {
      data: data as CreateBroadcastResponse,
      error: null,
    };
  } catch (error) {
    console.error('Error creating broadcast:', error);
    return {
      data: null,
      error: handleError(error),
    };
  }
}

// ============================================================================
// BROADCAST HISTORY
// ============================================================================

/**
 * Get broadcast history (paginated)
 * Super admin only
 *
 * @param limit - Number of broadcasts to fetch (default: 50)
 * @param offset - Offset for pagination (default: 0)
 * @returns List of broadcasts or error
 */
export async function getBroadcastHistory(
  limit: number = 50,
  offset: number = 0
): Promise<ServiceResponse<BroadcastHistoryItem[]>> {
  try {
    if (limit < 1 || limit > 100) {
      throw new Error('الحد يجب أن يكون بين 1 و 100');
    }

    if (offset < 0) {
      throw new Error('الإزاحة يجب أن تكون 0 أو أكثر');
    }

    const { data, error } = await supabase.rpc('get_broadcast_history', {
      p_limit: limit,
      p_offset: offset,
    });

    if (error) throw error;

    return {
      data: (data || []) as BroadcastHistoryItem[],
      error: null,
    };
  } catch (error) {
    console.error('Error fetching broadcast history:', error);
    return {
      data: null,
      error: handleError(error),
    };
  }
}

// ============================================================================
// BROADCAST STATISTICS
// ============================================================================

/**
 * Get detailed statistics for a specific broadcast
 * Super admin only
 *
 * @param broadcastId - UUID of the broadcast
 * @returns Broadcast statistics or error
 */
export async function getBroadcastStatistics(
  broadcastId: string
): Promise<ServiceResponse<BroadcastStatistics>> {
  try {
    if (!broadcastId) {
      throw new Error('معرف الإشعار مطلوب');
    }

    const { data, error } = await supabase.rpc('get_broadcast_statistics', {
      p_broadcast_id: broadcastId,
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error('الإشعار غير موجود');
    }

    return {
      data: data[0] as BroadcastStatistics,
      error: null,
    };
  } catch (error) {
    console.error('Error fetching broadcast statistics:', error);
    return {
      data: null,
      error: handleError(error),
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get human-readable label for targeting criteria
 *
 * @param criteria - Broadcast criteria
 * @returns Arabic label
 */
export function getTargetingLabel(criteria: BroadcastCriteria): string {
  switch (criteria.type) {
    case 'all':
      return 'جميع المستخدمين';

    case 'role':
      if (!criteria.values || criteria.values.length === 0) {
        return 'حسب الدور';
      }
      const roleLabels = criteria.values.map((role) => {
        if (role === 'super_admin') return 'مشرف رئيسي';
        if (role === 'admin') return 'مسؤول';
        if (role === 'moderator') return 'مشرف فرع';
        if (role === 'user') return 'مستخدم';
        return role;
      });
      return `الأدوار: ${roleLabels.join('، ')}`;

    case 'gender':
      if (!criteria.values || criteria.values.length === 0) {
        return 'حسب الجنس';
      }
      if (
        criteria.values.includes('male') &&
        criteria.values.includes('female')
      ) {
        return 'ذكور وإناث';
      }
      if (criteria.values.includes('male')) {
        return 'ذكور فقط';
      }
      if (criteria.values.includes('female')) {
        return 'إناث فقط';
      }
      return 'حسب الجنس';

    case 'location':
      if (!criteria.values || criteria.values.length === 0) {
        return 'حسب الموقع';
      }
      if (criteria.values.length === 1) {
        return `الموقع: ${criteria.values[0]}`;
      }
      return `المواقع: ${criteria.values.slice(0, 2).join('، ')}${
        criteria.values.length > 2 ? ' +' + (criteria.values.length - 2) : ''
      }`;

    case 'custom':
      const count = criteria.values?.length || 0;
      return `تحديد يدوي (${count} ${count === 1 ? 'شخص' : count === 2 ? 'شخصان' : 'أشخاص'})`;

    default:
      return 'غير محدد';
  }
}

/**
 * Get color for read percentage (for UI display)
 *
 * @param percentage - Read percentage (0-100)
 * @returns Color name or hex
 */
export function getReadPercentageColor(percentage: number): string {
  if (percentage >= 70) {
    return '#4CAF50'; // Success green
  }
  if (percentage >= 40) {
    return '#D58C4A'; // Desert Ochre (warning)
  }
  return '#FF3B30'; // Error red
}

/**
 * Get icon name for priority level
 *
 * @param priority - Priority level
 * @returns Ionicons icon name
 */
export function getPriorityIcon(
  priority: 'normal' | 'high' | 'urgent'
): string {
  switch (priority) {
    case 'urgent':
      return 'alert-circle';
    case 'high':
      return 'notifications';
    case 'normal':
    default:
      return 'information-circle-outline';
  }
}

/**
 * Get color for priority level
 *
 * @param priority - Priority level
 * @returns Color name or hex
 */
export function getPriorityColor(
  priority: 'normal' | 'high' | 'urgent'
): string {
  switch (priority) {
    case 'urgent':
      return '#FF3B30'; // Red
    case 'high':
      return '#A13333'; // Najdi Crimson
    case 'normal':
    default:
      return '#736372'; // Muted
  }
}

/**
 * Validate broadcast criteria before sending
 *
 * @param criteria - Criteria to validate
 * @returns Error message or null if valid
 */
export function validateBroadcastCriteria(
  criteria: BroadcastCriteria
): string | null {
  if (!criteria.type) {
    return 'يجب تحديد نوع المعايير';
  }

  if (!['all', 'role', 'gender', 'location', 'custom'].includes(criteria.type)) {
    return 'نوع معايير غير صالح';
  }

  if (criteria.type !== 'all') {
    if (!criteria.values || criteria.values.length === 0) {
      return 'يجب تحديد قيمة واحدة على الأقل';
    }
  }

  if (criteria.type === 'role') {
    const validRoles = ['super_admin', 'admin', 'moderator', 'user'];
    const invalidRoles = criteria.values!.filter(
      (r) => !validRoles.includes(r)
    );
    if (invalidRoles.length > 0) {
      return `أدوار غير صالحة: ${invalidRoles.join('، ')}`;
    }
  }

  if (criteria.type === 'gender') {
    const validGenders = ['male', 'female'];
    const invalidGenders = criteria.values!.filter(
      (g) => !validGenders.includes(g)
    );
    if (invalidGenders.length > 0) {
      return `أجناس غير صالحة: ${invalidGenders.join('، ')}`;
    }
  }

  return null;
}
