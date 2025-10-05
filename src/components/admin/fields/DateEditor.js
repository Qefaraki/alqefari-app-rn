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
import tokens from "../../ui/tokens";
import {
  toDateData,
  toArabicNumerals,
  fromArabicNumerals,
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

      if (activeCalendar === "hijri") {
        // Try hijri first, then fall back to converting from gregorian
        if (
          value.hijri_day !== undefined &&
          value.hijri_month !== undefined &&
          value.hijri_year !== undefined
        ) {
          // Direct hijri fields (legacy format)
          setDay(String(value.hijri_day || ""));
          setMonth(String(value.hijri_month || ""));
          setYear(String(value.hijri_year || ""));
        } else if (value.hijri) {
          // Nested hijri object (new format)
          setDay(String(value.hijri.day || ""));
          setMonth(String(value.hijri.month || ""));
          setYear(String(value.hijri.year || ""));
        } else if (
          value.day !== undefined &&
          value.month !== undefined &&
          value.year !== undefined
        ) {
          // Legacy gregorian format - convert to hijri for display
          const m = createFromGregorian(value.year, value.month, value.day);
          if (m && m.isValid()) {
            setDay(String(m.iDate()));
            setMonth(String(m.iMonth() + 1));
            setYear(String(m.iYear()));
          }
        } else if (value.gregorian) {
          // New format with gregorian - convert to hijri for display
          const m = createFromGregorian(
            value.gregorian.year,
            value.gregorian.month,
            value.gregorian.day,
          );
          if (m && m.isValid()) {
            setDay(String(m.iDate()));
            setMonth(String(m.iMonth() + 1));
            setYear(String(m.iYear()));
          }
        }
      } else {
        // Gregorian calendar
        if (
          value.day !== undefined &&
          value.month !== undefined &&
          value.year !== undefined
        ) {
          // Legacy format
          setDay(String(value.day || ""));
          setMonth(String(value.month || ""));
          setYear(String(value.year || ""));
        } else if (value.gregorian) {
          // New format
          setDay(String(value.gregorian.day || ""));
          setMonth(String(value.gregorian.month || ""));
          setYear(String(value.gregorian.year || ""));
        } else if (
          value.hijri_day !== undefined &&
          value.hijri_month !== undefined &&
          value.hijri_year !== undefined
        ) {
          // Legacy hijri format - convert to gregorian for display
          const m = createFromHijri(
            value.hijri_year,
            value.hijri_month,
            value.hijri_day,
          );
          if (m && m.isValid()) {
            setDay(String(m.date()));
            setMonth(String(m.month() + 1));
            setYear(String(m.year()));
          }
        } else if (value.hijri) {
          // New format with hijri - convert to gregorian for display
          const m = createFromHijri(
            value.hijri.year,
            value.hijri.month,
            value.hijri.day,
          );
          if (m && m.isValid()) {
            setDay(String(m.date()));
            setMonth(String(m.month() + 1));
            setYear(String(m.year()));
          }
        }
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
    // Convert Arabic numerals to Western, then allow only numbers
    const westernText = fromArabicNumerals(text);
    const cleaned = westernText.replace(/[^0-9]/g, "");
    if (cleaned.length <= 2) {
      setDay(cleaned);
      updateDate(cleaned, month, year, isApproximate);
    }
  };

  const handleMonthChange = (text) => {
    // Convert Arabic numerals to Western, then allow only numbers
    const westernText = fromArabicNumerals(text);
    const cleaned = westernText.replace(/[^0-9]/g, "");
    if (cleaned.length <= 2) {
      setMonth(cleaned);
      updateDate(day, cleaned, year, isApproximate);
    }
  };

  const handleYearChange = (text) => {
    // Convert Arabic numerals to Western, then allow only numbers
    const westernText = fromArabicNumerals(text);
    const cleaned = westernText.replace(/[^0-9]/g, "");
    // Allow up to 4 digits for years (0-9999)
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
                trackColor={{
                  false: tokens.colors.najdi.container + '60',
                  true: tokens.colors.najdi.secondary, // Desert Ochre
                }}
                thumbColor={tokens.colors.najdi.background}
                ios_backgroundColor={tokens.colors.najdi.container + '60'}
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
    marginBottom: tokens.spacing.md, // 16px
  },
  label: {
    fontSize: 16,
    marginBottom: tokens.spacing.xs, // 8px
    color: tokens.colors.najdi.textMuted, // #736372
    fontFamily: "SF Arabic Regular",
  },
  content: {
    padding: tokens.spacing.md, // 16px
  },
  segmentContainer: {
    marginBottom: tokens.spacing.lg, // 20px
  },
  inputRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm, // 12px
    marginBottom: tokens.spacing.md, // 16px
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12, // iOS caption1
    color: tokens.colors.najdi.textMuted, // #736372
    marginBottom: tokens.spacing.xxs, // 4px
    textAlign: "center",
    fontFamily: "SF Arabic Regular",
  },
  input: {
    height: tokens.touchTarget.minimum, // 44px
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container + '60', // Camel Hair Beige 60%
    borderRadius: tokens.radii.sm, // 8px
    fontSize: 18,
    fontWeight: "500",
    color: tokens.colors.najdi.text, // Sadu Night #242121
    backgroundColor: tokens.colors.najdi.background, // Al-Jass White #F9F7F3
  },
  yearInput: {
    flex: 1.5,
  },
  conversionDisplay: {
    backgroundColor: tokens.colors.najdi.container + '20', // Camel Hair Beige 20%
    padding: tokens.spacing.sm, // 12px
    borderRadius: tokens.radii.sm, // 8px
    marginBottom: tokens.spacing.md, // 16px
  },
  conversionLabel: {
    fontSize: 12, // iOS caption1
    color: tokens.colors.najdi.textMuted, // #736372
    marginBottom: tokens.spacing.xxs, // 4px
    fontFamily: "SF Arabic Regular",
  },
  conversionText: {
    fontSize: 16,
    color: tokens.colors.najdi.text, // Sadu Night #242121
    fontFamily: "SF Arabic Regular",
  },
  controls: {
    gap: tokens.spacing.md, // 16px
  },
  approximateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  approximateLabel: {
    fontSize: 16,
    color: tokens.colors.najdi.text, // Sadu Night #242121
    fontFamily: "SF Arabic Regular",
  },
  presetButtons: {
    flexDirection: "row",
    gap: tokens.spacing.sm, // 12px
  },
  presetButton: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.primary, // Najdi Crimson #A13333
    paddingVertical: tokens.spacing.sm, // 12px
    borderRadius: tokens.radii.sm, // 8px
    alignItems: "center",
    minHeight: tokens.touchTarget.minimum, // 44px
  },
  clearButton: {
    backgroundColor: tokens.colors.najdi.background, // Al-Jass White #F9F7F3
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container + '60', // Camel Hair border
  },
  presetButtonText: {
    fontSize: 16,
    color: tokens.colors.najdi.background, // Al-Jass White for contrast
    fontWeight: "600",
    fontFamily: "SF Arabic Regular",
  },
  clearButtonText: {
    color: tokens.colors.najdi.text, // Sadu Night #242121
  },
  errorText: {
    fontSize: 14,
    color: tokens.colors.danger, // #FF3B30
    marginTop: tokens.spacing.xxs, // 4px
    fontFamily: "SF Arabic Regular",
  },
});

DateEditor.displayName = "DateEditor";

export default DateEditor;
