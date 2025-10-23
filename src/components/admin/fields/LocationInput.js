import React, { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Animated,
  Easing,
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
  const [isFocused, setIsFocused] = useState(false);

  const debounceRef = useRef(null);
  const requestSequenceRef = useRef(0);  // Track request sequence to prevent stale results
  const shimmerAnim = useRef(new Animated.Value(0)).current;  // Skeleton shimmer animation

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

  // Shimmer animation loop for skeleton loaders
  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.bezier(0.4, 0.0, 0.2, 1),
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.bezier(0.4, 0.0, 0.2, 1),
          useNativeDriver: false,
        }),
      ])
    );
    shimmerAnimation.start();
    return () => shimmerAnimation.stop();
  }, [shimmerAnim]);

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
          if (error) {
            // Handle RPC error gracefully
            console.error('Location search error:', error);
            setSuggestions([]);
            setShowWarning(false);
            // Show alert only for critical errors, not network timeouts
            if (error.message && !error.message.includes('timeout')) {
              Alert.alert('خطأ البحث', 'حدث خطأ أثناء البحث عن المواقع. يرجى المحاولة لاحقاً.');
            }
          } else if (data && Array.isArray(data)) {
            // Filter by category if not "all"
            let filtered = data;
            if (categoryId !== 'all') {
              filtered = data.filter(item => item?.region === categoryId);
            }

            setSuggestions(filtered);

            // Semi-required: Show warning if common place has no match
            if (filtered.length === 0 && query.length > 3) {
              setShowWarning(true);
            } else {
              setShowWarning(false);
            }
          } else {
            // Handle unexpected response format
            setSuggestions([]);
            setShowWarning(false);
          }
        }
      } catch (err) {
        // Handle unexpected errors (network issues, etc.)
        if (currentSequence === requestSequenceRef.current) {
          console.error('Unexpected error in location search:', err);
          setSuggestions([]);
          setShowWarning(false);
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
        return tokens.colors.najdi.primary;      // Najdi Crimson
      case 'gulf':
        return tokens.colors.najdi.secondary;    // Desert Ochre
      case 'arab':
        return tokens.colors.najdi.focus;        // Focus purple
      case 'western':
        return tokens.colors.najdi.textMuted;    // Sadu muted
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
          style={[styles.input, showWarning && styles.inputWarning, isFocused && styles.inputFocused]}
          value={inputText}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.najdi.textMuted + '80'}
          textAlign="start"
          editable={!loading}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
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
              {[0, 1, 2].map((index) => {
                const shimmerOpacity = shimmerAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.3, 0.7, 0.3],
                });
                return (
                  <Animated.View
                    key={index}
                    style={[
                      styles.skeletonItem,
                      index === 0 && styles.skeletonItemFirst,
                      { opacity: shimmerOpacity },
                    ]}
                  >
                    <View style={[styles.skeletonIcon, index === 0 && styles.skeletonIconFirst]} />
                    <View style={styles.skeletonText}>
                      <View style={[styles.skeletonLine, styles.skeletonLineShort, index === 0 && styles.skeletonLineFirst]} />
                      <View style={styles.skeletonLine} />
                    </View>
                  </Animated.View>
                );
              })}
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
                      { transform: [{ scale: pressed ? 0.98 : 1 }] },
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
              <Ionicons
                name="search-outline"
                size={32}
                color={tokens.colors.najdi.textMuted}
                style={[styles.emptyStateIcon, { opacity: 0.6 }]}
              />
              <Text style={styles.emptyStateText}>
                لا توجد نتائج - يمكنك إدخال النص مباشرة
              </Text>
              <Text style={styles.emptyStateSubtext}>
                جرب مصطلحاً آخر أو اختر فئة مختلفة
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

  inputFocused: {
    borderColor: tokens.colors.najdi.focus,
    borderWidth: 1.5,
    shadowColor: tokens.colors.najdi.focus,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
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
    // iOS-style shadow for depth (reduced opacity for subtle effect)
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,  // Android elevation
  },

  // ============================================================================
  // Category Section Headers (shown only when viewing "all" categories)
  // ============================================================================

  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.najdi.textMuted,
    opacity: 0.7,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    paddingTop: tokens.spacing.md,
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
    textAlign: 'start',
  },

  suggestionCountry: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'start',
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

  skeletonItemFirst: {
    paddingTop: tokens.spacing.md,
  },

  skeletonIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: tokens.colors.najdi.container + '20',
  },

  skeletonIconFirst: {
    width: 28,
    height: 28,
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

  skeletonLineFirst: {
    height: 14,
    width: '75%',
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

  emptyStateIcon: {
    marginBottom: tokens.spacing.sm,
  },

  emptyStateText: {
    fontSize: 14,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
  },

  emptyStateSubtext: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: tokens.spacing.xxs,
  },
});

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

export default LocationInput;
