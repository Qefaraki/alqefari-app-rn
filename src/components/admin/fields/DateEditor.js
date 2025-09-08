import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from "react-native";
import * as Haptics from "expo-haptics";
import CardSurface from "../../ios/CardSurface";
import SegmentedControl from "../../ui/SegmentedControl";
import {
  toDateData,
  toArabicNumerals,
  createFromHijri,
  createFromGregorian,
} from "../../../utils/dateUtils";

const DateEditor = ({ label, value, onChange, error }) => {
  // Ensure onChange is a function
  const handleChange = onChange || (() => {});

  // State management
  const [activeCalendar, setActiveCalendar] = useState("hijri");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [isApproximate, setIsApproximate] = useState(false);

  // Initialize from value prop
  useEffect(() => {
    if (value) {
      setIsApproximate(value.approximate || false);

      if (activeCalendar === "hijri" && value.hijri) {
        setDay(String(value.hijri.day || ""));
        setMonth(String(value.hijri.month || ""));
        setYear(String(value.hijri.year || ""));
      } else if (activeCalendar === "gregorian" && value.gregorian) {
        setDay(String(value.gregorian.day || ""));
        setMonth(String(value.gregorian.month || ""));
        setYear(String(value.gregorian.year || ""));
      }
    } else {
      setDay("");
      setMonth("");
      setYear("");
      setIsApproximate(false);
    }
  }, [value, activeCalendar]);

  // Update date when any field changes
  const updateDate = useCallback(
    (newDay, newMonth, newYear, newApproximate) => {
      // Validate inputs
      const dayNum = parseInt(newDay);
      const monthNum = parseInt(newMonth);
      const yearNum = parseInt(newYear);

      if (
        !newDay ||
        !newMonth ||
        !newYear ||
        isNaN(dayNum) ||
        isNaN(monthNum) ||
        isNaN(yearNum)
      ) {
        // If any field is empty or invalid, don't update
        return;
      }

      // Create date based on active calendar
      let momentDate;
      if (activeCalendar === "hijri") {
        momentDate = createFromHijri(yearNum, monthNum, dayNum);
      } else {
        momentDate = createFromGregorian(yearNum, monthNum, dayNum);
      }

      if (momentDate && momentDate.isValid()) {
        const dateData = toDateData(momentDate, newApproximate);
        handleChange(dateData);
      }
    },
    [activeCalendar, handleChange],
  );

  // Handle individual field changes
  const handleDayChange = (text) => {
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, "");
    if (cleaned.length <= 2) {
      setDay(cleaned);
      updateDate(cleaned, month, year, isApproximate);
    }
  };

  const handleMonthChange = (text) => {
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, "");
    if (cleaned.length <= 2) {
      setMonth(cleaned);
      updateDate(day, cleaned, year, isApproximate);
    }
  };

  const handleYearChange = (text) => {
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, "");
    if (cleaned.length <= 4) {
      setYear(cleaned);
      updateDate(day, month, cleaned, isApproximate);
    }
  };

  // Handle calendar type change
  const handleCalendarTypeChange = useCallback((newType) => {
    setActiveCalendar(newType);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Clear fields when switching calendar type
    setDay("");
    setMonth("");
    setYear("");
  }, []);

  // Handle approximate toggle
  const handleApproximateToggle = useCallback(
    (newValue) => {
      setIsApproximate(newValue);
      updateDate(day, month, year, newValue);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [day, month, year, updateDate],
  );

  // Handle presets
  const handleToday = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Success);

    const today = new Date();
    if (activeCalendar === "gregorian") {
      setDay(String(today.getDate()));
      setMonth(String(today.getMonth() + 1));
      setYear(String(today.getFullYear()));

      const todayMoment = createFromGregorian(
        today.getFullYear(),
        today.getMonth() + 1,
        today.getDate(),
      );
      const dateData = toDateData(todayMoment, false);
      handleChange(dateData);
    } else {
      // For Hijri, we need to convert today's date
      const todayMoment = createFromGregorian(
        today.getFullYear(),
        today.getMonth() + 1,
        today.getDate(),
      );

      if (todayMoment) {
        const dateData = toDateData(todayMoment, false);
        if (dateData && dateData.hijri) {
          setDay(String(dateData.hijri.day));
          setMonth(String(dateData.hijri.month));
          setYear(String(dateData.hijri.year));
          handleChange(dateData);
        }
      }
    }
  }, [activeCalendar, handleChange]);

  const handleClear = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDay("");
    setMonth("");
    setYear("");
    setIsApproximate(false);
    handleChange(null);
  }, [handleChange]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <CardSurface>
        <View style={styles.content}>
          {/* Calendar type selector */}
          <View style={styles.segmentContainer}>
            <SegmentedControl
              options={[
                { label: "هجري", value: "hijri" },
                { label: "ميلادي", value: "gregorian" },
              ]}
              value={activeCalendar}
              onChange={handleCalendarTypeChange}
            />
          </View>

          {/* Date input fields */}
          <View style={styles.inputRow}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>يوم</Text>
              <TextInput
                style={styles.input}
                value={day}
                onChangeText={handleDayChange}
                placeholder={activeCalendar === "hijri" ? "١-٣٠" : "1-31"}
                keyboardType="number-pad"
                maxLength={2}
                textAlign="center"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>شهر</Text>
              <TextInput
                style={styles.input}
                value={month}
                onChangeText={handleMonthChange}
                placeholder="١-١٢"
                keyboardType="number-pad"
                maxLength={2}
                textAlign="center"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>سنة</Text>
              <TextInput
                style={[styles.input, styles.yearInput]}
                value={year}
                onChangeText={handleYearChange}
                placeholder={activeCalendar === "hijri" ? "١٤٤٦" : "2024"}
                keyboardType="number-pad"
                maxLength={4}
                textAlign="center"
              />
            </View>
          </View>

          {/* Display converted date */}
          {value && (
            <View style={styles.conversionDisplay}>
              <Text style={styles.conversionLabel}>
                {activeCalendar === "hijri"
                  ? "التاريخ الميلادي:"
                  : "التاريخ الهجري:"}
              </Text>
              <Text style={styles.conversionText}>
                {activeCalendar === "hijri"
                  ? value.gregorian
                    ? `${value.gregorian.day}/${value.gregorian.month}/${value.gregorian.year}`
                    : "—"
                  : value.hijri
                    ? `${toArabicNumerals(value.hijri.day)}/${toArabicNumerals(value.hijri.month)}/${toArabicNumerals(value.hijri.year)} هـ`
                    : "—"}
              </Text>
            </View>
          )}

          {/* Controls */}
          <View style={styles.controls}>
            {/* Approximate toggle */}
            <View style={styles.approximateRow}>
              <Text style={styles.approximateLabel}>تاريخ تقريبي</Text>
              <Switch
                value={isApproximate}
                onValueChange={handleApproximateToggle}
                trackColor={{ false: "#E5E5EA", true: "#34C759" }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E5E5EA"
              />
            </View>

            {/* Preset buttons */}
            <View style={styles.presetButtons}>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={handleToday}
                activeOpacity={0.7}
              >
                <Text style={styles.presetButtonText}>اليوم</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.presetButton, styles.clearButton]}
                onPress={handleClear}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetButtonText, styles.clearButtonText]}>
                  مسح
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </CardSurface>

      {/* Error message */}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  content: {
    padding: 16,
  },
  segmentContainer: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: "#8A8A8E",
    marginBottom: 4,
    textAlign: "center",
    fontFamily: "SF Arabic Regular",
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 8,
    fontSize: 18,
    fontWeight: "500",
    color: "#000000",
    backgroundColor: "#FFFFFF",
  },
  yearInput: {
    flex: 1.5,
  },
  conversionDisplay: {
    backgroundColor: "#F7F7FA",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  conversionLabel: {
    fontSize: 12,
    color: "#8A8A8E",
    marginBottom: 4,
    fontFamily: "SF Arabic Regular",
  },
  conversionText: {
    fontSize: 16,
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  controls: {
    gap: 16,
  },
  approximateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  approximateLabel: {
    fontSize: 16,
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  presetButtons: {
    flexDirection: "row",
    gap: 12,
  },
  presetButton: {
    flex: 1,
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  clearButton: {
    backgroundColor: "#E5E5EA",
  },
  presetButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
    fontFamily: "SF Arabic Regular",
  },
  clearButtonText: {
    color: "#8A8A8E",
  },
  errorText: {
    fontSize: 14,
    color: "#FF3B30",
    marginTop: 4,
    fontFamily: "SF Arabic Regular",
  },
});

DateEditor.displayName = "DateEditor";

export default DateEditor;
