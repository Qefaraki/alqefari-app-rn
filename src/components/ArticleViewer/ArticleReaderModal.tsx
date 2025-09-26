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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
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
  const lastScrollY = useRef(0);
  const insets = useSafeAreaInsets();
  const headerAnimY = useRef(new Animated.Value(0)).current;

  // Photo gallery state
  const [isPhotoHeavy, setIsPhotoHeavy] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryLink, setGalleryLink] = useState('');
  const [galleryLinkType, setGalleryLinkType] = useState<'drive' | 'photos' | 'article' | 'other'>('article');
  const [totalImageCount, setTotalImageCount] = useState(0);

  // Format date
  const formattedDate = useAbsoluteDateNoMemo(article?.publishedAt ? new Date(article.publishedAt) : new Date());

  // Analyze content and load gallery data
  useEffect(() => {
    if (article && article.html) {
      setIsLoading(true);

      // Analyze content for photo-heavy detection
      const analysis = analyzeContent(article.html);
      console.log('Article analysis:', analysis);

      // If photo-heavy, extract gallery data
      if (analysis.isHeavy) {
        setIsPhotoHeavy(true);

        // Extract gallery link
        const linkData = extractGalleryLink(article.html, article);
        setGalleryLink(linkData.url);
        setGalleryLinkType(linkData.type);

        // Extract preview images
        const images = extractPreviewImages(article.html, 20); // Get up to 20 for better selection
        setGalleryImages(images);

        // Set total count
        setTotalImageCount(analysis.imageCount);
      } else {
        setIsPhotoHeavy(false);
        setGalleryImages([]);
        setTotalImageCount(0);
      }

      // Simulate content processing
      setTimeout(() => {
        setIsLoading(false);
      }, 300);
    }
  }, [article]);

  // Animate header show/hide
  useEffect(() => {
    Animated.timing(headerAnimY, {
      toValue: showHeader ? 0 : -100,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showHeader]);

  // Handle scroll for header show/hide
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = event.nativeEvent.contentOffset.y;

    if (currentY > lastScrollY.current && currentY > 100) {
      if (showHeader) setShowHeader(false);
    } else if (currentY < lastScrollY.current - 5) {
      if (!showHeader) setShowHeader(true);
    }

    lastScrollY.current = currentY;
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

  // Process HTML for photo-heavy articles (remove images to prevent duplication)
  // MUST be before early return to follow React hooks rules
  const processedHtml = useMemo(() => {
    if (!article?.html) return '';

    // For photo-heavy articles, remove all image tags
    if (isPhotoHeavy) {
      return article.html
        .replace(/<img[^>]*>/gi, '') // Remove all img tags
        .replace(/<figure[^>]*>.*?<\/figure>/gis, ''); // Remove figure elements that contain images
    }

    return article.html;
  }, [article?.html, isPhotoHeavy]);

  // Calculate reading time (safe with optional chaining)
  const wordCount = article?.html ? article.html.replace(/<[^>]*>/g, '').split(/\s+/).length : 0;
  const readingTime = Math.ceil(wordCount / 200);

  if (!article) return null;

  const headerHeight = 56 + insets.top;

  return (
    <Modal
      visible={visible}
      animationType="slide"
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
          {/* Hero Image */}
          {article.heroImage && (
            <Animated.Image
              source={{ uri: article.heroImage }}
              style={[
                styles.heroImage,
                {
                  transform: [{
                    translateY: scrollY.interpolate({
                      inputRange: [-100, 0, 100],
                      outputRange: [-50, 0, 50],
                      extrapolate: 'clamp',
                    })
                  }]
                }
              ]}
              resizeMode="cover"
            />
          )}

          {/* Article Header */}
          <View style={[
            styles.articleHeader,
            !article.heroImage && styles.articleHeaderNoImage
          ]}>
            <Text style={styles.articleTitle}>{article.title}</Text>

            <View style={styles.articleMeta}>
              <Text style={styles.articleDate}>{formattedDate}</Text>
              {readingTime > 0 && (
                <>
                  <Text style={styles.metaSeparator}>·</Text>
                  <Text style={styles.readingTime}>{readingTime} دقائق قراءة</Text>
                </>
              )}
            </View>
          </View>

          {/* Article Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={tokens.colors.najdi.primary} />
            </View>
          ) : (
            <>
              <ArticleContentRenderer
                html={processedHtml}
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

        {/* Floating Header - After ScrollView for proper z-index */}
        <Animated.View
          style={[
            styles.header,
            {
              height: headerHeight,
              transform: [{ translateY: headerAnimY }]
            }
          ]}
        >
          <BlurView intensity={95} tint="light" style={[styles.headerBlur, { paddingTop: insets.top }]}>
            <View style={styles.headerContent}>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={28} color={tokens.colors.najdi.text} />
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {article.title}
                </Text>
              </View>

              <View style={styles.fontControls}>
                <TouchableOpacity
                  onPress={() => adjustFontSize(-1)}
                  style={styles.fontButton}
                  disabled={fontSize <= 14}
                >
                  <Text style={[styles.fontButtonText, { fontSize: 12 }, fontSize <= 14 && styles.disabledText]}>
                    ص-
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => adjustFontSize(1)}
                  style={styles.fontButton}
                  disabled={fontSize >= 24}
                >
                  <Text style={[styles.fontButtonText, { fontSize: 14 }, fontSize >= 24 && styles.disabledText]}>
                    ص+
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>

          {/* Reading Progress Bar */}
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: scrollY.interpolate({
                  inputRange: [0, 1000],
                  outputRange: ['0%', '100%'],
                  extrapolate: 'clamp',
                })
              }
            ]}
          />
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
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.najdi.container + '30',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    height: 56,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    textAlign: 'center',
    fontFamily: 'SF Arabic',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fontControls: {
    flexDirection: 'row',
    gap: 4,
  },
  fontButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.najdi.container + '20',
    borderRadius: 8,
  },
  fontButtonText: {
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    fontFamily: 'SF Arabic',
  },
  disabledText: {
    opacity: 0.3,
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
    backgroundColor: tokens.colors.najdi.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroImage: {
    width: screenWidth,
    height: screenWidth * 0.56,
    backgroundColor: tokens.colors.najdi.container + '10',
  },
  articleHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: tokens.colors.najdi.background,
  },
  articleHeaderNoImage: {
    paddingTop: 32,
  },
  articleTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
    lineHeight: 34,
    letterSpacing: -0.3,
    fontFamily: 'SF Arabic',
    marginBottom: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  articleDate: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF Arabic',
  },
  metaSeparator: {
    marginHorizontal: 8,
    color: tokens.colors.najdi.textMuted,
  },
  readingTime: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF Arabic',
  },
  loadingContainer: {
    paddingVertical: 100,
    alignItems: 'center',
  },
});

export default ArticleReaderModal;