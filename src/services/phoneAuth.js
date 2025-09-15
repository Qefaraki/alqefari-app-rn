import { supabase } from "./supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const phoneAuthService = {
  /**
   * Format phone number to international format
   * Handles Saudi numbers (05xxxxxxxx or 5xxxxxxxx)
   */
  formatPhoneNumber(phone) {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, "");

    // Handle Saudi numbers
    if (cleaned.startsWith("05")) {
      // 05xxxxxxxx -> +966 5xxxxxxxx
      cleaned = "966" + cleaned.substring(1);
    } else if (cleaned.startsWith("5") && cleaned.length === 9) {
      // 5xxxxxxxx -> +966 5xxxxxxxx
      cleaned = "966" + cleaned;
    } else if (cleaned.startsWith("00966")) {
      // 00966xxxxxxxxx -> 966xxxxxxxxx
      cleaned = cleaned.substring(2);
    } else if (!cleaned.startsWith("966")) {
      // Assume it's a Saudi number missing country code
      cleaned = "966" + cleaned;
    }

    return "+" + cleaned;
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
    if (!user) return null;

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_user_id", user.id)
        .single();

      if (error) {
        console.log("No linked profile found");
        return null;
      }

      return profile;
    } catch (error) {
      console.error("Error checking profile link:", error);
      return null;
    }
  },

  /**
   * Search for profiles by name chain
   */
  async searchProfilesByNameChain(nameChain) {
    try {
      const { data, error } = await supabase.rpc(
        "search_profiles_by_name_chain",
        {
          p_name_chain: nameChain,
        },
      );

      if (error) throw error;

      return { success: true, profiles: data || [] };
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
      const { data, error } = await supabase.rpc("get_profile_tree_context", {
        p_profile_id: profileId,
      });

      if (error) throw error;

      return { success: true, context: data };
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
    try {
      const { data, error } = await supabase.rpc(
        "submit_profile_link_request",
        {
          p_profile_id: profileId,
          p_name_chain: nameChain,
        },
      );

      if (error) throw error;

      return {
        success: true,
        requestId: data,
        message: "تم إرسال طلب الربط. سيتم مراجعته من قبل المشرف.",
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
          profile:profiles(name, hid, generation)
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
