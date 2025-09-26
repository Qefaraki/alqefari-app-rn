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
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Image,
  Alert,
} from 'react-native';
import { Galeria } from '@nandorojo/galeria';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NewsArticle } from '../../services/news';
import { useAbsoluteDateNoMemo } from '../../hooks/useFormattedDateNoMemo';
import ArticleContentRenderer from './components/ArticleContentRenderer';
import PhotoGalleryGrid from './components/PhotoGalleryGrid';
import tokens from '../ui/tokens';
import { extractPreviewImages } from './utils/linkExtractor';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
  const scrollY = useRef(new Animated.Value(0)).current;
  const [isLoading, setIsLoading] = useState(false); // Start with false, only set true if needed
  const [fontSize, setFontSize] = useState(17);
  const [showHeader, setShowHeader] = useState(true);
  const [readingProgress, setReadingProgress] = useState(0);
  const lastScrollY = useRef(0);
  const insets = useSafeAreaInsets();
  const headerAnimY = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  // All images from the article (for unified Galeria viewer)
  const [allArticleImages, setAllArticleImages] = useState<string[]>([]);

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
    Animated.spring(headerAnimY, {
      toValue: showHeader ? 0 : -100,
      damping: 15,
      stiffness: 150,
      useNativeDriver: true,
    }).start();
  }, [showHeader]);

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressWidth, {
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

  // Handle inline image press - no longer needed as Galeria handles it
  const handleInlineImagePress = useCallback((imageUrl: string, index: number) => {
    // Galeria handles the click natively
  }, []);

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
          onScroll={Animated.event(
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
            <Animated.View style={styles.heroWrapper}>
              <Animated.Image
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
            </Animated.View>
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
                    <Text style={styles.readingTime}>{readingTime} دقائق قراءة</Text>
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
              {/* Wrap content in Galeria for inline images */}
              <Galeria urls={allArticleImages}>
                <ArticleContentRenderer
                  html={article.html || ''}
                  fontSize={fontSize}
                  onImagePress={handleInlineImagePress}
                  onImagesExtracted={handleImagesExtracted}
                  isHeavyArticle={(article.html?.length || 0) > 100000}
                  allImages={allArticleImages}
                />
              </Galeria>

              {/* Photo Gallery Grid - already has its own Galeria */}
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


        {/* Floating Header - iOS Style */}
        <Animated.View
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
              {/* Close Button - iOS Style */}
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={styles.closeButtonCircle}>
                  <Ionicons name="close" size={20} color={tokens.colors.najdi.text} />
                </View>
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

              {/* Alqefari Emblem - Right Side for L-shape symmetry */}
              <View style={styles.emblemContainer}>
                <Image
                  source={require('../../../assets/logo/AlqefariEmblem.png')}
                  style={styles.emblem}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Progress Pill */}
            <View style={styles.progressPill}>
              <Animated.View
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
        </Animated.View>

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
  closeButtonCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(142, 142, 147, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fontControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(142, 142, 147, 0.12)',
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
    width: 28,
    height: 28,
    opacity: 0.7,
    tintColor: tokens.colors.najdi.primary,
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
    alignItems: 'flex-end',
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
});

export default ArticleReaderModal;