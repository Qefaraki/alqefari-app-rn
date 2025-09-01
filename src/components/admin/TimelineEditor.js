import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TimelineEditor = ({ timeline, onChange }) => {
  const handleAdd = () => {
    onChange([...timeline, { year: '', event: '' }]);
  };

  const handleRemove = (index) => {
    onChange(timeline.filter((_, i) => i !== index));
  };

  const handleChange = (index, field, value) => {
    const newTimeline = [...timeline];
    newTimeline[index] = { ...newTimeline[index], [field]: value };
    onChange(newTimeline);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>الأحداث المهمة</Text>
        <TouchableOpacity onPress={handleAdd} style={styles.addButton}>
          <Ionicons name="add-circle" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      
      {timeline.map((item, index) => (
        <View key={index} style={styles.timelineItem}>
          <View style={styles.timelineRow}>
            <TextInput
              style={styles.yearInput}
              value={item.year}
              onChangeText={(value) => handleChange(index, 'year', value)}
              placeholder="السنة"
              textAlign="center"
              keyboardType="numeric"
            />
            <TextInput
              style={styles.eventInput}
              value={item.event}
              onChangeText={(value) => handleChange(index, 'event', value)}
              placeholder="الحدث"
              textAlign="right"
              multiline
            />
            <TouchableOpacity onPress={() => handleRemove(index)} style={styles.removeButton}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>
      ))}
      
      {timeline.length === 0 && (
        <Text style={styles.emptyText}>لا توجد أحداث. اضغط + لإضافة حدث.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'right',
  },
  addButton: {
    padding: 4,
  },
  timelineItem: {
    marginBottom: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  yearInput: {
    width: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#000000',
  },
  eventInput: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#000000',
    minHeight: 44,
  },
  removeButton: {
    padding: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default TimelineEditor;