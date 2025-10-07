/**
 * DateRangePickerModal Component
 * Modal for filtering activities by date range
 * Features: Preset ranges, custom date selection, calendar preference support
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
            <Ionicons name="close" size={24} color={tokens.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Active Filter Display */}
        {selectedPreset !== 'all' && (
          <View style={styles.activeFilterDisplay}>
            <Ionicons name="calendar" size={16} color={tokens.colors.najdi.crimson} />
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
              activeOpacity={0.8}
            >
              <Ionicons
                name={preset.icon}
                size={20}
                color={
                  selectedPreset === preset.id
                    ? tokens.colors.najdi.alJass
                    : tokens.colors.text
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
          <Text style={styles.customRangeToggleText}>نطاق مخصص</Text>
          <Ionicons
            name={showCustomRange ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={tokens.colors.text}
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
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={20} color={tokens.colors.textMuted} />
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
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={20} color={tokens.colors.textMuted} />
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
              <Text style={styles.applyButtonText}>تطبيق</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

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
                  <TouchableOpacity onPress={() => setShowFromPicker(false)}>
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
                  <TouchableOpacity onPress={() => setShowToPicker(false)}>
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
    backgroundColor: tokens.colors.najdi.alJass,
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
    borderBottomColor: tokens.colors.najdi.camelHair + '40',
  },
  handleBar: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.textMuted + '40',
  },
  modalTitle: {
    ...tokens.typography.title2,
    color: tokens.colors.text,
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Active Filter Display
  activeFilterDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: tokens.colors.najdi.crimson + '08',
    borderRadius: 10,
    marginHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
  },
  activeFilterText: {
    ...tokens.typography.subheadline,
    color: tokens.colors.najdi.crimson,
    fontWeight: '600',
  },

  // Preset Grid
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.lg,
  },
  presetButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: tokens.colors.najdi.camelHair + '60',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: tokens.spacing.md,
    minHeight: 56,
  },
  presetButtonActive: {
    backgroundColor: tokens.colors.najdi.crimson,
    borderColor: tokens.colors.najdi.crimson,
  },
  presetButtonText: {
    ...tokens.typography.body,
    color: tokens.colors.text,
    fontWeight: '600',
  },
  presetButtonTextActive: {
    color: tokens.colors.najdi.alJass,
  },

  // Custom Range Toggle
  customRangeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.najdi.camelHair + '40',
  },
  customRangeToggleText: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.text,
  },

  // Custom Range Section
  customRangeSection: {
    overflow: 'hidden',
  },
  customRangeContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
  },
  dateInputGroup: {
    marginBottom: tokens.spacing.md,
  },
  dateLabel: {
    ...tokens.typography.footnote,
    color: tokens.colors.textMuted,
    marginBottom: 4,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    backgroundColor: tokens.colors.najdi.camelHair + '20',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.camelHair + '40',
    paddingHorizontal: tokens.spacing.md,
    height: 48,
  },
  dateInputText: {
    ...tokens.typography.body,
    color: tokens.colors.text,
  },
  dateInputPlaceholder: {
    color: tokens.colors.textMuted,
  },
  applyButton: {
    backgroundColor: tokens.colors.najdi.crimson,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: tokens.spacing.sm,
  },
  applyButtonDisabled: {
    backgroundColor: tokens.colors.najdi.camelHair + '40',
  },
  applyButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.alJass,
  },

  // iOS Date Picker
  pickerModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerContainer: {
    backgroundColor: tokens.colors.najdi.alJass,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: tokens.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.najdi.camelHair + '40',
  },
  pickerDone: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.crimson,
  },
  iosDatePicker: {
    backgroundColor: tokens.colors.najdi.alJass,
    height: 200,
  },

  // Footer
  modalFooter: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.najdi.camelHair + '40',
    backgroundColor: tokens.colors.najdi.alJass,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
    }),
  },
  clearButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: tokens.colors.najdi.crimson,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  clearButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.crimson,
  },
});

export default DateRangePickerModal;
