import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../services/supabase';
import tokens from '../../ui/tokens';

const MIN_QUERY_LENGTH = 1;
const SUGGESTION_LIMIT = 8;
const DEBOUNCE_DELAY = 180;

const SAUDI_REGION = 'saudi';
const SAUDI_COUNTRY_CODE = 'SA';

const countryCodeToEmoji = (code) => {
  if (!code || typeof code !== 'string' || code.length !== 2) {
    return null;
  }
  const upper = code.toUpperCase();
  const base = 0x1F1E6;
  const chars = upper.split('');
  if (chars.some((ch) => ch < 'A' || ch > 'Z')) {
    return null;
  }
  return String.fromCodePoint(
    base + (chars[0].charCodeAt(0) - 65),
    base + (chars[1].charCodeAt(0) - 65),
  );
};

const resolveListLabel = (suggestion) => {
  if (!suggestion) return '';
  if (suggestion.region === SAUDI_REGION && suggestion.place_type === 'city') {
    return suggestion.display_name;
  }
  return suggestion.country_name || suggestion.display_name;
};

const buildNormalizedPayload = (suggestion, displayText) => {
  if (!suggestion) return null;
  const normalized = suggestion.normalized_data || {};

  if (suggestion.region === SAUDI_REGION && suggestion.place_type === 'city') {
    return {
      ...normalized,
      original: displayText,
      city: normalized.city || {
        ar: displayText,
        en: suggestion.display_name_en || displayText,
        id: suggestion.id || null,
      },
      country: normalized.country || {
        ar: suggestion.country_name || 'السعودية',
        en: suggestion.display_name_en || suggestion.country_name || 'Saudi Arabia',
        code: normalized.country?.code || SAUDI_COUNTRY_CODE,
        id: normalized.country?.id || null,
      },
      confidence: normalized.confidence ?? 1,
    };
  }

  const country = normalized.country || {
    ar: suggestion.country_name || displayText,
    en: suggestion.display_name_en || displayText,
    code: normalized.country?.code || null,
    id: normalized.country?.id || null,
  };

  return {
    original: country.ar || displayText,
    country,
    confidence: normalized.confidence ?? 1,
  };
};

const getFlagEmoji = (suggestion) => {
  if (!suggestion) return null;
  const normalized = suggestion.normalized_data || {};
  const code = normalized.country?.code
    || (suggestion.region === SAUDI_REGION ? SAUDI_COUNTRY_CODE : null);
  return countryCodeToEmoji(code);
};

const LocationInput = ({
  label,
  value,
  onChange,
  placeholder,
  normalizedValue,
  onNormalizedChange,
}) => {
  const [inputText, setInputText] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const [committedKey, setCommittedKey] = useState(null);
  const debounceRef = useRef(null);
  const requestSequenceRef = useRef(0);
  const isSelectingRef = useRef(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setInputText(value || '');
  }, [value]);

  useEffect(() => {
    if (normalizedValue) {
      const key = normalizedValue.city?.id
        || normalizedValue.country?.id
        || normalizedValue.original
        || value;
      setCommittedKey(key ?? null);
    } else {
      setCommittedKey(null);
    }
  }, [normalizedValue, value]);

  useEffect(() => () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, []);

  const performSearch = useCallback(async (query) => {
    const sequence = ++requestSequenceRef.current;
    try {
      const { data, error } = await supabase.rpc('search_place_autocomplete', {
        p_query: query,
        p_limit: SUGGESTION_LIMIT,
      });

      if (sequence !== requestSequenceRef.current) {
        return;
      }

      if (error) {
        console.error('Location search error:', error);
        setSuggestions([]);
        return;
      }

      setSuggestions(Array.isArray(data) ? data : []);
    } catch (err) {
      if (sequence === requestSequenceRef.current) {
        console.error('Unexpected location search error:', err);
        setSuggestions([]);
      }
    }
  }, []);

  const scheduleSearch = useCallback((text) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = text.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch(trimmed);
    }, DEBOUNCE_DELAY);
  }, [performSearch]);

  const handleTextChange = useCallback((text) => {
    setInputText(text);
    onChange(text);
    setCommittedKey(null);

    if (onNormalizedChange) {
      onNormalizedChange(null);
    }

    scheduleSearch(text);
  }, [onChange, onNormalizedChange, scheduleSearch]);

  const handleClear = useCallback(() => {
    setInputText('');
    setSuggestions([]);
    setCommittedKey(null);
    onChange('');
    if (onNormalizedChange) {
      onNormalizedChange(null);
    }
    requestSequenceRef.current += 1;
  }, [onChange, onNormalizedChange]);

  const handleSelect = useCallback((suggestion) => {
    if (!suggestion) return;

    isSelectingRef.current = true;

    const displayText = resolveListLabel(suggestion);
    const normalizedPayload = buildNormalizedPayload(suggestion, displayText);
    const key = suggestion.region === SAUDI_REGION && suggestion.place_type === 'city'
      ? suggestion.id
      : normalizedPayload?.country?.id || displayText;

    setInputText(displayText);
    onChange(displayText);
    if (onNormalizedChange) {
      onNormalizedChange(normalizedPayload);
    }

    setCommittedKey(key ?? null);
    setSuggestions([]);

    requestAnimationFrame(() => {
      isSelectingRef.current = false;
    });

    if (inputRef.current) {
      inputRef.current.blur();
    }
  }, [onChange, onNormalizedChange]);

  const handleFocus = useCallback((event) => {
    console.log('[LocationInput] focus target', event?.nativeEvent?.target, inputRef.current?.isFocused?.());
    setIsFocused(true);
    if (inputText.trim().length >= MIN_QUERY_LENGTH) {
      scheduleSearch(inputText);
    }
  }, [inputText, scheduleSearch]);

  const handleBlur = useCallback((event) => {
    console.log('[LocationInput] blur target', event?.nativeEvent?.target, isSelectingRef.current);
    if (isSelectingRef.current) {
      requestAnimationFrame(() => {
        setIsFocused(false);
      });
      return;
    }

    setIsFocused(false);
    setSuggestions([]);
  }, []);

  const showDropdown = useMemo(() => {
    if (!isFocused) return false;
    if (inputText.trim().length < MIN_QUERY_LENGTH) return false;
    return true;
  }, [inputText, isFocused]);

  const helperVisible = inputText.trim().length > 0 && !committedKey;
  const showInvalidState = !isFocused && helperVisible;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          showInvalidState && styles.inputWrapperInvalid,
        ]}
      >
        <Ionicons
          name="search"
          size={18}
          color={tokens.colors.najdi.textMuted}
          style={styles.leadingIcon}
        />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={inputText}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={`${tokens.colors.najdi.textMuted  }80`}
          onFocus={handleFocus}
          onBlur={handleBlur}
          textAlign="right"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="done"
          blurOnSubmit={false}
        />
        {inputText.length > 0 && (
          <Pressable
            onPress={handleClear}
            style={({ pressed }) => [
              styles.clearButton,
              pressed && styles.clearButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="مسح الموقع"
          >
            <Ionicons
              name="close-circle"
              size={18}
              color={tokens.colors.najdi.textMuted}
            />
          </Pressable>
        )}
      </View>

      {helperVisible && (
        <Text style={[styles.helperText, showInvalidState && styles.helperTextInvalid]}>
          اختر موقعاً من القائمة لإتمام الحفظ
        </Text>
      )}

      {showDropdown && (
        <View style={styles.dropdown} pointerEvents="box-none">
          {suggestions.length > 0 ? (
            <BottomSheetScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
            >
              {suggestions.slice(0, SUGGESTION_LIMIT).map((item) => {
                const flag = getFlagEmoji(item);
                const labelText = resolveListLabel(item);
                return (
                  <Pressable
                    key={item.id ?? `${item.region}-${labelText}`}
                    onPress={() => handleSelect(item)}
                    onPressIn={() => { isSelectingRef.current = true; }}
                    style={({ pressed }) => [
                      styles.suggestionItem,
                      pressed && styles.suggestionItemPressed,
                    ]}
                  >
                    {flag ? (
                      <Text style={styles.flag}>{flag}</Text>
                    ) : (
                      <Ionicons
                        name="location"
                        size={18}
                        color={tokens.colors.najdi.textMuted}
                        style={styles.flagIconFallback}
                      />
                    )}
                    <Text numberOfLines={1} style={styles.suggestionLabel}>
                      {labelText}
                    </Text>
                  </Pressable>
                );
              })}
            </BottomSheetScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>لا توجد نتائج</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

LocationInput.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  normalizedValue: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  onNormalizedChange: PropTypes.func,
};

LocationInput.defaultProps = {
  value: '',
  placeholder: 'ابحث عن موقع...',
  normalizedValue: null,
  onNormalizedChange: undefined,
};

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
    paddingHorizontal: tokens.spacing.xs,
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.najdi.background,
    borderColor: `${tokens.colors.najdi.container  }40`,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.sm,
    minHeight: tokens.touchTarget.minimum,
  },
  inputWrapperFocused: {
    borderColor: tokens.colors.najdi.focus,
    borderWidth: 1.5,
    shadowColor: tokens.colors.najdi.focus,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  inputWrapperInvalid: {
    borderColor: tokens.colors.najdi.secondary,
    borderWidth: 1.5,
  },
  leadingIcon: {
    marginLeft: tokens.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: tokens.colors.najdi.text,
    paddingVertical: tokens.spacing.xs,
  },
  clearButton: {
    padding: tokens.spacing.xs,
    borderRadius: tokens.radii.full,
  },
  clearButtonPressed: {
    opacity: 0.6,
  },
  helperText: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
    paddingHorizontal: tokens.spacing.xs,
  },
  helperTextInvalid: {
    color: tokens.colors.najdi.secondary,
  },
  dropdown: {
    marginTop: tokens.spacing.xs,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.najdi.background,
    borderColor: `${tokens.colors.najdi.container  }40`,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    maxHeight: 240,
    overflow: 'hidden',
  },
  scroll: {
    maxHeight: 240,
  },
  scrollContent: {
    paddingVertical: tokens.spacing.xs,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  suggestionItemPressed: {
    backgroundColor: `${tokens.colors.najdi.container  }20`,
  },
  flag: {
    fontSize: 20,
  },
  flagIconFallback: {
    width: 20,
  },
  suggestionLabel: {
    flex: 1,
    fontSize: 16,
    color: tokens.colors.najdi.text,
  },
  emptyState: {
    paddingVertical: tokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: tokens.colors.najdi.textMuted,
  },
});

export default LocationInput;
