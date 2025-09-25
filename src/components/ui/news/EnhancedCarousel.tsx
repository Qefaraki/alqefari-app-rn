import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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
const CARD_WIDTH = Math.floor(SCREEN_WIDTH * 0.88); // 88% of screen width for better focus
const CARD_SPACING = 16; // Slightly more spacing for depth
const PEEK_WIDTH = (SCREEN_WIDTH - CARD_WIDTH) / 2;

// Single carousel card component with animations
const CarouselCard: React.FC<{
  article: NewsArticle;
  onPress: () => void;
  index: number;
  scrollX: Animated.SharedValue<number>;
}> = ({ article, onPress, index, scrollX }) => {
  const relativeDate = useRelativeDateNoMemo(article.publishedAt);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  // Calculate input range for this card
  const inputRange = [
    (index - 1) * (CARD_WIDTH + CARD_SPACING),
    index * (CARD_WIDTH + CARD_SPACING),
    (index + 1) * (CARD_WIDTH + CARD_SPACING),
  ];

  // Animated styles for scale and rotation with spring physics
  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.88, 1, 0.88],
      Extrapolation.CLAMP
    );

    const rotateY = interpolate(
      scrollX.value,
      inputRange,
      ['12deg', '0deg', '-12deg'],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.6, 1, 0.6],
      Extrapolation.CLAMP
    );

    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [10, 0, 10],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { scale: withSpring(scale, { damping: 15, stiffness: 150 }) },
        { perspective: 1000 },
        { rotateY },
        { translateY },
      ],
      opacity,
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <Surface style={styles.card} radius={8}>
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
    </Animated.View>
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
  const scrollX = useSharedValue(0);
  const scrollHintAnim = useSharedValue(0);

  // Auto-scroll hint animation on mount
  useEffect(() => {
    if (articles.length > 1 && !loading) {
      // Delay the hint slightly
      const timer = setTimeout(() => {
        // Also do actual scroll hint
        if (flatListRef.current) {
          flatListRef.current.scrollToOffset({ offset: 50, animated: true });
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }, 400);
        }
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [articles.length, loading]);

  // Calculate snap offsets for each card
  const snapOffsets = useMemo(() => {
    const offsets = [];
    const itemCount = loading ? 3 : articles.length;
    for (let i = 0; i < itemCount; i++) {
      offsets.push(i * (CARD_WIDTH + CARD_SPACING));
    }
    return offsets;
  }, [articles.length, loading]);

  // Handle scroll events for infinite loading and animations
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / (CARD_WIDTH + CARD_SPACING));

      // Update shared value for animations
      scrollX.value = offsetX;

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
    [currentIndex, onReachEnd, loadingMore, loading, scrollX]
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
            scrollX={scrollX}
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
        decelerationRate={0.985} // Smoother deceleration
        pagingEnabled={false}
        snapToInterval={CARD_WIDTH + CARD_SPACING} // Magnetic snapping
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
    backgroundColor: '#F9F7F3',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D1BBA31A',
  },
  cardPressable: {
    flex: 1,
  },
  heroImage: {
    width: '100%',
    height: 220, // Slightly taller for better proportions
    backgroundColor: '#D1BBA310',
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1BBA320',
  },
  cardContent: {
    padding: 24,
    gap: 12,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#242121',
    lineHeight: 26,
    letterSpacing: -0.3,
    fontFamily: 'SF Arabic',
  },
  cardSummary: {
    fontSize: 15,
    color: '#242121B3',
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