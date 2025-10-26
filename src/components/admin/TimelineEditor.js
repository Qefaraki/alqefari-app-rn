import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tokens from '../ui/tokens';

const TimelineEditor = ({ timeline, onChange }) => {
  const handleAdd = () => {
    onChange([...timeline, { year: '', event: '' }]);
  };

  const handleChange = (index, field, value) => {
    const newTimeline = [...timeline];
    newTimeline[index][field] = value;
    onChange(newTimeline);
  };

  const handleRemove = (index) => {
    onChange(timeline.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      {/* Add button at top */}
      <TouchableOpacity onPress={handleAdd} style={styles.addButton}>
        <Ionicons name="add-circle" size={22} color={tokens.colors.najdi.primary} />
        <Text style={styles.addButtonText}>إضافة حدث</Text>
      </TouchableOpacity>

      {timeline.map((item, index) => (
        <View key={index} style={styles.timelineRow}>
          <TextInput
            style={styles.yearInput}
            value={item.year}
            onChangeText={(value) => handleChange(index, 'year', value)}
            placeholder="السنة"
            placeholderTextColor={`${tokens.colors.najdi.textMuted}60`}
            textAlign="center"
            keyboardType="numeric"
          />
          <TextInput
            style={styles.eventInput}
            value={item.event}
            onChangeText={(value) => handleChange(index, 'event', value)}
            placeholder="الحدث..."
            placeholderTextColor={`${tokens.colors.najdi.textMuted}60`}
            textAlign="right"
            multiline
          />
          <TouchableOpacity onPress={() => handleRemove(index)} style={styles.removeButton}>
            <Ionicons name="trash-outline" size={20} color={tokens.colors.danger} />
          </TouchableOpacity>
        </View>
      ))}

      {timeline.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons
            name="calendar-outline"
            size={32}
            color={tokens.colors.najdi.textMuted}
            style={{ opacity: 0.4 }}
          />
          <Text style={styles.emptyText}>لا توجد أحداث بعد</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xs,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.primary,
    fontFamily: 'SF Arabic',
  },
  timelineRow: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    alignItems: 'flex-start',
  },
  yearInput: {
    width: 80,
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${tokens.colors.najdi.container}40`,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
    fontSize: 16,
    fontWeight: '400',
    color: tokens.colors.najdi.text,
    fontFamily: 'SF Arabic',
    minHeight: 44,
  },
  eventInput: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${tokens.colors.najdi.container}40`,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    fontSize: 16,
    fontWeight: '400',
    color: tokens.colors.najdi.text,
    fontFamily: 'SF Arabic',
    minHeight: 44,
  },
  removeButton: {
    padding: tokens.spacing.sm,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.xl,
    gap: tokens.spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF Arabic',
    textAlign: 'center',
  },
});

export default TimelineEditor;