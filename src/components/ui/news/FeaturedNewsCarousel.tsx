import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Dimensions, FlatList, ImageBackground, NativeSyntheticEvent, NativeScrollEvent, StyleSheet, View } from 'react-native';
import tokens from '../tokens';
import NewsCard from './NewsCard';
import { NewsArticle } from '../../../services/news';
import Surface from '../Surface';
import SkeletonLoader, { SkeletonText } from '../SkeletonLoader';

type Props = {
  articles: NewsArticle[];
  loading?: boolean;
  onArticlePress: (article: NewsArticle) => void;
  onEndReached?: () => void;
  loadingMore?: boolean;
  onMomentumScrollEnd?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const patternSource = require('../../../../assets/sadu_patterns/png/14.png');
const SCREEN_WIDTH = Dimensions.get('window').width;
const HORIZONTAL_PADDING = 16;
const CARD_SPACING = 12;
// Simpler card width calculation - 85% of screen width for better visibility
const CARD_WIDTH = Math.floor(SCREEN_WIDTH * 0.85);
const SNAP_INTERVAL = CARD_WIDTH + CARD_SPACING;

const FeaturedNewsCarousel: React.FC<Props> = ({
  articles,
  loading = false,
  onArticlePress,
  onEndReached,
  loadingMore = false,
  onMomentumScrollEnd,
}) => {
  const data = useMemo(() => (loading ? Array.from({ length: 3 }) : articles), [loading, articles]);
  const listRef = useRef<FlatList<any>>(null);
  const offsetRef = useRef(0);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetRef.current = event.nativeEvent.contentOffset.x;
  }, []);

  useEffect(() => {
    if (loading || !articles.length) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: offsetRef.current, animated: false });
    });
  }, [articles.length, loading]);

  return (
    <View style={styles.wrapper}>
      <ImageBackground source={patternSource} resizeMode="cover" style={styles.pattern} imageStyle={styles.patternImage} />
      <FlatList
        ref={listRef}
        horizontal
        data={data as any[]}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyExtractor={(item, index) =>
          loading ? `featured-loading-${index}` : `featured-${(item as NewsArticle).id}`
        }
        onEndReachedThreshold={0.6}
        onEndReached={onEndReached}
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        pagingEnabled={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item, index }) => {
          if (loading) {
            return <FeaturedSkeleton index={index} count={data.length} />;
          }

          const article = item as NewsArticle;
          const isFirst = index === 0;
          const isLast = index === data.length - 1;
          return (
            <View
              style={[
                styles.cardWrapper,
                isFirst && styles.cardWrapperFirst,
                isLast && styles.cardWrapperLast,
              ]}
            >
              <NewsCard
                article={article}
                onPress={() => onArticlePress(article)}
              />
            </View>
          );
        }}
        ListFooterComponent={
          loadingMore && !loading ? (
            <FeaturedSkeleton index={0} count={1} />
          ) : null
        }
      />
    </View>
  );
};

const FeaturedSkeleton: React.FC<{ index: number; count?: number }> = ({ index, count = 3 }) => {
  const isFirst = index === 0;
  const isLast = index === count - 1;
  return (
    <Surface
      style={[
        styles.skeletonCard,
        isFirst && { marginLeft: 0 },
        isLast && { marginRight: 0 },
      ]}
      radius={18}
    >
      <SkeletonLoader height={160} style={styles.skeletonImage} />
      <View style={styles.skeletonContent}>
        <SkeletonLoader width="80%" height={20} style={styles.skeletonLine} />
        <SkeletonText lines={2} />
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    paddingVertical: 12,
  },
  pattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.12,
  },
  patternImage: {
    transform: [{ scale: 1.1 }],
  },
  listContent: {
    paddingVertical: 4,
    // No horizontal padding - cards handle their own spacing
  },
  cardWrapper: {
    marginRight: CARD_SPACING,
  },
  cardWrapperFirst: {
    marginLeft: HORIZONTAL_PADDING, // Edge spacing for first item
  },
  cardWrapperLast: {
    marginRight: HORIZONTAL_PADDING, // Edge spacing for last item
  },
  skeletonCard: {
    width: CARD_WIDTH,
    marginRight: CARD_SPACING,
    backgroundColor: tokens.colors.najdi.background,
    borderWidth: 1,
    borderColor: `${tokens.colors.najdi.container}30`,
  },
  skeletonImage: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: `${tokens.colors.najdi.container}20`,
  },
  skeletonContent: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  skeletonLine: {
    marginBottom: 8,
  },
});

export default FeaturedNewsCarousel;
