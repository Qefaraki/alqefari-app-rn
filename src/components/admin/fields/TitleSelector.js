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
const BRAND_TINT = '#C7342A';
const ROW_BORDER = '#E7E7EB';
const ROW_BG_SELECTED = '#F7EFED';
const ROW_BORDER_SELECTED = '#DCC1BB';

const TitleSelector = ({ value, customValue, onChange, personName: _personName }) => {
  const [pendingTitle, setPendingTitle] = useState(value || null);
  const [pendingCustom, setPendingCustom] = useState(customValue || '');
  const [validationError, setValidationError] = useState('');
  const customInputRef = useRef(null);

  const otherHeightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showOther = pendingTitle === 'other';
    Animated.spring(otherHeightAnim, {
      toValue: showOther ? 1 : 0,
      damping: 20,
      stiffness: 200,
      useNativeDriver: false,
    }).start();
  }, [pendingTitle]);

  useEffect(() => {
    setPendingTitle(value || null);
  }, [value]);

  useEffect(() => {
    setPendingCustom(customValue || '');
  }, [customValue]);

  const handleTitleSelect = (titleValue) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingTitle(titleValue);
    setValidationError('');

    if (titleValue === 'other') {
      customInputRef.current?.focus?.();
      return;
    }

    const title = PROFESSIONAL_TITLES.find((t) => t.value === titleValue);
    setPendingCustom('');
    onChange({
      professional_title: titleValue,
      title_abbreviation: title?.abbrev || '',
    });
  };

  const handleCustomInput = (text) => {
    setPendingCustom(text);
    const validation = validateCustomTitle(text);
    setValidationError(validation.error || '');

    if (validation.valid) {
      onChange({ professional_title: 'other', title_abbreviation: text.trim() });
    }
  };

  const otherHeight = otherHeightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 140],
  });

  return (
    <View style={styles.container}>
      <View style={styles.list}>
        {PROFESSIONAL_TITLES.map((title) => {
          const isSelected = pendingTitle === title.value;
          const showInput = title.value === 'other' && isSelected;
          return (
            <View key={title.value} style={styles.rowWrapper}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.row,
                  isSelected && styles.rowSelected,
                  showInput && styles.rowExpanded,
                ]}
                onPress={() => handleTitleSelect(title.value)}
              >
                <View style={styles.rowHeader}>
                  <View style={styles.leadingIcon}>
                    {isSelected ? (
                      <Ionicons name="checkmark" size={20} color={BRAND_TINT} />
                    ) : null}
                  </View>
                  <Text
                    style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}
                    numberOfLines={1}
                  >
                    {title.label}
                  </Text>
                </View>
                {showInput ? (
                  <Animated.View style={[styles.otherContainer, { height: otherHeight }]}> 
                    <TextInput
                      ref={customInputRef}
                      style={[styles.otherInput, validationError && styles.otherInputError]}
                      value={pendingCustom}
                      onChangeText={handleCustomInput}
                      placeholder="اكتب اللقب هنا"
                      placeholderTextColor={tokens.colors.najdi.textMuted + '80'}
                      maxLength={20}
                    />
                    {validationError ? (
                      <Text style={styles.errorText}>{validationError}</Text>
                    ) : null}
                  </Animated.View>
                ) : null}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 24,
    paddingStart: 14,
    paddingEnd: 16,
    paddingTop: 24,
  },
  list: {
    gap: 12,
  },
  rowWrapper: {
    gap: 8,
  },
  row: {
    backgroundColor: '#FFFFFF',
    borderColor: ROW_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    paddingStart: 14,
    paddingEnd: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  rowExpanded: {
    paddingBottom: 16,
  },
  rowSelected: {
    borderColor: ROW_BORDER_SELECTED,
    backgroundColor: ROW_BG_SELECTED,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leadingIcon: {
    width: 20,
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 17,
    fontWeight: '500',
    color: '#101114',
    flex: 1,
    textAlign: 'left',
  },
  rowLabelSelected: {
    color: BRAND_TINT,
    fontWeight: '600',
  },
  otherContainer: {
    marginTop: 12,
    gap: 8,
  },
  otherInput: {
    fontSize: 16,
    color: tokens.colors.najdi.text,
    borderWidth: 1,
    borderColor: ROW_BORDER,
    borderRadius: 12,
    paddingStart: 14,
    paddingEnd: 16,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: '#FFFFFF',
  },
  otherInputError: {
    borderColor: BRAND_TINT,
  },
  errorText: {
    fontSize: 12,
    color: BRAND_TINT,
  },
});

export default TitleSelector;
