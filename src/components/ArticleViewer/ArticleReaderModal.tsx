import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  ActivityIndicator,
  Animated as RNAnimated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { NewsArticle } from '../../services/news';
import { useAbsoluteDateNoMemo } from '../../hooks/useFormattedDateNoMemo';
import ArticleContentRenderer from './components/ArticleContentRenderer';
import PhotoGalleryGrid from './components/PhotoGalleryGrid';
import tokens from '../ui/tokens';
import { extractPreviewImages } from './utils/linkExtractor';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Zoomable Image Viewer Component
interface ZoomableImageViewerProps {
  imageUrl: string;
  onClose: () => void;
}

const ZoomableImageViewer: React.FC<ZoomableImageViewerProps> = ({ imageUrl, onClose }) => {
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const handleClose = () => {
    'worklet';
    runOnJS(onClose)();
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = e.scale;
      focalX.value = e.focalX;
      focalY.value = e.focalY;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      } else if (scale.value > 5) {
        scale.value = withSpring(5);
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = e.translationX;
        translateY.value = e.translationY;
      }
    })
    .onEnd(() => {
      // Apply boundaries based on scale
      const maxTranslateX = (screenWidth * (scale.value - 1)) / 2;
      const maxTranslateY = (screenHeight * (scale.value - 1)) / 2;

      if (Math.abs(translateX.value) > maxTranslateX) {
        translateX.value = withSpring(Math.sign(translateX.value) * maxTranslateX);
      }
      if (Math.abs(translateY.value) > maxTranslateY) {
        translateY.value = withSpring(Math.sign(translateY.value) * maxTranslateY);
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      } else {
        scale.value = withSpring(2.5);
      }
    });

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (scale.value === 1) {
        handleClose();
      }
    });

  const composedGesture = Gesture.Race(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
    singleTapGesture
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  return (
    <View style={styles.imageViewerOverlay}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.imageViewerContent, animatedStyle]}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.fullScreenImage}
            resizeMode="contain"
          />
        </Animated.View>
      </GestureDetector>
      <TouchableOpacity
        style={styles.imageViewerClose}
        onPress={onClose}
      >
        <View style={styles.closeButtonZoom}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </View>
      </TouchableOpacity>
    </View>
  );
};

interface ArticleReaderModalProps {
  article: NewsArticle | null;
  visible: boolean;
  onClose: () => void;
}

const ArticleReaderModal: React.FC<ArticleReaderModalProps> = ({
  article,
  visible,
  onClose,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const [isLoading, setIsLoading] = useState(false); // Start with false, only set true if needed
  const [fontSize, setFontSize] = useState(17);
  const [showHeader, setShowHeader] = useState(true);
  const [readingProgress, setReadingProgress] = useState(0);
  const lastScrollY = useRef(0);
  const insets = useSafeAreaInsets();
  const headerAnimY = useRef(new RNAnimated.Value(0)).current;
  const progressWidth = useRef(new RNAnimated.Value(0)).current;

  // All images from the article (for unified Galeria viewer)
  const [allArticleImages, setAllArticleImages] = useState<string[]>([]);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Gallery preview images for PhotoGalleryGrid
  const [galleryPreviewImages, setGalleryPreviewImages] = useState<string[]>([]);
  const [galleryImageCount, setGalleryImageCount] = useState(0);

  // Format date
  const formattedDate = useAbsoluteDateNoMemo(article?.publishedAt ? new Date(article.publishedAt) : new Date());

  // Extract all images from article
  useEffect(() => {
    if (!article || !article.html) {
      setAllArticleImages([]);
      setGalleryPreviewImages([]);
      setGalleryImageCount(0);
      return;
    }

    // Extract ALL images from the article
    const imgRegex = /<img[^>]+src="([^"]+)"/gi;
    const images: string[] = [];
    let match;

    while ((match = imgRegex.exec(article.html)) !== null) {
      const imageUrl = match[1];
      // Skip tiny images (likely icons)
      if (!imageUrl.includes('20x20') && !imageUrl.includes('32x32')) {
        images.push(imageUrl.replace(/&amp;/g, '&'));
      }
    }

    setAllArticleImages(images);

    const htmlSize = article.html.length;
    if (htmlSize > 100000) {
      // Extract from the last 30KB where gallery typically is
      const tailHtml = article.html.slice(-30000);

      // Extract preview images for gallery grid
      const previewImages = extractPreviewImages(tailHtml, 9); // Get 9 images for the grid
      setGalleryPreviewImages(previewImages);

      // Estimate total count from tail
      const imageMatches = tailHtml.match(/<img/gi);
      const estimatedCount = imageMatches ? imageMatches.length * 2 : 0; // Rough estimate
      setGalleryImageCount(estimatedCount);
    } else {
      setGalleryPreviewImages([]);
      setGalleryImageCount(0);
    }
  }, [article]);

  // Load article content and manage caching
  useEffect(() => {
    if (!article) return;

    // If article has HTML, use it immediately (no spinner)
    if (article.html) {
      // Check for cached version in background (for next time)
      const cacheKey = `article_cache_${article.id}`;
      AsyncStorage.getItem(cacheKey)
        .then(cached => {
          if (cached) {
            const cachedData = JSON.parse(cached);
            const cacheAge = Date.now() - cachedData.timestamp;
            const ONE_DAY = 24 * 60 * 60 * 1000;

            // If cache is still valid, we're done
            if (cacheAge < ONE_DAY && cachedData.html) {
              return;
            }
          }

          // Cache is missing or expired, save new cache
          return AsyncStorage.setItem(cacheKey, JSON.stringify({
            html: article.html,
            timestamp: Date.now()
          }));
        })
        .catch(error => {
          console.log('Cache error:', error);
        });
    } else {
      // No HTML available, show loading
      setIsLoading(true);
    }
  }, [article]);

  // Animate header show/hide with spring
  useEffect(() => {
    RNAnimated.spring(headerAnimY, {
      toValue: showHeader ? 0 : -100,
      damping: 15,
      stiffness: 150,
      useNativeDriver: true,
    }).start();
  }, [showHeader]);

  // Animate progress bar
  useEffect(() => {
    RNAnimated.timing(progressWidth, {
      toValue: readingProgress,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [readingProgress]);

  // Handle scroll for header show/hide and progress
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const currentY = contentOffset.y;

    // Show/hide header
    if (currentY > lastScrollY.current && currentY > 100) {
      if (showHeader) setShowHeader(false);
    } else if (currentY < lastScrollY.current - 5) {
      if (!showHeader) setShowHeader(true);
    }

    lastScrollY.current = currentY;

    // Calculate reading progress
    const scrollPercentage = (contentOffset.y / (contentSize.height - layoutMeasurement.height)) * 100;
    setReadingProgress(Math.min(100, Math.max(0, scrollPercentage)));
  }, [showHeader]);

  // Handle close with haptic
  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  // Handle font size changes
  const adjustFontSize = useCallback((delta: number) => {
    setFontSize(prev => Math.max(14, Math.min(24, prev + delta)));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Handle inline image press - show in viewer
  const handleInlineImagePress = useCallback((imageUrl: string, index: number) => {
    if (index !== -1) {
      setSelectedImageIndex(index);
    } else {
      // Find or add the image
      const foundIndex = allArticleImages.findIndex(img => img === imageUrl);
      if (foundIndex !== -1) {
        setSelectedImageIndex(foundIndex);
      } else {
        setAllArticleImages(prev => [...prev, imageUrl]);
        setSelectedImageIndex(allArticleImages.length);
      }
    }
    setShowImageViewer(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [allArticleImages]);

  // Note: Share functionality would need to be implemented differently with native Galeria
  // as we can't overlay buttons on the native viewer

  // Handle images extracted from article - no longer needed as we extract all upfront
  const handleImagesExtracted = useCallback((images: string[]) => {
    // No-op - we extract all images upfront now
  }, []);



  // Calculate reading time
  const wordCount = article?.html ? article.html.replace(/<[^>]*>/g, '').split(/\s+/).length : 0;
  const readingTime = Math.ceil(wordCount / 200);

  if (!article) return null;

  const headerHeight = 56 + insets.top;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: tokens.colors.najdi.background }]}>
        <StatusBar barStyle="dark-content" backgroundColor={tokens.colors.najdi.background} />

        {/* Content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight }]}
          showsVerticalScrollIndicator={false}
          onScroll={RNAnimated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            {
              useNativeDriver: false,
              listener: handleScroll
            }
          )}
          scrollEventThrottle={16}
        >
          {/* Hero Image with Parallax */}
          {article.heroImage && (
            <RNAnimated.View style={styles.heroWrapper}>
              <RNAnimated.Image
                source={{ uri: article.heroImage }}
                style={[
                  styles.heroImage,
                  {
                    transform: [{
                      translateY: scrollY.interpolate({
                        inputRange: [-100, 0, 100],
                        outputRange: [-50, 0, 25],
                        extrapolate: 'clamp',
                      })
                    }, {
                      scale: scrollY.interpolate({
                        inputRange: [-100, 0],
                        outputRange: [1.2, 1],
                        extrapolate: 'clamp',
                      })
                    }]
                  }
                ]}
                resizeMode="cover"
              />
            </RNAnimated.View>
          )}

          {/* Article Header */}
          <View style={[
            styles.articleHeader,
            !article.heroImage && styles.articleHeaderNoImage
          ]}>
            <Text style={styles.articleTitle}>{article.title}</Text>

            <View style={styles.articleMeta}>
              <View style={styles.metaRow}>
                <Text style={styles.articleDate}>{formattedDate}</Text>
                {readingTime > 0 && (
                  <>
                    <Text style={styles.metaSeparator}>·</Text>
                    <Text style={styles.readingTime}>
                      {readingTime === 1 ? 'دقيقة واحدة' : `${readingTime} دقائق`}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Article Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={tokens.colors.najdi.primary} />
              <Text style={styles.loadingText}>جاري التحميل...</Text>
            </View>
          ) : (
            <>
              {/* Article content with clickable images */}
              <ArticleContentRenderer
                html={article.html || ''}
                fontSize={fontSize}
                onImagePress={handleInlineImagePress}
                onImagesExtracted={handleImagesExtracted}
                isHeavyArticle={(article.html?.length || 0) > 100000}
                allImages={allArticleImages}
              />

              {/* Photo Gallery Grid with Galeria */}
              <PhotoGalleryGrid
                previewImages={galleryPreviewImages}
                totalImageCount={galleryImageCount}
                permalink={article.permalink || ''}
                title={article.title}
                isNightMode={false}
                allImages={allArticleImages}
              />
            </>
          )}

          {/* Bottom Padding */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Enhanced modal viewer for inline images with zoom/pan */}
        {showImageViewer && allArticleImages[selectedImageIndex] && (
          <Modal
            visible={showImageViewer}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowImageViewer(false)}
          >
            <GestureHandlerRootView style={{ flex: 1 }}>
              <ZoomableImageViewer
                imageUrl={allArticleImages[selectedImageIndex]}
                onClose={() => setShowImageViewer(false)}
              />
            </GestureHandlerRootView>
          </Modal>
        )}


        {/* Floating Header - iOS Style */}
        <RNAnimated.View
          style={[
            styles.header,
            {
              height: headerHeight,
              transform: [{ translateY: headerAnimY }]
            }
          ]}
        >
          <BlurView intensity={85} tint="light" style={[styles.headerBlur, { paddingTop: insets.top }]}>
            <View style={styles.headerContent}>
              {/* Alqefari Emblem - Left Side (acts as close button) */}
              <TouchableOpacity
                onPress={handleClose}
                style={styles.emblemContainer}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Image
                  source={require('../../../assets/logo/AlqefariEmblem.png')}
                  style={styles.emblem}
                  resizeMode="contain"
                />
              </TouchableOpacity>

              {/* Font Controls - iOS Style */}
              <View style={styles.fontControls}>
                <TouchableOpacity
                  onPress={() => adjustFontSize(-1)}
                  style={[styles.fontButton, fontSize <= 14 && styles.fontButtonDisabled]}
                  disabled={fontSize <= 14}
                >
                  <Text style={[styles.fontButtonText, styles.fontButtonSmall]}>A</Text>
                </TouchableOpacity>

                <View style={styles.fontDivider} />

                <TouchableOpacity
                  onPress={() => adjustFontSize(1)}
                  style={[styles.fontButton, fontSize >= 24 && styles.fontButtonDisabled]}
                  disabled={fontSize >= 24}
                >
                  <Text style={[styles.fontButtonText, styles.fontButtonLarge]}>A</Text>
                </TouchableOpacity>
              </View>

              {/* Close Button - Right Side (no background) */}
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={tokens.colors.najdi.text} />
              </TouchableOpacity>
            </View>

            {/* Progress Pill */}
            <View style={styles.progressPill}>
              <RNAnimated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressWidth.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%']
                    })
                  }
                ]}
              />
            </View>
          </BlurView>
        </RNAnimated.View>

      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'transparent',
  },
  headerBlur: {
    flex: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    height: 56,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fontControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 4,
    height: 32,
    flex: 1,
    maxWidth: 100,
    marginHorizontal: 16,
  },
  fontButton: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  fontButtonDisabled: {
    opacity: 0.3,
  },
  fontButtonText: {
    fontWeight: '500',
    color: tokens.colors.najdi.text,
  },
  fontButtonSmall: {
    fontSize: 13,
  },
  fontButtonLarge: {
    fontSize: 17,
  },
  fontDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginHorizontal: 2,
  },
  emblemContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emblem: {
    width: 40,
    height: 40,
    opacity: 0.9,
    tintColor: '#242121', // Sadu Night black
  },
  progressPill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: tokens.colors.najdi.primary,
    borderRadius: 1.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroWrapper: {
    width: screenWidth,
    height: screenWidth * 0.56,
    overflow: 'hidden',
    backgroundColor: tokens.colors.najdi.container + '10',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  articleHeader: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
    backgroundColor: tokens.colors.najdi.background,
  },
  articleHeaderNoImage: {
    paddingTop: 36,
  },
  articleTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
    lineHeight: 38,
    letterSpacing: -0.5,
    fontFamily: 'System',
    marginBottom: 16,
  },
  articleMeta: {
    alignItems: 'flex-start', // Changed for RTL - React Native will flip this
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  articleDate: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'System',
    fontWeight: '500',
  },
  metaSeparator: {
    marginHorizontal: 8,
    color: tokens.colors.najdi.textMuted,
    fontSize: 13,
  },
  readingTime: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'System',
    fontWeight: '500',
  },
  loadingContainer: {
    paddingVertical: 100,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'System',
  },
  // Simple image viewer styles
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
  imageViewerClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    zIndex: 1000,
  },
  closeButtonZoom: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ArticleReaderModal;