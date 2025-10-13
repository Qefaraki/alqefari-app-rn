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
  Dimensions,
  ScrollView,
} from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import profilesService from "../services/profiles";
import { formatHijriDate } from "../utils/arabicUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function SpouseEditor({
  visible,
  onClose,
  person,
  marriage,
  onSave,
}) {
  // Form states
  const [spouseName, setSpouseName] = useState("");
  const [marriageDate, setMarriageDate] = useState(null);
  const [divorceDate, setDivorceDate] = useState(null);
  const [status, setStatus] = useState("current");
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState("marriage");

  // Refs
  const bottomSheetRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Initialize data when editing
  useEffect(() => {
    if (marriage && visible) {
      setSpouseName(
        person?.gender === "male"
          ? marriage.wife_name || ""
          : marriage.husband_name || "",
      );
      setMarriageDate(marriage.marriage_date);
      setDivorceDate(marriage.divorce_date);
      // Map old status values to new ones
      const oldStatus = marriage.status || "married";
      const mappedStatus = oldStatus === "married" ? "current" : "past";
      setStatus(mappedStatus);
    } else if (visible) {
      // Reset for new spouse
      setSpouseName("");
      setMarriageDate(null);
      setDivorceDate(null);
      setStatus("current");
    }

    // Animate in
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [marriage, visible, person]);

  // Dynamic labels based on person's gender
  const getLabels = () => {
    const isMale = person?.gender === "male";
    return {
      title: marriage
        ? isMale
          ? "تعديل الزوجة"
          : "تعديل الزوج"
        : isMale
          ? "إضافة زوجة"
          : "إضافة زوج",
      nameLabel: isMale ? "اسم الزوجة" : "اسم الزوج",
      namePlaceholder: isMale
        ? "مثال: مريم محمد علي السعوي"
        : "مثال: أحمد محمد علي القفاري",
    };
  };

  const labels = getLabels();

  // Status options
  const statusOptions = [
    { value: "current", label: "حالي", color: "#34C759" },
    {
      value: "past",
      label: "سابق",
      color: "#8E8E93",
    },
  ];

  // Handle save
  const handleSave = async () => {
    if (!spouseName.trim()) {
      Alert.alert("خطأ", "الرجاء إدخال الاسم");
      return;
    }

    setLoading(true);
    try {
      const data = {
        [person?.gender === "male" ? "wife_name" : "husband_name"]:
          spouseName.trim(),
        marriage_date: marriageDate,
        divorce_date: divorceDate,
        status,
      };

      if (marriage) {
        // Update existing
        await profilesService.updateMarriage(marriage.id, data);
      } else {
        // Create new
        await profilesService.createMarriage({
          [person?.gender === "male" ? "husband_id" : "wife_id"]: person.id,
          ...data,
        });
      }

      if (onSave) onSave();
      handleClose();
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
      snapPoints={["65%"]}
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
            <Text style={styles.closeButtonText}>إلغاء</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{labels.title}</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            {loading ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text style={styles.saveButtonText}>حفظ</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Name Input */}
          <View style={styles.section}>
            <Text style={styles.label}>{labels.nameLabel}</Text>
            <TextInput
              style={styles.input}
              value={spouseName}
              onChangeText={setSpouseName}
              placeholder={labels.namePlaceholder}
              placeholderTextColor="#8E8E93"
              autoFocus
              textAlign="right"
              clearButtonMode="never"
            />
          </View>

          {/* Marriage Date */}
          <View style={styles.section}>
            <Text style={styles.label}>تاريخ الزواج</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => {
                setDatePickerMode("marriage");
                setShowDatePicker(true);
              }}
            >
              <Text style={styles.dateText}>
                {marriageDate ? formatHijriDate(marriageDate) : "اختر التاريخ"}
              </Text>
              <Ionicons name="calendar-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>

          {/* Status Selector */}
          <View style={styles.section}>
            <Text style={styles.label}>الحالة</Text>
            <View style={styles.statusOptions}>
              {statusOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.statusOption,
                    status === option.value && styles.statusOptionActive,
                  ]}
                  onPress={() => setStatus(option.value)}
                >
                  <View style={styles.statusRadio}>
                    {status === option.value && (
                      <View style={styles.statusRadioActive} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.statusLabel,
                      {
                        color: status === option.value ? option.color : "#000",
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* End Date (if marriage is past) */}
          {status !== "current" && (
            <View style={styles.section}>
              <Text style={styles.label}>
                تاريخ انتهاء الزواج
              </Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => {
                  setDatePickerMode("divorce");
                  setShowDatePicker(true);
                }}
              >
                <Text style={styles.dateText}>
                  {divorceDate ? formatHijriDate(divorceDate) : "اختر التاريخ"}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Delete Button (if editing) */}
          {marriage && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                Alert.alert("تأكيد الحذف", "هل تريد حذف هذا السجل؟", [
                  { text: "إلغاء", style: "cancel" },
                  {
                    text: "حذف",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await profilesService.deleteMarriage(marriage.id);
                        if (onSave) onSave();
                        handleClose();
                      } catch (error) {
                        Alert.alert("خطأ", "فشل الحذف");
                      }
                    },
                  },
                ]);
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text style={styles.deleteButtonText}>حذف السجل</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={
              datePickerMode === "marriage"
                ? marriageDate
                  ? new Date(marriageDate)
                  : new Date()
                : divorceDate
                  ? new Date(divorceDate)
                  : new Date()
            }
            mode="date"
            display="spinner"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                const dateString = selectedDate.toISOString().split("T")[0];
                if (datePickerMode === "marriage") {
                  setMarriageDate(dateString);
                } else {
                  setDivorceDate(dateString);
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
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 17,
    color: "#007AFF",
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
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    fontSize: 17,
    color: "#000",
  },
  dateInput: {
    backgroundColor: "white",
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
  statusOptions: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 8,
  },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  statusOptionActive: {
    backgroundColor: "#F2F2F7",
    borderRadius: 6,
  },
  statusRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#C7C7CC",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusRadioActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#007AFF",
  },
  statusLabel: {
    fontSize: 17,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
  },
  deleteButtonText: {
    fontSize: 17,
    color: "#FF3B30",
    marginLeft: 8,
  },
});
