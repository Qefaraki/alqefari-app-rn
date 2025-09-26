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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NewsArticle } from '../../services/news';
import { useAbsoluteDateNoMemo } from '../../hooks/useFormattedDateNoMemo';
import ArticleContentRenderer from './components/ArticleContentRenderer';
import PhotoGalleryGrid from './components/PhotoGalleryGrid';
import { analyzeContent, extractGalleryLink, extractPreviewImages, countImages } from './utils/linkExtractor';
import tokens from '../ui/tokens';

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
  const [isLoading, setIsLoading] = useState(true);
  const [fontSize, setFontSize] = useState(17);
  const [showHeader, setShowHeader] = useState(true);
  const [readingProgress, setReadingProgress] = useState(0);
  const lastScrollY = useRef(0);
  const insets = useSafeAreaInsets();
  const headerAnimY = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  // Simple cache state
  const [cachedContent, setCachedContent] = useState<string | null>(null);

  // Photo gallery state
  const [isPhotoHeavy, setIsPhotoHeavy] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryLink, setGalleryLink] = useState('');
  const [galleryLinkType, setGalleryLinkType] = useState<'drive' | 'photos' | 'article' | 'other'>('article');
  const [totalImageCount, setTotalImageCount] = useState(0);

  // Format date
  const formattedDate = useAbsoluteDateNoMemo(article?.publishedAt ? new Date(article.publishedAt) : new Date());

  // Simple caching with AsyncStorage
  useEffect(() => {
    if (!article) return;

    // Start loading immediately
    setIsLoading(true);

    const loadArticle = async () => {
      const cacheKey = `article_cache_${article.id}`;

      try {
        // Try to get cached content first
        const cached = await AsyncStorage.getItem(cacheKey);

        if (cached) {
          // Parse cached data
          const cachedData = JSON.parse(cached);
          const cacheAge = Date.now() - cachedData.timestamp;
          const ONE_DAY = 24 * 60 * 60 * 1000;

          // Use cache if less than 1 day old
          if (cacheAge < ONE_DAY && cachedData.html) {
            setCachedContent(cachedData.html);

            // Analyze content for photo galleries
            const analysis = analyzeContent(cachedData.html);
            if (analysis.isHeavy) {
              setIsPhotoHeavy(true);
              const linkData = extractGalleryLink(cachedData.html, article);
              setGalleryLink(linkData.url);
              setGalleryLinkType(linkData.type);
              const images = extractPreviewImages(cachedData.html, 20);
              setGalleryImages(images);
              setTotalImageCount(analysis.imageCount);
            } else {
              setIsPhotoHeavy(false);
              setGalleryImages([]);
              setTotalImageCount(0);
            }

            setIsLoading(false);
            return; // Exit early with cached content
          }
        }
      } catch (error) {
        console.log('Cache read error:', error);
      }

      // No valid cache, load fresh content
      if (article.html) {
        // Analyze content
        const analysis = analyzeContent(article.html);

        if (analysis.isHeavy) {
          setIsPhotoHeavy(true);
          const linkData = extractGalleryLink(article.html, article);
          setGalleryLink(linkData.url);
          setGalleryLinkType(linkData.type);
          const images = extractPreviewImages(article.html, 20);
          setGalleryImages(images);
          setTotalImageCount(analysis.imageCount);
        } else {
          setIsPhotoHeavy(false);
          setGalleryImages([]);
          setTotalImageCount(0);
        }

        // Use fresh content immediately
        setCachedContent(article.html);
        setIsLoading(false);

        // Cache the content for next time (async, don't block UI)
        AsyncStorage.setItem(cacheKey, JSON.stringify({
          html: article.html,
          timestamp: Date.now()
        })).catch(error => {
          console.log('Cache write error:', error);
        });
      }
    };

    loadArticle();
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
              <ArticleContentRenderer
                html={cachedContent || article.html || ''}
                fontSize={fontSize}
              />

              {/* Photo Gallery Grid for photo-heavy articles */}
              {isPhotoHeavy && galleryImages.length > 0 && (
                <PhotoGalleryGrid
                  images={galleryImages}
                  totalCount={totalImageCount}
                  externalLink={galleryLink}
                  linkType={galleryLinkType}
                  isNightMode={false}
                />
              )}
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