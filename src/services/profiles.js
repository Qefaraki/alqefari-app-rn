import { supabase, handleSupabaseError } from "./supabase";

export const profilesService = {
  /**
   * Get branch data with depth limit - replaces get_tree_data()
   * @param {string|null} hid - Branch HID to start from (null for roots)
   * @param {number} maxDepth - Maximum depth to fetch (1-10)
   * @param {number} limit - Maximum nodes to return (1-500)
   */
  async getBranchData(hid = null, maxDepth = 3, limit = 200) {
    try {
      const { data, error } = await supabase.rpc("get_branch_data", {
        p_hid: hid,
        p_max_depth: maxDepth,
        p_limit: limit,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
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
      const { data, error } = await supabase.rpc("get_visible_nodes", {
        p_viewport: viewport,
        p_zoom_level: zoomLevel,
        p_limit: limit,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
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
      const { data, error } = await supabase.rpc("search_profiles_safe", {
        p_query: query,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Fetches all marriage and spouse details for a given person in a single,
   * efficient backend call.
   * @param {string} personId - The UUID of the person.
   * @returns {Promise<Array>} - A promise that resolves to an array of marriage objects.
   */
  async getPersonMarriages(personId) {
    if (!personId) {
      console.warn("getPersonMarriages called with no personId");
      return [];
    }
    try {
      // Try the RPC function first
      const { data, error } = await supabase.rpc("get_person_marriages", {
        p_id: personId,
      });

      if (error) {
        // If RPC doesn't exist, fallback to direct query
        const { data: person } = await supabase
          .from("profiles")
          .select("gender")
          .eq("id", personId)
          .single();

        const isHusband = person?.gender === "male";

        // Query marriages directly
        const { data: marriages, error: marriageError } = await supabase
          .from("marriages")
          .select(
            `
            id,
            husband_id,
            wife_id,
            status,
            start_date,
            end_date,
            munasib,
            husband:profiles!marriages_husband_id_fkey(id, name, photo_url),
            wife:profiles!marriages_wife_id_fkey(id, name, photo_url)
          `,
          )
          .or(`husband_id.eq.${personId},wife_id.eq.${personId}`)
          .order("start_date", { ascending: false });

        if (marriageError) throw marriageError;

        // Format the data to match RPC structure
        return (marriages || []).map((m) => {
          const spouse = isHusband ? m.wife : m.husband;
          return {
            id: m.id,  // Use id consistently for key prop
            marriage_id: m.id,
            spouse_id: spouse?.id,
            spouse_name: spouse?.name,
            spouse_photo: spouse?.photo_url,
            munasib: m.munasib,
            status: m.status,
            start_date: m.start_date,
            end_date: m.end_date,
            // Also include for backward compatibility
            husband_id: m.husband_id,
            wife_id: m.wife_id,
            husband_name: m.husband?.name,
            wife_name: m.wife?.name,
          };
        });
      }

      // Transform RPC response to include backward compatibility fields
      if (data && Array.isArray(data)) {
        return data.map(m => ({
          ...m,
          // RPC returns these fields
          id: m.marriage_id,
          // Add backward compatibility fields for ProfileSheet
          husband_name: m.spouse_name, // Will be fixed in ProfileSheet
          wife_name: m.spouse_name,     // Will be fixed in ProfileSheet
        }));
      }

      return data || [];
    } catch (error) {
      console.error("Error loading marriages:", error);
      return [];
    }
  },

  // Removed getPersonWithRelations - RPC doesn't exist
  // Use getBranchData for tree loading instead

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
        p_status: profileData.status || "alive",
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
        p_profile_visibility: profileData.profile_visibility || "public",
      };

      const { data, error } = await supabase.rpc(
        "admin_create_profile",
        params,
      );

      if (error) {
        // Handle specific validation errors
        if (error.message.includes("Circular parent")) {
          throw new Error("Cannot create circular relationship");
        }
        if (error.message.includes("Generation hierarchy")) {
          throw new Error("الجيل يجب أن يكون أكبر من جيل الوالد");
        }
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: error.message || handleSupabaseError(error) };
    }
  },

  /**
   * Admin: Bulk create children for a parent
   * @param {string} parentId - Parent profile ID
   * @param {Array} children - Array of child objects with name, gender, etc.
   */
  async bulkCreateChildren(parentId, children) {
    try {
      const { data, error } = await supabase.rpc("admin_bulk_create_children", {
        p_parent_id: parentId,
        p_parent_type: "father", // Default to father for backward compatibility
        p_children: children,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error.message || handleSupabaseError(error) };
    }
  },

  /**
   * Admin: Bulk create children with both parents
   * @param {string} fatherId - Father profile ID
   * @param {string} motherId - Mother profile ID
   * @param {Array} children - Array of child objects with name, gender, etc.
   */
  async bulkCreateChildrenWithMother(fatherId, motherId, children) {
    try {
      // Use the existing bulk create function but with modified children data
      const childrenWithParents = children.map((child) => ({
        ...child,
        father_id: fatherId,
        mother_id: motherId,
      }));

      // Create children one by one with both parents set
      const results = [];
      for (const child of childrenWithParents) {
        const { data, error } = await this.createProfile({
          name: child.name,
          gender: child.gender,
          generation: child.generation, // REQUIRED - must not be null
          father_id: fatherId,
          mother_id: motherId,
          sibling_order: child.sibling_order || 0,
        });

        if (error) {
          console.error(`Failed to create child ${child.name}:`, error);
          throw error;
        }
        results.push(data);
      }

      return { data: results, error: null };
    } catch (error) {
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
      const { data, error } = await supabase.rpc("admin_update_profile", {
        p_id: profileId,
        p_version: currentVersion,
        p_updates: updates,
      });

      if (error) {
        if (error.message.includes("version mismatch")) {
          throw new Error(
            "تم تحديث البيانات من مستخدم آخر. يرجى التحديث والمحاولة مرة أخرى",
          );
        }
        throw error;
      }

      return { data, error: null };
    } catch (error) {
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
      const { data, error } = await supabase.rpc("admin_delete_profile", {
        p_id: profileId,
        p_version: currentVersion,
      });

      if (error) {
        if (error.message.includes("has children")) {
          throw new Error("Cannot delete profile with children");
        }
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: error.message || handleSupabaseError(error) };
    }
  },

  /**
   * Reorder children efficiently using parallel updates
   * @param {string} parentId - Parent ID
   * @param {Array} childOrders - Array of {id, new_order} objects
   */
  async reorderChildren(parentId, childOrders) {
    try {
      // Execute all updates in parallel for maximum speed
      const updates = childOrders.map((order) =>
        supabase
          .from("profiles")
          .update({
            sibling_order: order.new_order,
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id)
          .select(),
      );

      const results = await Promise.all(updates);

      // Check for any errors
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        console.error("Some reorder updates failed:", errors);
        return {
          data: results.filter((r) => r.data).map((r) => r.data),
          error: `Failed to update ${errors.length} items`,
        };
      }

      // All successful
      return {
        data: results.map((r) => r.data).flat(),
        error: null,
      };
    } catch (error) {
      console.error("Error reordering children:", error);
      return { data: null, error: error.message || handleSupabaseError(error) };
    }
  },

  /**
   * Admin: Preview delete impact - shows what would be deleted
   * @param {string} profileId - Profile to check delete impact for
   */
  async previewDeleteImpact(profileId) {
    try {
      const { data, error } = await supabase.rpc(
        "admin_preview_delete_impact",
        {
          p_profile_id: profileId,
        },
      );

      if (error) throw error;
      return { data: data?.[0] || null, error: null };
    } catch (error) {
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Admin: Delete profile with optional cascade
   * @param {string} profileId - Profile to delete
   * @param {boolean} cascade - Whether to cascade delete all descendants
   */
  async deleteProfile(profileId, cascade = false) {
    try {
      const { data, error } = await supabase.rpc(
        "admin_cascade_delete_profile",
        {
          p_profile_id: profileId,
          p_confirm_cascade: cascade,
        },
      );

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Admin: Restore soft-deleted profile
   * @param {string} profileId - Profile to restore
   * @param {boolean} restoreDescendants - Whether to restore descendants too
   */
  async restoreProfile(profileId, restoreDescendants = false) {
    try {
      const { data, error } = await supabase.rpc(
        "admin_restore_deleted_profile",
        {
          p_profile_id: profileId,
          p_restore_descendants: restoreDescendants,
        },
      );

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Admin: List deleted profiles for restoration
   */
  async listDeletedProfiles() {
    try {
      const { data, error } = await supabase.rpc("admin_list_deleted_profiles");

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: [], error: handleSupabaseError(error) };
    }
  },

  /**
   * Admin: Create marriage relationship
   */
  async createMarriage(marriageData) {
    try {
      const { data, error } = await supabase.rpc("admin_create_marriage", {
        p_husband_id: marriageData.husband_id,
        p_wife_id: marriageData.wife_id,
        p_munasib: marriageData.munasib || null,
        p_start_date: marriageData.start_date || null,
        p_end_date: marriageData.end_date || null,
        p_status: marriageData.status || "married",
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Update marriage details
   */
  async updateMarriage(marriageId, updates) {
    try {
      const { data, error } = await supabase.rpc("admin_update_marriage", {
        p_marriage_id: marriageId,
        p_updates: updates,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      // Fallback to direct update if RPC doesn't exist
      try {
        const { data, error: directError } = await supabase
          .from("marriages")
          .update(updates)
          .eq("id", marriageId)
          .select()
          .single();

        if (directError) throw directError;
        return { data, error: null };
      } catch (fallbackError) {
        return { data: null, error: handleSupabaseError(fallbackError) };
      }
    }
  },

  /**
   * Delete a marriage
   */
  async deleteMarriage(marriageId) {
    try {
      const { data, error } = await supabase.rpc("admin_delete_marriage", {
        p_marriage_id: marriageId,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      // Fallback to direct delete if RPC doesn't exist
      try {
        const { error: directError } = await supabase
          .from("marriages")
          .delete()
          .eq("id", marriageId);

        if (directError) throw directError;
        return { data: true, error: null };
      } catch (fallbackError) {
        return { data: null, error: handleSupabaseError(fallbackError) };
      }
    }
  },

  /**
   * Admin: Get dashboard statistics
   */
  async getAdminStatistics() {
    try {
      // Try the RPC first
      const { data, error } = await supabase.rpc("admin_get_statistics");

      if (error) {
        console.log("RPC failed, using fallback:", error.message);
        // Fallback to direct query
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, gender, status, generation, photo_url, bio, father_id")
          .is("deleted_at", null);

        const stats = {
          total_profiles: profiles?.length || 0,
          male_count: profiles?.filter((p) => p.gender === "male").length || 0,
          female_count:
            profiles?.filter((p) => p.gender === "female").length || 0,
          alive_count:
            profiles?.filter((p) => p.status === "alive").length || 0,
          deceased_count:
            profiles?.filter((p) => p.status === "deceased").length || 0,
          max_generation: Math.max(
            ...(profiles?.map((p) => p.generation || 0) || [0]),
          ),
          profiles_with_photos:
            profiles?.filter((p) => p.photo_url).length || 0,
          profiles_with_bio: profiles?.filter((p) => p.bio).length || 0,
          recent_changes: 0,
          pending_validation: 0,
          active_jobs: 0,
          avg_children: 0,
        };

        return { data: stats, error: null };
      }

      return { data, error: null };
    } catch (error) {
      console.error("Error in getAdminStatistics:", error);
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Admin: Export data in various formats
   */
  async exportData(format = "json") {
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("hid");

      if (error) throw error;

      if (format === "csv") {
        // Convert to CSV format
        const headers = Object.keys(profiles[0] || {});
        const csvData = [
          headers.join(","),
          ...profiles.map((p) =>
            headers.map((h) => JSON.stringify(p[h] || "")).join(","),
          ),
        ].join("\n");
        return { data: csvData, error: null };
      }

      return { data: profiles, error: null };
    } catch (error) {
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Admin: Get validation dashboard
   */
  async getValidationDashboard() {
    try {
      const { data, error } = await supabase.rpc("admin_validation_dashboard");

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      // Return empty array as fallback (matching what the component expects)
      return {
        data: [],
        error: null,
      };
    }
  },

  /**
   * Admin: Run auto-fix for validation issues
   */
  async runAutoFix() {
    try {
      const { data, error } = await supabase.rpc("admin_auto_fix_issues");

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Admin: Bulk update layout positions
   * @param {Array} updates - Array of {id, position} objects
   */
  async bulkUpdateLayouts(updates) {
    try {
      const { data, error } = await supabase.rpc("admin_bulk_update_layouts", {
        p_updates: updates,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Get layout recalculation queue status
   */
  async getLayoutQueueStatus() {
    try {
      const { data, error } = await supabase
        .from("layout_recalc_queue")
        .select("*")
        .order("queued_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Trigger layout recalculation for a node
   * @param {string} nodeId - Node ID to recalculate from
   */
  async triggerLayoutRecalc(nodeId) {
    try {
      const { data, error } = await supabase.rpc(
        "trigger_layout_recalc_async",
        {
          p_node_id: nodeId,
        },
      );

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: handleSupabaseError(error) };
    }
  },
};

// Export for backward compatibility
export default profilesService;
