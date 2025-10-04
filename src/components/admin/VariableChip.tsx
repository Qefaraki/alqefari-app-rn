/**
 * Variable Chip Component
 *
 * Displays a clickable chip for template variables (e.g., {name_chain})
 * Clicking inserts the variable at cursor position
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { TemplateVariable } from '../../services/messageTemplates/types';

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
    backgroundColor: '#D58C4A15', // Desert Ochre 15%
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D58C4A60', // Desert Ochre 60%
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#D58C4A', // Desert Ochre
    fontFamily: 'SF Arabic',
  },
});

export default VariableChip;
