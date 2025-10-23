import { supabase } from "./supabase";
import { featureFlags } from "../config/featureFlags";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const phoneAuthService = {
  /**
   * Convert Arabic/Persian numerals to Western numerals
   */
  convertArabicNumbers(str) {
    const arabicNumerals = "٠١٢٣٤٥٦٧٨٩";
    const persianNumerals = "۰۱۲۳۴۵۶۷۸۹";
    const westernNumerals = "0123456789";

    let result = str || "";

    // Convert Arabic numerals
    for (let i = 0; i < 10; i++) {
      const regex = new RegExp(arabicNumerals[i], "g");
      result = result.replace(regex, westernNumerals[i]);
    }

    // Convert Persian numerals
    for (let i = 0; i < 10; i++) {
      const regex = new RegExp(persianNumerals[i], "g");
      result = result.replace(regex, westernNumerals[i]);
    }

    return result;
  },

  /**
   * Format phone number to international format
   * Handles Saudi numbers in ALL possible formats including Arabic numerals
   */
  formatPhoneNumber(phone) {
    if (!phone) return "";

    // First convert any Arabic/Persian numerals to Western
    let normalized = this.convertArabicNumbers(phone.toString());

    // Remove all non-digits except + at the beginning
    // This handles spaces, dashes, parentheses, etc.
    normalized = normalized.replace(/[^\d+]/g, "");

    // If it starts with +, preserve it and clean the rest
    const hasPlus = normalized.startsWith("+");
    let cleaned = normalized.replace(/\D/g, "");

    // Handle empty input
    if (!cleaned) return "";

    // Handle various Saudi number formats
    if (cleaned.startsWith("00966")) {
      // 00966xxxxxxxxx -> 966xxxxxxxxx
      cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith("0966")) {
      // 0966xxxxxxxxx -> 966xxxxxxxxx
      cleaned = cleaned.substring(1);
    } else if (cleaned.startsWith("966")) {
      // Already has country code
      // Valid lengths: 966 5XXXXXXXX (12 digits) or 966 5XXXXXXX (11 digits)
    } else if (cleaned.startsWith("05")) {
      // 05xxxxxxxx -> 966 5xxxxxxxx
      cleaned = `966${  cleaned.substring(1)}`;
    } else if (cleaned.startsWith("5") && cleaned.length === 9) {
      // 5xxxxxxxx -> 966 5xxxxxxxx
      cleaned = `966${  cleaned}`;
    } else if (cleaned.startsWith("5") && cleaned.length === 8) {
      // 5xxxxxxx -> 966 5xxxxxxx (8 digits after 5)
      cleaned = `966${  cleaned}`;
    } else if (cleaned.startsWith("0") && cleaned.length === 10) {
      // 0xxxxxxxxx -> might be 05xxxxxxxx
      if (cleaned[1] === "5") {
        cleaned = `966${  cleaned.substring(1)}`;
      } else {
        // Not a mobile number, but add country code anyway
        cleaned = `966${  cleaned.substring(1)}`;
      }
    } else if (cleaned.length === 9 && !cleaned.startsWith("966")) {
      // 9 digits, assume it needs country code
      if (cleaned.startsWith("5")) {
        // Mobile number
        cleaned = `966${  cleaned}`;
      } else {
        // Might be missing the 5
        cleaned = `9665${  cleaned}`;
      }
    } else if (cleaned.length === 8 && !cleaned.startsWith("966")) {
      // 8 digits, definitely needs country code and possibly the 5
      if (cleaned.startsWith("5")) {
        cleaned = `966${  cleaned}`;
      } else {
        // Assume mobile number missing the 5
        cleaned = `9665${  cleaned}`;
      }
    } else if (cleaned.length === 7) {
      // Very short, assume it's the core number without 05 or country code
      cleaned = `9665${  cleaned}`;
    } else if (!cleaned.startsWith("966") && cleaned.length < 12) {
      // Any other format, try to make it work
      if (cleaned.startsWith("5")) {
        cleaned = `966${  cleaned}`;
      } else if (cleaned.startsWith("0")) {
        cleaned = `966${  cleaned.substring(1)}`;
      } else {
        // Assume it needs both country code and mobile prefix
        cleaned = `9665${  cleaned}`;
      }
    }

    // Ensure we have the + prefix for international format
    return `+${  cleaned}`;
  },

  /**
   * Send OTP to phone number
   */
  async sendOTP(phoneNumber) {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      // Store the phone number for later use
      await AsyncStorage.setItem("pendingPhoneAuth", formattedPhone);

      const { data, error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          channel: "sms",
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      return {
        success: true,
        formattedPhone,
        message: `تم إرسال رمز التحقق إلى ${formattedPhone}`,
      };
    } catch (error) {
      console.error("Error sending OTP:", error);
      return {
        success: false,
        error: error.message || "فشل إرسال رمز التحقق",
      };
    }
  },

  /**
   * Verify OTP code
   */
  async verifyOTP(phoneNumber, token) {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token,
        type: "sms",
      });

      if (error) throw error;

      // Clear stored phone number
      await AsyncStorage.removeItem("pendingPhoneAuth");

      // Check if user has a linked profile
      const profile = await this.checkProfileLink(data.user);

      return {
        success: true,
        user: data.user,
        session: data.session,
        hasProfile: !!profile,
        profile,
      };
    } catch (error) {
      console.error("Error verifying OTP:", error);
      return {
        success: false,
        error: error.message || "رمز التحقق غير صحيح",
      };
    }
  },

  /**
   * Check if authenticated user has a linked profile
   */
  async checkProfileLink(user) {
    if (!user) {
      return null;
    }

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        // Silently return null when no profile found (this is expected for users without profiles)
        return null;
      }

      return profile;
    } catch (error) {
      console.error("[phoneAuthService] Error checking profile link:", error);
      return null;
    }
  },

  /**
   * Search for profiles by name chain
   */
  async searchProfilesByNameChain(nameChain) {
    try {
      // Remove common family names before searching
      const familyNames = [
        "القفاري",
        "الدوسري",
        "العتيبي",
        "الشمري",
        "العنزي",
        "السبيعي",
        "المطيري",
        "الحربي",
        "الزهراني",
        "الغامدي",
        "العمري",
        "المالكي",
        "الأحمدي",
        "الجهني",
        "الخالدي",
      ];

      let cleanedName = nameChain.trim();
      familyNames.forEach((family) => {
        cleanedName = cleanedName.replace(family, "").trim();
      });

      // Split the cleaned name chain into components
      const names = cleanedName.split(/\s+/);
      const firstName = names[0] || "";
      const fatherName = names[1] || "";
      const grandfatherName = names[2] || "";

      // Try using the RPC function first for better match scoring and full name chains
      let data = null;
      let error = null;
      let usedRpc = false; // Track explicitly whether RPC was used successfully

      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "search_profiles_by_name_chain",
          {
            p_name_chain: cleanedName,
          }
        );

        if (!rpcError && rpcData) {
          usedRpc = true; // Mark that RPC executed successfully
          // Filter out already claimed profiles
          // Note: After migration 20251015400000, RPC already filters claimed and Munasib,
          // but we keep checking has_auth as defense-in-depth
          // (hid check removed because RPC doesn't return hid field)
          data = (rpcData || []).filter(
            (profile) => !profile.has_auth
          );
        } else {
          // RPC failed, will use fallback below
          console.log('[RPC] search_profiles_by_name_chain error, using fallback:', rpcError?.message);
        }
      } catch (rpcErr) {
        // RPC not available, use fallback
        console.log('[RPC] search_profiles_by_name_chain not found, using fallback');
      }

      // Fallback: Direct query to profiles table if RPC failed
      // Note: If RPC succeeded but returned empty results, we don't use fallback
      // because that means there are legitimately no unclaimed profiles matching the name
      if (!usedRpc && (!data || data.length === 0)) {
        let query = supabase.from("profiles").select("*");

        // Search for profiles matching the first name
        if (firstName) {
          query = query.or(
            `name.eq.${firstName},` +
              `name.like.${firstName} %,` +
              `name.like.% ${firstName} %,` +
              `name.like.% ${firstName}`,
          );
        }

        // CRITICAL: Filter out already linked profiles
        // This ensures users can only see and claim unclaimed profiles
        query = query.is("user_id", null);

        // Munasib guard: only show profiles that belong to the core tree (have HID)
        query = query.not("hid", "is", null);

        // Limit results
        query = query.limit(20);

        const fallbackResult = await query;
        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) throw error;

      // Filter to ensure HID exists (only needed for fallback query results)
      // RPC results are already filtered at database level
      let filteredProfiles = usedRpc
        ? (data || [])
        : (data || []).filter((profile) => profile.hid);

      // Only do additional father name checking if we used the fallback query
      // (RPC function already provides accurate match_score and father_name)
      // Note: usedRpc is now tracked explicitly from the try/catch block above

      if (!usedRpc && fatherName && filteredProfiles.length > 0) {
        // FIXED: Batch query for father names (previously N+1 queries)
        // Performance improvement: 2s → 100ms for 20 results
        const fatherIds = filteredProfiles
          .map(p => p.father_id)
          .filter(Boolean);

        let fatherMap = {};
        if (fatherIds.length > 0) {
          const { data: fathers } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', fatherIds);

          fatherMap = Object.fromEntries(
            (fathers || []).map(f => [f.id, f.name])
          );
        }

        // Enrich profiles with father names and match scores (0-100 scale)
        const profilesWithFathers = filteredProfiles.map(profile => {
          if (profile.father_id && fatherMap[profile.father_id]) {
            const fatherNameValue = fatherMap[profile.father_id];

            // Check if father's name matches
            const fatherNameMatches =
              fatherNameValue === fatherName ||
              fatherNameValue?.startsWith(`${fatherName  } `) ||
              fatherNameValue?.includes(` ${  fatherName  } `) ||
              fatherNameValue?.endsWith(` ${  fatherName}`);

            return {
              ...profile,
              father_name: fatherNameValue,
              match_score: fatherNameMatches ? 80 : 40, // FIXED: Use 0-100 scale (not 1-2)
            };
          }
          return { ...profile, match_score: 40 }; // FIXED: Use 0-100 scale (not 1)
        });

        // Sort by match score
        filteredProfiles = profilesWithFathers.sort(
          (a, b) => b.match_score - a.match_score,
        );
      } else if (usedRpc) {
        // RPC results are already sorted by match_score, just ensure correct order
        filteredProfiles = filteredProfiles.sort(
          (a, b) => (b.match_score || 0) - (a.match_score || 0),
        );
      }

      return { success: true, profiles: filteredProfiles };
    } catch (error) {
      console.error("Error searching profiles:", error);
      return {
        success: false,
        error: error.message || "فشل البحث عن الملفات",
        profiles: [],
      };
    }
  },

  /**
   * Get tree context for a profile
   */
  async getProfileTreeContext(profileId) {
    try {
      // First try the RPC function if it exists
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "get_profile_tree_context",
          {
            p_profile_id: profileId,
          },
        );

        if (!rpcError && rpcData) {
          return { success: true, context: rpcData };
        }
      } catch (rpcErr) {
        // RPC not available, using fallback
      }

      // Fallback: Build context manually
      // Get the profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .single();

      if (profileError) throw profileError;

      // Get lineage (ancestors)
      const lineage = [];
      let currentId = profile.father_id;
      let level = 1;

      while (currentId && level <= 5) {
        const { data: ancestor } = await supabase
          .from("profiles")
          .select("id, name, generation, father_id")
          .eq("id", currentId)
          .single();

        if (ancestor) {
          lineage.push({ ...ancestor, level });
          currentId = ancestor.father_id;
          level++;
        } else {
          break;
        }
      }

      // Get siblings
      const { data: siblings } = await supabase
        .from("profiles")
        .select("id, name, gender, sibling_order, status")
        .eq("father_id", profile.father_id)
        .neq("id", profileId)
        .order("sibling_order");

      // Get father's siblings (uncles/aunts)
      let father_siblings = [];
      if (profile.father_id) {
        const { data: father } = await supabase
          .from("profiles")
          .select("father_id")
          .eq("id", profile.father_id)
          .single();

        if (father?.father_id) {
          const { data: uncles } = await supabase
            .from("profiles")
            .select("id, name, gender, sibling_order")
            .eq("father_id", father.father_id)
            .neq("id", profile.father_id)
            .order("sibling_order");

          father_siblings = uncles || [];
        }
      }

      // Get grandfather's siblings
      let grandfather_siblings = [];
      if (lineage[1]?.father_id) {
        const { data: grandUncles } = await supabase
          .from("profiles")
          .select("id, name, gender")
          .eq("father_id", lineage[1].father_id)
          .neq("id", lineage[0]?.father_id)
          .order("sibling_order");

        grandfather_siblings = grandUncles || [];
      }

      // Get children
      const { data: children } = await supabase
        .from("profiles")
        .select("id, name, gender")
        .or(`father_id.eq.${profileId},mother_id.eq.${profileId}`)
        .order("sibling_order");

      const context = {
        profile: {
          id: profile.id,
          name: profile.name,
          hid: profile.hid,
          generation: profile.generation,
          status: profile.status,
          gender: profile.gender,
          birth_date_hijri: profile.birth_date_hijri,
          death_date_hijri: profile.death_date_hijri,
        },
        lineage,
        siblings: siblings || [],
        father_siblings,
        grandfather_siblings,
        children_count: children?.length || 0,
        children: children || [],
      };

      return { success: true, context };
    } catch (error) {
      console.error("Error getting tree context:", error);
      return {
        success: false,
        error: error.message || "فشل تحميل سياق الشجرة",
        context: null,
      };
    }
  },

  /**
   * Submit profile link request
   */
  async submitProfileLinkRequest(profileId, nameChain) {
    if (!featureFlags.profileLinkRequests) {
      return {
        success: false,
        error: 'ميزة طلب ربط الملف غير مفعلة حالياً.',
      };
    }
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return {
          success: false,
          error: "يجب تسجيل الدخول أولاً",
        };
      }

      // CRITICAL VALIDATION: Check if the profile is already linked
      const { data: profileCheck, error: checkError } = await supabase
        .from('profiles')
        .select('id, name, user_id, hid, family_origin')
        .eq('id', profileId)
        .single();

      if (checkError) {
        console.error('Error checking profile status:', checkError);
        return { success: false, error: 'حدث خطأ في التحقق من حالة الملف' };
      }

      if (!profileCheck) {
        return { success: false, error: 'الملف المطلوب غير موجود' };
      }

      if (!profileCheck.hid) {
        console.error('Attempted to claim munasib profile:', profileId, profileCheck.name, profileCheck.family_origin);
        return {
          success: false,
          error: 'هذا الملف يخص عائلة مناسبة ولا يمكن ربطه بحساب مستخدم.'
        };
      }

      if (profileCheck.user_id) {
        console.error('Attempted to claim already-linked profile:', profileId, profileCheck.name);
        return {
          success: false,
          error: 'هذا الملف مرتبط بحساب آخر بالفعل. يرجى اختيار ملف آخر أو التواصل مع المشرف.'
        };
      }

      // Check if profile is already claimed
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("id", profileId)
        .single();

      if (profile?.user_id) {
        return {
          success: false,
          error: "هذا الملف مرتبط بمستخدم آخر",
        };
      }

      // Check if user already has a pending request
      const { data: existingRequest } = await supabase
        .from("profile_link_requests")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .single();

      if (existingRequest) {
        return {
          success: false,
          error: "لديك طلب قيد المراجعة بالفعل",
          existingRequest: true,
        };
      }

      // Create or update link request (proper flow through admin approval)
      const { data: request, error: requestError } = await supabase
        .from("profile_link_requests")
        .upsert(
          {
            user_id: user.id,
            profile_id: profileId,
            name_chain: nameChain,
            phone: user.phone,
            status: "pending",
            created_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,profile_id",
            ignoreDuplicates: false,
          }
        )
        .select()
        .single();

      if (requestError) throw requestError;

      // Notify admins of new request
      try {
        const { notifyAdminsOfNewRequest } = await import("./notifications");
        await notifyAdminsOfNewRequest({
          id: request.id,
          name_chain: nameChain,
          profile_id: profileId,
        });
      } catch (notifError) {
        // Notification error (non-critical)
      }

      return {
        success: true,
        message: "تم إرسال طلب الربط للمراجعة",
        requestId: request.id,
        needsApproval: true,
      };
    } catch (error) {
      console.error("Error submitting link request:", error);
      return {
        success: false,
        error: error.message || "فشل إرسال طلب الربط",
      };
    }
  },

  /**
   * Get user's pending link requests
   */
  async getUserLinkRequests() {
    if (!featureFlags.profileLinkRequests) {
      return {
        success: true,
        requests: [],
      };
    }
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { success: false, requests: [] };

      const { data, error } = await supabase
        .from("profile_link_requests")
        .select(
          `
          *,
          profile:profiles!profile_link_requests_profile_id_fkey(name, hid, generation)
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return { success: true, requests: data || [] };
    } catch (error) {
      console.error("Error getting link requests:", error);
      return {
        success: false,
        error: error.message,
        requests: [],
      };
    }
  },

  /**
   * Withdraw a pending link request
   */
  async withdrawLinkRequest(requestId) {
    if (!featureFlags.profileLinkRequests) {
      return {
        success: false,
        error: 'لا توجد طلبات ربط فعّالة لحذفها في الإصدار الحالي.',
      };
    }
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return {
          success: false,
          error: "يجب تسجيل الدخول أولاً",
        };
      }

      // Delete the request (only if it's pending and belongs to the user)
      const { error } = await supabase
        .from("profile_link_requests")
        .delete()
        .eq("id", requestId)
        .eq("user_id", user.id)
        .eq("status", "pending");

      if (error) throw error;

      return {
        success: true,
        message: "تم سحب الطلب بنجاح",
      };
    } catch (error) {
      console.error("Error withdrawing link request:", error);
      return {
        success: false,
        error: error.message || "فشل سحب الطلب",
      };
    }
  },

  /**
   * Request to unlink profile (for already linked users)
   */
  async requestUnlinkProfile() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return {
          success: false,
          error: "يجب تسجيل الدخول أولاً",
        };
      }

      // Find user's linked profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("user_id", user.id)
        .single();

      if (!profile) {
        return {
          success: false,
          error: "لا يوجد ملف مرتبط",
        };
      }

      // Create an admin message requesting unlink
      const { error } = await supabase
        .from("admin_messages")
        .insert({
          user_id: user.id,
          type: "unlink_request",
          message: `طلب إلغاء ربط الملف: ${profile.name}`,
          profile_id: profile.id,
          status: "pending",
        });

      if (error) throw error;

      // Notify admins
      try {
        const { notifyAdminsOfNewRequest } = await import("./notifications");
        await notifyAdminsOfNewRequest({
          type: "unlink_request",
          name_chain: profile.name,
          profile_id: profile.id,
        });
      } catch (notifError) {
        // Notification error (non-critical)
      }

      return {
        success: true,
        message: "تم إرسال طلب إلغاء الربط للمشرف",
      };
    } catch (error) {
      console.error("Error requesting unlink:", error);
      return {
        success: false,
        error: error.message || "فشل إرسال الطلب",
      };
    }
  },

  /**
   * Admin: Approve a profile link request
   */
  async approveProfileLink(requestId, adminNotes = null) {
    if (!featureFlags.profileLinkRequests) {
      return {
        success: false,
        error: 'لوحة طلبات الربط غير مفعلة.',
      };
    }
    try {
      // Try the new secure RPC function first
      const { data, error } = await supabase.rpc('admin_approve_request', {
        p_request_id: requestId,
        p_admin_notes: adminNotes
      });

      // If the function doesn't exist, fall back to the old one
      if (error && error.message?.includes('function') && error.message?.includes('does not exist')) {
        console.warn('New RPC function not found, falling back to old function');
        const { data: fallbackData, error: fallbackError } = await supabase.rpc('approve_profile_link_request', {
          p_request_id: requestId,
          p_admin_notes: adminNotes
        });

        if (fallbackError) throw fallbackError;

        return {
          success: true,
          message: "تمت الموافقة على الطلب بنجاح"
        };
      }

      if (error) throw error;

      // Check if the RPC function returned success
      if (data && data.success) {
        return {
          success: true,
          message: "تمت الموافقة على الطلب بنجاح"
        };
      } else {
        throw new Error(data?.error || "فشلت الموافقة على الطلب");
      }
    } catch (error) {
      console.error("Error approving profile link:", error);
      return {
        success: false,
        error: error.message || "فشلت الموافقة على الطلب"
      };
    }
  },

  /**
   * Admin: Reject a profile link request
   */
  async rejectProfileLink(requestId, adminNotes = null) {
    if (!featureFlags.profileLinkRequests) {
      return {
        success: false,
        error: 'لوحة طلبات الربط غير مفعلة.',
      };
    }
    try {
      // Try the new secure RPC function first
      const { data, error } = await supabase.rpc('admin_reject_request', {
        p_request_id: requestId,
        p_rejection_reason: adminNotes
      });

      // If the function doesn't exist, fall back to the old one
      if (error && error.message?.includes('function') && error.message?.includes('does not exist')) {
        console.warn('New RPC function not found, falling back to old function');
        const { data: fallbackData, error: fallbackError } = await supabase.rpc('reject_profile_link_request', {
          p_request_id: requestId,
          p_admin_notes: adminNotes
        });

        if (fallbackError) throw fallbackError;

        return {
          success: true,
          message: "تم رفض الطلب"
        };
      }

      if (error) throw error;

      // Check if the RPC function returned success
      if (data && data.success) {
        return {
          success: true,
          message: "تم رفض الطلب"
        };
      } else {
        throw new Error(data?.error || "فشل رفض الطلب");
      }
    } catch (error) {
      console.error("Error rejecting profile link:", error);
      return {
        success: false,
        error: error.message || "فشل رفض الطلب"
      };
    }
  },

  /**
   * Admin: Force unlink a profile from a user
   */
  async adminForceUnlinkProfile(profileId, adminNotes = null) {
    try {
      const { data, error } = await supabase.rpc('admin_force_unlink_profile', {
        p_profile_id: profileId,
        p_admin_notes: adminNotes
      });

      if (error) throw error;

      return {
        success: true,
        message: "تم إلغاء الربط بنجاح"
      };
    } catch (error) {
      console.error("Error force unlinking profile:", error);
      return {
        success: false,
        error: error.message || "فشل إلغاء الربط"
      };
    }
  },

  /**
   * Admin: Get all pending profile link requests
   */
  async getPendingLinkRequests() {
    if (!featureFlags.profileLinkRequests) {
      return {
        success: true,
        requests: [],
      };
    }
    try {
      const { data, error } = await supabase
        .from('profile_link_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      console.error("Error fetching pending requests:", error);
      return {
        success: false,
        error: error.message || "فشل جلب الطلبات",
        data: []
      };
    }
  },

  /**
   * Admin: Get all admin messages
   */
  async getAdminMessages(type = null) {
    try {
      let query = supabase
        .from('admin_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      console.error("Error fetching admin messages:", error);
      return {
        success: false,
        error: error.message || "فشل جلب الرسائل",
        data: []
      };
    }
  },

  /**
   * Admin: Mark message as read
   */
  async markMessageAsRead(messageId) {
    try {
      const { error } = await supabase
        .from('admin_messages')
        .update({ status: 'read' })
        .eq('id', messageId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error("Error marking message as read:", error);
      return {
        success: false,
        error: error.message || "فشل تحديث الرسالة"
      };
    }
  },

  /**
   * Sign out
   */
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Clear any stored data
      await AsyncStorage.removeItem("pendingPhoneAuth");

      return { success: true };
    } catch (error) {
      console.error("Error signing out:", error);
      return {
        success: false,
        error: error.message || "فشل تسجيل الخروج",
      };
    }
  },

  /**
   * Resend OTP
   */
  async resendOTP() {
    try {
      const phoneNumber = await AsyncStorage.getItem("pendingPhoneAuth");
      if (!phoneNumber) {
        return {
          success: false,
          error: "لم يتم العثور على رقم الهاتف",
        };
      }

      return await this.sendOTP(phoneNumber);
    } catch (error) {
      console.error("Error resending OTP:", error);
      return {
        success: false,
        error: error.message || "فشل إعادة إرسال رمز التحقق",
      };
    }
  },
};

export default phoneAuthService;
