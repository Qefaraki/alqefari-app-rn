import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../services/supabase';
import tokens from '../../ui/tokens';

/**
 * LocationInput Component
 * Features:
 * - Arabic-first autocomplete search
 * - Flexible input (user can type freely or select from suggestions)
 * - Semi-required mode (warns if no match found)
 * - Priority ordering: Saudi cities → Gulf → Arab → Western → Other
 */
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
  const [loading, setLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const debounceRef = useRef(null);
  const requestSequenceRef = useRef(0);  // Track request sequence to prevent stale results

  useEffect(() => {
    setInputText(value || '');
  }, [value]);

  // Cleanup debounce and requests on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const searchPlaces = useCallback(
    async (query) => {
      if (query.length < 2) {
        setSuggestions([]);
        setShowWarning(false);
        return;
      }

      // Track request sequence to prevent stale results from older requests
      const currentSequence = ++requestSequenceRef.current;

      setLoading(true);

      try {
        const { data, error } = await supabase.rpc('search_place_autocomplete', {
          p_query: query,
          p_limit: 8,
        });

        // Only update state if this is still the latest request
        if (currentSequence === requestSequenceRef.current) {
          if (!error && data) {
            setSuggestions(data);

            // Semi-required: Show warning if common place has no match
            if (data.length === 0 && query.length > 3) {
              setShowWarning(true);
            } else {
              setShowWarning(false);
            }
          }
        }
      } finally {
        // Always clear loading for the latest request (including stale requests)
        if (currentSequence === requestSequenceRef.current) {
          setLoading(false);
        }
      }
    },
    [setSuggestions, setLoading, setShowWarning]
  );

  const handleTextChange = useCallback(
    (text) => {
      setInputText(text);
      onChange(text);

      // Clear normalized data when user types freeform
      if (onNormalizedChange) {
        onNormalizedChange(null);
      }

      // Debounce search (350ms for smooth typing)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        searchPlaces(text);
      }, 350);
    },
    [onChange, onNormalizedChange, searchPlaces]
  );

  const selectSuggestion = useCallback(
    (suggestion) => {
      setInputText(suggestion.display_name);
      onChange(suggestion.display_name);

      if (onNormalizedChange) {
        onNormalizedChange(suggestion.normalized_data);
      }

      setSuggestions([]);
      setShowWarning(false);
    },
    [onChange, onNormalizedChange]
  );

  const getIcon = (region) => {
    if (region === 'saudi') return 'location';
    return 'earth';
  };

  const getIconColor = (region) => {
    switch (region) {
      case 'saudi':
        return tokens.colors.najdi.primary;
      case 'gulf':
        return '#007AFF';
      case 'arab':
        return '#34C759';
      case 'western':
        return '#5856D6';
      default:
        return tokens.colors.najdi.textMuted;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, showWarning && styles.inputWarning]}
          value={inputText}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.najdi.textMuted + '80'}
          textAlign="right"
        />
        {loading && (
          <ActivityIndicator
            size="small"
            color={tokens.colors.najdi.primary}
            style={styles.loader}
          />
        )}
      </View>

      <View
        style={[
          styles.warningContainer,
          { opacity: showWarning ? 1 : 0 },
        ]}
        pointerEvents={showWarning ? 'auto' : 'none'}
      >
        <Ionicons
          name="alert-circle-outline"
          size={16}
          color={tokens.colors.najdi.secondary}
        />
        <Text style={styles.warningText}>
          لم نجد مطابقة. يمكنك المتابعة بهذا النص أو اختر من القائمة.
        </Text>
      </View>

      {(loading || suggestions.length > 0) && inputText.length >= 2 && (
        <View style={styles.resultsContainer}>
          {loading && suggestions.length === 0 ? (
            <View style={styles.skeletonLoaderInner}>
              {[0, 1, 2].map((index) => (
                <View key={index} style={styles.skeletonItem}>
                  <View style={styles.skeletonIcon} />
                  <View style={styles.skeletonText}>
                    <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
                    <View style={styles.skeletonLine} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.suggestionItem,
                    pressed && styles.suggestionItemPressed,
                  ]}
                  onPress={() => selectSuggestion(item)}
                >
                  <Ionicons
                    name={getIcon(item.region)}
                    size={18}
                    color={getIconColor(item.region)}
                    style={styles.suggestionIcon}
                  />
                  <View style={styles.suggestionText}>
                    <Text style={styles.suggestionName}>{item.display_name}</Text>
                    {item.country_name && (
                      <Text style={styles.suggestionCountry}>
                        {item.country_name}
                      </Text>
                    )}
                    {item.display_name_en && (
                      <Text style={styles.suggestionNameEn}>
                        {item.display_name_en}
                      </Text>
                    )}
                  </View>
                </Pressable>
              )}
              scrollEnabled={suggestions.length > 5}
              nestedScrollEnabled={true}
              style={styles.suggestionsList}
            />
          )}
        </View>
      )}
    </View>
  );
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
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    fontSize: 17,
    fontWeight: '400',
    color: tokens.colors.najdi.text,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container + '40',
    minHeight: tokens.touchTarget.minimum,
  },
  inputWarning: {
    borderColor: tokens.colors.najdi.secondary,
    borderWidth: 1.5,
  },
  loader: {
    position: 'absolute',
    right: tokens.spacing.md,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    minHeight: 28,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: tokens.colors.najdi.secondary,
    textAlign: 'right',
  },
  resultsContainer: {
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container + '40',
    minHeight: 180,
    maxHeight: 300,
    overflow: 'hidden',
    marginTop: tokens.spacing.xs,
  },
  suggestionsList: {
    // FlatList container
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.najdi.container + '20',
    gap: tokens.spacing.sm,
  },
  suggestionItemPressed: {
    backgroundColor: tokens.colors.najdi.container + '20',
  },
  suggestionIcon: {
    width: 24,
    textAlign: 'center',
  },
  suggestionText: {
    flex: 1,
    gap: tokens.spacing.xxs,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '500',
    color: tokens.colors.najdi.text,
    textAlign: 'right',
  },
  suggestionCountry: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'right',
  },
  suggestionNameEn: {
    fontSize: 12,
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
    textAlign: 'right',
  },
  skeletonLoaderInner: {
    // Inner container for skeleton items (no additional styling needed)
  },
  skeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.najdi.container + '20',
    gap: tokens.spacing.sm,
  },
  skeletonIcon: {
    width: 24,
    height: 20,
    borderRadius: 4,
    backgroundColor: tokens.colors.najdi.container + '20',
  },
  skeletonText: {
    flex: 1,
    gap: tokens.spacing.xxs,
  },
  skeletonLine: {
    height: 14,
    backgroundColor: tokens.colors.najdi.container + '20',
    borderRadius: 4,
    marginBottom: tokens.spacing.xs,
  },
  skeletonLineShort: {
    width: '60%',
  },
});

export default LocationInput;
