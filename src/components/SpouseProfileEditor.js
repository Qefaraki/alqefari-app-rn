import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  Image,
} from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import profilesService from "../services/profiles";
import storageService from "../services/storage";
import { formatHijriDate } from "../utils/arabicUtils";

export default function SpouseProfileEditor({
  visible,
  onClose,
  spouse,
  person,
  onSave,
}) {
  // Form states
  const [profileData, setProfileData] = useState({
    name: "",
    date_of_birth: null,
    date_of_death: null,
    location: "",
    story: "",
    phone: "",
    email: "",
    photo_url: null,
  });
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState("birth");

  // Refs
  const bottomSheetRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Initialize data
  useEffect(() => {
    if (spouse && visible) {
      const spouseName =
        person?.gender === "male" ? spouse.wife_name : spouse.husband_name;

      setProfileData({
        name: spouseName || "",
        date_of_birth: spouse.spouse_date_of_birth,
        date_of_death: spouse.spouse_date_of_death,
        location: spouse.spouse_location || "",
        story: spouse.spouse_story || "",
        phone: spouse.spouse_phone || "",
        email: spouse.spouse_email || "",
        photo_url: spouse.spouse_photo_url,
      });

      // Animate in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [spouse, visible, person]);

  // Dynamic title
  const title =
    person?.gender === "male"
      ? `ملف ${profileData.name || "الزوجة"}`
      : `ملف ${profileData.name || "الزوج"}`;

  // Handle photo selection
  const handleSelectPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("خطأ", "نحتاج إذن الوصول إلى الصور");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      uploadPhoto(result.assets[0]);
    }
  };

  // Upload photo
  const uploadPhoto = async (asset) => {
    setUploadingPhoto(true);
    try {
      const photoUrl = await storageService.uploadSpousePhoto(
        spouse.id,
        asset.uri,
      );
      setProfileData({ ...profileData, photo_url: photoUrl });
    } catch (error) {
      Alert.alert("خطأ", "فشل رفع الصورة");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    setLoading(true);
    try {
      const updateData = {
        [person?.gender === "male" ? "wife_name" : "husband_name"]:
          profileData.name,
        spouse_date_of_birth: profileData.date_of_birth,
        spouse_date_of_death: profileData.date_of_death,
        spouse_location: profileData.location,
        spouse_story: profileData.story,
        spouse_phone: profileData.phone,
        spouse_email: profileData.email,
        spouse_photo_url: profileData.photo_url,
      };

      await profilesService.updateMarriage(spouse.id, updateData);

      if (onSave) onSave();
      handleClose();
      Alert.alert("نجح", "تم حفظ التغييرات");
    } catch (error) {
      Alert.alert("خطأ", "فشل حفظ البيانات");
    } finally {
      setLoading(false);
    }
  };

  // Handle close
  const handleClose = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      if (onClose) onClose();
    });
  };

  if (!visible) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={["85%"]}
      onClose={handleClose}
      enablePanDownToClose
      backdropComponent={({ animatedIndex, style }) => (
        <Animated.View
          style={[
            style,
            {
              backgroundColor: "rgba(0,0,0,0.3)",
              opacity: animatedIndex,
            },
          ]}
        />
      )}
      handleComponent={() => (
        <View style={styles.handle}>
          <View style={styles.handleIndicator} />
        </View>
      )}
    >
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            {loading ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text style={styles.saveButtonText}>حفظ</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Photo Section */}
          <View style={styles.photoSection}>
            <TouchableOpacity
              style={styles.photoContainer}
              onPress={handleSelectPhoto}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="large" color="#007AFF" />
              ) : profileData.photo_url ? (
                <Image
                  source={{ uri: profileData.photo_url }}
                  style={styles.photo}
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={40} color="#8E8E93" />
                  <Text style={styles.photoPlaceholderText}>إضافة صورة</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Basic Info */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>المعلومات الأساسية</Text>

            <View style={styles.field}>
              <Text style={styles.label}>الاسم الكامل</Text>
              <TextInput
                style={styles.input}
                value={profileData.name}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, name: text })
                }
                placeholder="أدخل الاسم الكامل"
                placeholderTextColor="#8E8E93"
                textAlign="right"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>الموقع</Text>
              <TextInput
                style={styles.input}
                value={profileData.location}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, location: text })
                }
                placeholder="المدينة، البلد"
                placeholderTextColor="#8E8E93"
                textAlign="right"
              />
            </View>
          </View>

          {/* Dates */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>التواريخ</Text>

            <TouchableOpacity
              style={styles.dateField}
              onPress={() => {
                setDatePickerMode("birth");
                setShowDatePicker(true);
              }}
            >
              <Text style={styles.label}>تاريخ الميلاد</Text>
              <View style={styles.dateValue}>
                <Text style={styles.dateText}>
                  {profileData.date_of_birth
                    ? formatHijriDate(profileData.date_of_birth)
                    : "غير محدد"}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
              </View>
            </TouchableOpacity>

            {profileData.date_of_death !== undefined && (
              <TouchableOpacity
                style={styles.dateField}
                onPress={() => {
                  setDatePickerMode("death");
                  setShowDatePicker(true);
                }}
              >
                <Text style={styles.label}>تاريخ الوفاة</Text>
                <View style={styles.dateValue}>
                  <Text style={styles.dateText}>
                    {profileData.date_of_death
                      ? formatHijriDate(profileData.date_of_death)
                      : "غير محدد"}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Story */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>السيرة الذاتية</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={profileData.story}
              onChangeText={(text) =>
                setProfileData({ ...profileData, story: text })
              }
              placeholder="أضف قصة أو معلومات إضافية..."
              placeholderTextColor="#8E8E93"
              multiline
              numberOfLines={4}
              textAlign="right"
              textAlignVertical="top"
            />
          </View>

          {/* Contact Info */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>معلومات الاتصال</Text>

            <View style={styles.field}>
              <Text style={styles.label}>رقم الهاتف</Text>
              <TextInput
                style={styles.input}
                value={profileData.phone}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, phone: text })
                }
                placeholder="05xxxxxxxx"
                placeholderTextColor="#8E8E93"
                keyboardType="phone-pad"
                textAlign="right"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>البريد الإلكتروني</Text>
              <TextInput
                style={styles.input}
                value={profileData.email}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, email: text })
                }
                placeholder="example@email.com"
                placeholderTextColor="#8E8E93"
                keyboardType="email-address"
                textAlign="right"
              />
            </View>
          </View>
        </ScrollView>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={
              datePickerMode === "birth"
                ? profileData.date_of_birth
                  ? new Date(profileData.date_of_birth)
                  : new Date()
                : profileData.date_of_death
                  ? new Date(profileData.date_of_death)
                  : new Date()
            }
            mode="date"
            display="spinner"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                const dateString = selectedDate.toISOString().split("T")[0];
                if (datePickerMode === "birth") {
                  setProfileData({ ...profileData, date_of_birth: dateString });
                } else {
                  setProfileData({ ...profileData, date_of_death: dateString });
                }
              }
            }}
          />
        )}
      </Animated.View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  handle: {
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "white",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  handleIndicator: {
    width: 36,
    height: 5,
    backgroundColor: "#D1D1D6",
    borderRadius: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C6C6C8",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
    flex: 1,
    textAlign: "center",
  },
  closeButton: {
    padding: 4,
  },
  saveButton: {
    padding: 4,
  },
  saveButtonText: {
    fontSize: 17,
    color: "#007AFF",
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  photoSection: {
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: "white",
    marginBottom: 16,
  },
  photoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    backgroundColor: "#F2F2F7",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 8,
  },
  card: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    padding: 12,
    fontSize: 17,
    color: "#000",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  dateField: {
    marginBottom: 16,
  },
  dateValue: {
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateText: {
    fontSize: 17,
    color: "#000",
  },
});
