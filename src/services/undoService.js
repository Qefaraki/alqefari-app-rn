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
   * Undo a profile update by restoring old data from audit log
   * @param {string} auditLogId - UUID of the audit log entry to undo
   * @param {string} reason - Optional reason for undo
   * @returns {Promise<Object>} - {success: boolean, message?: string, error?: string}
   */
  async undoProfileUpdate(auditLogId, reason = null) {
    try {
      const { data, error } = await supabase.rpc('undo_profile_update', {
        p_audit_log_id: auditLogId,
        p_undo_reason: reason
      });

      if (error) {
        if (__DEV__) {
          console.error('Undo profile update error:', error);
        }
        throw new Error(this._parseErrorMessage(error));
      }

      if (data && !data.success) {
        throw new Error(data.error || ERROR_MESSAGES.UNKNOWN);
      }

      return data;
    } catch (error) {
      if (__DEV__) {
        console.error('undoProfileUpdate error:', error);
      }
      throw error;
    }
  }

  /**
   * Undo a profile soft delete by clearing deleted_at
   * @param {string} auditLogId - UUID of the audit log entry to undo
   * @param {string} reason - Optional reason for undo
   * @returns {Promise<Object>} - {success: boolean, message?: string, error?: string}
   */
  async undoProfileDelete(auditLogId, reason = null) {
    try {
      const { data, error } = await supabase.rpc('undo_profile_delete', {
        p_audit_log_id: auditLogId,
        p_undo_reason: reason
      });

      if (error) {
        if (__DEV__) {
          console.error('Undo profile delete error:', error);
        }
        throw new Error(this._parseErrorMessage(error));
      }

      if (data && !data.success) {
        throw new Error(data.error || ERROR_MESSAGES.UNKNOWN);
      }

      return data;
    } catch (error) {
      if (__DEV__) {
        console.error('undoProfileDelete error:', error);
      }
      throw error;
    }
  }

  /**
   * Smart undo that automatically determines the action type
   * @param {string} auditLogId - UUID of the audit log entry to undo
   * @param {string} actionType - The action_type from audit log (e.g., 'profile_update', 'profile_delete')
   * @param {string} reason - Optional reason for undo
   * @returns {Promise<Object>} - {success: boolean, message?: string, error?: string}
   */
  async undoAction(auditLogId, actionType, reason = null) {
    try {
      // Route to appropriate undo function based on action type
      if (actionType.includes('delete')) {
        return await this.undoProfileDelete(auditLogId, reason);
      } else if (actionType.includes('update')) {
        return await this.undoProfileUpdate(auditLogId, reason);
      } else {
        throw new Error('نوع الإجراء غير مدعوم للتراجع حالياً');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('undoAction error:', error);
      }
      throw error;
    }
  }

  /**
   * Get undoable actions for a specific profile
   * @param {string} profileId - UUID of the profile
   * @param {number} limit - Maximum number of actions to return
   * @returns {Promise<Array>} - Array of undoable audit log entries
   */
  async getUndoableActions(profileId, limit = 20) {
    try {
      const { data, error } = await supabase
        .from('audit_log_enhanced')
        .select('*')
        .eq('record_id', profileId)
        .is('undone_at', null)
        .eq('is_undoable', true)
        .in('action_type', ['profile_update', 'profile_delete', 'admin_update'])
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
   * Format action type for display in Arabic
   * @param {string} actionType - The action_type from audit log
   * @returns {string} - Arabic formatted action type
   */
  formatActionType(actionType) {
    const actionLabels = {
      'profile_update': 'تحديث الملف',
      'profile_delete': 'حذف الملف',
      'admin_update': 'تحديث من المسؤول',
      'admin_delete': 'حذف من المسؤول',
      'cascade_delete': 'حذف متعدد',
      'undo_profile_update': 'تراجع عن تحديث',
      'undo_profile_delete': 'تراجع عن حذف',
      'undo_delete': 'استعادة ملف'
    };

    return actionLabels[actionType] || actionType;
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
