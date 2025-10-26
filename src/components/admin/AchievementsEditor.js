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

const AchievementsEditor = ({ achievements, onChange }) => {
  const handleAdd = () => {
    onChange([...achievements, '']);
  };

  const handleChange = (index, value) => {
    const newAchievements = [...achievements];
    newAchievements[index] = value;
    onChange(newAchievements);
  };

  const handleRemove = (index) => {
    onChange(achievements.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      {/* Add button at top */}
      <TouchableOpacity onPress={handleAdd} style={styles.addButton}>
        <Ionicons name="add-circle" size={22} color={tokens.colors.najdi.primary} />
        <Text style={styles.addButtonText}>إضافة إنجاز</Text>
      </TouchableOpacity>

      {achievements.map((achievement, index) => (
        <View key={index} style={styles.achievementRow}>
          <TextInput
            style={styles.achievementInput}
            value={achievement}
            onChangeText={(value) => handleChange(index, value)}
            placeholder="إنجاز..."
            placeholderTextColor={`${tokens.colors.najdi.textMuted}60`}
            textAlign="right"
            multiline
          />
          <TouchableOpacity onPress={() => handleRemove(index)} style={styles.removeButton}>
            <Ionicons name="trash-outline" size={20} color={tokens.colors.danger} />
          </TouchableOpacity>
        </View>
      ))}

      {achievements.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons
            name="trophy-outline"
            size={32}
            color={tokens.colors.najdi.textMuted}
            style={{ opacity: 0.4 }}
          />
          <Text style={styles.emptyText}>لا توجد إنجازات بعد</Text>
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
  achievementRow: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    alignItems: 'flex-start',
  },
  achievementInput: {
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

export default AchievementsEditor;