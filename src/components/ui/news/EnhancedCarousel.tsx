import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
  ImageBackground,
  Text,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NewsArticle } from '../../../services/news';
import CachedImage from '../../CachedImage';
import tokens from '../tokens';
import Surface from '../Surface';
import { useRelativeDateNoMemo } from '../../../hooks/useFormattedDateNoMemo';

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
}> = ({ article, onPress }) => {
  const relativeDate = useRelativeDateNoMemo(article.publishedAt);

  return (
    <Surface style={styles.card} radius={18}>
      <Pressable
        style={styles.cardPressable}
        onPress={onPress}
        android_ripple={{ color: 'rgba(0,0,0,0.04)' }}
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
  <Surface style={styles.card} radius={18}>
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

  // Handle scroll events for pagination dots
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / (CARD_WIDTH + CARD_SPACING));
      setCurrentIndex(index);

      // Check if we need to load more
      const contentWidth = event.nativeEvent.contentSize.width;
      const scrollPercentage = (offsetX + SCREEN_WIDTH) / contentWidth;

      if (scrollPercentage > 0.7 && onReachEnd && !loadingMore) {
        onReachEnd();
      }
    },
    [onReachEnd, loadingMore]
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
      {/* Background pattern */}
      <ImageBackground
        source={require('../../../../assets/sadu_patterns/png/14.png')}
        style={styles.pattern}
        imageStyle={styles.patternImage}
      />

      {/* Carousel */}
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
    position: 'relative',
    paddingVertical: 12,
  },
  pattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  patternImage: {
    opacity: 0.08,
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
    backgroundColor: tokens.colors.najdi.background,
    overflow: 'hidden',
  },
  cardPressable: {
    flex: 1,
  },
  heroImage: {
    width: '100%',
    height: 180,
    backgroundColor: `${tokens.colors.najdi.container}10`,
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${tokens.colors.najdi.container}20`,
  },
  cardContent: {
    padding: 18,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
    lineHeight: 24,
  },
  cardSummary: {
    fontSize: 14,
    color: tokens.colors.najdi.textMuted,
    lineHeight: 20,
  },
  cardDate: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    marginTop: 4,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: `${tokens.colors.najdi.container}40`,
  },
  paginationDotActive: {
    width: 18,
    backgroundColor: tokens.colors.najdi.primary,
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