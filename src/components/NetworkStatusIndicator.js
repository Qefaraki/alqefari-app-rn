import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Platform,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNetworkStore } from '../stores/networkStore';

/**
 * NetworkStatusIndicator Component
 *
 * Unified network error indicator with three display modes:
 * - banner: Persistent top banner (for global offline state)
 * - fullscreen: Full-screen error view (for screens that require network)
 * - inline: Inline error card (for optional network features)
 *
 * Usage:
 * ```javascript
 * // Banner mode (app root)
 * <NetworkStatusIndicator mode="banner" />
 *
 * // Fullscreen mode (TreeView, Search when offline)
 * {offline && <NetworkStatusIndicator mode="fullscreen" onRetry={retry} />}
 *
 * // Inline mode (within a screen, for optional features)
 * {offline && <NetworkStatusIndicator mode="inline" onRetry={retry} />}
 * ```
 */

const NetworkStatusIndicator = ({
  mode = 'banner', // 'banner', 'fullscreen', 'inline'
  onRetry = null,
  isRetrying = false,
  errorType = 'network', // 'network', 'timeout', 'server'
  customMessage = null,
  visible = true, // For banner mode auto-hide
  dismissible = false, // Allow user to dismiss banner temporarily
  onDismiss = null,
}) => {
  const { isConnected, isInternetReachable } = useNetworkStore();
  const [userDismissed, setUserDismissed] = useState(false);
  const insets = useSafeAreaInsets();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  const isOffline = !isConnected || isInternetReachable === false;

  // Auto-show/hide banner based on network state
  useEffect(() => {
    if (mode === 'banner') {
      if (isOffline && !userDismissed) {
        // Slide in banner
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        // Slide out banner
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: -100,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => setUserDismissed(false));
      }
    } else if (mode === 'fullscreen') {
      // Fullscreen entrance animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOffline, userDismissed, mode]);

  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRetry?.();
  };

  const handleDismiss = () => {
    setUserDismissed(true);
    onDismiss?.();
  };

  const getContent = () => {
    if (errorType === 'timeout') {
      return {
        title: 'الاتصال بطيء',
        subtitle: 'الاتصال بطيء جداً. حاول مرة أخرى',
        icon: 'time-outline',
      };
    }

    if (errorType === 'server') {
      return {
        title: 'خطأ في الخادم',
        subtitle: customMessage || 'لم نتمكن من الاتصال بالخادم',
        icon: 'cloud-outline',
      };
    }

    // Network/offline error
    return {
      title: 'لا يوجد اتصال',
      subtitle: 'تحقق من اتصالك بالإنترنت',
      icon: 'cloud-offline-outline',
    };
  };

  const content = getContent();

  // Banner mode: Don't render at all when online
  if (mode === 'banner') {
    // Return null immediately if user is online (not offline)
    if (!isOffline) {
      return null;
    }

    // Return null if user dismissed banner
    if (userDismissed) {
      return null;
    }

    // Only render if offline and not dismissed
    return (
      <Animated.View
        style={[
          styles.banner,
          {
            paddingTop: insets.top + 12, // Add status bar height
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.bannerContent}>
          <View style={styles.bannerLeft}>
            <Ionicons name={content.icon} size={18} color="#FFFFFF" />
            <Text style={styles.bannerText}>{content.subtitle}</Text>
          </View>
          {dismissible && (
            <TouchableOpacity onPress={handleDismiss}>
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  }

  // Fullscreen mode: Full-screen error view
  if (mode === 'fullscreen') {
    return (
      <SafeAreaView style={styles.fullscreenContainer}>
        <Animated.View
          style={[
            styles.fullscreenContent,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Logo - Hero Element */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <Image
              source={require('../../assets/logo/Alqefari Emblem (Transparent).png')}
              style={styles.logo}
              resizeMode="contain"
            />

            {/* Error badge */}
            <View style={styles.errorBadge}>
              <Ionicons name={content.icon} size={24} color="#FFFFFF" />
            </View>
          </Animated.View>

          {/* Title */}
          <Text style={styles.fullscreenTitle}>{content.title}</Text>

          {/* Subtitle */}
          <Text style={styles.fullscreenSubtitle}>{content.subtitle}</Text>

          {/* Retry Button */}
          {onRetry && (
            <TouchableOpacity
              style={[styles.button, isRetrying && styles.buttonDisabled]}
              onPress={handleRetry}
              disabled={isRetrying}
              activeOpacity={0.8}
            >
              {isRetrying ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="refresh" size={20} color="#FFFFFF" />
                  <Text style={styles.buttonText}>حاول مرة أخرى</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </Animated.View>
      </SafeAreaView>
    );
  }

  // Inline mode: Card-style error indicator
  if (mode === 'inline') {
    return (
      <View style={styles.inlineContainer}>
        <View style={styles.inlineContent}>
          <View style={styles.inlineLeft}>
            <View style={styles.inlineIcon}>
              <Ionicons name={content.icon} size={20} color="#FF3B30" />
            </View>
            <View style={styles.inlineText}>
              <Text style={styles.inlineTitle}>{content.title}</Text>
              <Text style={styles.inlineSubtitle}>{content.subtitle}</Text>
            </View>
          </View>

          {onRetry && (
            <TouchableOpacity onPress={handleRetry} disabled={isRetrying}>
              {isRetrying ? (
                <ActivityIndicator size="small" color="#FF3B30" />
              ) : (
                <Ionicons name="refresh" size={20} color="#FF3B30" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  // Banner styles
  banner: {
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 16,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  bannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  bannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    flex: 1,
  },

  // Fullscreen styles
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#F9F7F3',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  fullscreenContent: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  logoContainer: {
    width: 160,
    height: 160,
    marginBottom: 40,
    position: 'relative',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  errorBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  fullscreenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#242121',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  fullscreenSubtitle: {
    fontSize: 17,
    color: '#8E8E93',
    marginBottom: 44,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },

  // Inline styles
  inlineContainer: {
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  inlineContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  inlineLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inlineIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFE5E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineText: {
    flex: 1,
  },
  inlineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#242121',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  inlineSubtitle: {
    fontSize: 13,
    color: '#736372',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    lineHeight: 18,
  },
});

export default NetworkStatusIndicator;
