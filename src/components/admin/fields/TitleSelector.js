import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import tokens from '../../ui/tokens';
import {
  PROFESSIONAL_TITLES,
  validateCustomTitle,
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

  return (
    <View style={styles.container}>
      <View style={styles.optionsGrid}>
        {PROFESSIONAL_TITLES.map((title) => {
          const isActive = selectedTitle === title.value;
          return (
            <TouchableOpacity
              key={title.value}
              style={[
                styles.optionChip,
                isActive && styles.optionChipActive,
                title.value === 'other' && styles.optionChipFull,
              ]}
              onPress={() => handleTitleSelect(title.value)}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.optionLabel,
                  isActive && styles.optionLabelActive,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {title.label}
              </Text>
            </TouchableOpacity>
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
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + '30',
    backgroundColor: tokens.colors.surface,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    minHeight: tokens.touchTarget.minimum,
    justifyContent: 'center',
  },
  optionChipFull: {
    flexBasis: '100%',
  },
  optionChipActive: {
    borderColor: tokens.colors.najdi.primary,
    backgroundColor: tokens.colors.najdi.primary + '12',
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  optionLabelActive: {
    color: tokens.colors.najdi.primary,
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
