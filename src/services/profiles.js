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
      // Note: .range() not supported on RPC calls in Supabase JS v2
      // PostgREST max-rows setting controls row limit (configured to 5000 in dashboard)

      // DEBUG: Log first node to verify version field from database
      if (data && data.length > 0) {
        console.log('[profilesService] First node from database:', {
          id: data[0].id,
          name: data[0].name,
          hasVersion: 'version' in data[0],
          version: data[0].version,
          allKeys: Object.keys(data[0]).sort()
        });
      }

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: handleSupabaseError(error) };
    }
  },

  /**
   * Phase 3B: Get structure-only data for progressive loading
   *
   * Returns minimal fields for tree layout calculation:
   * - id, name, father_id, generation, sibling_order
   * - photo_url (for nodeWidth calculation: 85px if photo, 60px if text-only)
   *
   * Benefits:
   * - Data size: 0.45 MB (vs 4.26 MB full tree)
   * - Load time: <500ms (vs ~800ms full tree)
   * - Layout: Calculated ONCE with full structure, never recalculates
   *
   * @param {string|null} hid - Starting node HID (null = root)
   * @param {number} maxDepth - Maximum recursion depth (1-15)
   * @param {number} limit - Maximum results (1-10000)
   */
  async getStructureOnly(hid = null, maxDepth = 15, limit = 10000) {
    try {
      const { data, error } = await supabase.rpc("get_structure_only", {
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
   * Phase 3B: Enrich visible nodes with rich data
   *
   * Loads rich data (photos, bio, contact info) for visible nodes only.
   * Called after initial structure load and layout calculation.
   * Merges data WITHOUT triggering layout recalculation.
   *
   * Benefits:
   * - Progressive: Load only what's visible
   * - Background: Non-blocking operation
   * - Efficient: Avoids unnecessary rich data transfer
   *
   * @param {Array<UUID>} nodeIds - Profile IDs to enrich
   */
  async enrichVisibleNodes(nodeIds) {
    try {
      if (!nodeIds || nodeIds.length === 0) {
        return { data: [], error: null };
      }

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          version,
          photo_url,
          kunya,
          nickname,
          professional_title,
          title_abbreviation,
          status,
          bio,
          phone,
          email,
          dob_data,
          dod_data,
          birth_place,
          current_residence,
          occupation,
          education,
          achievements,
          social_media_links
        `)
        .in('id', nodeIds)
        .is('deleted_at', null);

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
   * Transforms raw marriage data to include nested spouse_profile structure
   * for component compatibility (FamilyCard expects marriage.spouse_profile.photo_url).
   *
   * @param {Array} rawMarriages - Raw marriage records with flat spouse fields
   * @param {string} source - Source identifier for logging ('RPC' or 'fallback')
   * @returns {Array} Transformed marriages with nested spouse_profile
   *
   * Expected raw marriage schema (from both RPC and fallback):
   * {
   *   id: UUID,
   *   marriage_id?: UUID,
   *   status: 'current' | 'past',
   *   start_date: string?,
   *   end_date: string?,
   *   munasib: string?,
   *   spouse_id: UUID,
   *   spouse_name: string,
   *   spouse_photo: string?,
   *   spouse_gender: 'male' | 'female',
   *   spouse_hid: string?,
   *   spouse_deleted_at: timestamp?,
   *   spouse_version: number?,
   *   spouse_full_name_chain: string?,
   *   children_count?: number
   * }
   */
  _transformMarriageData(rawMarriages, source = 'unknown') {
    // Guard against invalid input
    if (!Array.isArray(rawMarriages)) {
      console.warn(`[transformMarriageData:${source}] Expected array, got:`, typeof rawMarriages);
      return [];
    }

    const UNKNOWN_NAME = 'غير محدد';

    return rawMarriages
      .filter(m => {
        // Guard against null/undefined marriage record
        if (!m) {
          console.warn(`[transformMarriageData:${source}] Skipping null marriage record`);
          return false;
        }

        // Validate required fields
        const required = ['id', 'status', 'spouse_id'];
        const missing = required.filter(field => !(field in m));

        if (missing.length > 0) {
          console.error(`[transformMarriageData:${source}] Invalid marriage schema, missing:`, missing, m);
          return false;
        }

        return true;
      })
      .map((m) => ({
        // Handle both old (marriage_id) and new (id) RPC versions
        id: m.id || m.marriage_id,
        marriage_id: m.marriage_id || m.id,

        // Nested structure for modern components (FamilyCard, etc.)
        spouse_profile: {
          id: m.spouse_id,
          name: m.spouse_name || UNKNOWN_NAME,
          photo_url: m.spouse_photo || null,  // Map spouse_photo → photo_url
          gender: m.spouse_gender,
          hid: m.spouse_hid,
          full_name_chain: m.spouse_full_name_chain || m.spouse_name || UNKNOWN_NAME,
          name_chain: m.spouse_full_name_chain || m.spouse_name || UNKNOWN_NAME,  // Alias for formatNameWithTitle
          fullNameChain: m.spouse_full_name_chain || m.spouse_name || UNKNOWN_NAME,  // CamelCase alias
          deleted_at: m.spouse_deleted_at || null,  // Use actual value from database
          version: m.spouse_version || 1,  // Required for optimistic locking
        },

        // Keep flat fields for backward compatibility
        spouse_id: m.spouse_id,
        spouse_name: m.spouse_name,
        spouse_photo: m.spouse_photo,
        spouse_gender: m.spouse_gender,
        spouse_hid: m.spouse_hid,

        munasib: m.munasib,
        status: m.status,
        start_date: m.start_date,
        end_date: m.end_date,
        children_count: m.children_count || 0,

        // Deprecated fields (for backward compatibility only)
        husband_id: m.husband_id,
        wife_id: m.wife_id,
        husband_name: m.husband_name || m.spouse_name,
        wife_name: m.wife_name || m.spouse_name,
      }));
  },

  /**
   * Fetches all marriage and spouse details for a given person in a single,
   * efficient backend call.
   * @param {string} personId - The UUID of the person.
   * @returns {Promise<Array>} - A promise that resolves to an array of marriage objects.
   */
  async getPersonMarriages(personId) {
    if (!personId) {
      console.warn("[getPersonMarriages] Called with no personId");
      return [];
    }

    console.log('[getPersonMarriages] Fetching marriages for profile:', personId);

    try {
      // Try the RPC function first
      const { data, error } = await supabase.rpc("get_person_marriages", {
        p_id: personId,
      });

      if (error) {
        console.warn('[getPersonMarriages] RPC failed, using fallback. Error:', error.message);

        // Fallback to direct query
        const { data: person } = await supabase
          .from("profiles")
          .select("gender")
          .eq("id", personId)
          .single();

        const isHusband = person?.gender === "male";

        // Query marriages directly with ALL required spouse fields
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
            husband:profiles!marriages_husband_id_fkey(
              id,
              name,
              photo_url,
              gender,
              hid,
              deleted_at,
              version,
              full_name_chain
            ),
            wife:profiles!marriages_wife_id_fkey(
              id,
              name,
              photo_url,
              gender,
              hid,
              deleted_at,
              version,
              full_name_chain
            )
          `,
          )
          .or(`husband_id.eq.${personId},wife_id.eq.${personId}`)
          .order("start_date", { ascending: false });

        if (marriageError) throw marriageError;

        console.log('[getPersonMarriages] Fallback succeeded, raw count:', marriages?.length || 0);

        // Transform fallback data to match expected format
        const rawMarriages = (marriages || []).map((m) => {
          const spouse = isHusband ? m.wife : m.husband;
          return {
            id: m.id,
            marriage_id: m.id,
            status: m.status,
            start_date: m.start_date,
            end_date: m.end_date,
            munasib: m.munasib,
            husband_id: m.husband_id,
            wife_id: m.wife_id,
            husband_name: m.husband?.name,
            wife_name: m.wife?.name,
            // Flatten spouse fields for transformer
            spouse_id: spouse?.id,
            spouse_name: spouse?.name,
            spouse_photo: spouse?.photo_url,
            spouse_gender: spouse?.gender,
            spouse_hid: spouse?.hid,
            spouse_deleted_at: spouse?.deleted_at,
            spouse_version: spouse?.version,
            spouse_full_name_chain: spouse?.full_name_chain,
          };
        });

        const transformed = this._transformMarriageData(rawMarriages, 'fallback');
        console.log('[getPersonMarriages] Transformed count:', transformed.length);
        return transformed;
      }

      // RPC path succeeded
      console.log('[getPersonMarriages] RPC path succeeded, raw count:', data?.length || 0);

      if (!data || !Array.isArray(data)) {
        console.warn('[getPersonMarriages] RPC returned invalid data type:', typeof data);
        return [];
      }

      const transformed = this._transformMarriageData(data, 'RPC');
      console.log('[getPersonMarriages] Transformed count:', transformed.length);
      return transformed;

    } catch (error) {
      console.error("[getPersonMarriages] Unexpected error:", error);
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
      if (__DEV__) {
        console.log(`[createProfile] Creating: ${profileData.name} (${profileData.gender}, gen ${profileData.generation})`);
      }

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
        console.error('[createProfile] Error:', error.code, error.message);
        // Handle specific validation errors
        if (error.message.includes("Circular parent")) {
          throw new Error("Cannot create circular relationship");
        }
        if (error.message.includes("Generation hierarchy")) {
          throw new Error("الجيل يجب أن يكون أكبر من جيل الوالد");
        }
        throw error;
      }

      if (__DEV__) {
        console.log(`[createProfile] Success: Created profile ID ${data.id}`);
      }

      return { data, error: null };
    } catch (error) {
      console.error('[createProfile] Exception:', error.message);
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
   * Admin: Batch save children (create, update, delete) in single atomic transaction
   * Replaces 23 sequential RPC calls with 1 atomic operation (95% reduction)
   * @param {string} parentId - Parent profile ID
   * @param {string} parentGender - Parent gender ('male' or 'female')
   * @param {string|null} selectedMotherId - Optional mother ID (if parent is father)
   * @param {string|null} selectedFatherId - Required father ID (if parent is mother)
   * @param {Array} childrenToCreate - Array of child objects to create
   * @param {Array} childrenToUpdate - Array of child objects to update (with id, version)
   * @param {Array} childrenToDelete - Array of child IDs to delete (with id, version)
   * @param {string|null} operationDescription - Optional description for audit trail
   * @returns {Promise<{data, error}>}
   *
   * @example Create 3 children for father
   * await quickAddBatchSave(
   *   parentId,
   *   'male',
   *   motherProfileId,
   *   null,
   *   [{name: 'محمد', gender: 'male', sibling_order: 0}],
   *   [],
   *   []
   * )
   *
   * @example Delete 1 child with reordering
   * await quickAddBatchSave(
   *   parentId,
   *   'male',
   *   null,
   *   null,
   *   [],
   *   [{id: 'sibling1-uuid', version: 1, sibling_order: 0}],
   *   [{id: 'child-uuid', version: 1}]
   * )
   */
  async quickAddBatchSave(
    parentId,
    parentGender,
    selectedMotherId = null,
    selectedFatherId = null,
    childrenToCreate = [],
    childrenToUpdate = [],
    childrenToDelete = [],
    operationDescription = null
  ) {
    try {
      if (__DEV__) {
        const total = childrenToCreate.length + childrenToUpdate.length + childrenToDelete.length;
        console.log(`[quickAddBatchSave] ${total} operations (create: ${childrenToCreate.length}, update: ${childrenToUpdate.length}, delete: ${childrenToDelete.length})`);
      }

      const { data, error } = await supabase.rpc("admin_quick_add_batch_save", {
        p_parent_id: parentId,
        p_parent_gender: parentGender,
        p_selected_mother_id: selectedMotherId,
        p_selected_father_id: selectedFatherId,
        p_children_to_create: childrenToCreate,
        p_children_to_update: childrenToUpdate,
        p_children_to_delete: childrenToDelete,
        p_operation_description: operationDescription,
      });

      if (error) {
        console.error('[quickAddBatchSave] Error:', error.code, error.message);
        // Handle specific errors with friendly messages
        if (error.message.includes('صلاحية')) {
          throw new Error('ليس لديك صلاحية لتنفيذ هذه العملية');
        }
        if (error.message.includes('version')) {
          throw new Error('تم تحديث البيانات من قبل مستخدم آخر');
        }
        if (error.message.includes('lock') || error.message.includes('قيد التنفيذ')) {
          throw new Error('عملية أخرى قيد التنفيذ. يرجى المحاولة بعد قليل');
        }
        throw error;
      }

      if (__DEV__) {
        console.log(`[quickAddBatchSave] Success: ${data.created_count || 0} created, ${data.updated_count || 0} updated, ${data.deleted_count || 0} deleted`);
      }

      return { data, error: null };
    } catch (error) {
      console.error('[quickAddBatchSave] Exception:', error.message);
      return {
        data: null,
        error: error.message || handleSupabaseError(error)
      };
    }
  },

  /**
   * Delete profile with intelligent parameter detection
   * @param {string} profileId - Profile ID to delete
   * @param {number|boolean} versionOrCascade - Pass NUMBER for simple delete with version, or BOOLEAN true for cascade delete
   * @param {number} profileVersion - Profile version for optimistic locking (required for cascade delete)
   * @returns {Promise<{data, error}>}
   *
   * @example Simple delete
   * await deleteProfile(profile.id, profile.version || 1)
   *
   * @example Cascade delete
   * await deleteProfile(profile.id, true, profile.version || 1)
   */
  async deleteProfile(profileId, versionOrCascade = 1, profileVersion = 1) {
    try {
      // Validate boolean false edge case
      if (typeof versionOrCascade === 'boolean' && versionOrCascade === false) {
        return {
          data: null,
          error: 'Cascade delete requires explicit confirmation (pass true)'
        };
      }

      // Smart detection: boolean = cascade mode, number = version mode
      if (typeof versionOrCascade === 'boolean') {
        // Cascade delete path
        const { data, error } = await supabase.rpc("admin_cascade_delete_profile", {
          p_profile_id: profileId,
          p_version: profileVersion, // Use actual profile version
          p_confirm_cascade: versionOrCascade,
          p_max_descendants: 100
        });

        if (error) throw error;
        return { data, error: null };
      } else {
        // Optimistic locking path
        const version = versionOrCascade;
        const { data, error } = await supabase.rpc("admin_delete_profile", {
          p_id: profileId,
          p_version: version,
        });

        if (error) {
          if (error.message && error.message.includes("has children")) {
            throw new Error("Cannot delete profile with children");
          }
          throw error;
        }
        return { data, error: null };
      }
    } catch (error) {
      return {
        data: null,
        error: error.message || handleSupabaseError(error)
      };
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
   * Admin: Create marriage relationship
   */
  async createMarriage(marriageData) {
    try {
      // Ensure required parameters are present
      if (!marriageData.husband_id || !marriageData.wife_id) {
        throw new Error("Both husband_id and wife_id are required");
      }

      const { data, error } = await supabase.rpc("admin_create_marriage", {
        p_husband_id: marriageData.husband_id,
        p_wife_id: marriageData.wife_id,
        p_munasib: marriageData.munasib || null,
        p_start_date: marriageData.start_date || null,
        p_end_date: marriageData.end_date || null,
        p_status: marriageData.status || "current",
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error("createMarriage error:", error);
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
      const { data, error } = await supabase.rpc("admin_get_enhanced_statistics");

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
