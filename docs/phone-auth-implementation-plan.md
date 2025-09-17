# Phone Authentication & Profile Linking Implementation Plan

## Overview

Complete authentication system with phone-based login, profile linking, moderator hierarchy, and edit suggestion workflow for the Alqefari Family Tree app.

## Core Principles

- **Speed over security** - Get users linked to profiles ASAP
- **Manual verification** - All profile links reviewed by admins via WhatsApp
- **Read-only by default** - Everyone can view the full tree
- **Progressive permissions** - Users → Moderators → Admins

## 1. Authentication System

### 1.1 Phone Authentication Flow

```
1. Enter Phone → SMS OTP → Verified Phone Account
2. Enter Name Chain: "أحمد محمد عبدالله القفاري"
3. Search & Match Profiles → Show Tree Context
4. Select Profile → Submit Link Request
5. Admin Reviews → WhatsApp Verification → Approved/Rejected
```

### 1.2 Database Schema

```sql
-- Extend profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  auth_user_id UUID REFERENCES auth.users(id),
  phone_verified BOOLEAN DEFAULT FALSE,
  claim_status TEXT CHECK (claim_status IN ('unclaimed', 'pending', 'verified', 'rejected')),
  claim_requested_at TIMESTAMPTZ,
  claim_verified_by UUID REFERENCES profiles(id);

-- Profile link requests
CREATE TABLE profile_link_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  profile_id UUID REFERENCES profiles(id) NOT NULL,
  name_chain TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  review_notes TEXT,
  whatsapp_contacted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- Edit suggestions system
CREATE TABLE edit_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) NOT NULL,
  suggested_by UUID REFERENCES auth.users(id) NOT NULL,
  field_name TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  reviewed_by UUID REFERENCES profiles(id),
  review_type TEXT CHECK (review_type IN ('owner', 'moderator', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- Moderator permissions
CREATE TABLE moderator_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  branch_root_id UUID REFERENCES profiles(id) NOT NULL,
  can_edit BOOLEAN DEFAULT TRUE,
  can_delete BOOLEAN DEFAULT FALSE,
  can_add_marriages BOOLEAN DEFAULT TRUE,
  can_approve_links BOOLEAN DEFAULT TRUE,
  can_approve_edits BOOLEAN DEFAULT TRUE,
  granted_by UUID REFERENCES profiles(id) NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, branch_root_id)
);

-- Notification system
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('edit_suggestion', 'link_request', 'approval', 'rejection', 'mention')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Activity tracking
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp templates
CREATE TABLE whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  template_text TEXT NOT NULL,
  variables TEXT[], -- {name}, {profile_name}, etc
  is_active BOOLEAN DEFAULT TRUE,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_link_requests_status ON profile_link_requests(status) WHERE status = 'pending';
CREATE INDEX idx_edit_suggestions_status ON edit_suggestions(status, profile_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_activity_log_user ON activity_log(user_id, created_at DESC);
CREATE INDEX idx_moderator_branch ON moderator_permissions(branch_root_id);
```

## 2. User Permission Levels

### 2.1 Permission Hierarchy

```javascript
const PermissionLevels = {
  GUEST: {
    // Not logged in
    canView: true,
    canSearch: true,
    canZoomPan: true,
    canExport: false,
    canEdit: [],
    canSuggestEdits: false,
  },

  READ_ONLY: {
    // Logged in but not linked to profile
    canView: true,
    canSearch: true,
    canZoomPan: true,
    canExport: true,
    canEdit: [],
    canSuggestEdits: true,
    canContactAdmin: true,
  },

  FAMILY_MEMBER: {
    // Linked to profile
    canView: true,
    canSearch: true,
    canZoomPan: true,
    canExport: true,
    canEdit: ["self", "children", "parents", "spouse"],
    canSuggestEdits: true,
    canApproveOwnEdits: true,
    canAddChildren: true,
    canUpdateMarriage: true,
  },

  MODERATOR: {
    // Branch admin
    canView: true,
    canSearch: true,
    canZoomPan: true,
    canExport: true,
    canEdit: ["branch"], // All descendants of assigned root
    canSuggestEdits: true,
    canApproveEdits: ["branch"],
    canApproveLinkRequests: ["branch"],
    canAddProfiles: ["branch"],
    canDeleteProfiles: ["branch"],
    canAddMarriages: ["branch"],
  },

  ADMIN: {
    // Full admin
    canEdit: ["all"],
    canApproveEdits: ["all"],
    canApproveLinkRequests: ["all"],
    canAddProfiles: ["all"],
    canDeleteProfiles: ["all"],
    canAssignModerators: true,
    canEditTemplates: true,
    canViewAnalytics: true,
    canExportData: true,
  },
};
```

### 2.2 Moderator Assignment Function

```sql
CREATE OR REPLACE FUNCTION assign_moderator(
  p_user_id UUID,
  p_branch_root_id UUID,
  p_permissions JSONB DEFAULT '{"can_edit": true, "can_approve": true}'
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Only admins can assign moderators
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO moderator_permissions (
    user_id,
    branch_root_id,
    can_edit,
    can_delete,
    can_add_marriages,
    can_approve_links,
    can_approve_edits,
    granted_by
  ) VALUES (
    p_user_id,
    p_branch_root_id,
    COALESCE((p_permissions->>'can_edit')::BOOLEAN, TRUE),
    COALESCE((p_permissions->>'can_delete')::BOOLEAN, FALSE),
    COALESCE((p_permissions->>'can_add_marriages')::BOOLEAN, TRUE),
    COALESCE((p_permissions->>'can_approve_links')::BOOLEAN, TRUE),
    COALESCE((p_permissions->>'can_approve_edits')::BOOLEAN, TRUE),
    auth.uid()
  )
  ON CONFLICT (user_id, branch_root_id)
  DO UPDATE SET
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    can_add_marriages = EXCLUDED.can_add_marriages,
    can_approve_links = EXCLUDED.can_approve_links,
    can_approve_edits = EXCLUDED.can_approve_edits,
    granted_by = EXCLUDED.granted_by,
    granted_at = NOW();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can edit a specific profile
CREATE OR REPLACE FUNCTION can_user_edit_profile(
  p_user_id UUID,
  p_profile_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_profile_id UUID;
  v_target_hid TEXT;
  v_is_admin BOOLEAN;
BEGIN
  -- Check if admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN TRUE;
  END IF;

  -- Get user's profile ID
  SELECT id INTO v_user_profile_id
  FROM profiles
  WHERE auth_user_id = p_user_id;

  -- Can edit self
  IF v_user_profile_id = p_profile_id THEN
    RETURN TRUE;
  END IF;

  -- Can edit children, parents, spouse
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_profile_id
    AND (
      father_id = v_user_profile_id OR
      mother_id = v_user_profile_id OR
      id IN (
        SELECT father_id FROM profiles WHERE id = v_user_profile_id
        UNION
        SELECT mother_id FROM profiles WHERE id = v_user_profile_id
        UNION
        SELECT CASE
          WHEN husband_id = v_user_profile_id THEN wife_id
          WHEN wife_id = v_user_profile_id THEN husband_id
        END
        FROM marriages
        WHERE husband_id = v_user_profile_id OR wife_id = v_user_profile_id
      )
    )
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check moderator permissions
  SELECT hid INTO v_target_hid
  FROM profiles
  WHERE id = p_profile_id;

  IF EXISTS (
    SELECT 1
    FROM moderator_permissions mp
    JOIN profiles p ON p.id = mp.branch_root_id
    WHERE mp.user_id = p_user_id
    AND mp.can_edit = TRUE
    AND v_target_hid LIKE p.hid || '%'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 3. Profile Linking Flow

### 3.1 Name Chain Search Implementation

```javascript
// src/services/profileSearch.js
export const profileSearchService = {
  // Parse Arabic name chain
  parseNameChain(nameChain) {
    // Split by spaces, handling multiple spaces
    const names = nameChain.trim().split(/\s+/);

    return {
      firstName: names[0] || "",
      fatherName: names[1] || "",
      grandfatherName: names[2] || "",
      additionalNames: names.slice(3),
    };
  },

  // Search for matching profiles
  async searchByNameChain(nameChain) {
    const names = this.parseNameChain(nameChain);

    const { data, error } = await supabase.rpc("search_profiles_by_chain", {
      p_first_name: names.firstName,
      p_father_name: names.fatherName,
      p_grandfather_name: names.grandfatherName,
    });

    if (error) throw error;

    // Filter out already claimed profiles
    return data.filter((p) => !p.auth_user_id);
  },
};
```

### 3.2 Tree Context Display

```sql
-- Get tree context for profile matching
CREATE OR REPLACE FUNCTION get_profile_tree_context(
  p_profile_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH RECURSIVE ancestors AS (
    -- Start with the profile
    SELECT id, name, father_id, mother_id, generation, hid, 0 as level
    FROM profiles
    WHERE id = p_profile_id

    UNION ALL

    -- Get all ancestors up to root
    SELECT p.id, p.name, p.father_id, p.mother_id, p.generation, p.hid, a.level + 1
    FROM profiles p
    INNER JOIN ancestors a ON p.id = a.father_id
    WHERE a.level < 10 -- Prevent infinite recursion
  ),
  context AS (
    SELECT
      json_build_object(
        'profile', (
          SELECT json_build_object(
            'id', id,
            'name', name,
            'hid', hid,
            'generation', generation
          )
          FROM profiles WHERE id = p_profile_id
        ),
        'ancestors', (
          SELECT json_agg(
            json_build_object(
              'id', id,
              'name', name,
              'generation', generation,
              'level', level
            ) ORDER BY level
          )
          FROM ancestors WHERE id != p_profile_id
        ),
        'siblings', (
          SELECT json_agg(
            json_build_object(
              'id', id,
              'name', name,
              'sibling_order', sibling_order
            ) ORDER BY sibling_order
          )
          FROM profiles
          WHERE father_id = (SELECT father_id FROM profiles WHERE id = p_profile_id)
          AND id != p_profile_id
        ),
        'father_siblings', (
          SELECT json_agg(
            json_build_object(
              'id', id,
              'name', name,
              'sibling_order', sibling_order
            ) ORDER BY sibling_order
          )
          FROM profiles
          WHERE father_id = (
            SELECT father_id
            FROM profiles
            WHERE id = (SELECT father_id FROM profiles WHERE id = p_profile_id)
          )
        ),
        'grandfather_siblings', (
          SELECT json_agg(
            json_build_object(
              'id', id,
              'name', name,
              'sibling_order', sibling_order
            ) ORDER BY sibling_order
          )
          FROM profiles
          WHERE father_id = (
            SELECT father_id
            FROM profiles
            WHERE id = (
              SELECT father_id
              FROM profiles
              WHERE id = (SELECT father_id FROM profiles WHERE id = p_profile_id)
            )
          )
        ),
        'children', (
          SELECT json_build_object(
            'count', COUNT(*),
            'list', json_agg(
              json_build_object(
                'id', id,
                'name', name
              ) ORDER BY sibling_order
            )
          )
          FROM profiles
          WHERE father_id = p_profile_id OR mother_id = p_profile_id
        )
      ) as result
  )
  SELECT result INTO v_result FROM context;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3.3 Profile Matching UI

```javascript
// src/screens/ProfileMatchingScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { TreeContextView } from "../components/TreeContextView";

export function ProfileMatchingScreen({ nameChain, onSelect, onNoMatch }) {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [treeContext, setTreeContext] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    searchProfiles();
  }, [nameChain]);

  const searchProfiles = async () => {
    const results = await profileSearchService.searchByNameChain(nameChain);
    setMatches(results);
    setLoading(false);
  };

  const loadTreeContext = async (profileId) => {
    const context = await supabase.rpc("get_profile_tree_context", {
      p_profile_id: profileId,
    });
    setTreeContext(context.data);
    setSelectedMatch(profileId);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>اختر ملفك الشخصي</Text>
      <Text style={styles.nameChain}>{nameChain}</Text>

      {matches.length === 0 ? (
        <View style={styles.noMatchContainer}>
          <Text style={styles.noMatchText}>لم نجد ملفاً مطابقاً</Text>
          <TouchableOpacity onPress={onNoMatch} style={styles.contactButton}>
            <Text style={styles.buttonText}>تواصل مع المشرف</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView>
          <Text style={styles.subtitle}>
            اضغط على الاسم لعرض السياق العائلي
          </Text>

          {matches.map((match) => (
            <TouchableOpacity
              key={match.id}
              style={[
                styles.matchCard,
                selectedMatch === match.id && styles.selectedCard,
              ]}
              onPress={() => loadTreeContext(match.id)}
            >
              <Text style={styles.matchName}>{match.name}</Text>
              <Text style={styles.matchInfo}>
                الجيل {match.generation} • {match.hid}
              </Text>
            </TouchableOpacity>
          ))}

          {treeContext && (
            <View style={styles.contextContainer}>
              <TreeContextView context={treeContext} />
              <TouchableOpacity
                onPress={() => onSelect(selectedMatch)}
                style={styles.confirmButton}
              >
                <Text style={styles.confirmText}>نعم، هذا أنا</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
```

## 4. Edit Suggestions System

### 4.1 Suggestion Submission

```javascript
// src/services/editSuggestions.js
export const editSuggestionService = {
  async submitSuggestion(profileId, fieldName, newValue) {
    // Get current value
    const { data: profile } = await supabase
      .from("profiles")
      .select(fieldName)
      .eq("id", profileId)
      .single();

    const { data, error } = await supabase
      .from("edit_suggestions")
      .insert({
        profile_id: profileId,
        suggested_by: (await supabase.auth.getUser()).data.user.id,
        field_name: fieldName,
        old_value: profile[fieldName],
        new_value: newValue,
        status: "pending",
      })
      .select()
      .single();

    if (!error) {
      // Notify profile owner
      await this.notifyProfileOwner(profileId, data.id);
    }

    return { data, error };
  },

  async notifyProfileOwner(profileId, suggestionId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("auth_user_id, name")
      .eq("id", profileId)
      .single();

    if (profile?.auth_user_id) {
      await supabase.from("notifications").insert({
        user_id: profile.auth_user_id,
        type: "edit_suggestion",
        title: "اقتراح تعديل جديد",
        body: `هناك اقتراح تعديل على ملفك الشخصي`,
        data: { suggestion_id: suggestionId, profile_id: profileId },
      });
    }
  },
};
```

### 4.2 Approval Flow

```sql
-- Approve edit suggestion
CREATE OR REPLACE FUNCTION approve_edit_suggestion(
  p_suggestion_id UUID,
  p_approval_type TEXT DEFAULT 'owner' -- owner, moderator, admin
)
RETURNS BOOLEAN AS $$
DECLARE
  v_suggestion RECORD;
  v_can_approve BOOLEAN := FALSE;
BEGIN
  -- Get suggestion details
  SELECT * INTO v_suggestion
  FROM edit_suggestions
  WHERE id = p_suggestion_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suggestion not found or already processed';
  END IF;

  -- Check approval permissions
  IF p_approval_type = 'owner' THEN
    -- Check if user owns the profile
    v_can_approve := EXISTS (
      SELECT 1 FROM profiles
      WHERE id = v_suggestion.profile_id
      AND auth_user_id = auth.uid()
    );
  ELSIF p_approval_type = 'moderator' THEN
    -- Check moderator permissions
    v_can_approve := can_user_edit_profile(auth.uid(), v_suggestion.profile_id);
  ELSIF p_approval_type = 'admin' THEN
    v_can_approve := is_admin();
  END IF;

  IF NOT v_can_approve THEN
    RAISE EXCEPTION 'Unauthorized to approve this suggestion';
  END IF;

  -- Apply the change
  EXECUTE format(
    'UPDATE profiles SET %I = $1, updated_at = NOW() WHERE id = $2',
    v_suggestion.field_name
  ) USING v_suggestion.new_value, v_suggestion.profile_id;

  -- Mark suggestion as approved
  UPDATE edit_suggestions
  SET
    status = 'approved',
    reviewed_by = auth.uid(),
    review_type = p_approval_type,
    reviewed_at = NOW()
  WHERE id = p_suggestion_id;

  -- Log the action
  INSERT INTO activity_log (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    auth.uid(),
    'APPROVE_EDIT',
    'edit_suggestion',
    p_suggestion_id,
    jsonb_build_object(
      'profile_id', v_suggestion.profile_id,
      'field', v_suggestion.field_name,
      'approval_type', p_approval_type
    )
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 5. WhatsApp Integration

### 5.1 WhatsApp Service

```javascript
// src/services/whatsappService.js
export const whatsappService = {
  // Format phone for WhatsApp
  formatWhatsAppNumber(phone) {
    let cleaned = phone.replace(/\D/g, "");
    if (!cleaned.startsWith("966")) {
      if (cleaned.startsWith("0")) {
        cleaned = "966" + cleaned.substring(1);
      } else {
        cleaned = "966" + cleaned;
      }
    }
    return cleaned;
  },

  // Get template from database
  async getTemplate(templateKey) {
    const { data } = await supabase
      .from("whatsapp_templates")
      .select("template_text")
      .eq("template_key", templateKey)
      .eq("is_active", true)
      .single();

    return data?.template_text || this.getDefaultTemplate(templateKey);
  },

  // Default templates
  getDefaultTemplate(key) {
    const templates = {
      link_request:
        'مرحباً {name}،\n\nتم استلام طلبك لربط ملفك الشخصي "{profile_name}" في شجرة العائلة.\n\nللتحقق من هويتك، يرجى الرد برقم الهوية أو صورة من بطاقة العائلة.\n\nشكراً لك',
      edit_suggestion:
        'مرحباً،\n\nهناك اقتراح تعديل على الملف الشخصي "{profile_name}".\n\nالحقل: {field}\nالقيمة الجديدة: {new_value}\n\nللموافقة أو الرفض، يرجى الدخول إلى التطبيق.',
      phone_change:
        "مرحباً {name}،\n\nتم استلام طلبك لتغيير رقم الهاتف.\n\nالرقم القديم: {old_phone}\nالرقم الجديد: {new_phone}\n\nللتأكيد، يرجى إرسال رمز التحقق المرسل إلى رقمك الجديد.",
      general:
        "مرحباً،\n\nنود التواصل معك بخصوص شجرة عائلة القفاري.\n\n{message}\n\nشكراً لك",
    };

    return templates[key] || templates.general;
  },

  // Create WhatsApp link with message
  async createWhatsAppLink(phone, templateKey, variables = {}) {
    const number = this.formatWhatsAppNumber(phone);
    let message = await this.getTemplate(templateKey);

    // Replace variables in template
    Object.keys(variables).forEach((key) => {
      message = message.replace(new RegExp(`{${key}}`, "g"), variables[key]);
    });

    // URL encode the message
    const encodedMessage = encodeURIComponent(message);

    return `https://wa.me/${number}?text=${encodedMessage}`;
  },

  // Open WhatsApp
  async openWhatsApp(phone, templateKey, variables = {}) {
    const url = await this.createWhatsAppLink(phone, templateKey, variables);
    Linking.openURL(url);
  },
};
```

### 5.2 Admin Contact Button

```javascript
// src/components/WhatsAppButton.js
import React from "react";
import { TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { whatsappService } from "../services/whatsappService";

export function WhatsAppButton({ phone, templateKey, variables, style }) {
  const handlePress = () => {
    whatsappService.openWhatsApp(phone, templateKey, variables);
  };

  return (
    <TouchableOpacity style={[styles.button, style]} onPress={handlePress}>
      <Ionicons name="logo-whatsapp" size={20} color="white" />
      <Text style={styles.text}>WhatsApp</Text>
    </TouchableOpacity>
  );
}

const styles = {
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#25D366",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  text: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
};
```

## 6. Notification System

### 6.1 Push Notifications Setup

```javascript
// src/services/notificationService.js
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";

export const notificationService = {
  async requestPermissions() {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  },

  async registerForPushNotifications() {
    const token = (await Notifications.getExpoPushTokenAsync()).data;

    // Save token to user profile
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ push_token: token })
        .eq("auth_user_id", user.id);
    }

    return token;
  },

  async sendPushNotification(userId, title, body, data = {}) {
    // Get user's push token
    const { data: profile } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("auth_user_id", userId)
      .single();

    if (profile?.push_token) {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: profile.push_token,
          title,
          body,
          data,
          priority: "high",
          sound: "default",
        }),
      });
    }
  },
};
```

### 6.2 In-App Notifications

```javascript
// src/components/NotificationDrawer.js
import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { useNotifications } from "../hooks/useNotifications";

export function NotificationDrawer({ visible, onClose }) {
  const { notifications, markAsRead, loading } = useNotifications();

  const renderNotification = ({ item }) => (
    <TouchableOpacity
      style={[styles.notification, !item.read && styles.unread]}
      onPress={() => {
        markAsRead(item.id);
        handleNotificationPress(item);
      }}
    >
      <View style={styles.notificationHeader}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.time}>{formatRelativeTime(item.created_at)}</Text>
      </View>
      <Text style={styles.body}>{item.body}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>الإشعارات</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>لا توجد إشعارات</Text>}
        />
      </View>
    </Modal>
  );
}
```

## 7. Account Management

### 7.1 Phone Number Change

```sql
CREATE OR REPLACE FUNCTION request_phone_change(
  p_new_phone TEXT
)
RETURNS UUID AS $$
DECLARE
  v_request_id UUID;
BEGIN
  -- Create change request
  INSERT INTO phone_change_requests (
    user_id,
    old_phone,
    new_phone,
    status,
    created_at
  ) VALUES (
    auth.uid(),
    (SELECT phone FROM auth.users WHERE id = auth.uid()),
    p_new_phone,
    'pending',
    NOW()
  ) RETURNING id INTO v_request_id;

  -- Notify admins
  INSERT INTO notifications (
    user_id,
    type,
    title,
    body,
    data
  )
  SELECT
    id,
    'phone_change',
    'طلب تغيير رقم هاتف',
    'مستخدم يريد تغيير رقم هاتفه',
    jsonb_build_object('request_id', v_request_id)
  FROM profiles
  WHERE role = 'admin';

  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 7.2 Account Deletion

```sql
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Get profile ID
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE auth_user_id = v_user_id;

  -- Unlink profile but keep it in tree
  UPDATE profiles
  SET
    auth_user_id = NULL,
    phone = NULL,
    email = NULL,
    push_token = NULL,
    phone_verified = FALSE,
    claim_status = 'unclaimed'
  WHERE id = v_profile_id;

  -- Log the unlinking
  INSERT INTO activity_log (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_user_id,
    'ACCOUNT_DELETED',
    'profile',
    v_profile_id,
    jsonb_build_object('deleted_at', NOW())
  );

  -- Delete auth account (handled by Supabase)
  -- The actual deletion happens in the app via supabase.auth.admin.deleteUser()

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 8. Analytics & Tracking

### 8.1 Activity Tracking

```sql
-- Track all profile views
CREATE OR REPLACE FUNCTION track_profile_view(
  p_profile_id UUID
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO activity_log (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  ) VALUES (
    auth.uid(),
    'PROFILE_VIEW',
    'profile',
    p_profile_id,
    jsonb_build_object(
      'viewer_ip', inet_client_addr(),
      'timestamp', NOW()
    ),
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin analytics dashboard
CREATE OR REPLACE FUNCTION get_admin_analytics()
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'users', json_build_object(
      'total', (SELECT COUNT(*) FROM auth.users),
      'linked', (SELECT COUNT(*) FROM profiles WHERE auth_user_id IS NOT NULL),
      'read_only', (
        SELECT COUNT(*) FROM auth.users u
        WHERE NOT EXISTS (
          SELECT 1 FROM profiles WHERE auth_user_id = u.id
        )
      ),
      'new_today', (
        SELECT COUNT(*) FROM auth.users
        WHERE created_at > CURRENT_DATE
      )
    ),
    'link_requests', json_build_object(
      'pending', (SELECT COUNT(*) FROM profile_link_requests WHERE status = 'pending'),
      'approved_today', (
        SELECT COUNT(*) FROM profile_link_requests
        WHERE status = 'approved' AND reviewed_at > CURRENT_DATE
      ),
      'rejected_today', (
        SELECT COUNT(*) FROM profile_link_requests
        WHERE status = 'rejected' AND reviewed_at > CURRENT_DATE
      ),
      'avg_review_time', (
        SELECT AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at))/3600)::INT
        FROM profile_link_requests
        WHERE status != 'pending' AND reviewed_at > NOW() - INTERVAL '7 days'
      )
    ),
    'edit_suggestions', json_build_object(
      'pending', (SELECT COUNT(*) FROM edit_suggestions WHERE status = 'pending'),
      'approved_today', (
        SELECT COUNT(*) FROM edit_suggestions
        WHERE status = 'approved' AND reviewed_at > CURRENT_DATE
      ),
      'by_field', (
        SELECT json_object_agg(field_name, count)
        FROM (
          SELECT field_name, COUNT(*) as count
          FROM edit_suggestions
          WHERE created_at > NOW() - INTERVAL '30 days'
          GROUP BY field_name
        ) t
      )
    ),
    'activity', json_build_object(
      'profile_views_today', (
        SELECT COUNT(*) FROM activity_log
        WHERE action = 'PROFILE_VIEW' AND created_at > CURRENT_DATE
      ),
      'edits_today', (
        SELECT COUNT(*) FROM activity_log
        WHERE action LIKE '%EDIT%' AND created_at > CURRENT_DATE
      ),
      'most_viewed_profiles', (
        SELECT json_agg(t)
        FROM (
          SELECT p.name, p.hid, COUNT(*) as views
          FROM activity_log a
          JOIN profiles p ON p.id = a.entity_id::UUID
          WHERE a.action = 'PROFILE_VIEW'
          AND a.created_at > NOW() - INTERVAL '7 days'
          GROUP BY p.id, p.name, p.hid
          ORDER BY views DESC
          LIMIT 10
        ) t
      )
    ),
    'moderators', json_build_object(
      'total', (SELECT COUNT(DISTINCT user_id) FROM moderator_permissions),
      'active_today', (
        SELECT COUNT(DISTINCT user_id)
        FROM activity_log
        WHERE user_id IN (SELECT user_id FROM moderator_permissions)
        AND created_at > CURRENT_DATE
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 9. Implementation Priority

### Phase 1: Core Authentication (Week 1)

- [ ] Phone auth with OTP
- [ ] Basic profile linking
- [ ] Name chain search
- [ ] Admin approval flow

### Phase 2: Permissions System (Week 2)

- [ ] User permission levels
- [ ] Moderator assignment
- [ ] Branch-based editing
- [ ] Permission checking

### Phase 3: Edit Suggestions (Week 3)

- [ ] Suggestion submission
- [ ] Approval workflow
- [ ] Notifications
- [ ] Activity tracking

### Phase 4: WhatsApp & Polish (Week 4)

- [ ] WhatsApp templates
- [ ] Contact buttons
- [ ] Push notifications
- [ ] Analytics dashboard

## 10. Security Considerations

- UUID-based internal identification (not phone)
- Phone numbers can be changed by admin
- All actions logged in activity_log
- Manual verification via WhatsApp
- No automatic approvals
- Read-only by default
- Progressive permission elevation

## Success Metrics

- Time to profile link: < 24 hours
- Onboarding completion: > 80%
- Edit suggestion approval rate
- User engagement after linking
- Moderator activity levels
- Profile completion rates
