import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

/**
 * RobustImage - Production-grade image component with error recovery
 *
 * Features:
 * - Uses expo-image for superior caching and network handling
 * - Automatic retry with exponential backoff
 * - User-triggered manual retry
 * - Loading states with skeleton/shimmer
 * - Error states with actionable UI
 * - Cache-busting for problematic images
 * - Diagnostic logging for production monitoring
 */
const RobustImage = ({
  source,
  style,
  contentFit = 'cover',
  placeholder,
  transition = 300,
  cachePolicy = 'memory-disk', // 'memory-disk', 'none', 'memory', 'disk'
  maxRetries = 3,
  showRetryButton = true,
  onLoadStart,
  onLoadEnd,
  onError: externalOnError,
  recyclingKey, // Force re-render if same URL
  ...otherProps
}) => {
  const [loadState, setLoadState] = useState('loading'); // 'loading', 'success', 'error'
  const [retryCount, setRetryCount] = useState(0);
  const [imageKey, setImageKey] = useState(0); // Force remount on retry
  const retryTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Extract URL for logging
  const getImageUrl = () => {
    if (typeof source === 'string') return source;
    if (source?.uri) return source.uri;
    return 'unknown';
  };

  const imageUrl = getImageUrl();

  // Auto-retry with exponential backoff
  const scheduleRetry = useCallback(() => {
    if (retryCount >= maxRetries) {
      console.error('[RobustImage] Max retries reached for:', imageUrl);
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
    console.log(`[RobustImage] Scheduling retry ${retryCount + 1}/${maxRetries} in ${delay}ms for:`, imageUrl);

    retryTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;

      setRetryCount(prev => prev + 1);
      setImageKey(prev => prev + 1);
      setLoadState('loading');
    }, delay);
  }, [retryCount, maxRetries, imageUrl]);

  // Manual retry (user-triggered)
  const handleManualRetry = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('[RobustImage] Manual retry triggered for:', imageUrl);

    setRetryCount(0); // Reset retry count
    setImageKey(prev => prev + 1);
    setLoadState('loading');
  }, [imageUrl]);

  // Handle load start
  const handleLoadStart = useCallback(() => {
    setLoadState('loading');
    onLoadStart?.();
  }, [onLoadStart]);

  // Handle load success
  const handleLoadEnd = useCallback(() => {
    if (!mountedRef.current) return;

    setLoadState('success');
    if (retryCount > 0) {
      console.log(`[RobustImage] ✅ Success after ${retryCount} retries:`, imageUrl);
    }
    onLoadEnd?.();
  }, [retryCount, imageUrl, onLoadEnd]);

  // Handle load error
  const handleError = useCallback((error) => {
    if (!mountedRef.current) return;

    console.error('[RobustImage] Load error:', {
      url: imageUrl,
      attempt: retryCount + 1,
      error: error?.message || 'Unknown error',
    });

    setLoadState('error');
    externalOnError?.(error);

    // Auto-retry if under max attempts
    if (retryCount < maxRetries) {
      scheduleRetry();
    }
  }, [retryCount, maxRetries, imageUrl, scheduleRetry, externalOnError]);

  // Build source with cache-busting if retrying
  const buildSource = () => {
    let builtSource = source;

    // Add cache-busting query param on retries
    if (retryCount > 0 && typeof source === 'string') {
      const separator = source.includes('?') ? '&' : '?';
      builtSource = `${source}${separator}_retry=${retryCount}&_t=${Date.now()}`;
    } else if (retryCount > 0 && source?.uri) {
      const separator = source.uri.includes('?') ? '&' : '?';
      builtSource = {
        ...source,
        uri: `${source.uri}${separator}_retry=${retryCount}&_t=${Date.now()}`,
      };
    }

    return builtSource;
  };

  const finalSource = buildSource();
  const finalCachePolicy = retryCount > 0 ? 'none' : cachePolicy;

  return (
    <View style={[styles.container, style]}>
      {/* Main Image */}
      <Image
        key={`image-${imageKey}`}
        source={finalSource}
        style={[StyleSheet.absoluteFill, loadState === 'error' && styles.hidden]}
        contentFit={contentFit}
        placeholder={placeholder}
        transition={transition}
        cachePolicy={finalCachePolicy}
        recyclingKey={recyclingKey}
        onLoadStart={handleLoadStart}
        onLoad={handleLoadEnd}
        onError={handleError}
        {...otherProps}
      />

      {/* Loading State */}
      {loadState === 'loading' && (
        <View style={[StyleSheet.absoluteFill, styles.overlay, styles.loadingOverlay]}>
          <ActivityIndicator size="small" color="#A13333" />
        </View>
      )}

      {/* Error State with Retry */}
      {loadState === 'error' && (
        <View style={[StyleSheet.absoluteFill, styles.overlay, styles.errorOverlay]}>
          <Ionicons name="image-outline" size={32} color="#73637299" />
          {showRetryButton && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleManualRetry}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={16} color="#F9F7F3" />
              <Text style={styles.retryText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          )}
          {retryCount >= maxRetries && (
            <Text style={styles.errorText}>فشل تحميل الصورة</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },

  hidden: {
    opacity: 0,
  },

  overlay: {
    backgroundColor: '#D1BBA3', // Camel Hair Beige
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingOverlay: {
    backgroundColor: '#D1BBA340', // Camel Hair Beige 40%
  },

  errorOverlay: {
    backgroundColor: '#D1BBA3',
  },

  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#A13333', // Najdi Crimson
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },

  retryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F9F7F3', // Al-Jass White
    fontFamily: 'SF Arabic',
  },

  errorText: {
    fontSize: 11,
    color: '#73637299', // Text Muted
    marginTop: 8,
    fontFamily: 'SF Arabic',
  },
});

export default RobustImage;
