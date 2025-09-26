import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getAllSwatches, getNamedSwatches } from 'react-native-palette';
import { Image } from 'expo-image';
import { NewsArticle } from '../../../services/news';
import CachedImage from '../../CachedImage';
import tokens from '../tokens';
import Surface from '../Surface';
import { useRelativeDateNoMemo } from '../../../hooks/useFormattedDateNoMemo';

// Map cache for extracted colors (using URL as key)
const colorCache = new Map<string, string>();

// Fallback colors for cards without images
const fallbackColors = [
  '#A13333', // Najdi Crimson
  '#D58C4A', // Desert Ochre
  '#8B5A3C', // Brown
  '#704214', // Dark Bronze
  '#5C4033', // Coffee
];

interface EnhancedCarouselProps {
  articles: NewsArticle[];
  onArticlePress: (article: NewsArticle) => void;
  onReachEnd?: () => void;
  loading?: boolean;
  loadingMore?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.floor(SCREEN_WIDTH * 0.85); // 85% of screen width
const CARD_SPACING = 12;
const PEEK_WIDTH = (SCREEN_WIDTH - CARD_WIDTH) / 2;

// Single carousel card component
const CarouselCard: React.FC<{
  article: NewsArticle;
  onPress: () => void;
  index?: number;
}> = ({ article, onPress, index = 0 }) => {
  const relativeDate = useRelativeDateNoMemo(article.publishedAt);
  const [bgColor, setBgColor] = useState<string | null>(null);
  const imageRef = useRef<string | null>(null); // Initialize as null

  // Extract color from hero image
  useEffect(() => {
    if (article.heroImage) {
      // Check if we've already processed this image
      if (imageRef.current === article.heroImage) {
        return;
      }
      imageRef.current = article.heroImage;

      // Check cache first
      const cached = colorCache.get(article.heroImage);
      if (cached) {
        console.log('Using cached color:', cached);
        setBgColor(cached);
        return;
      }

      console.log('Extracting color from:', article.heroImage);
      console.log('Platform:', Platform.OS);

      // Try different quality on iOS
      const quality = Platform.OS === 'ios' ? 'high' : 'low';

      // Extract new color
      getAllSwatches({ quality, alpha: 1 }, article.heroImage, (err, swatches) => {
        console.log('Raw error:', err);
        console.log('Raw swatches:', JSON.stringify(swatches, null, 2));
        if (err) {
          console.log('Color extraction error:', err);

          // Try prefetching and extracting from cached version
          console.log('Trying to prefetch and extract...');
          Image.prefetch(article.heroImage).then(() => {
            getAllSwatches({ quality: 'high', alpha: 1 }, article.heroImage, (err2, swatches2) => {
              if (!err2 && swatches2 && swatches2.length > 1) {
                console.log('Prefetch extraction worked!', swatches2);
                processSwatches(swatches2);
              } else {
                console.log('Prefetch extraction also failed');
                useFallback();
              }
            });
          }).catch(() => {
            console.log('Prefetch failed');
            useFallback();
          });
        } else if (swatches && swatches.length > 0) {
          processSwatches(swatches);
        } else {
          console.log('No swatches found');
          useFallback();
        }

        function processSwatches(swatches: any[]) {
          // Log all swatches to debug
          console.log('Processing swatches:', swatches.map(s => ({
            hex: s.hex,
            population: s.population,
            color: s.color
          })));

          // Sort by population to get most dominant colors
          const sortedSwatches = [...swatches].sort((a, b) =>
            (parseInt(b.population) || 0) - (parseInt(a.population) || 0)
          );

          // Find first non-black/non-white color
          const vibrantColor = sortedSwatches.find(swatch => {
            const hex = swatch.hex?.toUpperCase();
            // Skip blacks, whites, and very dark colors
            return hex &&
              hex !== '#000000FF' &&
              hex !== '#FFFFFFFF' &&
              !hex.startsWith('#000') &&
              !hex.startsWith('#FFF') &&
              !hex.startsWith('#0') &&
              !hex.startsWith('#1') &&
              !hex.startsWith('#2');
          });

          // Use vibrant color, or any non-black color, or fallback
          const selectedColor = vibrantColor?.hex ||
            sortedSwatches.find(s => s.hex && s.hex.toUpperCase() !== '#000000FF')?.hex ||
            fallbackColors[index % fallbackColors.length];

          console.log('Selected color:', selectedColor);
          colorCache.set(article.heroImage, selectedColor);
          setBgColor(selectedColor);
        }

        function useFallback() {
          const fallback = fallbackColors[index % fallbackColors.length];
          console.log('Using fallback:', fallback);
          setBgColor(fallback);
        }
      });
    } else {
      // No image, use fallback color
      const fallback = fallbackColors[index % fallbackColors.length];
      setBgColor(fallback);
    }
  }, [article.heroImage, index]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Surface
      style={[
        styles.card,
        bgColor && {
          backgroundColor: bgColor.startsWith('#') ? `${bgColor.slice(0, 7)}35` : `${bgColor}35`, // 35% opacity, handle RGBA hex
        }
      ]}
      radius={8}
    >
      <Pressable
        style={styles.cardPressable}
        onPress={handlePress}
        android_ripple={{ color: 'rgba(0,0,0,0.04)' }}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`مقال مميز: ${article.title}`}
        accessibilityHint={`اضغط لفتح المقال. ${relativeDate}`}
      >
        {/* Hero Image */}
        {article.heroImage ? (
          <CachedImage
            source={{ uri: article.heroImage }}
            style={styles.heroImage}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <Ionicons name="image-outline" size={32} color={tokens.colors.najdi.textMuted} />
          </View>
        )}

        {/* Content */}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {article.title}
          </Text>
          {article.summary && (
            <Text style={styles.cardSummary} numberOfLines={2}>
              {article.summary}
            </Text>
          )}
          <Text style={styles.cardDate}>{relativeDate}</Text>
        </View>
      </Pressable>
    </Surface>
  );
};

// Skeleton loading card
const SkeletonCard: React.FC = () => (
  <Surface style={styles.card} radius={8}>
    <View style={styles.cardPressable}>
      <View style={[styles.heroImage, styles.skeletonImage]} />
      <View style={styles.cardContent}>
        <View style={[styles.skeletonLine, { width: '80%', height: 16, marginBottom: 8 }]} />
        <View style={[styles.skeletonLine, { width: '60%', height: 16, marginBottom: 12 }]} />
        <View style={[styles.skeletonLine, { width: '90%', height: 12, marginBottom: 4 }]} />
        <View style={[styles.skeletonLine, { width: '70%', height: 12, marginBottom: 12 }]} />
        <View style={[styles.skeletonLine, { width: 80, height: 10 }]} />
      </View>
    </View>
  </Surface>
);

const EnhancedCarousel: React.FC<EnhancedCarouselProps> = ({
  articles,
  onArticlePress,
  onReachEnd,
  loading = false,
  loadingMore = false,
}) => {
  const flatListRef = useRef<FlatList<NewsArticle>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Calculate snap offsets for each card
  const snapOffsets = useMemo(() => {
    const offsets = [];
    const itemCount = loading ? 3 : articles.length;
    for (let i = 0; i < itemCount; i++) {
      offsets.push(i * (CARD_WIDTH + CARD_SPACING));
    }
    return offsets;
  }, [articles.length, loading]);

  // Handle scroll events for infinite loading
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / (CARD_WIDTH + CARD_SPACING));

      // Haptic feedback on card change
      if (index !== currentIndex) {
        Haptics.selectionAsync();
        setCurrentIndex(index);
      }

      // Check if we're near the end (last 3 cards from end)
      const contentWidth = event.nativeEvent.contentSize.width;
      const scrolledNearEnd = offsetX + SCREEN_WIDTH >= contentWidth - (CARD_WIDTH * 3);

      if (scrolledNearEnd && onReachEnd && !loadingMore && !loading) {
        onReachEnd();
      }
    },
    [currentIndex, onReachEnd, loadingMore, loading]
  );

  // Render individual item
  const renderItem = useCallback(
    ({ item, index }: { item: NewsArticle | null; index: number }) => {
      if (loading || !item) {
        return (
          <View
            style={[
              styles.cardWrapper,
              index === 0 && styles.firstCard,
              index === 2 && styles.lastCard,
            ]}
          >
            <SkeletonCard />
          </View>
        );
      }

      const isFirst = index === 0;
      const isLast = index === articles.length - 1;

      return (
        <View
          style={[
            styles.cardWrapper,
            isFirst && styles.firstCard,
            isLast && styles.lastCard,
          ]}
        >
          <CarouselCard
            article={item}
            onPress={() => onArticlePress(item)}
            index={index}
          />
        </View>
      );
    },
    [loading, articles.length, onArticlePress]
  );

  // Key extractor
  const keyExtractor = useCallback(
    (item: NewsArticle | null, index: number) => {
      if (loading || !item) return `skeleton-${index}`;
      return `carousel-${item.id}`;
    },
    [loading]
  );

  // Data for FlatList
  const data = loading
    ? [null, null, null] as (NewsArticle | null)[]
    : articles;

  // Get item layout for better performance
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: CARD_WIDTH + CARD_SPACING,
      offset: (CARD_WIDTH + CARD_SPACING) * index,
      index,
    }),
    []
  );

  return (
    <View style={styles.container}>
      {/* Carousel - No pattern overlay */}
      <FlatList
        ref={flatListRef}
        horizontal
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        showsHorizontalScrollIndicator={false}
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        decelerationRate="fast"
        pagingEnabled={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.contentContainer}
        ListFooterComponent={
          loadingMore && !loading ? (
            <View style={styles.loadingMore}>
              <SkeletonCard />
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  contentContainer: {
    paddingVertical: 4,
  },
  cardWrapper: {
    width: CARD_WIDTH,
    marginRight: CARD_SPACING,
  },
  firstCard: {
    marginLeft: PEEK_WIDTH,
  },
  lastCard: {
    marginRight: PEEK_WIDTH,
  },
  card: {
    backgroundColor: tokens.colors.najdi.background, // Al-Jass White
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D1BBA31A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressable: {
    flex: 1,
  },
  heroImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#D1BBA310',
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1BBA320',
  },
  cardContent: {
    padding: 20,
    gap: 10,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
    lineHeight: 26,
    letterSpacing: -0.3,
    fontFamily: 'SF Arabic',
  },
  cardSummary: {
    fontSize: 15,
    color: tokens.colors.najdi.textMuted,
    lineHeight: 22,
    fontFamily: 'SF Arabic',
  },
  cardDate: {
    fontSize: 12,
    color: '#24212180',
    marginTop: 6,
    fontWeight: '500',
    fontFamily: 'SF Arabic',
  },
  loadingMore: {
    marginRight: CARD_SPACING,
  },

  // Skeleton styles
  skeletonImage: {
    backgroundColor: `${tokens.colors.najdi.container}20`,
  },
  skeletonLine: {
    backgroundColor: `${tokens.colors.najdi.container}30`,
    borderRadius: 6,
  },
});

export default EnhancedCarousel;