import React, { useCallback, useEffect, useMemo, useRef, useState, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Platform,
  StatusBar,
  Linking,
  Alert,
  TouchableOpacity,
  ListRenderItemInfo,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetBackdrop,
  BottomSheetModalProvider,
} from '@gorhom/bottom-sheet';
import {
  useSharedValue,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { NewsArticle } from '../../services/news';
import { useSettings } from '../../contexts/SettingsContext';
import tokens from '../ui/tokens';
import ArticleHeader from './components/ArticleHeader';
import ArticleContent from './components/ArticleContent';
import ArticleActions from './components/ArticleActions';
import ArticleSkeletonLoader from './components/ArticleSkeletonLoader';
import { extractGalleryImages } from './utils/galleryExtractor';
import { useArticleCache } from './hooks/useArticleCache';
import { useImagePreloader } from './hooks/useImagePreloader';
import { getWordPressImageSizes } from './utils/imageOptimizer';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const GALLERY_COLUMNS = 2;
const PADDING = 8;
const COLUMN_WIDTH = (screenWidth - PADDING * (GALLERY_COLUMNS + 1)) / GALLERY_COLUMNS;

interface ArticleViewerModalProps {
  article: NewsArticle | null;
  visible: boolean;
  onClose: () => void;
}

// Section types for FlatList
type SectionType = 'HEADER' | 'ACTIONS' | 'CONTENT' | 'GALLERY_SEPARATOR' | 'GALLERY_IMAGE' | 'BOTTOM_PADDING';

interface SectionItem {
  id: string;
  type: SectionType;
  data?: any;
}

// Memoized gallery image component with progressive loading
const GalleryImageItem = React.memo(({
  url,
  index,
  isNightMode,
  onPress,
}: {
  url: string;
  index: number;
  isNightMode: boolean;
  onPress: () => void;
}) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [currentImageUrl, setCurrentImageUrl] = React.useState<string>('');
  const isLeftColumn = index % 2 === 0;

  React.useEffect(() => {
    // Start with thumbnail, then load full image
    const sizes = getWordPressImageSizes(url);

    // Load thumbnail first
    setCurrentImageUrl(sizes.thumbnail);

    // Then load the full image
    const loadFullImage = async () => {
      try {
        await Image.prefetch(url);
        setCurrentImageUrl(url);
      } catch {
        // Keep thumbnail if full image fails
      }
    };

    loadFullImage();
  }, [url]);

  return (
    <TouchableOpacity
      style={[
        styles.galleryImageContainer,
        { width: COLUMN_WIDTH },
        !isLeftColumn && { marginLeft: PADDING },
      ]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <Image
        source={{ uri: currentImageUrl || url }}
        style={styles.galleryImage}
        contentFit="cover"
        transition={300}
        onLoad={() => setIsLoaded(true)}
        recyclingKey={url}
        cachePolicy="memory-disk"
        priority="low"
      />

      {!isLoaded && (
        <View style={styles.imageLoadingOverlay}>
          <ActivityIndicator size="small" color={tokens.colors.najdi.primary} />
        </View>
      )}
    </TouchableOpacity>
  );
});

GalleryImageItem.displayName = 'GalleryImageItem';

const ArticleViewerModal: React.FC<ArticleViewerModalProps> = ({
  article,
  visible,
  onClose,
}) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const { settings } = useSettings();

  // Refs for non-render values
  const hasProcessedRef = useRef(false);
  const lastArticleIdRef = useRef<number | null>(null);

  // State - only what triggers renders
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);
  const [readingProgress, setReadingProgress] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [isNightMode, setIsNightMode] = useState(false);
  const [isContentReady, setIsContentReady] = useState(false);

  // Animation values
  const animatedPosition = useSharedValue(0);
  const scrollY = useSharedValue(0);

  // Cache management
  const { getCachedArticle, cacheArticle, clearOldCache } = useArticleCache();

  // Image preloading
  const { preloadImages, cancelPreloading } = useImagePreloader();

  // Initialize with empty data for instant opening
  const [articleData, setArticleData] = useState({
    processedContent: '',
    galleryImages: [] as string[],
    wordCount: 0,
    readingTime: 0,
    isValid: false
  });

  // Process article content asynchronously
  useEffect(() => {
    if (!article) {
      setIsContentReady(false);
      return;
    }

    // Open immediately with skeleton
    setIsContentReady(false);

    // Process content asynchronously
    const processContentAsync = async () => {
      // Small delay to ensure smooth opening animation
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!article.html || article.html.length === 0) {
        setArticleData({
          processedContent: '',
          galleryImages: [],
          wordCount: 0,
          readingTime: 0,
          isValid: false
        });
        setIsContentReady(true);
        return;
      }

      // Extract gallery and process content
      const { content, galleryImages: gallery } = extractGalleryImages(article.html);

      // Calculate reading metrics
      const wordCount = article.html.replace(/<[^>]*>/g, '').split(/\s+/).length;
      const readingTime = Math.ceil(wordCount / 200);

      setArticleData({
        processedContent: content,
        galleryImages: gallery,
        wordCount,
        readingTime,
        isValid: true
      });

      // Cache the article
      cacheArticle(article);

      // Start preloading gallery images
      if (gallery.length > 0) {
        preloadImages(gallery.slice(0, 3));
      }

      setIsContentReady(true);
    };

    processContentAsync();
  }, [article?.id, cacheArticle, preloadImages]);

  // Create sections for FlatList
  const sections = useMemo(() => {
    if (!articleData.isValid || !article) return [];

    const items: SectionItem[] = [];

    // Add header section
    items.push({
      id: 'header',
      type: 'HEADER',
      data: {
        article,
        readingTime: articleData.readingTime,
        wordCount: articleData.wordCount,
        scrollY,
        isNightMode,
      }
    });

    // Add actions section
    items.push({
      id: 'actions',
      type: 'ACTIONS',
      data: {
        article,
        fontSize,
        isNightMode,
        readingProgress,
      }
    });

    // Add content section
    items.push({
      id: 'content',
      type: 'CONTENT',
      data: {
        html: articleData.processedContent,
        fontSize,
        isNightMode,
        settings,
      }
    });

    // Add gallery sections if images exist
    if (articleData.galleryImages.length > 0) {
      // Add separator
      items.push({
        id: 'gallery-separator',
        type: 'GALLERY_SEPARATOR',
        data: {
          imageCount: articleData.galleryImages.length,
        }
      });

      // Add gallery images as pairs for 2-column layout
      for (let i = 0; i < articleData.galleryImages.length; i += GALLERY_COLUMNS) {
        const imageRow: string[] = [];
        for (let j = 0; j < GALLERY_COLUMNS && i + j < articleData.galleryImages.length; j++) {
          imageRow.push(articleData.galleryImages[i + j]);
        }

        items.push({
          id: `gallery-row-${i}`,
          type: 'GALLERY_IMAGE',
          data: {
            images: imageRow,
            startIndex: i,
          }
        });
      }
    }

    // Add bottom padding
    items.push({
      id: 'bottom-padding',
      type: 'BOTTOM_PADDING',
      data: null
    });

    return items;
  }, [article, articleData, fontSize, isNightMode, settings, readingProgress, scrollY]);

  // Snap points derived from article data
  const snapPoints = useMemo(() => {
    if (!article) return ['50%'];

    const baseSnaps = ['50%', '92%'];

    // Add full screen snap if there's a gallery
    if (articleData.galleryImages.length > 0) {
      baseSnaps.push('100%');
    }

    return baseSnaps;
  }, [article, articleData.galleryImages.length]);

  // Handle invalid article
  useEffect(() => {
    if (isContentReady && !articleData.isValid && article) {
      if (article.permalink) {
        Linking.openURL(article.permalink).catch(() => {
          Alert.alert('تعذر فتح الرابط', 'حاول مرة أخرى لاحقاً.');
        });
      } else {
        Alert.alert('لا يوجد محتوى', 'هذا المقال لا يحتوي على محتوى للعرض.');
      }
      onClose();
    }
  }, [isContentReady, articleData.isValid, article, onClose]);

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

    // Progressive image preloading based on engagement
    if (articleData.galleryImages.length > 0) {
      if (index === 1 && articleData.galleryImages.length > 6) {
        // User engaged more - preload next batch
        preloadImages(articleData.galleryImages.slice(6, 18));
      } else if (index === 2 && articleData.galleryImages.length > 18) {
        // Full screen - preload all remaining
        preloadImages(articleData.galleryImages.slice(18));
      }
    }
  }, [articleData.galleryImages, preloadImages]);

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

  // Handle gallery image press
  const handleGalleryImagePress = useCallback((url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('معاينة', 'سيتم فتح معاينة الصورة بالحجم الكامل قريباً');
  }, []);

  // Render different section types
  const renderItem = useCallback(({ item }: ListRenderItemInfo<SectionItem>) => {
    switch (item.type) {
      case 'HEADER':
        return (
          <ArticleHeader
            article={item.data.article}
            readingTime={item.data.readingTime}
            wordCount={item.data.wordCount}
            scrollY={item.data.scrollY}
            isNightMode={item.data.isNightMode}
          />
        );

      case 'ACTIONS':
        return (
          <ArticleActions
            article={item.data.article}
            fontSize={item.data.fontSize}
            onFontSizeChange={adjustFontSize}
            isNightMode={item.data.isNightMode}
            onToggleNightMode={toggleNightMode}
            readingProgress={item.data.readingProgress}
          />
        );

      case 'CONTENT':
        return (
          <ArticleContent
            html={item.data.html}
            fontSize={item.data.fontSize}
            isNightMode={item.data.isNightMode}
            settings={item.data.settings}
          />
        );

      case 'GALLERY_SEPARATOR':
        return (
          <View style={styles.gallerySeparator}>
            <View style={styles.separatorLine} />
            <Text style={styles.galleryTitle}>
              📸 {item.data.imageCount} صور من الحدث
            </Text>
            <View style={styles.separatorLine} />
          </View>
        );

      case 'GALLERY_IMAGE':
        return (
          <View style={styles.galleryRow}>
            {item.data.images.map((url: string, index: number) => (
              <GalleryImageItem
                key={url}
                url={url}
                index={item.data.startIndex + index}
                isNightMode={isNightMode}
                onPress={() => handleGalleryImagePress(url)}
              />
            ))}
            {/* Add empty space for incomplete rows */}
            {item.data.images.length < GALLERY_COLUMNS && (
              <View
                style={{
                  width: COLUMN_WIDTH * (GALLERY_COLUMNS - item.data.images.length) + PADDING * (GALLERY_COLUMNS - item.data.images.length - 1),
                  marginLeft: PADDING,
                }}
              />
            )}
          </View>
        );

      case 'BOTTOM_PADDING':
        return <View style={{ height: 100 }} />;

      default:
        return null;
    }
  }, [adjustFontSize, toggleNightMode, handleGalleryImagePress, isNightMode]);

  // Key extractor
  const keyExtractor = useCallback((item: SectionItem) => item.id, []);

  // Imperative handle for sheet control
  const openSheet = useCallback(() => {
    if (article && visible) {
      // Open immediately without waiting for content
      bottomSheetRef.current?.present();
    }
  }, [article, visible]);

  const closeSheet = useCallback(() => {
    bottomSheetRef.current?.dismiss();
    // Reset state
    cancelPreloading();
    setReadingProgress(0);
    lastArticleIdRef.current = null;
    hasProcessedRef.current = false;
  }, [cancelPreloading]);

  // Single effect for visibility changes
  useEffect(() => {
    if (visible && article) {
      openSheet();
    } else {
      closeSheet();
    }
  }, [visible, article?.id]); // Only depend on article.id to avoid unnecessary calls

  // Clear old cache once on mount
  useEffect(() => {
    clearOldCache();
  }, []); // Empty deps is intentional - only run once

  if (!article) return null;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      animatedPosition={animatedPosition}
      onChange={handleSheetChange}
      onDismiss={onClose}
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
      // Modal-specific optimizations
      enableDismissOnClose={true}
      stackBehavior="push"
    >
      {!isContentReady ? (
        <ArticleSkeletonLoader
          isNightMode={isNightMode}
          hasImage={!!article?.heroImage}
        />
      ) : !articleData.isValid ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>لا يمكن عرض المحتوى</Text>
        </View>
      ) : (
        <BottomSheetFlatList
          data={sections}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          style={[styles.container, isNightMode && styles.containerDark]}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            scrollY.value = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          removeClippedSubviews={true}
          maxToRenderPerBatch={5}
          updateCellsBatchingPeriod={50}
          initialNumToRender={3}
          windowSize={10}
        />
      )}
    </BottomSheetModal>
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
  errorText: {
    fontSize: 16,
    color: tokens.colors.najdi.textMuted,
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
  galleryRow: {
    flexDirection: 'row',
    paddingHorizontal: PADDING,
    marginBottom: PADDING,
  },
  galleryImageContainer: {
    height: COLUMN_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// Export with provider wrapper for standalone use
export default ArticleViewerModal;

// Also export the raw component for use within existing provider
export { ArticleViewerModal as ArticleViewerModalRaw };