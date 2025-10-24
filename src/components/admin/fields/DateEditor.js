import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Animated,
} from "react-native";
import * as Haptics from "expo-haptics";
import ProfileFormCard from "../../ui/form/ProfileFormCard";
import SegmentedControl from "../../ui/SegmentedControl";
import ChoiceChip from "../../ui/ChoiceChip";
import tokens from "../../ui/tokens";
import {
  toDateData,
  toArabicNumerals,
  fromArabicNumerals,
  createFromHijri,
  createFromGregorian,
  createFromPartialDate,
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
  const [showDetails, setShowDetails] = useState(true); // Expandable details (month/day)
  const [dayUnknown, setDayUnknown] = useState(false);
  const [monthUnknown, setMonthUnknown] = useState(false);

  // Initialize from value prop
  useEffect(() => {
    if (value) {
      setIsApproximate(value.approximate || false);

      // Check for partial dates
      const hasCompleteDate = (obj) => obj && obj.year && obj.month && obj.day;
      const hasPartialDate = (obj) => obj && obj.year && (!obj.month || !obj.day);

      if (activeCalendar === "hijri") {
        // Handle Hijri calendar
        if (value.hijri) {
          const { day: d, month: m, year: y } = value.hijri;
          setYear(String(y || ""));
          setMonth(String(m || ""));
          setDay(String(d || ""));
          setMonthUnknown(!m);
          setDayUnknown(!d);
          setShowDetails(!(!m && !d)); // Collapse if both unknown
        } else if (value.gregorian) {
          // Convert from gregorian to hijri
          const { day: d, month: m, year: y } = value.gregorian;
          if (y && m && d) {
            const momentDate = createFromGregorian(y, m, d);
            if (momentDate && momentDate.isValid()) {
              setYear(String(momentDate.iYear()));
              setMonth(String(momentDate.iMonth() + 1));
              setDay(String(momentDate.iDate()));
              setMonthUnknown(false);
              setDayUnknown(false);
              setShowDetails(true);
            }
          } else if (y) {
            // Partial date - convert year only
            const momentDate = createFromPartialDate(y, m || null, d || null, false);
            if (momentDate && momentDate.isValid()) {
              setYear(String(momentDate.iYear()));
              setMonth(String(momentDate.iMonth() + 1));
              setDay(String(momentDate.iDate()));
              setMonthUnknown(!m);
              setDayUnknown(!d);
              setShowDetails(!(!m && !d));
            }
          }
        }
      } else {
        // Handle Gregorian calendar
        if (value.gregorian) {
          const { day: d, month: m, year: y } = value.gregorian;
          setYear(String(y || ""));
          setMonth(String(m || ""));
          setDay(String(d || ""));
          setMonthUnknown(!m);
          setDayUnknown(!d);
          setShowDetails(!(!m && !d));
        } else if (value.hijri) {
          // Convert from hijri to gregorian
          const { day: d, month: m, year: y } = value.hijri;
          if (y && m && d) {
            const momentDate = createFromHijri(y, m, d);
            if (momentDate && momentDate.isValid()) {
              setYear(String(momentDate.year()));
              setMonth(String(momentDate.month() + 1));
              setDay(String(momentDate.date()));
              setMonthUnknown(false);
              setDayUnknown(false);
              setShowDetails(true);
            }
          } else if (y) {
            // Partial date - convert year only
            const momentDate = createFromPartialDate(y, m || null, d || null, true);
            if (momentDate && momentDate.isValid()) {
              setYear(String(momentDate.year()));
              setMonth(String(momentDate.month() + 1));
              setDay(String(momentDate.date()));
              setMonthUnknown(!m);
              setDayUnknown(!d);
              setShowDetails(!(!m && !d));
            }
          }
        }
      }
    } else {
      setDay("");
      setMonth("");
      setYear("");
      setIsApproximate(false);
      setMonthUnknown(false);
      setDayUnknown(false);
      setShowDetails(true);
    }
  }, [value, activeCalendar]);

  // Update date when any field changes
  const updateDate = useCallback(
    (newDay, newMonth, newYear, newApproximate, ignoreMonth = false, ignoreDay = false) => {
      // Validate year (required)
      const yearNum = parseInt(newYear);
      if (!newYear || isNaN(yearNum)) {
        return;
      }

      // Validate month and day if they should be included
      const monthNum = ignoreMonth ? null : parseInt(newMonth);
      const dayNum = ignoreDay ? null : parseInt(newDay);

      const hasValidMonth = !ignoreMonth && newMonth && !isNaN(monthNum);
      const hasValidDay = !ignoreDay && newDay && !isNaN(dayNum);

      // Create date based on active calendar
      let momentDate;
      if (activeCalendar === "hijri") {
        if (hasValidMonth && hasValidDay) {
          momentDate = createFromHijri(yearNum, monthNum, dayNum);
        } else if (hasValidMonth) {
          momentDate = createFromPartialDate(yearNum, monthNum, null, true);
        } else {
          momentDate = createFromPartialDate(yearNum, null, null, true);
        }
      } else {
        if (hasValidMonth && hasValidDay) {
          momentDate = createFromGregorian(yearNum, monthNum, dayNum);
        } else if (hasValidMonth) {
          momentDate = createFromPartialDate(yearNum, monthNum, null, false);
        } else {
          momentDate = createFromPartialDate(yearNum, null, null, false);
        }
      }

      if (momentDate && momentDate.isValid()) {
        // Determine what to include in output based on unknown flags
        const includeMonth = !ignoreMonth && hasValidMonth;
        const includeDay = !ignoreDay && hasValidDay;

        const dateData = toDateData(momentDate, newApproximate || !includeMonth || !includeDay, includeMonth, includeDay);
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
      updateDate(cleaned, month, year, isApproximate, monthUnknown, dayUnknown);
    }
  };

  const handleMonthChange = (text) => {
    // Convert Arabic numerals to Western, then allow only numbers
    const westernText = fromArabicNumerals(text);
    const cleaned = westernText.replace(/[^0-9]/g, "");
    if (cleaned.length <= 2) {
      setMonth(cleaned);
      updateDate(day, cleaned, year, isApproximate, monthUnknown, dayUnknown);
    }
  };

  const handleYearChange = (text) => {
    // Convert Arabic numerals to Western, then allow only numbers
    const westernText = fromArabicNumerals(text);
    const cleaned = westernText.replace(/[^0-9]/g, "");
    // Allow up to 4 digits for years (0-9999)
    if (cleaned.length <= 4) {
      setYear(cleaned);
      updateDate(day, month, cleaned, isApproximate, monthUnknown, dayUnknown);
    }
  };

  // Handle month unknown toggle
  const handleMonthUnknownToggle = useCallback(() => {
    const newMonthUnknown = !monthUnknown;
    setMonthUnknown(newMonthUnknown);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // When toggling month unknown, update the date
    if (newMonthUnknown) {
      setMonth("");
      setDay("");
      setDayUnknown(true);
      updateDate("", "", year, isApproximate, true, true);
    } else if (year) {
      // Show default month when unchecking
      setMonth("7");
      updateDate(day, "7", year, isApproximate, false, dayUnknown);
    }
  }, [monthUnknown, year, day, dayUnknown, isApproximate, updateDate]);

  // Handle day unknown toggle
  const handleDayUnknownToggle = useCallback(() => {
    const newDayUnknown = !dayUnknown;
    setDayUnknown(newDayUnknown);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // When toggling day unknown, update the date
    if (newDayUnknown) {
      setDay("");
      updateDate("", month, year, isApproximate, monthUnknown, true);
    } else if (year && month) {
      // Show default day when unchecking
      setDay("1");
      updateDate("1", month, year, isApproximate, monthUnknown, false);
    }
  }, [dayUnknown, year, month, monthUnknown, isApproximate, updateDate]);

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

      <ProfileFormCard>
        <View style={styles.content}>
          {/* Header with calendar toggle and year field */}
          <View style={styles.headerRow}>
            <View style={styles.yearFieldContainer}>
              <Text style={styles.inputLabel}>السنة</Text>
              <TextInput
                style={styles.yearField}
                value={year}
                onChangeText={handleYearChange}
                placeholder={activeCalendar === "hijri" ? "١٤٤٦" : "2024"}
                keyboardType="number-pad"
                maxLength={4}
                textAlign="center"
              />
            </View>

            {/* Compact calendar toggle pill */}
            <View style={styles.calendarPill}>
              <SegmentedControl
                options={[
                  { label: "هـ", id: "hijri" },
                  { label: "م", id: "gregorian" },
                ]}
                value={activeCalendar}
                onChange={handleCalendarTypeChange}
              />
            </View>
          </View>

          {/* Expandable additional details section */}
          {showDetails && (
            <View style={styles.detailsSection}>
              {/* Month and day inputs */}
              <View style={styles.detailsInputRow}>
                <View style={styles.detailInputWrapper}>
                  <Text style={styles.inputLabel}>شهر</Text>
                  <TextInput
                    style={styles.detailInput}
                    value={month}
                    onChangeText={handleMonthChange}
                    placeholder="١-١٢"
                    keyboardType="number-pad"
                    maxLength={2}
                    textAlign="center"
                    editable={!monthUnknown}
                  />
                </View>

                <View style={styles.detailInputWrapper}>
                  <Text style={styles.inputLabel}>يوم</Text>
                  <TextInput
                    style={styles.detailInput}
                    value={day}
                    onChangeText={handleDayChange}
                    placeholder={activeCalendar === "hijri" ? "١-٣٠" : "1-31"}
                    keyboardType="number-pad"
                    maxLength={2}
                    textAlign="center"
                    editable={!dayUnknown}
                  />
                </View>
              </View>

              {/* Unknown toggles */}
              <View style={styles.unknownChipsRow}>
                <ChoiceChip
                  label="الشهر غير معروف"
                  selected={monthUnknown}
                  onPress={handleMonthUnknownToggle}
                  size="small"
                />
                <ChoiceChip
                  label="اليوم غير معروف"
                  selected={dayUnknown}
                  onPress={handleDayUnknownToggle}
                  size="small"
                />
              </View>
            </View>
          )}

          {/* Toggle details link */}
          {year && (
            <TouchableOpacity
              onPress={() => setShowDetails(!showDetails)}
              style={styles.toggleDetailsLink}
            >
              <Text style={styles.toggleDetailsText}>
                {showDetails ? "إخفاء التفاصيل" : "إضافة التفاصيل"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Minimal conversion display - single line */}
          {value && (value.gregorian?.year || value.hijri?.year) && (
            <View style={styles.conversionRow}>
              <Text style={styles.conversionLabel}>
                {activeCalendar === "hijri" ? "يعادل: " : "يعادل: "}
              </Text>
              <Text style={styles.conversionValue}>
                {activeCalendar === "hijri"
                  ? value.gregorian
                    ? value.gregorian.month && value.gregorian.day
                      ? `${value.gregorian.day}/${value.gregorian.month}/${value.gregorian.year}`
                      : `${value.gregorian.year}`
                    : "—"
                  : value.hijri
                    ? value.hijri.month && value.hijri.day
                      ? `${toArabicNumerals(value.hijri.day)}/${toArabicNumerals(value.hijri.month)}/${toArabicNumerals(value.hijri.year)} هـ`
                      : `${toArabicNumerals(value.hijri.year)} هـ`
                    : "—"}
              </Text>
            </View>
          )}

          {/* Simplified control row with chips */}
          <View style={styles.controlRow}>
            <ChoiceChip
              label="تقريبي"
              selected={isApproximate}
              onPress={handleApproximateToggle}
              size="small"
            />
            <ChoiceChip
              label="اليوم"
              selected={false}
              onPress={handleToday}
              size="small"
            />
            <TouchableOpacity
              style={styles.clearLink}
              onPress={handleClear}
            >
              <Text style={styles.clearLinkText}>مسح</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ProfileFormCard>

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
    gap: tokens.spacing.md, // 16px
  },

  // Header row with year field and calendar toggle
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: tokens.spacing.sm, // 12px
  },
  yearFieldContainer: {
    flex: 1,
  },
  yearField: {
    height: tokens.touchTarget.minimum, // 44px
    borderWidth: 1,
    borderColor: `${tokens.colors.najdi.container}60`,
    borderRadius: tokens.radii.sm, // 8px
    fontSize: 20,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    backgroundColor: tokens.colors.najdi.background,
    paddingHorizontal: tokens.spacing.sm,
  },
  calendarPill: {
    minWidth: 100,
  },

  // Labels for inputs
  inputLabel: {
    fontSize: 12, // iOS caption1
    color: tokens.colors.najdi.textMuted,
    marginBottom: tokens.spacing.xxs, // 4px
    textAlign: "center",
    fontFamily: "SF Arabic Regular",
  },

  // Expandable details section
  detailsSection: {
    gap: tokens.spacing.sm, // 12px
    borderTopWidth: 1,
    borderTopColor: `${tokens.colors.najdi.container}20`,
    paddingTop: tokens.spacing.md, // 16px
    marginTop: tokens.spacing.md, // 16px
  },
  detailsInputRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm, // 12px
  },
  detailInputWrapper: {
    flex: 1,
  },
  detailInput: {
    height: 44,
    borderWidth: 1,
    borderColor: `${tokens.colors.najdi.container}60`,
    borderRadius: tokens.radii.sm, // 8px
    fontSize: 16,
    fontWeight: "500",
    color: tokens.colors.najdi.text,
    backgroundColor: tokens.colors.najdi.background,
    textAlign: "center",
  },
  unknownChipsRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm, // 12px
    flexWrap: "wrap",
  },

  // Toggle details link
  toggleDetailsLink: {
    paddingVertical: tokens.spacing.sm, // 12px
  },
  toggleDetailsText: {
    fontSize: 14,
    color: tokens.colors.najdi.secondary, // Desert Ochre for link color
    fontFamily: "SF Arabic Regular",
    fontWeight: "500",
  },

  // Minimal conversion display - single line
  conversionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs, // 8px
  },
  conversionLabel: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
    fontFamily: "SF Arabic Regular",
  },
  conversionValue: {
    fontSize: 14,
    color: tokens.colors.najdi.text,
    fontFamily: "SF Arabic Regular",
    fontWeight: "500",
  },

  // Control row with chips
  controlRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm, // 12px
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: `${tokens.colors.najdi.container}20`,
    paddingTop: tokens.spacing.md, // 16px
    marginTop: tokens.spacing.md, // 16px
  },
  clearLink: {
    paddingVertical: tokens.spacing.xs, // 8px
    paddingHorizontal: tokens.spacing.sm, // 12px
  },
  clearLinkText: {
    fontSize: 14,
    color: tokens.colors.danger, // Red for clear action
    fontFamily: "SF Arabic Regular",
    fontWeight: "500",
  },

  // Error message
  errorText: {
    fontSize: 14,
    color: tokens.colors.danger, // #FF3B30
    marginTop: tokens.spacing.xxs, // 4px
    fontFamily: "SF Arabic Regular",
  },
});

DateEditor.displayName = "DateEditor";

export default DateEditor;
