/**
 * Undo Service
 *
 * Handles undo functionality for audit log entries.
 * Provides methods to check undo permissions and revert profile changes.
 */

import { supabase } from './supabase';

// Arabic error messages
const ERROR_MESSAGES = {
  'UNAUTHORIZED': 'غير مصرح. يجب تسجيل الدخول.',
  'PERMISSION_DENIED': 'ليس لديك صلاحية للتراجع عن هذا الإجراء',
  'INVALID_ACTION_TYPE': 'نوع الإجراء غير مدعوم للتراجع',
  'PROFILE_NOT_FOUND': 'الملف غير موجود',
  'ALREADY_UNDONE': 'تم التراجع عن هذا الإجراء بالفعل',
  'NOT_UNDOABLE': 'لا يمكن التراجع عن هذا الإجراء',
  'EXPIRED': 'انتهت صلاحية التراجع (أكثر من 30 يوماً)',
  'UNKNOWN': 'حدث خطأ غير متوقع'
};

// Action type configuration registry
const ACTION_TYPE_CONFIG = {
  'profile_update': {
    rpcFunction: 'undo_profile_update',
    description: 'تحديث الملف',
    requiresAdmin: false,
    timeLimitDays: 30,
    dangerous: false,
  },
  'profile_soft_delete': {
    rpcFunction: 'undo_profile_delete',
    description: 'حذف الملف',
    requiresAdmin: false,
    timeLimitDays: 30,
    dangerous: false,
  },
  'profile_cascade_delete': {
    rpcFunction: 'undo_cascade_delete',
    description: 'حذف متعدد',
    requiresAdmin: true,
    timeLimitDays: 7,
    dangerous: true,
  },
  'add_marriage': {
    rpcFunction: 'undo_marriage_create',
    description: 'إضافة زواج',
    requiresAdmin: true,
    timeLimitDays: null,
    dangerous: true,
  },
  'marriage_soft_delete': {
    rpcFunction: 'undo_marriage_delete',
    description: 'حذف زواج',
    requiresAdmin: false,
    timeLimitDays: 30,
    dangerous: false,
  },
  'marriage_update': {
    rpcFunction: null, // Not undoable (status changes are intentional)
    description: 'تحديث زواج',
    requiresAdmin: false,
    timeLimitDays: null,
    dangerous: false,
  },
  'suggestion_rejected': {
    rpcFunction: null, // Not undoable (rejection is intentional)
    description: 'رفض اقتراح',
    requiresAdmin: false,
    timeLimitDays: null,
    dangerous: false,
  },
  'photo_delete': {
    rpcFunction: 'undo_photo_delete',
    description: 'حذف الصورة',
    requiresAdmin: false,
    timeLimitDays: 30,
    dangerous: false,
  },
  'admin_update': {
    rpcFunction: 'undo_profile_update',
    description: 'تحديث من المسؤول',
    requiresAdmin: false,
    timeLimitDays: 30,
    dangerous: false,
  },
  'admin_delete': {
    rpcFunction: 'undo_profile_delete',
    description: 'حذف من المسؤول',
    requiresAdmin: false,
    timeLimitDays: 30,
    dangerous: false,
  },
  'profile_insert': {
    rpcFunction: null, // Not undoable
    description: 'إنشاء ملف',
    requiresAdmin: false,
    timeLimitDays: null,
    dangerous: false,
  },
  'profile_hard_delete': {
    rpcFunction: null, // Not undoable (hard deletes are permanent)
    description: 'حذف نهائي',
    requiresAdmin: true,
    timeLimitDays: null,
    dangerous: true,
  },
};

class UndoService {
  /**
   * Check if current user can undo a specific audit log entry
   * @param {string} auditLogId - UUID of the audit log entry
   * @param {string} userProfileId - UUID of the current user's profile
   * @returns {Promise<Object>} - {can_undo: boolean, reason: string, ...}
   */
  async checkUndoPermission(auditLogId, userProfileId) {
    try {
      const { data, error } = await supabase.rpc('check_undo_permission', {
        p_audit_log_id: auditLogId,
        p_user_profile_id: userProfileId
      });

      if (error) {
        if (__DEV__) {
          console.error('Check undo permission error:', error);
        }
        throw new Error(ERROR_MESSAGES.PERMISSION_DENIED);
      }

      return data || { can_undo: false, reason: ERROR_MESSAGES.UNKNOWN };
    } catch (error) {
      if (__DEV__) {
        console.error('checkUndoPermission error:', error);
      }
      throw error;
    }
  }

  /**
   * Smart undo that automatically determines the action type using registry
   * @param {string} auditLogId - UUID of the audit log entry to undo
   * @param {string} userProfileId - UUID of the current user's profile
   * @param {string} actionType - The action_type from audit log (e.g., 'profile_update', 'profile_delete')
   * @param {string} reason - Optional reason for undo
   * @returns {Promise<Object>} - {success: boolean, message?: string, error?: string}
   */
  async undoAction(auditLogId, userProfileId, actionType, reason = null) {
    const config = ACTION_TYPE_CONFIG[actionType];

    if (!config) {
      throw new Error(`نوع الإجراء '${actionType}' غير مدعوم للتراجع`);
    }

    if (!config.rpcFunction) {
      throw new Error(`لا يمكن التراجع عن هذا النوع من الإجراءات: ${config.description}`);
    }

    const { data, error } = await supabase.rpc(config.rpcFunction, {
      p_audit_log_id: auditLogId,
      p_undo_reason: reason
    });

    if (error) {
      throw new Error(this._parseErrorMessage(error));
    }

    if (data && !data.success) {
      throw new Error(data.error || ERROR_MESSAGES.UNKNOWN);
    }

    return data;
  }

  /**
   * Get undoable actions for a specific profile
   * @param {string} profileId - UUID of the profile
   * @param {number} limit - Maximum number of actions to return
   * @returns {Promise<Array>} - Array of undoable audit log entries
   */
  async getUndoableActions(profileId, limit = 20) {
    try {
      // Get all action types that have an RPC function (i.e., are actually undoable)
      const undoableActionTypes = Object.keys(ACTION_TYPE_CONFIG).filter(
        type => ACTION_TYPE_CONFIG[type].rpcFunction !== null
      );

      const { data, error } = await supabase
        .from('audit_log_enhanced')
        .select('*')
        .eq('record_id', profileId)
        .is('undone_at', null)
        .eq('is_undoable', true)
        .in('action_type', undoableActionTypes)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        if (__DEV__) {
          console.error('Get undoable actions error:', error);
        }
        return [];
      }

      return data || [];
    } catch (error) {
      if (__DEV__) {
        console.error('getUndoableActions error:', error);
      }
      return [];
    }
  }

  /**
   * Get undo history for a profile (actions that were undone)
   * @param {string} profileId - UUID of the profile
   * @param {number} limit - Maximum number of actions to return
   * @returns {Promise<Array>} - Array of undone audit log entries
   */
  async getUndoHistory(profileId, limit = 20) {
    try {
      const { data, error } = await supabase
        .from('audit_log_enhanced')
        .select('*')
        .eq('record_id', profileId)
        .not('undone_at', 'is', null)
        .order('undone_at', { ascending: false })
        .limit(limit);

      if (error) {
        if (__DEV__) {
          console.error('Get undo history error:', error);
        }
        return [];
      }

      return data || [];
    } catch (error) {
      if (__DEV__) {
        console.error('getUndoHistory error:', error);
      }
      return [];
    }
  }

  /**
   * Format time remaining for undo window (30 days for regular users)
   * @param {string} createdAt - ISO timestamp of when action was created
   * @param {boolean} isAdmin - Whether user is admin (unlimited time)
   * @returns {string} - Arabic formatted time remaining or status
   */
  getUndoTimeRemaining(createdAt, isAdmin = false) {
    if (isAdmin) {
      return 'غير محدود (مسؤول)';
    }

    const created = new Date(createdAt);
    const expireTime = new Date(created.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
    const now = new Date();
    const remaining = expireTime - now;

    if (remaining <= 0) {
      return 'انتهت الصلاحية';
    }

    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    if (days > 0) {
      return `${days} يوم متبقي`;
    } else if (hours > 0) {
      return `${hours} ساعة متبقية`;
    } else {
      return 'أقل من ساعة';
    }
  }

  /**
   * Check if action is dangerous (requires extra confirmation)
   * @param {string} actionType - The action_type from audit log
   * @returns {boolean} - True if action is dangerous
   */
  isDangerousAction(actionType) {
    return ACTION_TYPE_CONFIG[actionType]?.dangerous || false;
  }

  /**
   * Check if action requires admin approval
   * @param {string} actionType - The action_type from audit log
   * @returns {boolean} - True if requires admin approval
   */
  requiresAdminApproval(actionType) {
    return ACTION_TYPE_CONFIG[actionType]?.requiresAdmin || false;
  }

  /**
   * Get action description in Arabic
   * @param {string} actionType - The action_type from audit log
   * @returns {string} - Arabic description of action
   */
  getActionDescription(actionType) {
    return ACTION_TYPE_CONFIG[actionType]?.description || actionType;
  }

  /**
   * Format action type for display in Arabic (uses registry)
   * @param {string} actionType - The action_type from audit log
   * @returns {string} - Arabic formatted action type
   */
  formatActionType(actionType) {
    return this.getActionDescription(actionType);
  }

  /**
   * Parse error message and return appropriate Arabic message
   * @private
   */
  _parseErrorMessage(error) {
    const message = error.message || '';

    if (message.includes('UNAUTHORIZED')) {
      return ERROR_MESSAGES.UNAUTHORIZED;
    }
    if (message.includes('PERMISSION_DENIED')) {
      return ERROR_MESSAGES.PERMISSION_DENIED;
    }
    if (message.includes('INVALID_ACTION_TYPE')) {
      return ERROR_MESSAGES.INVALID_ACTION_TYPE;
    }
    if (message.includes('PROFILE_NOT_FOUND')) {
      return ERROR_MESSAGES.PROFILE_NOT_FOUND;
    }
    if (message.includes('30 يوم')) {
      return ERROR_MESSAGES.EXPIRED;
    }
    if (message.includes('بالفعل')) {
      return ERROR_MESSAGES.ALREADY_UNDONE;
    }

    return message || ERROR_MESSAGES.UNKNOWN;
  }
}

// Export singleton instance
export default new UndoService();
