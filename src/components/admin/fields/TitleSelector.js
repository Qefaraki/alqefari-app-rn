import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Animated,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import tokens from '../../ui/tokens';
import {
  PROFESSIONAL_TITLES,
  validateCustomTitle,
} from '../../../services/professionalTitleService';
import ChoiceChip from '../../ui/ChoiceChip';

const TitleSelector = ({ value, customValue, onChange }) => {
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

  return (
    <View style={styles.container}>
      <View style={styles.optionsGrid}>
        {PROFESSIONAL_TITLES.map((title, index) => {
          const isActive = selectedTitle === title.value;
          const isLastOdd =
            PROFESSIONAL_TITLES.length % 2 !== 0 &&
            index === PROFESSIONAL_TITLES.length - 1;
          return (
            <ChoiceChip
              key={title.value}
              label={title.label}
              selected={isActive}
              onPress={() => handleTitleSelect(title.value)}
              grow={isLastOdd || title.value === 'other'}
              style={[
                styles.optionChip,
                (isLastOdd || title.value === 'other') && styles.optionChipFull,
              ]}
            />
          );
        })}
      </View>

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
          placeholderTextColor={`${tokens.colors.najdi.textMuted  }80`}
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
    gap: tokens.spacing.sm,
  },
  optionChip: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  optionChipFull: {
    flexBasis: '100%',
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
    borderColor: `${tokens.colors.najdi.container  }40`,
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
