import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "../../services/supabase";
import { profilesService } from "../../services/profiles";
import { buildNameChain } from "../../utils/nameChainBuilder";
import { familyNameService } from "../../services/familyNameService";

export default function SpouseManager({ visible, person, onClose, onSpouseAdded }) {
  const [mode, setMode] = useState("search"); // 'search' or 'create'
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSpouse, setSelectedSpouse] = useState(null);
  const [newSpouseName, setNewSpouseName] = useState("");
  const [newSpousePhone, setNewSpousePhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Get the appropriate gender for spouse
  const spouseGender = person?.gender === "male" ? "female" : "male";
  const spouseTitle = spouseGender === "female" ? "الزوجة" : "الزوج";

  useEffect(() => {
    if (visible) {
      // Reset state when modal opens
      setMode("search");
      setSearchQuery("");
      setSearchResults([]);
      setSelectedSpouse(null);
      setNewSpouseName("");
      setNewSpousePhone("");
    }
  }, [visible]);

  useEffect(() => {
    if (mode === "search" && searchQuery.length >= 2) {
      const timer = setTimeout(() => performSearch(), 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, mode]);

  const performSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await profilesService.searchProfiles(
        searchQuery.trim(),
        20,
        0
      );

      if (error) throw error;

      // Filter by gender and exclude current person
      const filtered = (data || [])
        .filter(p => p.gender === spouseGender)
        .filter(p => p.id !== person?.id);

      setSearchResults(filtered);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSpouse = (spouse) => {
    setSelectedSpouse(spouse);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLinkExistingSpouse = async () => {
    if (!selectedSpouse) {
      Alert.alert("تنبيه", `يرجى اختيار ${spouseTitle}`);
      return;
    }

    setSubmitting(true);
    try {
      const husband_id = person.gender === "male" ? person.id : selectedSpouse.id;
      const wife_id = person.gender === "female" ? person.id : selectedSpouse.id;

      // Determine munasib value: If spouse has hid (Al-Qefari), munasib is null
      // If spouse doesn't have hid (Munasib), use their family_origin
      const munasibValue = selectedSpouse.hid ? null : (selectedSpouse.family_origin || null);

      const { data, error } = await profilesService.createMarriage({
        husband_id,
        wife_id,
        munasib: munasibValue,
      });

      if (error) throw error;

      Alert.alert("نجح", "تم إضافة الزواج بنجاح");
      if (onSpouseAdded) onSpouseAdded(data);
      onClose();
    } catch (error) {
      Alert.alert("خطأ", error.message || "حدث خطأ أثناء إضافة الزواج");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNewSpouse = async () => {
    if (!newSpouseName.trim()) {
      Alert.alert("تنبيه", "يرجى إدخال اسم كامل");
      return;
    }

    // Extract family origin from the name
    const familyOrigin = familyNameService.extractFamilyName(newSpouseName.trim());
    if (!familyOrigin) {
      Alert.alert("تنبيه", "يرجى إدخال اسم العائلة");
      return;
    }

    setSubmitting(true);
    try {
      // Create new Munasib profile using secure RPC function
      // This ensures proper permissions and audit logging
      const { data: newPerson, error: createError } = await supabase
        .rpc('admin_create_munasib_profile', {
          p_name: newSpouseName.trim(),
          p_gender: spouseGender,
          p_generation: person.generation,
          p_family_origin: familyOrigin,
          p_sibling_order: 0,
          p_status: 'alive',
          p_phone: newSpousePhone.trim() || null,
        });

      if (createError) throw createError;

      // Create the marriage
      const husband_id = person.gender === "male" ? person.id : newPerson.id;
      const wife_id = person.gender === "female" ? person.id : newPerson.id;

      const { data: marriage, error: marriageError } =
        await profilesService.createMarriage({
          husband_id,
          wife_id,
          munasib: familyOrigin, // Store family origin for Munasib
        });

      if (marriageError) throw marriageError;

      Alert.alert("نجح", `تم إضافة ${spouseTitle} بنجاح`);
      if (onSpouseAdded) onSpouseAdded(marriage);
      onClose();
    } catch (error) {
      Alert.alert("خطأ", error.message || "حدث خطأ أثناء الإضافة");
    } finally {
      setSubmitting(false);
    }
  };

  const renderSearchResult = ({ item }) => {
    const isSelected = selectedSpouse?.id === item.id;

    return (
      <TouchableOpacity
        style={[styles.resultCard, isSelected && styles.resultCardSelected]}
        onPress={() => handleSelectSpouse(item)}
        activeOpacity={0.7}
      >
        <View style={styles.resultContent}>
          <View style={styles.resultInfo}>
            <Text style={styles.resultName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.hid && (
              <Text style={styles.resultHid}>
                HID: {item.hid}
              </Text>
            )}
          </View>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color="#A13333" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#242121" />
          </TouchableOpacity>
          <Text style={styles.title}>إضافة {spouseTitle}</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Person Info */}
        <View style={styles.personInfo}>
          <Text style={styles.personName}>{person?.name}</Text>
          <Text style={styles.personSubtext}>
            إضافة {spouseTitle} لـ
          </Text>
        </View>

        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              mode === "search" && styles.modeButtonActive,
            ]}
            onPress={() => setMode("search")}
          >
            <Ionicons
              name="search"
              size={20}
              color={mode === "search" ? "#F9F7F3" : "#242121"}
            />
            <Text
              style={[
                styles.modeButtonText,
                mode === "search" && styles.modeButtonTextActive,
              ]}
            >
              بحث عن موجود
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              mode === "create" && styles.modeButtonActive,
            ]}
            onPress={() => setMode("create")}
          >
            <Ionicons
              name="person-add"
              size={20}
              color={mode === "create" ? "#F9F7F3" : "#242121"}
            />
            <Text
              style={[
                styles.modeButtonText,
                mode === "create" && styles.modeButtonTextActive,
              ]}
            >
              إضافة جديد
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Mode */}
        {mode === "search" && (
          <View style={styles.content}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#24212160" />
              <TextInput
                style={styles.searchInput}
                placeholder={`ابحث عن ${spouseTitle}...`}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#24212160"
                autoFocus
              />
              {searchQuery !== "" && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color="#24212160" />
                </TouchableOpacity>
              )}
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#A13333" />
              </View>
            ) : (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.resultsList}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  searchQuery.length >= 2 && (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="search-outline" size={48} color="#24212140" />
                      <Text style={styles.emptyText}>لا توجد نتائج</Text>
                      <TouchableOpacity
                        style={styles.switchModeButton}
                        onPress={() => {
                          setMode("create");
                          setNewSpouseName(searchQuery);
                        }}
                      >
                        <Text style={styles.switchModeText}>
                          إضافة "{searchQuery}" كشخص جديد
                        </Text>
                        <Ionicons name="arrow-forward" size={20} color="#A13333" />
                      </TouchableOpacity>
                    </View>
                  )
                }
              />
            )}

            {selectedSpouse && (
              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.primaryButton, submitting && styles.buttonDisabled]}
                  onPress={handleLinkExistingSpouse}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#F9F7F3" />
                  ) : (
                    <Text style={styles.primaryButtonText}>ربط الزواج</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Create Mode */}
        {mode === "create" && (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>الاسم الكامل</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="مثال: فاطمة بنت محمد العتيبي"
                  value={newSpouseName}
                  onChangeText={setNewSpouseName}
                  placeholderTextColor="#24212160"
                  autoFocus
                />
                <Text style={styles.inputHint}>
                  يجب أن يتضمن الاسم اسم العائلة
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>رقم الهاتف (اختياري)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="05XXXXXXXX"
                  value={newSpousePhone}
                  onChangeText={setNewSpousePhone}
                  placeholderTextColor="#24212160"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.primaryButton, submitting && styles.buttonDisabled]}
                onPress={handleCreateNewSpouse}
                disabled={submitting || !newSpouseName.trim()}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#F9F7F3" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    إضافة {spouseTitle}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#D1BBA340",
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#242121",
  },
  personInfo: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#D1BBA310",
  },
  personName: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#242121",
  },
  personSubtext: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: "#24212199",
    marginTop: 4,
  },
  modeToggle: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#D1BBA320",
    borderWidth: 1,
    borderColor: "transparent",
  },
  modeButtonActive: {
    backgroundColor: "#A13333",
    borderColor: "#A13333",
  },
  modeButtonText: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    fontWeight: "500",
    color: "#242121",
  },
  modeButtonTextActive: {
    color: "#F9F7F3",
  },
  content: {
    flex: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1BBA320",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "SF Arabic",
    marginHorizontal: 8,
    color: "#242121",
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  resultCard: {
    backgroundColor: "#F9F7F3",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1BBA340",
    marginBottom: 8,
    overflow: "hidden",
  },
  resultCardSelected: {
    borderColor: "#A13333",
    backgroundColor: "#A1333308",
  },
  resultContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontFamily: "SF Arabic",
    fontWeight: "500",
    color: "#242121",
  },
  resultHid: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: "#24212160",
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "SF Arabic",
    color: "#24212160",
    marginTop: 16,
  },
  switchModeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#A1333310",
    borderRadius: 10,
  },
  switchModeText: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: "#A13333",
    fontWeight: "500",
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    fontWeight: "500",
    color: "#242121",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#D1BBA320",
    borderWidth: 1,
    borderColor: "#D1BBA340",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "SF Arabic",
    color: "#242121",
  },
  inputHint: {
    fontSize: 12,
    fontFamily: "SF Arabic",
    color: "#24212160",
    marginTop: 6,
  },
  footer: {
    padding: 16,
    paddingBottom: 24,
  },
  primaryButton: {
    backgroundColor: "#A13333",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primaryButtonText: {
    color: "#F9F7F3",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});