import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import CardSurface from "../ios/CardSurface";
import FatherSelector from "./fields/FatherSelector";
import MotherSelector from "./fields/MotherSelector";
import ChildrenManager from "./ChildrenManager";
import MarriageEditor from "./MarriageEditor";
import { supabase } from "../../services/supabase";
import { useAdminMode } from "../../contexts/AdminModeContext";

const RelationshipManager = ({ profile, onUpdate, visible, onClose }) => {
  const { isAdmin } = useAdminMode();
  const [editedProfile, setEditedProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [marriages, setMarriages] = useState([]);
  const [showMarriageEditor, setShowMarriageEditor] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Initialize edited profile when profile changes
  useEffect(() => {
    if (profile) {
      setEditedProfile({
        id: profile.id,
        father_id: profile.father_id,
        mother_id: profile.mother_id,
        generation: profile.generation,
      });
      loadMarriages();
    }
  }, [profile]);

  // Track changes
  useEffect(() => {
    if (profile && editedProfile) {
      const hasChanges =
        profile.father_id !== editedProfile.father_id ||
        profile.mother_id !== editedProfile.mother_id;
      setIsDirty(hasChanges);
    }
  }, [profile, editedProfile]);

  const loadMarriages = async () => {
    if (!profile?.id) return;

    try {
      // Load marriages based on gender
      const column = profile.gender === "male" ? "husband_id" : "wife_id";
      const partnerColumn =
        profile.gender === "male" ? "wife_id" : "husband_id";

      const { data, error } = await supabase
        .from("marriages")
        .select(
          `
          id,
          ${partnerColumn},
          status,
          is_current,
          start_date,
          end_date,
          partner:profiles!${partnerColumn}(
            id,
            name,
            hid
          )
        `,
        )
        .eq(column, profile.id)
        .order("is_current", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading marriages:", error);
        setMarriages([]);
      } else {
        setMarriages(data || []);
      }
    } catch (error) {
      console.error("Error in loadMarriages:", error);
      setMarriages([]);
    }
  };

  const handleParentChange = (field, value) => {
    setEditedProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveParents = async () => {
    if (!isDirty || !editedProfile) return;

    setSaving(true);
    try {
      // Validate generation hierarchy
      if (editedProfile.father_id) {
        const { data: father } = await supabase
          .from("profiles")
          .select("generation")
          .eq("id", editedProfile.father_id)
          .single();

        if (father && father.generation >= profile.generation) {
          Alert.alert("خطأ", "يجب أن يكون الأب من جيل سابق");
          setSaving(false);
          return;
        }
      }

      if (editedProfile.mother_id) {
        const { data: mother } = await supabase
          .from("profiles")
          .select("generation")
          .eq("id", editedProfile.mother_id)
          .single();

        if (mother && mother.generation >= profile.generation) {
          Alert.alert("خطأ", "يجب أن تكون الأم من جيل سابق");
          setSaving(false);
          return;
        }
      }

      // Update profile
      const { error } = await supabase
        .from("profiles")
        .update({
          father_id: editedProfile.father_id,
          mother_id: editedProfile.mother_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) {
        Alert.alert("خطأ", "فشل حفظ التغييرات");
        console.error("Save error:", error);
      } else {
        Alert.alert("نجح", "تم حفظ التغييرات");
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      Alert.alert("خطأ", "حدث خطأ أثناء الحفظ");
      console.error("Error in handleSaveParents:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMarriage = async (marriageId) => {
    Alert.alert("تأكيد الحذف", "هل تريد حذف هذا الزواج؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("marriages")
              .delete()
              .eq("id", marriageId);

            if (error) {
              Alert.alert("خطأ", "فشل حذف الزواج");
              console.error("Delete error:", error);
            } else {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              loadMarriages();
            }
          } catch (error) {
            Alert.alert("خطأ", "حدث خطأ أثناء الحذف");
            console.error("Error in handleDeleteMarriage:", error);
          }
        },
      },
    ]);
  };

  const renderMarriage = (marriage) => {
    const partner = marriage.partner?.[0] || marriage.partner;
    if (!partner) return null;

    return (
      <View key={marriage.id} style={styles.marriageRow}>
        <View style={styles.marriageInfo}>
          <Text style={styles.partnerName}>{partner.name}</Text>
          <View style={styles.marriageMeta}>
            <Text style={styles.partnerHid}>HID: {partner.hid}</Text>
            {marriage.is_current ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>حالي</Text>
              </View>
            ) : (
              <Text style={styles.marriageStatus}>
                {marriage.status === "divorced" ? "مطلق" : "سابق"}
              </Text>
            )}
          </View>
        </View>
        {isAdmin && (
          <TouchableOpacity
            onPress={() => handleDeleteMarriage(marriage.id)}
            style={styles.deleteButton}
          >
            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>إدارة العلاقات</Text>
          {isDirty && (
            <TouchableOpacity
              onPress={handleSaveParents}
              style={styles.saveButton}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? "جارِ الحفظ..." : "حفظ"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.content}>
          {/* Parents Section */}
          {isAdmin && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>الوالدين</Text>
              <CardSurface>
                <View style={styles.sectionContent}>
                  <FatherSelector
                    value={editedProfile?.father_id}
                    onChange={(value) => handleParentChange("father_id", value)}
                    currentProfileId={profile?.id}
                    currentGeneration={profile?.generation}
                  />

                  <MotherSelector
                    fatherId={editedProfile?.father_id || profile?.father_id}
                    value={editedProfile?.mother_id}
                    onChange={(value) => handleParentChange("mother_id", value)}
                  />
                </View>
              </CardSurface>
            </View>
          )}

          {/* Marriages Section - Admin Only */}
          {isAdmin && profile?.gender && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {profile.gender === "male" ? "الزوجات" : "الأزواج"}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowMarriageEditor(true)}
                  style={styles.addButton}
                >
                  <Ionicons name="add-circle" size={24} color="#007AFF" />
                  <Text style={styles.addButtonText}>إضافة</Text>
                </TouchableOpacity>
              </View>

              {marriages.length > 0 ? (
                <CardSurface>
                  <View style={styles.sectionContent}>
                    {marriages.map(renderMarriage)}
                  </View>
                </CardSurface>
              ) : (
                <CardSurface>
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      لا يوجد {profile.gender === "male" ? "زوجات" : "أزواج"}
                    </Text>
                  </View>
                </CardSurface>
              )}
            </View>
          )}

          {/* Children Section */}
          <View style={styles.section}>
            <ChildrenManager
              profile={profile}
              onUpdate={onUpdate}
              isAdmin={isAdmin}
            />
          </View>
        </ScrollView>

        {/* Marriage Editor Modal */}
        <MarriageEditor
          visible={showMarriageEditor}
          onClose={() => setShowMarriageEditor(false)}
          person={profile}
          onCreated={() => {
            setShowMarriageEditor(false);
            loadMarriages();
          }}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#007AFF",
    borderRadius: 16,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "SF Arabic Regular",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "SF Arabic Regular",
    marginBottom: 12,
  },
  sectionContent: {
    padding: 16,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonText: {
    fontSize: 16,
    color: "#007AFF",
    fontFamily: "SF Arabic Regular",
  },
  marriageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  marriageInfo: {
    flex: 1,
  },
  partnerName: {
    fontSize: 17,
    color: "#000000",
    fontFamily: "SF Arabic Regular",
    marginBottom: 4,
  },
  marriageMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  partnerHid: {
    fontSize: 14,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  currentBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentBadgeText: {
    fontSize: 12,
    color: "#2E7D32",
    fontFamily: "SF Arabic Regular",
  },
  marriageStatus: {
    fontSize: 14,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
});

export default RelationshipManager;
