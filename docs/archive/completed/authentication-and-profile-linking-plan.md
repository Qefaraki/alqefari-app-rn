# Phone Authentication & Profile Linking System - Comprehensive Plan

## Executive Summary

This document outlines a complete authentication system using phone numbers with SMS OTP, profile creation and linking mechanisms, and a premium onboarding experience for the Alqefari Family Tree app. The system allows family members to claim their existing profiles or create new ones, with admin oversight for verification.

## Current State Analysis

### Existing Infrastructure

- **Database**: Profiles table with 10,000+ existing family members
- **Auth System**: Supabase Auth with email/password (currently for admins only)
- **Admin System**: Role-based access control with `profiles.role` field
- **Profile Structure**: HID-based hierarchy with father/mother relationships
- **Missing**: Phone field exists in profiles but not utilized for auth

### Key Challenges

1. Most profiles exist without associated auth accounts
2. No phone verification system
3. No profile claiming mechanism
4. No onboarding flow for new users
5. Limited to email auth (not ideal for Arabic-speaking family)

## System Architecture

### 1. Database Schema Updates

```sql
-- Add authentication linking fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  auth_user_id UUID REFERENCES auth.users(id),
  phone_verified BOOLEAN DEFAULT FALSE,
  phone_verified_at TIMESTAMPTZ,
  claim_status TEXT CHECK (claim_status IN ('unclaimed', 'pending', 'verified', 'rejected')),
  claim_requested_at TIMESTAMPTZ,
  claim_verified_by UUID REFERENCES profiles(id),
  claim_verification_notes TEXT;

-- Create profile claims table for audit trail
CREATE TABLE profile_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) NOT NULL,
  claimed_by_user_id UUID REFERENCES auth.users(id) NOT NULL,
  phone_number TEXT NOT NULL,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('self', 'parent', 'guardian')),
  verification_method TEXT CHECK (verification_method IN ('sms', 'admin', 'family_member')),
  verification_code TEXT,
  verification_attempts INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
  verified_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- Create pending profiles for users without tree nodes
CREATE TABLE pending_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female')),
  requested_father_name TEXT,
  requested_mother_name TEXT,
  requested_family_branch TEXT,
  additional_info JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'linked')),
  reviewed_by UUID REFERENCES profiles(id),
  review_notes TEXT,
  linked_profile_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_profiles_auth_user_id ON profiles(auth_user_id);
CREATE INDEX idx_profiles_claim_status ON profiles(claim_status) WHERE claim_status IS NOT NULL;
CREATE INDEX idx_profile_claims_user ON profile_claims(claimed_by_user_id);
CREATE INDEX idx_profile_claims_profile ON profile_claims(profile_id);
CREATE INDEX idx_profile_claims_status ON profile_claims(status);
CREATE INDEX idx_pending_profiles_user ON pending_profiles(auth_user_id);
CREATE INDEX idx_pending_profiles_status ON pending_profiles(status);
```

### 2. Phone Authentication Flow

#### 2.1 SMS OTP Implementation

```javascript
// src/services/phoneAuth.js
import { supabase } from "./supabase";

export const phoneAuthService = {
  // Format Saudi phone numbers
  formatPhoneNumber(phone) {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, "");

    // Handle Saudi numbers (05xxxxxxxx or 5xxxxxxxx)
    if (cleaned.startsWith("05")) {
      cleaned = "966" + cleaned.substring(1);
    } else if (cleaned.startsWith("5") && cleaned.length === 9) {
      cleaned = "966" + cleaned;
    } else if (!cleaned.startsWith("966")) {
      cleaned = "966" + cleaned;
    }

    return "+" + cleaned;
  },

  // Send OTP
  async sendOTP(phoneNumber) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);

    const { data, error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
      options: {
        channel: "sms",
        shouldCreateUser: true,
      },
    });

    return { data, error, formattedPhone };
  },

  // Verify OTP
  async verifyOTP(phoneNumber, token) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);

    const { data, error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token,
      type: "sms",
    });

    if (data?.user) {
      // Check if user has a linked profile
      await this.checkProfileLink(data.user);
    }

    return { data, error };
  },

  // Check if authenticated user has a linked profile
  async checkProfileLink(user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", user.id)
      .single();

    return profile;
  },
};
```

#### 2.2 Phone Verification UI Flow

```javascript
// src/screens/PhoneAuthScreen.js
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { phoneAuthService } from "../services/phoneAuth";

export default function PhoneAuthScreen({ navigation }) {
  const [step, setStep] = useState("phone"); // 'phone' or 'otp'
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    setLoading(true);
    const { error, formattedPhone } =
      await phoneAuthService.sendOTP(phoneNumber);

    if (error) {
      Alert.alert("خطأ", "فشل إرسال رمز التحقق");
    } else {
      setStep("otp");
      Alert.alert("نجح", `تم إرسال رمز التحقق إلى ${formattedPhone}`);
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    setLoading(true);
    const { data, error } = await phoneAuthService.verifyOTP(phoneNumber, otp);

    if (error) {
      Alert.alert("خطأ", "رمز التحقق غير صحيح");
    } else {
      // Check if user has profile
      const profile = await phoneAuthService.checkProfileLink(data.user);

      if (profile) {
        // User has profile, go to main app
        navigation.replace("MainApp");
      } else {
        // No profile, go to onboarding
        navigation.replace("Onboarding", { user: data.user });
      }
    }
    setLoading(false);
  };

  // UI implementation...
}
```

### 3. Profile Linking System

#### 3.1 Profile Claiming Flow

```javascript
// src/services/profileLinking.js
export const profileLinkingService = {
  // Search for potential profile matches
  async searchPotentialProfiles(name, fatherName, phoneNumber) {
    const { data, error } = await supabase.rpc("search_unclaimed_profiles", {
      p_name: name,
      p_father_name: fatherName,
      p_phone: phoneNumber,
    });

    return { data, error };
  },

  // Claim an existing profile
  async claimProfile(profileId, userId, verificationType = "sms") {
    const { data, error } = await supabase.rpc("claim_profile", {
      p_profile_id: profileId,
      p_user_id: userId,
      p_verification_type: verificationType,
    });

    return { data, error };
  },

  // Create a pending profile request
  async createPendingProfile(userData) {
    const { data, error } = await supabase
      .from("pending_profiles")
      .insert({
        auth_user_id: userData.userId,
        name: userData.name,
        phone: userData.phone,
        gender: userData.gender,
        requested_father_name: userData.fatherName,
        requested_mother_name: userData.motherName,
        requested_family_branch: userData.familyBranch,
        additional_info: userData.additionalInfo,
      })
      .select()
      .single();

    return { data, error };
  },
};
```

#### 3.2 Admin Verification Dashboard

```javascript
// src/screens/admin/ProfileClaimsManagement.js
export function ProfileClaimsManagement() {
  const [pendingClaims, setPendingClaims] = useState([]);
  const [pendingProfiles, setPendingProfiles] = useState([]);

  // Load pending claims
  useEffect(() => {
    loadPendingClaims();
    loadPendingProfiles();
  }, []);

  const loadPendingClaims = async () => {
    const { data } = await supabase
      .from("profile_claims")
      .select(
        `
        *,
        profile:profiles(*),
        user:auth.users(*)
      `,
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    setPendingClaims(data || []);
  };

  const loadPendingProfiles = async () => {
    const { data } = await supabase
      .from("pending_profiles")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    setPendingProfiles(data || []);
  };

  const approveClaim = async (claimId) => {
    await supabase.rpc("admin_approve_profile_claim", {
      p_claim_id: claimId,
    });
    loadPendingClaims();
  };

  const rejectClaim = async (claimId, reason) => {
    await supabase.rpc("admin_reject_profile_claim", {
      p_claim_id: claimId,
      p_reason: reason,
    });
    loadPendingClaims();
  };

  const linkPendingProfile = async (pendingId, profileId) => {
    await supabase.rpc("admin_link_pending_profile", {
      p_pending_id: pendingId,
      p_profile_id: profileId,
    });
    loadPendingProfiles();
  };

  // UI for managing claims and pending profiles...
}
```

### 4. Onboarding Experience

#### 4.1 Onboarding Flow States

```javascript
// src/screens/onboarding/OnboardingNavigator.js
const OnboardingSteps = {
  WELCOME: "welcome",
  PHONE_VERIFY: "phone_verify",
  BASIC_INFO: "basic_info",
  FAMILY_SEARCH: "family_search",
  CLAIM_PROFILE: "claim_profile",
  CREATE_PROFILE: "create_profile",
  AWAITING_APPROVAL: "awaiting_approval",
  COMPLETE: "complete",
};

export function OnboardingNavigator({ user }) {
  const [currentStep, setCurrentStep] = useState(OnboardingSteps.WELCOME);
  const [onboardingData, setOnboardingData] = useState({
    userId: user.id,
    phone: user.phone,
    name: "",
    gender: "",
    fatherName: "",
    motherName: "",
    familyBranch: "",
    potentialMatches: [],
    selectedProfile: null,
    pendingProfileId: null,
  });

  const screens = {
    [OnboardingSteps.WELCOME]: WelcomeScreen,
    [OnboardingSteps.BASIC_INFO]: BasicInfoScreen,
    [OnboardingSteps.FAMILY_SEARCH]: FamilySearchScreen,
    [OnboardingSteps.CLAIM_PROFILE]: ClaimProfileScreen,
    [OnboardingSteps.CREATE_PROFILE]: CreateProfileScreen,
    [OnboardingSteps.AWAITING_APPROVAL]: AwaitingApprovalScreen,
    [OnboardingSteps.COMPLETE]: CompleteScreen,
  };

  // Navigate through steps based on user actions...
}
```

#### 4.2 Welcome & Introduction

```javascript
// src/screens/onboarding/WelcomeScreen.js
export function WelcomeScreen({ onNext }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image source={require("../assets/logo.png")} style={styles.logo} />
        <Text style={styles.title}>مرحباً بك في شجرة عائلة القفاري</Text>
      </View>

      <View style={styles.features}>
        <FeatureItem
          icon="tree"
          title="اكتشف تاريخ عائلتك"
          description="تصفح شجرة العائلة الكاملة واكتشف روابطك العائلية"
        />
        <FeatureItem
          icon="link"
          title="اربط ملفك الشخصي"
          description="ابحث عن ملفك الموجود أو أنشئ ملفاً جديداً"
        />
        <FeatureItem
          icon="shield"
          title="خصوصية وأمان"
          description="معلوماتك محمية ولن تُشارك إلا بإذنك"
        />
      </View>

      <TouchableOpacity style={styles.continueButton} onPress={onNext}>
        <Text style={styles.continueText}>ابدأ</Text>
      </TouchableOpacity>
    </View>
  );
}
```

#### 4.3 Family Search & Matching

```javascript
// src/screens/onboarding/FamilySearchScreen.js
export function FamilySearchScreen({ onboardingData, onNext, onBack }) {
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    searchForMatches();
  }, []);

  const searchForMatches = async () => {
    setSearching(true);

    // Search using multiple criteria
    const { data } = await supabase.rpc("intelligent_profile_search", {
      p_name: onboardingData.name,
      p_father_name: onboardingData.fatherName,
      p_phone: onboardingData.phone,
      p_fuzzy_match: true, // Enable fuzzy matching for Arabic names
    });

    setMatches(data || []);
    setSearching(false);
  };

  const selectMatch = (profile) => {
    onboardingData.selectedProfile = profile;
    onNext(OnboardingSteps.CLAIM_PROFILE);
  };

  const noMatchFound = () => {
    onNext(OnboardingSteps.CREATE_PROFILE);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>البحث عن ملفك الشخصي</Text>
      <Text style={styles.subtitle}>
        نبحث عن ملفك بناءً على المعلومات التي قدمتها
      </Text>

      {searching ? (
        <ActivityIndicator size="large" />
      ) : (
        <>
          {matches.length > 0 ? (
            <FlatList
              data={matches}
              renderItem={({ item }) => (
                <ProfileMatchCard
                  profile={item}
                  confidence={item.match_confidence}
                  onSelect={() => selectMatch(item)}
                />
              )}
            />
          ) : (
            <View style={styles.noMatchContainer}>
              <Icon name="user-x" size={64} color="#999" />
              <Text style={styles.noMatchText}>لم نجد ملفاً مطابقاً</Text>
              <TouchableOpacity
                style={styles.createNewButton}
                onPress={noMatchFound}
              >
                <Text style={styles.createNewText}>إنشاء ملف جديد</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}
```

#### 4.4 Profile Claim Verification

```javascript
// src/screens/onboarding/ClaimProfileScreen.js
export function ClaimProfileScreen({ onboardingData, onNext }) {
  const [verificationMethod, setVerificationMethod] = useState("sms");
  const [verificationCode, setVerificationCode] = useState("");
  const [familyMemberPhone, setFamilyMemberPhone] = useState("");

  const handleClaim = async () => {
    const { data, error } = await supabase.rpc("submit_profile_claim", {
      p_profile_id: onboardingData.selectedProfile.id,
      p_user_id: onboardingData.userId,
      p_verification_method: verificationMethod,
      p_verification_data: {
        code: verificationCode,
        family_member_phone: familyMemberPhone,
      },
    });

    if (error) {
      Alert.alert("خطأ", "فشل تقديم طلب الربط");
      return;
    }

    if (verificationMethod === "admin") {
      // Needs admin approval
      onboardingData.pendingClaimId = data.id;
      onNext(OnboardingSteps.AWAITING_APPROVAL);
    } else {
      // Auto-approved
      onNext(OnboardingSteps.COMPLETE);
    }
  };

  return (
    <View style={styles.container}>
      <ProfileCard profile={onboardingData.selectedProfile} />

      <Text style={styles.title}>تأكيد الهوية</Text>
      <Text style={styles.subtitle}>
        للتحقق من أن هذا ملفك الشخصي، اختر طريقة التحقق
      </Text>

      <VerificationMethodSelector
        selected={verificationMethod}
        onChange={setVerificationMethod}
        options={[
          { id: "sms", label: "رسالة نصية", icon: "message-square" },
          { id: "family", label: "عضو عائلة", icon: "users" },
          { id: "admin", label: "مراجعة إدارية", icon: "shield" },
        ]}
      />

      {verificationMethod === "sms" && (
        <OTPInput
          value={verificationCode}
          onChange={setVerificationCode}
          onResend={() => sendVerificationSMS()}
        />
      )}

      {verificationMethod === "family" && (
        <FamilyMemberVerification
          phoneNumber={familyMemberPhone}
          onChange={setFamilyMemberPhone}
        />
      )}

      <TouchableOpacity style={styles.claimButton} onPress={handleClaim}>
        <Text style={styles.claimText}>تقديم طلب الربط</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### 5. Backend RPC Functions

```sql
-- Search for unclaimed profiles with fuzzy matching
CREATE OR REPLACE FUNCTION search_unclaimed_profiles(
  p_name TEXT,
  p_father_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_fuzzy_match BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  father_name TEXT,
  phone TEXT,
  hid TEXT,
  match_confidence NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH matches AS (
    SELECT
      p.id,
      p.name,
      f.name as father_name,
      p.phone,
      p.hid,
      CASE
        -- Exact name match
        WHEN p.name = p_name THEN 100
        -- Fuzzy name match (using trigram similarity if enabled)
        WHEN p_fuzzy_match AND similarity(p.name, p_name) > 0.6
          THEN similarity(p.name, p_name) * 80
        ELSE 0
      END +
      CASE
        -- Father name match
        WHEN p_father_name IS NOT NULL AND f.name = p_father_name THEN 20
        WHEN p_father_name IS NOT NULL AND p_fuzzy_match
          AND similarity(f.name, p_father_name) > 0.6
          THEN similarity(f.name, p_father_name) * 15
        ELSE 0
      END +
      CASE
        -- Phone match
        WHEN p_phone IS NOT NULL AND p.phone = p_phone THEN 20
        ELSE 0
      END AS match_confidence
    FROM profiles p
    LEFT JOIN profiles f ON p.father_id = f.id
    WHERE
      p.auth_user_id IS NULL -- Unclaimed profiles only
      AND p.deleted_at IS NULL
      AND (
        p.name ILIKE '%' || p_name || '%'
        OR (p_fuzzy_match AND similarity(p.name, p_name) > 0.4)
        OR (p_phone IS NOT NULL AND p.phone = p_phone)
      )
  )
  SELECT * FROM matches
  WHERE match_confidence > 30
  ORDER BY match_confidence DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit a profile claim
CREATE OR REPLACE FUNCTION submit_profile_claim(
  p_profile_id UUID,
  p_user_id UUID,
  p_verification_method TEXT,
  p_verification_data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_claim_id UUID;
  v_auto_approve BOOLEAN := FALSE;
BEGIN
  -- Check if profile is already claimed
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_profile_id AND auth_user_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Profile is already claimed';
  END IF;

  -- Check if user already has a profile
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE auth_user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User already has a linked profile';
  END IF;

  -- Create claim record
  INSERT INTO profile_claims (
    profile_id,
    claimed_by_user_id,
    phone_number,
    claim_type,
    verification_method,
    metadata
  ) VALUES (
    p_profile_id,
    p_user_id,
    (SELECT phone FROM auth.users WHERE id = p_user_id),
    'self',
    p_verification_method,
    p_verification_data
  ) RETURNING id INTO v_claim_id;

  -- Auto-approve for certain verification methods
  IF p_verification_method = 'sms' AND
     p_verification_data->>'verified' = 'true' THEN
    v_auto_approve := TRUE;
  END IF;

  IF v_auto_approve THEN
    -- Auto-approve the claim
    UPDATE profile_claims
    SET
      status = 'verified',
      verified_at = NOW()
    WHERE id = v_claim_id;

    -- Link the profile
    UPDATE profiles
    SET
      auth_user_id = p_user_id,
      phone_verified = TRUE,
      phone_verified_at = NOW(),
      claim_status = 'verified'
    WHERE id = p_profile_id;
  ELSE
    -- Mark profile as pending claim
    UPDATE profiles
    SET
      claim_status = 'pending',
      claim_requested_at = NOW()
    WHERE id = p_profile_id;
  END IF;

  RETURN v_claim_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin function to approve profile claim
CREATE OR REPLACE FUNCTION admin_approve_profile_claim(
  p_claim_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_profile_id UUID;
  v_user_id UUID;
BEGIN
  -- Verify admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get claim details
  SELECT profile_id, claimed_by_user_id
  INTO v_profile_id, v_user_id
  FROM profile_claims
  WHERE id = p_claim_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found or already processed';
  END IF;

  -- Update claim
  UPDATE profile_claims
  SET
    status = 'verified',
    verified_by = auth.uid(),
    verified_at = NOW()
  WHERE id = p_claim_id;

  -- Link profile to user
  UPDATE profiles
  SET
    auth_user_id = v_user_id,
    phone_verified = TRUE,
    phone_verified_at = NOW(),
    claim_status = 'verified',
    claim_verified_by = auth.uid()
  WHERE id = v_profile_id;

  -- Log the action
  INSERT INTO audit_log (
    action,
    table_name,
    record_id,
    user_id,
    details
  ) VALUES (
    'APPROVE_CLAIM',
    'profile_claims',
    p_claim_id,
    auth.uid(),
    jsonb_build_object(
      'profile_id', v_profile_id,
      'user_id', v_user_id
    )
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 6. Security & Privacy Considerations

#### 6.1 Data Protection

- Phone numbers are hashed in database
- OTP codes expire after 5 minutes
- Maximum 3 verification attempts per hour
- Profile claims expire after 24 hours

#### 6.2 Access Control

```sql
-- RLS Policies for profile claims
ALTER TABLE profile_claims ENABLE ROW LEVEL SECURITY;

-- Users can only see their own claims
CREATE POLICY profile_claims_own ON profile_claims
  FOR SELECT
  USING (claimed_by_user_id = auth.uid());

-- Admins can see all claims
CREATE POLICY profile_claims_admin ON profile_claims
  FOR ALL
  USING (is_admin());

-- RLS for pending profiles
ALTER TABLE pending_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only see their own pending profile
CREATE POLICY pending_profiles_own ON pending_profiles
  FOR SELECT
  USING (auth_user_id = auth.uid());

-- Users can update their own pending profile before approval
CREATE POLICY pending_profiles_update ON pending_profiles
  FOR UPDATE
  USING (auth_user_id = auth.uid() AND status = 'pending');
```

#### 6.3 Privacy Settings

```javascript
// src/services/privacySettings.js
export const privacySettings = {
  PHONE_VISIBILITY: {
    HIDDEN: "hidden", // No one can see
    FAMILY: "family", // Only linked family members
    VERIFIED: "verified", // Only verified users
    PUBLIC: "public", // Everyone (not recommended)
  },

  PROFILE_VISIBILITY: {
    PRIVATE: "private", // Only self
    FAMILY: "family", // Family members
    PUBLIC: "public", // All authenticated users
  },
};
```

### 7. Admin Management Interface

#### 7.1 Claims Dashboard

```javascript
// src/screens/admin/ClaimsDashboard.js
export function ClaimsDashboard() {
  return (
    <View style={styles.container}>
      <DashboardStats />
      <Tabs>
        <Tab title="Pending Claims" count={pendingClaims.length}>
          <PendingClaimsList />
        </Tab>
        <Tab title="Pending Profiles" count={pendingProfiles.length}>
          <PendingProfilesList />
        </Tab>
        <Tab title="Recent Approvals">
          <RecentApprovalsList />
        </Tab>
        <Tab title="Rejected" badge="warning">
          <RejectedList />
        </Tab>
      </Tabs>
    </View>
  );
}
```

#### 7.2 Verification Tools

- Photo comparison for identity verification
- Family tree context viewer
- Communication tools (SMS/Call buttons)
- Bulk approval/rejection
- Auto-matching suggestions

### 8. User Experience Flows

#### 8.1 New User Journey

1. **Download App** → Splash screen with family tree visualization
2. **Phone Entry** → Clean UI with country code selector
3. **OTP Verification** → Auto-fill from SMS, resend option
4. **Basic Info** → Name, gender, parent names
5. **Profile Search** → Intelligent matching with confidence scores
6. **Claim/Create** → Either claim existing or request new profile
7. **Waiting/Success** → Clear status with next steps

#### 8.2 Returning User Journey

1. **App Open** → Auto-login if session valid
2. **Phone Verification** → If new device
3. **Main App** → Direct to tree view with their profile highlighted

#### 8.3 Edge Cases

- **Multiple Profiles Found**: Show all with match confidence
- **No Matches**: Create pending profile for admin review
- **Duplicate Claims**: First claim wins, notify second user
- **Lost Phone**: Recovery via admin with identity verification

### 9. Implementation Phases

#### Phase 1: Foundation (Week 1-2)

- [ ] Database schema updates
- [ ] Supabase phone auth configuration
- [ ] Basic phone auth flow
- [ ] Profile linking backend functions

#### Phase 2: Core Features (Week 3-4)

- [ ] Profile search and matching
- [ ] Claim submission system
- [ ] Basic onboarding screens
- [ ] Admin claim management

#### Phase 3: Enhanced Experience (Week 5-6)

- [ ] Intelligent matching algorithm
- [ ] Family member verification
- [ ] Onboarding animations
- [ ] Push notifications setup

#### Phase 4: Polish & Testing (Week 7-8)

- [ ] Error handling & edge cases
- [ ] Performance optimization
- [ ] Security audit
- [ ] Beta testing with family members

### 10. Technical Requirements

#### 10.1 Supabase Configuration

```javascript
// Enable phone auth in Supabase Dashboard
// Settings > Auth > Phone Auth
{
  "ENABLE_PHONE_SIGNUP": true,
  "ENABLE_PHONE_AUTOCONFIRM": false,
  "SMS_PROVIDER": "twilio", // or messagebird
  "SMS_TWILIO_ACCOUNT_SID": "your_sid",
  "SMS_TWILIO_AUTH_TOKEN": "your_token",
  "SMS_TWILIO_MESSAGE_SERVICE_SID": "your_service_sid",
  "SMS_OTP_EXP": 300, // 5 minutes
  "SMS_OTP_LENGTH": 6,
  "SMS_TEMPLATE": "رمز التحقق الخاص بك في شجرة عائلة القفاري: {{.Code}}"
}
```

#### 10.2 Required Packages

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "react-native-otp-textinput": "^1.1.1",
    "libphonenumber-js": "^1.10.0",
    "react-native-phone-number-input": "^2.1.0",
    "@react-native-firebase/messaging": "^18.0.0",
    "react-native-permissions": "^3.9.0"
  }
}
```

### 11. Analytics & Monitoring

#### 11.1 Key Metrics

- Onboarding completion rate
- Profile claim success rate
- Average time to approval
- User retention after linking
- SMS delivery success rate

#### 11.2 Admin Dashboard Metrics

```sql
-- Dashboard statistics function
CREATE OR REPLACE FUNCTION get_auth_statistics()
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'linked_profiles', (SELECT COUNT(*) FROM profiles WHERE auth_user_id IS NOT NULL),
    'pending_claims', (SELECT COUNT(*) FROM profile_claims WHERE status = 'pending'),
    'pending_profiles', (SELECT COUNT(*) FROM pending_profiles WHERE status = 'pending'),
    'claims_last_24h', (
      SELECT COUNT(*) FROM profile_claims
      WHERE created_at > NOW() - INTERVAL '24 hours'
    ),
    'approval_rate', (
      SELECT
        ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'verified') /
        NULLIF(COUNT(*), 0), 2)
      FROM profile_claims
      WHERE created_at > NOW() - INTERVAL '7 days'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 12. Future Enhancements

1. **WhatsApp Integration**: Use WhatsApp Business API for OTP
2. **Face Recognition**: Optional photo verification for claims
3. **Family Invitations**: Existing members can invite relatives
4. **Biometric Auth**: FaceID/TouchID after initial setup
5. **Social Login**: Optional Google/Apple login for younger generation
6. **Progressive Disclosure**: Gradual profile completion
7. **Gamification**: Badges for completing family connections
8. **AI Matching**: ML model for better profile matching

## Conclusion

This comprehensive authentication and profile linking system provides:

- ✅ Seamless phone-based authentication
- ✅ Intelligent profile matching
- ✅ Multiple verification methods
- ✅ Admin oversight and control
- ✅ Privacy-first approach
- ✅ Premium user experience
- ✅ Scalable architecture

The system respects Arabic culture (phone over email), maintains data integrity, and provides a delightful onboarding experience while ensuring security and privacy.
