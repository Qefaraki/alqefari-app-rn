/**
 * Suggestion Service for Permission System v4.2
 *
 * Handles all suggestion-related API calls for the three-circle permission model:
 * - Inner Circle: Direct edits (family members)
 * - Family Circle: 48-hour auto-approval (cousins, aunts, uncles)
 * - Extended Family: Manual approval required
 */

import { supabase } from './supabase';
import { Alert } from 'react-native';

// Fields allowed by the v4 suggestion system (must stay in sync with backend whitelist)
const ALLOWED_SUGGESTION_FIELDS = new Set([
  'display_name',
  'name',
  'phone',
  'email',
  'date_of_birth',
  'place_of_birth',
  'current_location',
  'occupation',
  'bio',
  'instagram',
  'twitter',
  'linkedin',
  'notes',
  'professional_title',
  'title_abbreviation',
]);

// Arabic error messages
const ERROR_MESSAGES = {
  'Rate limit exceeded': 'تجاوزت الحد المسموح (10 اقتراحات في اليوم)',
  'You are blocked': 'تم حظرك من تقديم الاقتراحات',
  'Field % is not allowed': 'هذا الحقل غير مسموح بتعديله',
  'none': 'ليس لديك صلاحية لتعديل هذا الملف',
  'blocked': 'تم حظرك من التعديل',
  'permission': 'لا يمكن التحقق من الصلاحيات',
  'unknown': 'حدث خطأ غير متوقع'
};

class SuggestionService {
  /**
   * Check user's permission level for a profile
   * Returns: 'inner', 'family', 'extended', 'blocked', or 'none'
   */
  async checkPermission(userId, targetId) {
    try {
      const { data, error } = await supabase.rpc('check_family_permission_v4', {
        p_user_id: userId,
        p_target_id: targetId
      });

      if (error) {
        if (__DEV__) {
          console.error('Permission check error:', error);
        }
        throw new Error(ERROR_MESSAGES.permission);
      }

      return data || 'none';
    } catch (error) {
      if (__DEV__) {
        console.error('checkPermission error:', error);
      }
      throw error;
    }
  }

  /**
   * Submit an edit suggestion for approval
   * Used for family and extended circles
   */
  async submitEditSuggestion(profileId, fieldName, newValue, reason = null) {
    if (!ALLOWED_SUGGESTION_FIELDS.has(fieldName)) {
      throw new Error('لا يمكن إرسال اقتراح لهذا الحقل. يتطلب موافقة مباشرة من صاحب الملف.');
    }
    try {
      const { data, error } = await supabase.rpc('submit_edit_suggestion_v4', {
        p_profile_id: profileId,
        p_field_name: fieldName,
        p_new_value: newValue,
        p_reason: reason
      });

      if (error) {
        // Parse specific error messages
        if (error.message?.includes('Rate limit')) {
          throw new Error(ERROR_MESSAGES['Rate limit exceeded']);
        }
        if (error.message?.includes('blocked')) {
          throw new Error(ERROR_MESSAGES['You are blocked']);
        }
        if (error.message?.includes('is not allowed')) {
          throw new Error('هذا الحقل لا يدعم نظام الاقتراحات. اطلب من صاحب الملف التعديل المباشر.');
        }

        if (__DEV__) {
          console.error('Submit suggestion error:', error);
        }
        throw new Error(error.message || ERROR_MESSAGES.unknown);
      }

      return data; // Returns suggestion ID or null for direct edits
    } catch (error) {
      if (__DEV__) {
        console.error('submitEditSuggestion error:', error);
      }
      throw error;
    }
  }

  /**
   * Submit multiple field changes at once
   * Batches all changes into appropriate suggestions
   */
  async submitProfileChanges(profileId, changes) {
    try {
      const results = [];
      const errors = [];
      const skipped = [];

      // Submit each change as a separate suggestion
      for (const [fieldName, newValue] of Object.entries(changes)) {
        if (!ALLOWED_SUGGESTION_FIELDS.has(fieldName)) {
          skipped.push(fieldName);
          continue;
        }
        try {
          const result = await this.submitEditSuggestion(
            profileId,
            fieldName,
            newValue,
            null // No specific reason for batch updates
          );
          results.push({ fieldName, result });
        } catch (error) {
          errors.push({ fieldName, error: error.message });
        }
      }

      const attemptedCount = Object.keys(changes).length - skipped.length;

      // If nothing could be submitted
      if (attemptedCount === 0 && skipped.length > 0) {
        throw new Error('التعديلات التي اخترتها غير مدعومة عبر نظام الاقتراحات. الرجاء التواصل مع صاحب الملف.');
      }

      // If all attempted submissions failed, surface the first error
      if (attemptedCount > 0 && errors.length === attemptedCount) {
        throw new Error(errors[0].error);
      }

      // Return summary
      return {
        success: results.length > 0,
        results,
        errors,
        skipped,
        allDirectEdit: results.length > 0 && results.every(r => r.result === null)
      };
    } catch (error) {
      if (__DEV__) {
        console.error('submitProfileChanges error:', error);
      }
      throw error;
    }
  }

  /**
   * Approve a suggestion (for profile owners and admins)
   */
  async approveSuggestion(suggestionId, notes = null) {
    try {
      const { data, error } = await supabase.rpc('approve_suggestion', {
        p_suggestion_id: suggestionId,
        p_notes: notes
      });

      if (error) {
        if (error.message?.includes('Rate limit')) {
          throw new Error('تجاوزت الحد المسموح (100 موافقة في اليوم)');
        }
        if (error.message?.includes('permission')) {
          throw new Error('ليس لديك صلاحية للموافقة على هذا الاقتراح');
        }

        if (__DEV__) {
          console.error('Approve suggestion error:', error);
        }
        throw new Error(error.message || ERROR_MESSAGES.unknown);
      }

      return data;
    } catch (error) {
      if (__DEV__) {
        console.error('approveSuggestion error:', error);
      }
      throw error;
    }
  }

  /**
   * Reject a suggestion (for profile owners and admins)
   */
  async rejectSuggestion(suggestionId, notes = 'رفض من قبل المالك') {
    try {
      const { data, error } = await supabase.rpc('reject_suggestion', {
        p_suggestion_id: suggestionId,
        p_notes: notes
      });

      if (error) {
        if (error.message?.includes('Rate limit')) {
          throw new Error('تجاوزت الحد المسموح (100 رفض في اليوم)');
        }
        if (error.message?.includes('permission')) {
          throw new Error('ليس لديك صلاحية لرفض هذا الاقتراح');
        }

        if (__DEV__) {
          console.error('Reject suggestion error:', error);
        }
        throw new Error(error.message || ERROR_MESSAGES.unknown);
      }

      return data;
    } catch (error) {
      if (__DEV__) {
        console.error('rejectSuggestion error:', error);
      }
      throw error;
    }
  }

  /**
   * Get count of pending suggestions for a profile or all user's reviewable suggestions
   */
  async getPendingSuggestionsCount(profileId = null) {
    try {
      const { data, error } = await supabase.rpc('get_pending_suggestions_count', {
        p_profile_id: profileId
      });

      if (error) {
        if (__DEV__) {
          console.error('Get pending count error:', error);
        }
        // Return 0 on error to not break UI
        return 0;
      }

      return data || 0;
    } catch (error) {
      if (__DEV__) {
        console.error('getPendingSuggestionsCount error:', error);
      }
      return 0;
    }
  }

  /**
   * Get all pending suggestions for review
   */
  async getPendingSuggestions() {
    try {
      const { data, error } = await supabase
        .from('profile_edit_suggestions')
        .select(`
          *,
          profile:profile_id (
            id,
            name,
            photo_url
          ),
          submitter:submitter_id (
            id,
            name,
            photo_url
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        if (__DEV__) {
          console.error('Get pending suggestions error:', error);
        }
        throw new Error('فشل في تحميل الاقتراحات');
      }

      return data || [];
    } catch (error) {
      if (__DEV__) {
        console.error('getPendingSuggestions error:', error);
      }
      throw error;
    }
  }

  /**
   * Get suggestions for a specific profile
   */
  async getProfileSuggestions(profileId, status = null) {
    try {
      let query = supabase
        .from('profile_edit_suggestions')
        .select(`
          *,
          profile:profile_id (
            id,
            name,
            photo_url
          ),
          submitter:submitter_id (
            id,
            name,
            photo_url
          ),
          reviewer:reviewed_by (
            id,
            name
          )
        `)
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        if (__DEV__) {
          console.error('Get profile suggestions error:', error);
        }
        throw new Error('فشل في تحميل اقتراحات الملف');
      }

      return data || [];
    } catch (error) {
      if (__DEV__) {
        console.error('getProfileSuggestions error:', error);
      }
      throw error;
    }
  }

  /**
   * Get suggestions submitted by a user
   */
  async getUserSubmittedSuggestions(userId) {
    try {
      const { data, error } = await supabase
        .from('profile_edit_suggestions')
        .select(`
          *,
          profile:profile_id (
            id,
            name,
            photo_url
          ),
          reviewer:reviewed_by (
            id,
            name
          )
        `)
        .eq('submitter_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        if (__DEV__) {
          console.error('Get user suggestions error:', error);
        }
        throw new Error('فشل في تحميل اقتراحاتك');
      }

      return data || [];
    } catch (error) {
      if (__DEV__) {
        console.error('getUserSubmittedSuggestions error:', error);
      }
      throw error;
    }
  }

  /**
   * Helper to show appropriate message based on permission level
   */
  getPermissionMessage(permission) {
    switch (permission) {
      case 'inner':
        return {
          title: 'تم الحفظ',
          message: 'تم تحديث البيانات بنجاح',
          type: 'success'
        };
      case 'family':
        return {
          title: 'تم إرسال الاقتراح',
          message: 'سيتم مراجعة التغييرات والموافقة عليها خلال 48 ساعة',
          type: 'info'
        };
      case 'extended':
        return {
          title: 'يحتاج موافقة',
          message: 'تم إرسال اقتراحك إلى صاحب الملف للموافقة',
          type: 'info'
        };
      case 'blocked':
        return {
          title: 'محظور',
          message: 'لا يمكنك تعديل هذا الملف حالياً',
          type: 'error'
        };
      case 'none':
        return {
          title: 'غير مسموح',
          message: 'ليس لديك صلاحية لتعديل هذا الملف',
          type: 'error'
        };
      default:
        return {
          title: 'خطأ',
          message: 'حالة صلاحية غير معروفة',
          type: 'error'
        };
    }
  }

  /**
   * Format field name for display in Arabic
   */
  formatFieldName(fieldName) {
    const fieldLabels = {
      'display_name': 'الاسم',
      'phone': 'رقم الهاتف',
      'email': 'البريد الإلكتروني',
      'date_of_birth': 'تاريخ الميلاد',
      'place_of_birth': 'مكان الميلاد',
      'current_location': 'مكان الإقامة الحالي',
      'occupation': 'المهنة',
      'bio': 'السيرة الذاتية',
      'instagram': 'انستجرام',
      'twitter': 'تويتر',
      'linkedin': 'لينكد إن',
      'notes': 'ملاحظات',
      'kunya': 'الكنية',
      'nickname': 'اللقب',
      'education': 'التعليم',
      'gender': 'الجنس',
      'status': 'الحالة',
      'sibling_order': 'الترتيب بين الإخوة'
    };

    return fieldLabels[fieldName] || fieldName;
  }

  /**
   * Calculate time remaining for auto-approval (48 hours)
   */
  getAutoApprovalTimeRemaining(createdAt) {
    const created = new Date(createdAt);
    const autoApproveTime = new Date(created.getTime() + (48 * 60 * 60 * 1000));
    const now = new Date();
    const remaining = autoApproveTime - now;

    if (remaining <= 0) {
      return 'جاهز للموافقة التلقائية';
    }

    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} يوم و ${hours % 24} ساعة`;
    } else if (hours > 0) {
      return `${hours} ساعة و ${minutes} دقيقة`;
    } else {
      return `${minutes} دقيقة`;
    }
  }
}

// Export singleton instance
export default new SuggestionService();

export { ALLOWED_SUGGESTION_FIELDS };
