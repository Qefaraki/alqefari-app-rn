import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import CardSurface from "../../ios/CardSurface";
import SegmentedControl from "../../ui/SegmentedControl";
import {
  toDateData,
  fromDateData,
  generateCalendarDays,
  getMonthName,
  getWeekdayNames,
  toArabicNumerals,
  createFromHijri,
  createFromGregorian,
} from "../../../utils/dateUtils";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const DateEditor = ({ label, value, onChange, error }) => {
  // Ensure onChange is a function
  const handleChange = onChange || (() => {});
  // State management
  const [currentDate, setCurrentDate] = useState(value);
  const [activeCalendar, setActiveCalendar] = useState("hijri");
  const [showCalendar, setShowCalendar] = useState(false);
  const [manualInput, setManualInput] = useState("");

  // Display month/year for calendar view
  const momentDate = useMemo(() => fromDateData(currentDate), [currentDate]);
  const [displayYear, setDisplayYear] = useState(() => {
    if (!momentDate) {
      const now = new Date();
      return activeCalendar === "hijri" ? 1446 : now.getFullYear();
    }
    if (activeCalendar === "hijri") {
      return momentDate.iYear();
    }
    return momentDate.year();
  });

  const [displayMonth, setDisplayMonth] = useState(() => {
    if (!momentDate) {
      const now = new Date();
      return activeCalendar === "hijri" ? 1 : now.getMonth() + 1;
    }
    if (activeCalendar === "hijri") {
      return momentDate.iMonth() + 1;
    }
    return momentDate.month() + 1;
  });

  // Animation values
  const calendarHeight = useSharedValue(showCalendar ? 1 : 0);
  const calendarOpacity = useSharedValue(showCalendar ? 1 : 0);

  const calendarAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(calendarHeight.value, [0, 1], [0, 400]),
    opacity: calendarOpacity.value,
    overflow: "hidden",
  }));

  // Handle calendar toggle
  const toggleCalendar = useCallback(() => {
    const newShow = !showCalendar;
    setShowCalendar(newShow);
    calendarHeight.value = withSpring(newShow ? 1 : 0);
    calendarOpacity.value = withTiming(newShow ? 1 : 0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [showCalendar]);

  // Handle calendar type switch
  const handleCalendarTypeChange = useCallback(
    (newType) => {
      setActiveCalendar(newType);

      // Update display month/year based on current date
      if (momentDate) {
        if (newType === "hijri") {
          setDisplayYear(momentDate.iYear());
          setDisplayMonth(momentDate.iMonth() + 1);
        } else {
          setDisplayYear(momentDate.year());
          setDisplayMonth(momentDate.month() + 1);
        }
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [momentDate],
  );

  // Handle day selection
  const handleDayPress = useCallback(
    (day) => {
      if (!day.isCurrentMonth) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      let selectedDate;
      if (activeCalendar === "hijri") {
        selectedDate = createFromHijri(displayYear, displayMonth, day.day);
      } else {
        selectedDate = createFromGregorian(displayYear, displayMonth, day.day);
      }

      const newDateData = toDateData(
        selectedDate,
        currentDate?.approximate || false,
      );
      setCurrentDate(newDateData);
      handleChange(newDateData);
    },
    [activeCalendar, displayYear, displayMonth, currentDate, handleChange],
  );

  // Handle month navigation
  const handlePrevMonth = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (displayMonth === 1) {
      setDisplayMonth(12);
      setDisplayYear(displayYear - 1);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  }, [displayMonth, displayYear]);

  const handleNextMonth = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (displayMonth === 12) {
      setDisplayMonth(1);
      setDisplayYear(displayYear + 1);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  }, [displayMonth, displayYear]);

  // Handle approximate toggle
  const handleApproximateToggle = useCallback(
    (value) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (currentDate) {
        const newDateData = { ...currentDate, approximate: value };
        setCurrentDate(newDateData);
        handleChange(newDateData);
      }
    },
    [currentDate, handleChange],
  );

  // Handle presets
  const handleToday = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Success);

    const today = new Date();
    const todayMoment = createFromGregorian(
      today.getFullYear(),
      today.getMonth() + 1,
      today.getDate(),
    );
    const newDateData = toDateData(todayMoment, false);
    setCurrentDate(newDateData);
    handleChange(newDateData);

    // Update display to show today
    if (activeCalendar === "hijri") {
      setDisplayYear(todayMoment.iYear());
      setDisplayMonth(todayMoment.iMonth() + 1);
    } else {
      setDisplayYear(today.getFullYear());
      setDisplayMonth(today.getMonth() + 1);
    }
  }, [activeCalendar, handleChange]);

  const handleUnknown = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentDate(null);
    handleChange(null);
  }, [handleChange]);

  // Generate calendar days
  const calendarDays = useMemo(
    () =>
      generateCalendarDays(
        displayYear,
        displayMonth,
        activeCalendar === "hijri",
      ),
    [displayYear, displayMonth, activeCalendar],
  );

  // Get weekday names
  const weekdays = useMemo(() => getWeekdayNames(true), []);

  // Check if a day is selected
  const isSelectedDay = useCallback(
    (day) => {
      if (!day.isCurrentMonth || !currentDate) return false;

      if (activeCalendar === "hijri" && currentDate.hijri) {
        return (
          currentDate.hijri.year === displayYear &&
          currentDate.hijri.month === displayMonth &&
          currentDate.hijri.day === day.day
        );
      } else if (activeCalendar === "gregorian" && currentDate.gregorian) {
        return (
          currentDate.gregorian.year === displayYear &&
          currentDate.gregorian.month === displayMonth &&
          currentDate.gregorian.day === day.day
        );
      }

      return false;
    },
    [currentDate, activeCalendar, displayYear, displayMonth],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <CardSurface>
        <View style={styles.content}>
          {/* Display current date */}
          <TouchableOpacity
            style={styles.dateDisplay}
            onPress={toggleCalendar}
            activeOpacity={0.7}
          >
            <View style={styles.dateDisplayContent}>
              <Text style={styles.dateDisplayText}>
                {currentDate ? currentDate.display : "اختر التاريخ"}
              </Text>
              {currentDate?.approximate && (
                <View style={styles.approximateBadge}>
                  <Text style={styles.approximateText}>تقريبي</Text>
                </View>
              )}
            </View>
            <Ionicons
              name={showCalendar ? "chevron-up" : "chevron-down"}
              size={20}
              color="#8A8A8E"
            />
          </TouchableOpacity>

          {/* Calendar type selector */}
          <View style={styles.calendarTypeContainer}>
            <SegmentedControl
              options={[
                { label: "هجري", value: "hijri" },
                { label: "ميلادي", value: "gregorian" },
              ]}
              value={activeCalendar}
              onChange={handleCalendarTypeChange}
            />
          </View>

          {/* Calendar view */}
          <Animated.View style={calendarAnimatedStyle}>
            {/* Calendar header */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                style={styles.navButton}
              >
                <Ionicons name="chevron-forward" size={24} color="#007AFF" />
              </TouchableOpacity>

              <Text style={styles.monthYearText}>
                {getMonthName(displayMonth - 1, activeCalendar === "hijri")}{" "}
                {toArabicNumerals(displayYear)}
              </Text>

              <TouchableOpacity
                onPress={handleNextMonth}
                style={styles.navButton}
              >
                <Ionicons name="chevron-back" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>

            {/* Weekday headers */}
            <View style={styles.weekdayRow}>
              {weekdays.map((day, index) => (
                <View key={index} style={styles.weekdayCell}>
                  <Text style={styles.weekdayText}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                const isSelected = isSelectedDay(day);
                return (
                  <AnimatedPressable
                    key={index}
                    style={[
                      styles.dayCell,
                      !day.isCurrentMonth && styles.otherMonthDay,
                      isSelected && styles.selectedDay,
                    ]}
                    onPress={() => handleDayPress(day)}
                    disabled={!day.isCurrentMonth}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !day.isCurrentMonth && styles.otherMonthDayText,
                        isSelected && styles.selectedDayText,
                      ]}
                    >
                      {toArabicNumerals(day.day)}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Controls */}
          <View style={styles.controls}>
            {/* Approximate toggle */}
            <View style={styles.approximateRow}>
              <Text style={styles.approximateLabel}>تاريخ تقريبي</Text>
              <Switch
                value={currentDate?.approximate || false}
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
                style={[styles.presetButton, styles.unknownButton]}
                onPress={handleUnknown}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.presetButtonText, styles.unknownButtonText]}
                >
                  غير معروف
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
  dateDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  dateDisplayContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateDisplayText: {
    fontSize: 18,
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  approximateBadge: {
    backgroundColor: "#FFF3CD",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  approximateText: {
    fontSize: 12,
    color: "#856404",
    fontFamily: "SF Arabic Regular",
  },
  calendarTypeContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  navButton: {
    padding: 8,
  },
  monthYearText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  weekdayRow: {
    flexDirection: "row",
    paddingBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
  },
  weekdayText: {
    fontSize: 12,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  otherMonthDay: {
    opacity: 0.3,
  },
  selectedDay: {
    backgroundColor: "#007AFF",
  },
  dayText: {
    fontSize: 16,
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  otherMonthDayText: {
    color: "#8A8A8E",
  },
  selectedDayText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  controls: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
  },
  approximateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
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
  unknownButton: {
    backgroundColor: "#E5E5EA",
  },
  presetButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
    fontFamily: "SF Arabic Regular",
  },
  unknownButtonText: {
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
