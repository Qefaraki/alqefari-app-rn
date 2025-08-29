import { supabase, handleSupabaseError } from './supabase';

export const profilesService = {
  /**
   * Get branch data with depth limit - replaces get_tree_data()
   * @param {string|null} hid - Branch HID to start from (null for roots)
   * @param {number} maxDepth - Maximum depth to fetch (1-10)
   * @param {number} limit - Maximum nodes to return (1-500)
   */
  async getBranchData(hid = null, maxDepth = 3, limit = 200) {
    try {
      const { data, error } = await supabase.rpc('get_branch_data', {
        p_hid: hid,
        p_max_depth: maxDepth,
        p_limit: limit
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('getBranchData error:', error);
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Get visible nodes based on viewport
   * @param {Object} viewport - Viewport bounds {left, top, right, bottom}
   * @param {number} zoomLevel - Current zoom level
   * @param {number} limit - Maximum nodes to return
   */
  async getVisibleNodes(viewport, zoomLevel = 1.0, limit = 200) {
    try {
      const { data, error } = await supabase.rpc('get_visible_nodes', {
        p_viewport: viewport,
        p_zoom_level: zoomLevel,
        p_limit: limit
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('getVisibleNodes error:', error);
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Safe search with pagination
   * @param {string} query - Search term
   * @param {number} limit - Results per page
   * @param {number} offset - Pagination offset
   */
  async searchProfiles(query, limit = 50, offset = 0) {
    try {
      const { data, error } = await supabase.rpc('search_profiles_safe', {
        p_query: query,
        p_limit: limit,
        p_offset: offset
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('searchProfiles error:', error);
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Get marriages for a specific person
   * @param {string} personId - Profile ID
   */
  async getPersonMarriages(personId) {
    try {
      const { data, error } = await supabase.rpc('get_person_marriages', {
        p_id: personId
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('getPersonMarriages error:', error);
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Get person with full details and relationships
   * @param {string} personId - Profile ID
   */
  async getPersonWithRelations(personId) {
    try {
      const { data, error } = await supabase.rpc('get_person_with_relations', {
        p_id: personId
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('getPersonWithRelations error:', error);
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Admin: Create new profile
   * @param {Object} profileData - Profile data
   */
  async createProfile(profileData) {
    try {
      // Map to RPC parameters
      const params = {
        p_name: profileData.name,
        p_gender: profileData.gender,
        p_father_id: profileData.father_id || null,
        p_mother_id: profileData.mother_id || null,
        p_generation: profileData.generation,
        p_sibling_order: profileData.sibling_order || 1,
        p_kunya: profileData.kunya || null,
        p_nickname: profileData.nickname || null,
        p_status: profileData.status || 'alive',
        p_dob_data: profileData.dob_data || null,
        p_bio: profileData.bio || null,
        p_birth_place: profileData.birth_place || null,
        p_current_residence: profileData.current_residence || null,
        p_occupation: profileData.occupation || null,
        p_education: profileData.education || null,
        p_phone: profileData.phone || null,
        p_email: profileData.email || null,
        p_photo_url: profileData.photo_url || null,
        p_social_media_links: profileData.social_media_links || {},
        p_achievements: profileData.achievements || null,
        p_timeline: profileData.timeline || null,
        p_dob_is_public: profileData.dob_is_public !== false,
        p_profile_visibility: profileData.profile_visibility || 'public'
      };

      const { data, error } = await supabase.rpc('admin_create_profile', params);
      
      if (error) {
        // Handle specific validation errors
        if (error.message.includes('Circular parent')) {
          throw new Error('Cannot create circular relationship');
        }
        if (error.message.includes('Generation hierarchy')) {
          throw new Error('الجيل يجب أن يكون أكبر من جيل الوالد');
        }
        throw error;
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('createProfile error:', error);
      return { data: null, error: error.message || handleSupabaseError(error) };
    }
  },

  /**
   * Admin: Update existing profile
   * @param {string} profileId - Profile ID
   * @param {number} currentVersion - Current version for optimistic locking
   * @param {Object} updates - Fields to update
   */
  async updateProfile(profileId, currentVersion, updates) {
    try {
      const { data, error } = await supabase.rpc('admin_update_profile', {
        p_id: profileId,
        p_version: currentVersion,
        p_updates: updates
      });
      
      if (error) {
        if (error.message.includes('version mismatch')) {
          throw new Error('تم تحديث البيانات من مستخدم آخر. يرجى التحديث والمحاولة مرة أخرى');
        }
        throw error;
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('updateProfile error:', error);
      return { data: null, error: error.message || handleSupabaseError(error) };
    }
  },

  /**
   * Admin: Delete profile
   * @param {string} profileId - Profile ID to delete
   * @param {number} currentVersion - Current version for optimistic locking
   */
  async deleteProfile(profileId, currentVersion) {
    try {
      const { data, error } = await supabase.rpc('admin_delete_profile', {
        p_id: profileId,
        p_version: currentVersion
      });
      
      if (error) {
        if (error.message.includes('has children')) {
          throw new Error('Cannot delete profile with children');
        }
        throw error;
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('deleteProfile error:', error);
      return { data: null, error: error.message || handleSupabaseError(error) };
    }
  },

  /**
   * Admin: Create marriage
   * @param {Object} marriageData - Marriage data
   */
  async createMarriage(marriageData) {
    try {
      const { data, error } = await supabase.rpc('admin_create_marriage', {
        p_husband_id: marriageData.husband_id,
        p_wife_id: marriageData.wife_id,
        p_munasib: marriageData.munasib || null,
        p_start_date: marriageData.start_date || null,
        p_end_date: marriageData.end_date || null,
        p_status: marriageData.status || 'married'
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('createMarriage error:', error);
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Admin: Get validation dashboard
   */
  async getValidationDashboard() {
    try {
      const { data, error } = await supabase.rpc('admin_validation_dashboard');
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('getValidationDashboard error:', error);
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Admin: Run auto-fix for validation issues
   */
  async runAutoFix() {
    try {
      const { data, error } = await supabase.rpc('admin_auto_fix_issues');
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('runAutoFix error:', error);
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Admin: Bulk update layout positions
   * @param {Array} updates - Array of {id, position} objects
   */
  async bulkUpdateLayouts(updates) {
    try {
      const { data, error } = await supabase.rpc('admin_bulk_update_layouts', {
        p_updates: updates
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('bulkUpdateLayouts error:', error);
      return { data, null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Get layout recalculation queue status
   */
  async getLayoutQueueStatus() {
    try {
      const { data, error } = await supabase
        .from('layout_recalc_queue')
        .select('*')
        .order('queued_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('getLayoutQueueStatus error:', error);
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Trigger layout recalculation for a node
   * @param {string} nodeId - Node ID to recalculate from
   */
  async triggerLayoutRecalc(nodeId) {
    try {
      const { data, error } = await supabase.rpc('trigger_layout_recalc', {
        p_node_id: nodeId
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('triggerLayoutRecalc error:', error);
      return { data: null, error: handleSupabaseError(error) };
    }
  }
};

// Export for backward compatibility
export default profilesService;