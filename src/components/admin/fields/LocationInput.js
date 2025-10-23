import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../services/supabase';
import tokens from '../../ui/tokens';
import CategoryChipFilter from './CategoryChipFilter';

/**
 * LocationInput Component (Redesigned)
 *
 * Features:
 * - Category chip filter (Saudi default, Khalij, Arab, International)
 * - Fixed-height results container (prevents layout jump)
 * - Arabic-only display (minimal, clean)
 * - Debounced search (200ms, prevents glitchy updates)
 * - Freeform input support (for unknown/historical places)
 * - Semi-required validation (warns if no match)
 *
 * Architecture:
 * - Chips filter by region (السعودية → 27 cities, not 64 mixed)
 * - Search debounces to prevent rapid updates
 * - Results container is fixed 300pt height (no layout shift)
 * - Skeleton loader inside container (no jumps)
 * - ScrollView for results (replaces FlatList to avoid nesting warning)
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
  const [activeCategory, setActiveCategory] = useState('saudi'); // Default to Saudi cities

  const debounceRef = useRef(null);
  const requestSequenceRef = useRef(0);  // Track request sequence to prevent stale results

  // Category definitions for chips
  const categories = [
    { id: 'saudi', label: 'السعودية', count: 27 },
    { id: 'gulf', label: 'الخليج', count: 5 },
    { id: 'arab', label: 'العربية', count: 12 },
    { id: 'international', label: 'دولية', count: 20 },
    { id: 'all', label: 'الكل', count: 64 },
  ];

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
    async (query, categoryId = 'all') => {
      if (query.length < 2) {
        setSuggestions([]);
        setShowWarning(false);
        return;
      }

      // Track request sequence to prevent stale results from older requests
      const currentSequence = ++requestSequenceRef.current;

      setLoading(true);

      try {
        // Fetch from RPC with limit
        const { data, error } = await supabase.rpc('search_place_autocomplete', {
          p_query: query,
          p_limit: 8,
        });

        // Only update state if this is still the latest request
        if (currentSequence === requestSequenceRef.current) {
          if (!error && data) {
            // Filter by category if not "all"
            let filtered = data;
            if (categoryId !== 'all') {
              filtered = data.filter(item => item.region === categoryId);
            }

            setSuggestions(filtered);

            // Semi-required: Show warning if common place has no match
            if (filtered.length === 0 && query.length > 3) {
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
    []
  );

  const handleTextChange = useCallback(
    (text) => {
      setInputText(text);
      onChange(text);

      // Clear normalized data when user types freeform
      if (onNormalizedChange) {
        onNormalizedChange(null);
      }

      // Debounce search (200ms for smooth typing, prevents glitchy updates)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        searchPlaces(text, activeCategory);
      }, 200);
    },
    [onChange, onNormalizedChange, searchPlaces, activeCategory]
  );

  const handleCategoryChange = useCallback(
    (categoryId) => {
      setActiveCategory(categoryId);
      // Re-search with new category filter
      if (inputText.length >= 2) {
        searchPlaces(inputText, categoryId);
      } else {
        setSuggestions([]);
      }
    },
    [inputText, searchPlaces]
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

      {/* Category Filter Chips */}
      <CategoryChipFilter
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        style={styles.chipFilterContainer}
      />

      {/* Search Field */}
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, showWarning && styles.inputWarning]}
          value={inputText}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.najdi.textMuted + '80'}
          textAlign="right"
          editable={!loading}
        />
      </View>

      {/* Warning Message (with opacity fade, no mount/unmount) */}
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

      {/* Fixed-Height Results Container (prevents layout jump!) */}
      {inputText.length >= 2 && (
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
          ) : suggestions.length > 0 ? (
            <ScrollView
              scrollEnabled={suggestions.length > 5}
              showsVerticalScrollIndicator={true}
              scrollIndicatorInsets={{ right: 1 }}
            >
              {suggestions.map((item, index) => (
                <View key={item.id.toString()}>
                  {/* Show category header only when viewing "all" and at region boundaries */}
                  {activeCategory === 'all' && index === 0 && (
                    <Text style={styles.sectionHeader}>{item.region}</Text>
                  )}
                  {activeCategory === 'all' && index > 0 &&
                    suggestions[index - 1].region !== item.region && (
                    <Text style={styles.sectionHeader}>{item.region}</Text>
                  )}

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
                      {/* Arabic name only (no English, no country labels for Saudi) */}
                      <Text style={styles.suggestionName}>
                        {item.display_name}
                      </Text>
                      {/* Only show country for non-Saudi places */}
                      {item.place_type === 'city' && item.region !== 'saudi' && (
                        <Text style={styles.suggestionCountry}>
                          {item.country_name}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>
                لا توجد نتائج - يمكنك إدخال النص مباشرة
              </Text>
            </View>
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

  chipFilterContainer: {
    marginVertical: tokens.spacing.xs,
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

  // ============================================================================
  // Fixed-Height Results Container (key to preventing layout jump!)
  // ============================================================================

  resultsContainer: {
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container + '40',
    height: 300,  // Fixed height (not minHeight/maxHeight)
    overflow: 'hidden',
    marginTop: tokens.spacing.xs,
  },

  // ============================================================================
  // Category Section Headers (shown only when viewing "all" categories)
  // ============================================================================

  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.najdi.textMuted,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    paddingTop: tokens.spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ============================================================================
  // Suggestion Items (now single-line, Arabic-only, minimal)
  // ============================================================================

  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.najdi.container + '20',
    gap: tokens.spacing.sm,
    minHeight: 44,  // Touch target
  },

  suggestionItemPressed: {
    backgroundColor: tokens.colors.najdi.container + '20',
  },

  suggestionIcon: {
    width: 24,
    height: 24,
    textAlign: 'center',
  },

  suggestionText: {
    flex: 1,
    gap: tokens.spacing.xxs,
  },

  suggestionName: {
    fontSize: 16,
    fontWeight: '500',
    color: tokens.colors.najdi.text,
    textAlign: 'right',
  },

  suggestionCountry: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'right',
  },

  // ============================================================================
  // Skeleton Loaders (shown while searching)
  // ============================================================================

  skeletonLoaderInner: {
    paddingVertical: tokens.spacing.sm,
  },

  skeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.najdi.container + '20',
    gap: tokens.spacing.sm,
    minHeight: 44,
  },

  skeletonIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: tokens.colors.najdi.container + '20',
  },

  skeletonText: {
    flex: 1,
    gap: tokens.spacing.xs,
  },

  skeletonLine: {
    height: 12,
    backgroundColor: tokens.colors.najdi.container + '20',
    borderRadius: 4,
  },

  skeletonLineShort: {
    width: '60%',
  },

  // ============================================================================
  // Empty State (when no results found)
  // ============================================================================

  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.lg,
  },

  emptyStateText: {
    fontSize: 14,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
  },
});

export default LocationInput;
