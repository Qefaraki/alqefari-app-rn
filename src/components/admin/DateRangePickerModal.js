/**
 * DateRangePickerModal Component
 * Modal for filtering activities by date range
 * Features: Preset ranges, custom date selection, calendar preference support
 * Design: Najdi Sadu design system with iOS-standard patterns
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DateTimePicker, Host } from '@expo/ui/swift-ui';
import * as Haptics from 'expo-haptics';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
} from 'date-fns';
import { useSettings } from '../../contexts/SettingsContext';
import { formatDateByPreference } from '../../utils/dateDisplay';
import { gregorianToHijri } from '../../utils/hijriConverter';
import tokens from '../ui/tokens';

// Najdi Sadu color shortcuts for consistency
const colors = {
  alJass: tokens.colors.najdi.background,
  camelHair: tokens.colors.najdi.container,
  saduNight: tokens.colors.najdi.text,
  crimson: tokens.colors.najdi.primary,
  ochre: tokens.colors.najdi.secondary,
  textMuted: tokens.colors.najdi.textMuted,
};

const DATE_PRESETS = [
  { id: 'today', label: 'اليوم', icon: 'today' },
  { id: 'week', label: 'هذا الأسبوع', icon: 'calendar-outline' },
  { id: 'month', label: 'هذا الشهر', icon: 'calendar' },
  { id: 'all', label: 'الكل', icon: 'infinite' },
];

const DateRangePickerModal = ({
  visible,
  onClose,
  onApplyFilter,
  activePreset,
  customRange,
}) => {
  const { settings } = useSettings();
  const [selectedPreset, setSelectedPreset] = useState(activePreset || 'all');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [fromDate, setFromDate] = useState(customRange?.from || null);
  const [toDate, setToDate] = useState(customRange?.to || null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Animation for custom range expand/collapse
  const expandAnimation = useRef(new Animated.Value(showCustomRange ? 1 : 0)).current;

  // Get date range for preset
  const getPresetRange = (preset) => {
    const now = new Date();
    switch (preset) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'all':
        return { start: null, end: null };
      default:
        return { start: null, end: null };
    }
  };

  // Get label for active filter
  const getFilterLabel = () => {
    if (selectedPreset === 'custom' && fromDate && toDate) {
      const fromFormatted = formatDateForDisplay(fromDate);
      const toFormatted = formatDateForDisplay(toDate);
      return `${fromFormatted} - ${toFormatted}`;
    }
    const preset = DATE_PRESETS.find(p => p.id === selectedPreset);
    return preset ? preset.label : 'غير محدد';
  };

  // Format date for display based on user preference
  const formatDateForDisplay = (date) => {
    if (!date) return 'اختر التاريخ';

    const gregorian = {
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
    const hijri = gregorianToHijri(gregorian.year, gregorian.month, gregorian.day);

    return formatDateByPreference({ gregorian, hijri }, settings);
  };

  // Handle preset selection
  const handlePresetSelect = (preset) => {
    Haptics.selectionAsync();
    setSelectedPreset(preset);

    if (preset !== 'custom') {
      const range = getPresetRange(preset);
      onApplyFilter(preset, range);
      // Close modal after short delay for feedback
      setTimeout(() => onClose(), 300);
    }
  };

  // Toggle custom range section
  const toggleCustomRange = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newValue = !showCustomRange;
    setShowCustomRange(newValue);

    Animated.spring(expandAnimation, {
      toValue: newValue ? 1 : 0,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();

    if (newValue) {
      setSelectedPreset('custom');
    }
  };

  // Handle custom date changes
  const handleFromDateChange = (dateString) => {
    const date = new Date(dateString);
    setFromDate(startOfDay(date));
    setShowFromPicker(false);
  };

  const handleToDateChange = (dateString) => {
    const date = new Date(dateString);
    setToDate(endOfDay(date));
    setShowToPicker(false);
  };

  // Apply custom date range
  const handleApplyCustomRange = () => {
    if (!fromDate || !toDate) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const range = {
      start: fromDate,
      end: toDate,
    };

    onApplyFilter('custom', range);
    onClose();
  };

  // Clear date filter
  const handleClearDateFilter = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPreset('all');
    setFromDate(null);
    setToDate(null);
    setShowCustomRange(false);
    onApplyFilter('all', { start: null, end: null });
  };

  const customRangeHeight = expandAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 280],
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={styles.handleBar} />
          <Text style={styles.modalTitle}>تصفية حسب التاريخ</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.saduNight} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.modalContent}
          contentContainerStyle={styles.modalContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Active Filter Display */}
          {selectedPreset !== 'all' && (
            <View style={styles.activeFilterDisplay}>
              <Ionicons name="calendar" size={17} color={colors.crimson} />
              <Text style={styles.activeFilterText}>النطاق: {getFilterLabel()}</Text>
            </View>
          )}

          {/* Preset Buttons Grid */}
          <View style={styles.presetGrid}>
            {DATE_PRESETS.map(preset => (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.presetButton,
                  selectedPreset === preset.id && styles.presetButtonActive,
                ]}
                onPress={() => handlePresetSelect(preset.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={preset.icon}
                  size={20}
                  color={
                    selectedPreset === preset.id
                      ? colors.alJass
                      : colors.saduNight
                  }
                />
                <Text
                  style={[
                    styles.presetButtonText,
                    selectedPreset === preset.id && styles.presetButtonTextActive,
                  ]}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Range Toggle */}
          <TouchableOpacity
            style={styles.customRangeToggle}
            onPress={toggleCustomRange}
            activeOpacity={0.7}
          >
            <View style={styles.customRangeToggleLeft}>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={showCustomRange ? colors.crimson : colors.saduNight}
              />
              <Text style={[
                styles.customRangeToggleText,
                showCustomRange && styles.customRangeToggleTextActive
              ]}>نطاق مخصص</Text>
            </View>
            <Ionicons
              name={showCustomRange ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={showCustomRange ? colors.crimson : colors.saduNight}
            />
          </TouchableOpacity>

          {/* Custom Range Section (Collapsible) */}
          <Animated.View style={[styles.customRangeSection, { height: customRangeHeight }]}>
            <View style={styles.customRangeContent}>
              {/* From Date */}
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateLabel}>من تاريخ</Text>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowFromPicker(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
                  <Text style={[styles.dateInputText, !fromDate && styles.dateInputPlaceholder]}>
                    {formatDateForDisplay(fromDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* To Date */}
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateLabel}>إلى تاريخ</Text>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowToPicker(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
                  <Text style={[styles.dateInputText, !toDate && styles.dateInputPlaceholder]}>
                    {formatDateForDisplay(toDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Apply Button */}
              <TouchableOpacity
                style={[
                  styles.applyButton,
                  (!fromDate || !toDate) && styles.applyButtonDisabled,
                ]}
                onPress={handleApplyCustomRange}
                disabled={!fromDate || !toDate}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.applyButtonText,
                  (!fromDate || !toDate) && styles.applyButtonTextDisabled
                ]}>تطبيق</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>

        {/* iOS Date Pickers */}
        {showFromPicker && (
          <Modal
            visible={showFromPicker}
            transparent={true}
            animationType="slide"
          >
            <View style={styles.pickerModalOverlay}>
              <View style={styles.pickerContainer}>
                <View style={styles.pickerHeader}>
                  <TouchableOpacity onPress={() => setShowFromPicker(false)} style={styles.pickerDoneButton}>
                    <Text style={styles.pickerDone}>تم</Text>
                  </TouchableOpacity>
                </View>
                <Host matchContents>
                  <DateTimePicker
                    onDateSelected={handleFromDateChange}
                    displayedComponents="date"
                    initialDate={(fromDate || new Date()).toISOString()}
                    variant="wheel"
                  />
                </Host>
              </View>
            </View>
          </Modal>
        )}

        {showToPicker && (
          <Modal
            visible={showToPicker}
            transparent={true}
            animationType="slide"
          >
            <View style={styles.pickerModalOverlay}>
              <View style={styles.pickerContainer}>
                <View style={styles.pickerHeader}>
                  <TouchableOpacity onPress={() => setShowToPicker(false)} style={styles.pickerDoneButton}>
                    <Text style={styles.pickerDone}>تم</Text>
                  </TouchableOpacity>
                </View>
                <Host matchContents>
                  <DateTimePicker
                    onDateSelected={handleToDateChange}
                    displayedComponents="date"
                    initialDate={(toDate || new Date()).toISOString()}
                    variant="wheel"
                  />
                </Host>
              </View>
            </View>
          </Modal>
        )}

        {/* Footer - Clear Button */}
        {selectedPreset !== 'all' && (
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearDateFilter}
              activeOpacity={0.8}
            >
              <Text style={styles.clearButtonText}>مسح الفلتر</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Modal Container
  modalContainer: {
    flex: 1,
    backgroundColor: colors.alJass,
  },

  // Header
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.camelHair + '40',
  },
  handleBar: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted + '40',
  },
  modalTitle: {
    ...tokens.typography.title2,
    color: colors.saduNight,
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modal Content
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    paddingBottom: tokens.spacing.xl,
  },

  // Active Filter Display
  activeFilterDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: colors.crimson + '08',
    borderRadius: 10,
    marginHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
  },
  activeFilterText: {
    ...tokens.typography.subheadline,
    color: colors.crimson,
    fontWeight: '600',
  },

  // Preset Grid
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
  },
  presetButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: colors.camelHair + '15',
    borderWidth: 1.5,
    borderColor: colors.camelHair + '60',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: tokens.spacing.md,
    minHeight: 52,
  },
  presetButtonActive: {
    backgroundColor: colors.crimson,
    borderColor: colors.crimson,
  },
  presetButtonText: {
    ...tokens.typography.body,
    color: colors.saduNight,
    fontWeight: '600',
  },
  presetButtonTextActive: {
    color: colors.alJass,
  },

  // Custom Range Toggle
  customRangeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    marginHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
    backgroundColor: colors.camelHair + '20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.camelHair + '40',
    minHeight: 52,
  },
  customRangeToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  customRangeToggleText: {
    ...tokens.typography.body,
    fontWeight: '600',
    color: colors.saduNight,
  },
  customRangeToggleTextActive: {
    color: colors.crimson,
  },

  // Custom Range Section
  customRangeSection: {
    overflow: 'hidden',
    marginHorizontal: tokens.spacing.md,
  },
  customRangeContent: {
    paddingTop: tokens.spacing.md,
  },
  dateInputGroup: {
    marginBottom: tokens.spacing.md,
  },
  dateLabel: {
    ...tokens.typography.footnote,
    color: colors.textMuted,
    marginBottom: tokens.spacing.xxs,
    paddingHorizontal: tokens.spacing.xxs,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    backgroundColor: colors.camelHair + '20',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.camelHair + '40',
    paddingHorizontal: tokens.spacing.md,
    minHeight: 48,
  },
  dateInputText: {
    ...tokens.typography.body,
    color: colors.saduNight,
    flex: 1,
  },
  dateInputPlaceholder: {
    color: colors.textMuted,
  },
  applyButton: {
    backgroundColor: colors.crimson,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: tokens.spacing.sm,
  },
  applyButtonDisabled: {
    backgroundColor: colors.camelHair + '40',
    opacity: 0.5,
  },
  applyButtonText: {
    ...tokens.typography.body,
    fontWeight: '600',
    color: colors.alJass,
  },
  applyButtonTextDisabled: {
    color: colors.textMuted,
  },

  // iOS Date Picker
  pickerModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerContainer: {
    backgroundColor: colors.alJass,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: tokens.spacing.lg,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.camelHair + '40',
    minHeight: 56,
  },
  pickerDoneButton: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  pickerDone: {
    ...tokens.typography.body,
    fontWeight: '600',
    color: colors.crimson,
  },

  // Footer
  modalFooter: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.camelHair + '40',
    backgroundColor: colors.alJass,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  clearButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.crimson,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  clearButtonText: {
    ...tokens.typography.body,
    fontWeight: '600',
    color: colors.crimson,
  },
});

export default DateRangePickerModal;
