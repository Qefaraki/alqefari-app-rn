import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import profilesService from "../services/profiles";
import NameEditor from "../components/admin/fields/NameEditor";
import DateEditor from "../components/admin/fields/DateEditor";
import PhotoEditor from "../components/admin/fields/PhotoEditor";
import DraggableChildrenList from "../components/admin/DraggableChildrenList";
import MarriageEditor from "../components/admin/MarriageEditor";
import InlineSpouseAdder from "../components/InlineSpouseAdder";
import { formatDateByPreference } from "../utils/dateDisplay";
import { useSettings } from "../contexts/SettingsContext";
import { validateDates } from "../utils/dateUtils";

/**
 * ModernProfileEditorContent - The content of ModernProfileEditorV4 without the BottomSheet wrapper
 * This is designed to be rendered inside ProfileSheet when in admin edit mode
 */
const ModernProfileEditorContent = ({ profile, onSave, onCancel }) => {
  const { settings } = useSettings();
  const [selectedTab, setSelectedTab] = useState(0);
  const [editedData, setEditedData] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [marriages, setMarriages] = useState([]);
  const [loadingMarriages, setLoadingMarriages] = useState(false);
  const [showMarriageEditor, setShowMarriageEditor] = useState(false);
  const [dateErrors, setDateErrors] = useState({});

  // Initialize edited data
  useEffect(() => {
    if (profile) {
      setEditedData({
        name: profile.name || "",
        date_of_birth: profile.date_of_birth || null,
        date_of_death: profile.date_of_death || null,
        photo_url: profile.photo_url || null,
        sibling_order: profile.sibling_order || 0,
      });
      loadMarriages();
    }
  }, [profile]);

  // Load marriages
  const loadMarriages = async () => {
    if (!profile?.id) return;

    setLoadingMarriages(true);
    try {
      const { data, error } = await profilesService.getMarriages(profile.id);
      if (error) throw error;
      setMarriages(data || []);
    } catch (error) {
      console.error("Error loading marriages:", error);
      setMarriages([]);
    } finally {
      setLoadingMarriages(false);
    }
  };

  // Track changes
  useEffect(() => {
    if (!profile) return;

    const changed =
      editedData.name !== (profile.name || "") ||
      editedData.date_of_birth !== (profile.date_of_birth || null) ||
      editedData.date_of_death !== (profile.date_of_death || null) ||
      editedData.photo_url !== (profile.photo_url || null) ||
      editedData.sibling_order !== (profile.sibling_order || 0);

    setHasChanges(changed);
  }, [editedData, profile]);

  // Handle field updates
  const handleFieldChange = (field, value) => {
    setEditedData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Validate dates if date field changed
    if (field === "date_of_birth" || field === "date_of_death") {
      const newData = { ...editedData, [field]: value };
      const errors = validateDates(
        newData.date_of_birth,
        newData.date_of_death,
      );
      setDateErrors(errors);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!hasChanges || saving) return;

    // Validate dates
    const errors = validateDates(
      editedData.date_of_birth,
      editedData.date_of_death,
    );
    if (errors.dob || errors.dod) {
      Alert.alert("خطأ في التواريخ", errors.dob || errors.dod);
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await profilesService.updateProfile(
        profile.id,
        editedData,
      );

      if (error) throw error;

      if (onSave) {
        onSave(data);
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert(
        "خطأ في الحفظ",
        error.message || "حدث خطأ أثناء حفظ التغييرات",
      );
    } finally {
      setSaving(false);
    }
  };

  // Render segmented control
  const renderSegmentedControl = () => (
    <View style={styles.segmentedControl}>
      <TouchableOpacity
        style={[styles.segment, selectedTab === 0 && styles.segmentActive]}
        onPress={() => setSelectedTab(0)}
      >
        <Text
          style={[
            styles.segmentText,
            selectedTab === 0 && styles.segmentTextActive,
          ]}
        >
          معلومات أساسية
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.segment, selectedTab === 1 && styles.segmentActive]}
        onPress={() => setSelectedTab(1)}
      >
        <Text
          style={[
            styles.segmentText,
            selectedTab === 1 && styles.segmentTextActive,
          ]}
        >
          العائلة
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Render content based on selected tab
  const renderContent = () => {
    switch (selectedTab) {
      case 0:
        return renderBasicInfo();
      case 1:
        return renderFamilyInfo();
      default:
        return null;
    }
  };

  // Render basic info tab
  const renderBasicInfo = () => (
    <View style={styles.content}>
      <PhotoEditor
        currentPhotoUrl={editedData.photo_url}
        personId={profile.id}
        onPhotoChange={(url) => handleFieldChange("photo_url", url)}
      />

      <View style={styles.section}>
        <NameEditor
          value={editedData.name}
          onChange={(value) => handleFieldChange("name", value)}
        />
      </View>

      <View style={styles.section}>
        <DateEditor
          label="تاريخ الميلاد"
          value={editedData.date_of_birth}
          onChange={(value) => handleFieldChange("date_of_birth", value)}
          error={dateErrors.dob}
        />
      </View>

      <View style={styles.section}>
        <DateEditor
          label="تاريخ الوفاة"
          value={editedData.date_of_death}
          onChange={(value) => handleFieldChange("date_of_death", value)}
          error={dateErrors.dod}
        />
      </View>
    </View>
  );

  // Render family info tab
  const renderFamilyInfo = () => (
    <View style={styles.content}>
      {/* Children Section */}
      {profile.id && (
        <View style={styles.section}>
          <DraggableChildrenList parentId={profile.id} />
        </View>
      )}

      {/* Marriages Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {profile.gender === "female" ? "الأزواج" : "الزوجات"}
          </Text>
          <TouchableOpacity
            onPress={() => setShowMarriageEditor(true)}
            style={styles.addButton}
          >
            <Ionicons name="add-circle" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {loadingMarriages ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <>
            {marriages.map((marriage) => (
              <View key={marriage.id} style={styles.marriageCard}>
                <Text style={styles.marriageName}>
                  {marriage.spouse_name || "غير محدد"}
                </Text>
                <Text style={styles.marriageStatus}>
                  {marriage.status === "married"
                    ? "متزوج"
                    : marriage.status === "divorced"
                      ? profile.gender === "female"
                        ? "سابق"
                        : "سابقة"
                      : marriage.status === "deceased"
                        ? profile.gender === "female"
                          ? "رحمه الله"
                          : "رحمها الله"
                        : ""}
                </Text>
              </View>
            ))}

            {/* Inline Spouse Adder */}
            <InlineSpouseAdder
              personId={profile.id}
              personGender={profile.gender}
              onAdded={loadMarriages}
            />
          </>
        )}
      </View>

      {/* Marriage Editor Modal */}
      {profile && (
        <MarriageEditor
          visible={showMarriageEditor}
          onClose={() => setShowMarriageEditor(false)}
          person={profile}
          onCreated={() => {
            setShowMarriageEditor(false);
            loadMarriages();
          }}
        />
      )}
    </View>
  );

  return (
    <>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
          <Text style={styles.cancelText}>إلغاء</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>تعديل الملف</Text>

        <TouchableOpacity
          onPress={handleSave}
          disabled={
            !hasChanges || saving || !!dateErrors.dob || !!dateErrors.dod
          }
          style={styles.headerButton}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text style={[styles.saveText, !hasChanges && styles.disabledText]}>
              حفظ
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Segmented Control */}
      {renderSegmentedControl()}

      {/* Content */}
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
        <View style={{ height: 100 }} />
      </BottomSheetScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E5EA",
  },
  headerButton: {
    minWidth: 44,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
  },
  cancelText: {
    fontSize: 17,
    color: "#007AFF",
  },
  saveText: {
    fontSize: 17,
    color: "#007AFF",
    fontWeight: "600",
  },
  disabledText: {
    opacity: 0.3,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#F2F2F7",
    borderRadius: 9,
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 7,
  },
  segmentActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    color: "#8E8E93",
  },
  segmentTextActive: {
    color: "#000",
    fontWeight: "500",
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
  },
  addButton: {
    padding: 4,
  },
  marriageCard: {
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  marriageName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
    marginBottom: 4,
  },
  marriageDate: {
    fontSize: 14,
    color: "#8E8E93",
    marginBottom: 2,
  },
  marriageStatus: {
    fontSize: 13,
    color: "#8E8E93",
    fontStyle: "italic",
  },
});

export default ModernProfileEditorContent;
