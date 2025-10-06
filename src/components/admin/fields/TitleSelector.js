import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import tokens from '../../ui/tokens';
import {
  PROFESSIONAL_TITLES,
  validateCustomTitle,
  formatNameWithTitle,
} from '../../../services/professionalTitleService';

const TitleSelector = ({ value, customValue, onChange, personName }) => {
  const [selectedTitle, setSelectedTitle] = useState(value || null);
  const [customInput, setCustomInput] = useState(customValue || '');
  const [validationError, setValidationError] = useState('');

  const otherHeightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showOther = selectedTitle === 'other';
    Animated.spring(otherHeightAnim, {
      toValue: showOther ? 1 : 0,
      damping: 20,
      stiffness: 200,
      useNativeDriver: false,
    }).start();
  }, [selectedTitle]);

  const handleTitleSelect = (titleValue) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTitle(titleValue);
    setValidationError('');

    if (titleValue === 'other') {
      onChange({ professional_title: 'other', title_abbreviation: customInput });
    } else {
      const title = PROFESSIONAL_TITLES.find((t) => t.value === titleValue);
      onChange({
        professional_title: titleValue,
        title_abbreviation: title?.abbrev || '',
      });
    }
  };

  const handleCustomInput = (text) => {
    setCustomInput(text);
    const validation = validateCustomTitle(text);
    setValidationError(validation.error || '');

    if (validation.valid) {
      onChange({ professional_title: 'other', title_abbreviation: text });
    }
  };

  const otherHeight = otherHeightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 140],
  });

  const previewName = formatNameWithTitle(
    {
      name: personName,
      professional_title: selectedTitle,
      title_abbreviation: customInput,
    },
    { maxLength: 40 }
  );

  return (
    <View style={styles.container}>
      <View style={styles.optionsGrid}>
        {PROFESSIONAL_TITLES.map((title) => {
          const isActive = selectedTitle === title.value;
          return (
            <TouchableOpacity
              key={title.value}
              style={[styles.optionChip, isActive && styles.optionChipActive]}
              onPress={() => handleTitleSelect(title.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>
                {title.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedTitle && (
        <View style={styles.preview}>
          <Text style={styles.previewLabel}>سيظهر بجانب الاسم:</Text>
          <Text style={styles.previewName}>{previewName}</Text>
        </View>
      )}

      <Animated.View
        style={[styles.otherContainer, { height: otherHeight }]}
        pointerEvents={selectedTitle === 'other' ? 'auto' : 'none'}
      >
        <Text style={styles.otherLabel}>أدخل اللقب المخصص</Text>
        <TextInput
          style={[styles.otherInput, validationError && styles.otherInputError]}
          value={customInput}
          onChangeText={handleCustomInput}
          placeholder="مثال: د., أ.د., م."
          placeholderTextColor={tokens.colors.najdi.textMuted + '80'}
          maxLength={20}
        />
        {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.md,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  optionChip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.sm,
    borderWidth: 1.5,
    borderColor: tokens.colors.najdi.container,
    backgroundColor: tokens.colors.najdi.background,
  },
  optionChipActive: {
    borderColor: tokens.colors.najdi.primary,
    backgroundColor: tokens.colors.najdi.primary + '10',
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.textMuted,
  },
  optionLabelActive: {
    color: tokens.colors.najdi.primary,
  },
  preview: {
    padding: tokens.spacing.md,
    backgroundColor: tokens.colors.najdi.container + '20',
    borderRadius: tokens.radii.sm,
    gap: tokens.spacing.xxs,
  },
  previewLabel: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },
  previewName: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  otherContainer: {
    overflow: 'hidden',
    gap: tokens.spacing.xs,
  },
  otherLabel: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },
  otherInput: {
    fontSize: 17,
    color: tokens.colors.najdi.text,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container + '40',
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: tokens.colors.najdi.background,
  },
  otherInputError: {
    borderColor: tokens.colors.najdi.primary,
  },
  errorText: {
    fontSize: 12,
    color: tokens.colors.najdi.primary,
  },
});

export default TitleSelector;
