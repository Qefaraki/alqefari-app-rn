/**
 * Variable Chip Component
 *
 * Displays a clickable chip for template variables (e.g., {name_chain})
 * Clicking inserts the variable at cursor position
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { TemplateVariable } from '../../services/messageTemplates/types';
import tokens from '../ui/tokens';

const palette = tokens.colors.najdi;

interface VariableChipProps {
  variable: TemplateVariable;
  onPress: (variableKey: string) => void;
}

const VariableChip: React.FC<VariableChipProps> = ({ variable, onPress }) => {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(variable.key);
  };

  return (
    <TouchableOpacity
      style={styles.chip}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={styles.chipText}>{variable.key}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: `${palette.secondary}15`,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.secondary}55`,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: palette.secondary,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
});

export default VariableChip;
