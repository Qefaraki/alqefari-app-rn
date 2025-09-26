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
import { getColors } from 'react-native-image-colors';
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
        setBgColor(cached);
        return;
      }

      // Extract colors using react-native-image-colors
      getColors(article.heroImage, {
        fallback: fallbackColors[index % fallbackColors.length],
        cache: true,
        key: article.heroImage,
        quality: Platform.OS === 'ios' ? 'low' : 'low'
      }).then(colors => {
        if (colors) {
          let selectedColor = fallbackColors[index % fallbackColors.length];

          if (colors.platform === 'ios') {
            // iOS returns: background, primary, secondary, detail
            // Try to use primary or secondary color (usually more vibrant)
            selectedColor = colors.primary || colors.secondary || colors.background || selectedColor;
          } else if (colors.platform === 'android') {
            // Android returns: dominant, vibrant, darkVibrant, lightVibrant, muted, darkMuted, lightMuted
            selectedColor = colors.vibrant || colors.dominant || colors.darkVibrant || selectedColor;
          } else if (colors.platform === 'web') {
            // Web returns: dominant, vibrant, darkVibrant, lightVibrant, muted, darkMuted, lightMuted
            selectedColor = colors.vibrant || colors.dominant || selectedColor;
          }

          // Ensure we have a valid color
          if (selectedColor && selectedColor !== '#000000' && selectedColor !== '#FFFFFF') {
            colorCache.set(article.heroImage, selectedColor);
            setBgColor(selectedColor);
          } else {
            // Use fallback if extracted color is black or white
            const fallback = fallbackColors[index % fallbackColors.length];
            setBgColor(fallback);
          }
        } else {
          // No colors extracted, use fallback
          const fallback = fallbackColors[index % fallbackColors.length];
          setBgColor(fallback);
        }
      }).catch(err => {
        console.log('Color extraction error:', err);
        // Use fallback on error
        const fallback = fallbackColors[index % fallbackColors.length];
        setBgColor(fallback);
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
          backgroundColor: `${bgColor}35`, // 35% opacity
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