import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AchievementsEditor = ({ achievements, onChange }) => {
  const handleAdd = () => {
    onChange([...achievements, '']);
  };

  const handleRemove = (index) => {
    onChange(achievements.filter((_, i) => i !== index));
  };

  const handleChange = (index, value) => {
    const newAchievements = [...achievements];
    newAchievements[index] = value;
    onChange(newAchievements);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>الإنجازات</Text>
        <TouchableOpacity onPress={handleAdd} style={styles.addButton}>
          <Ionicons name="add-circle" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      
      {achievements.map((achievement, index) => (
        <View key={index} style={styles.achievementRow}>
          <TextInput
            style={styles.achievementInput}
            value={achievement}
            onChangeText={(value) => handleChange(index, value)}
            placeholder="أدخل الإنجاز"
            textAlign="right"
            multiline
          />
          <TouchableOpacity onPress={() => handleRemove(index)} style={styles.removeButton}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      ))}
      
      {achievements.length === 0 && (
        <Text style={styles.emptyText}>لا توجد إنجازات. اضغط + لإضافة إنجاز.</Text>
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
  achievementRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  achievementInput: {
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

export default AchievementsEditor;