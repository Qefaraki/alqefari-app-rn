import React, { useMemo } from 'react';
import { FlatList, ImageBackground, StyleSheet, View } from 'react-native';
import tokens from '../tokens';
import NewsCard from './NewsCard';
import { NewsArticle } from '../../../services/news';
import Surface from '../Surface';
import SkeletonLoader, { SkeletonText } from '../SkeletonLoader';
import { ActivityIndicator } from 'react-native';

type Props = {
  articles: NewsArticle[];
  loading?: boolean;
  onArticlePress: (article: NewsArticle) => void;
  renderSubtitle: (article: NewsArticle) => string;
  onEndReached?: () => void;
  loadingMore?: boolean;
};

const patternSource = require('../../../../assets/sadu_patterns/png/14.png');

const FeaturedNewsCarousel: React.FC<Props> = ({
  articles,
  loading = false,
  onArticlePress,
  renderSubtitle,
  onEndReached,
  loadingMore = false,
}) => {
  const data = useMemo(() => (loading ? Array.from({ length: 3 }) : articles), [loading, articles]);

  return (
    <View style={styles.wrapper}>
      <ImageBackground source={patternSource} resizeMode="cover" style={styles.pattern} imageStyle={styles.patternImage} />
      <FlatList
        horizontal
        data={data as any[]}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyExtractor={(_, index) => `featured-${index}`}
        onEndReachedThreshold={0.6}
        onEndReached={onEndReached}
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
                subtitle={renderSubtitle(article)}
                onPress={() => onArticlePress(article)}
              />
            </View>
          );
        }}
        ListFooterComponent={
          loadingMore && !loading ? (
            <View style={styles.loaderWrapper}>
              <ActivityIndicator size="small" color={tokens.colors.najdi.primary} />
            </View>
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
        isFirst && { marginLeft: 16 },
        isLast && { marginRight: 16 },
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
    paddingRight: 16,
  },
  cardWrapper: {
    marginRight: 12,
  },
  cardWrapperFirst: {
    marginLeft: 16,
  },
  cardWrapperLast: {
    marginRight: 16,
  },
  skeletonCard: {
    width: 300,
    marginRight: 12,
    backgroundColor: tokens.colors.najdi.background,
  },
  skeletonImage: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  skeletonContent: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  skeletonLine: {
    marginBottom: 8,
  },
  loaderWrapper: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default FeaturedNewsCarousel;
