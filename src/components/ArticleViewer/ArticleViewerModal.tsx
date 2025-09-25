import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import {
  useSharedValue,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { NewsArticle } from '../../services/news';
import { useSettings } from '../../contexts/SettingsContext';
import tokens from '../ui/tokens';
import ArticleHeader from './components/ArticleHeader';
import ArticleContent from './components/ArticleContent';
import ArticleGallery from './components/ArticleGallery/GalleryContainer';
import ArticleActions from './components/ArticleActions';
import { extractGalleryImages } from './utils/galleryExtractor';
import { useArticleCache } from './hooks/useArticleCache';
import { useImagePreloader } from './hooks/useImagePreloader';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ArticleViewerModalProps {
  article: NewsArticle | null;
  visible: boolean;
  onClose: () => void;
}

const ArticleViewerModal: React.FC<ArticleViewerModalProps> = ({
  article,
  visible,
  onClose,
}) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const scrollRef = useRef<any>(null);
  const { settings } = useSettings();

  // State
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [processedContent, setProcessedContent] = useState<string>('');
  const [readingProgress, setReadingProgress] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [isNightMode, setIsNightMode] = useState(false);

  // Animation values
  const animatedPosition = useSharedValue(0);
  const scrollY = useSharedValue(0);

  // Snap points - dynamic based on content
  const snapPoints = useMemo(() => {
    if (!article) return ['50%'];

    // Adjust snap points based on article length
    const hasGallery = galleryImages.length > 0;
    const baseSnaps = ['50%', '92%'];

    // Add full screen snap if there's a gallery
    if (hasGallery) {
      baseSnaps.push('100%');
    }

    return baseSnaps;
  }, [article, galleryImages]);

  // Calculate status bar height
  const statusBarHeight =
    Platform.OS === 'ios' ? 47 : StatusBar.currentHeight || 24;

  // Cache management
  const { getCachedArticle, cacheArticle, clearOldCache } = useArticleCache();

  // Image preloading
  const { preloadImages, cancelPreloading } = useImagePreloader();

  // Process article content and extract gallery
  useEffect(() => {
    if (!article) return;

    setIsLoading(true);

    // Extract gallery images and process content
    const { content, galleryImages: gallery } = extractGalleryImages(article.html);
    setProcessedContent(content);
    setGalleryImages(gallery);

    // Cache the article
    cacheArticle(article);

    // Start preloading gallery images when sheet opens to 50%
    if (currentSnapIndex >= 0 && gallery.length > 0) {
      // Preload first 6 images immediately
      preloadImages(gallery.slice(0, 6));

      // Preload next batch when sheet is more open
      if (currentSnapIndex >= 1) {
        preloadImages(gallery.slice(6, 18));
      }
    }

    setIsLoading(false);
  }, [article, currentSnapIndex]);

  // Track reading progress based on scroll
  useAnimatedReaction(
    () => scrollY.value,
    (current) => {
      // Calculate reading progress
      const contentHeight = 2000; // This should be dynamic
      const viewportHeight = screenHeight * 0.92;
      const progress = Math.min(100, (current / (contentHeight - viewportHeight)) * 100);
      runOnJS(setReadingProgress)(Math.round(progress));
    },
    [scrollY]
  );

  // Handle sheet changes
  const handleSheetChange = useCallback((index: number) => {
    setCurrentSnapIndex(index);

    // Haptic feedback
    if (index !== -1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Start preloading more images as user engages
    if (index === 2 && galleryImages.length > 18) {
      preloadImages(galleryImages.slice(18));
    }
  }, [galleryImages]);

  // Custom backdrop
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.5}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );

  // Custom handle
  const renderHandle = useCallback(
    () => (
      <View style={styles.handleContainer}>
        <View style={styles.handleBar} />
        {readingProgress > 0 && (
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${readingProgress}%` }
              ]}
            />
          </View>
        )}
      </View>
    ),
    [readingProgress]
  );

  // Handle font size changes
  const adjustFontSize = useCallback((delta: number) => {
    setFontSize(prev => Math.max(12, Math.min(24, prev + delta)));
  }, []);

  // Toggle night mode
  const toggleNightMode = useCallback(() => {
    setIsNightMode(prev => !prev);
  }, []);

  // Show/hide sheet based on visibility
  useEffect(() => {
    if (visible && article) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
      // Cleanup
      cancelPreloading();
      setGalleryImages([]);
      setProcessedContent('');
      setReadingProgress(0);
    }
  }, [visible, article]);

  // Clear old cache on mount
  useEffect(() => {
    clearOldCache();
  }, []);

  if (!article) return null;

  // Calculate reading time
  const wordCount = article.html.replace(/<[^>]*>/g, '').split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 200); // 200 words per minute

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      animatedPosition={animatedPosition}
      onChange={handleSheetChange}
      onClose={onClose}
      backdropComponent={renderBackdrop}
      handleComponent={renderHandle}
      backgroundStyle={[
        styles.sheetBackground,
        isNightMode && styles.sheetBackgroundDark,
      ]}
      enablePanDownToClose
      animateOnMount
      // Enable keyboard handling for comments/sharing
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetScrollView
        ref={scrollRef}
        style={[styles.container, isNightMode && styles.containerDark]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          scrollY.value = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={tokens.colors.najdi.primary} />
            <Text style={styles.loadingText}>جاري التحميل...</Text>
          </View>
        ) : (
          <>
            {/* Article Header */}
            <ArticleHeader
              article={article}
              readingTime={readingTime}
              wordCount={wordCount}
              scrollY={scrollY}
              isNightMode={isNightMode}
            />

            {/* Article Actions Bar */}
            <ArticleActions
              article={article}
              fontSize={fontSize}
              onFontSizeChange={adjustFontSize}
              isNightMode={isNightMode}
              onToggleNightMode={toggleNightMode}
              readingProgress={readingProgress}
            />

            {/* Article Content */}
            <ArticleContent
              html={processedContent}
              fontSize={fontSize}
              isNightMode={isNightMode}
              settings={settings}
            />

            {/* Gallery Section (if images detected) */}
            {galleryImages.length > 0 && (
              <>
                <View style={styles.gallerySeparator}>
                  <View style={styles.separatorLine} />
                  <Text style={styles.galleryTitle}>
                    📸 {galleryImages.length} صور من الحدث
                  </Text>
                  <View style={styles.separatorLine} />
                </View>

                <ArticleGallery
                  images={galleryImages}
                  articleTitle={article.title}
                  isNightMode={isNightMode}
                />
              </>
            )}

            {/* Bottom padding for safe area */}
            <View style={{ height: 100 }} />
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  contentContainer: {
    paddingBottom: 20,
  },
  sheetBackground: {
    backgroundColor: '#FFFFFF',
  },
  sheetBackgroundDark: {
    backgroundColor: '#1a1a1a',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: tokens.colors.najdi.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: tokens.colors.najdi.text,
  },
  gallerySeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 12,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  galleryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
});

export default ArticleViewerModal;