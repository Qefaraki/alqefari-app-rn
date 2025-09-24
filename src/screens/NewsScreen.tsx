import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  FlatList,
  ImageBackground,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNewsStore } from '../stores/useNewsStore';
import { useFormattedDate, useRelativeDate, useAbsoluteDate } from '../hooks/useFormattedDate';
import { useDebounce } from '../hooks/useDebounce';
import FeaturedNewsCarousel from '../components/ui/news/FeaturedNewsCarousel';
import { RecentArticleItem, RecentArticleSkeleton } from '../components/ui/news/RecentArticleItem';
import { NewsArticle, stripHtmlForDisplay } from '../services/news';
import tokens from '../components/ui/tokens';
import NetworkError from '../components/NetworkError';

// Helper component to properly handle date formatting with hooks
const ArticleWithDate: React.FC<{ article: NewsArticle; onPress: () => void }> = ({ article, onPress }) => {
  const subtitle = useRelativeDate(article.publishedAt);
  return (
    <RecentArticleItem
      article={article}
      subtitle={subtitle}
      onPress={onPress}
    />
  );
};

const NewsScreen: React.FC = () => {
  // Ref to track scroll position and prevent jumps
  const flatListRef = useRef<FlatList>(null);
  const scrollPositionRef = useRef(0);

  const featured = useNewsStore((state) => state.featured);
  const recent = useNewsStore((state) => state.recent);
  const status = useNewsStore((state) => state.status);
  const errorMessage = useNewsStore((state) => state.errorMessage);
  const isRefreshing = useNewsStore((state) => state.isRefreshing);
  const loadInitial = useNewsStore((state) => state.loadInitial);
  const refresh = useNewsStore((state) => state.refresh);
  const loadMoreRecent = useNewsStore((state) => state.loadMoreRecent);
  const loadMoreFeatured = useNewsStore((state) => state.loadMoreFeatured);
  const prefetchRecent = useNewsStore((state) => state.prefetchRecent);
  const prefetchFeatured = useNewsStore((state) => state.prefetchFeatured);
  const isLoadingMoreRecent = useNewsStore((state) => state.isLoadingMoreRecent);
  const isLoadingMoreFeatured = useNewsStore((state) => state.isLoadingMoreFeatured);
  const hasMoreRecent = useNewsStore((state) => state.hasMoreRecent);
  const hasMoreFeatured = useNewsStore((state) => state.hasMoreFeatured);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Use the new unified date formatting hook for header
  const headerDate = useAbsoluteDate(new Date());

  const handleOpenArticle = useCallback((article: NewsArticle) => {
    if (article.permalink) {
      Linking.openURL(article.permalink).catch(() => {
        Alert.alert('تعذر فتح الرابط', 'حاول مرة أخرى لاحقاً.');
      });
      return;
    }

    Alert.alert('لا يوجد رابط', stripHtmlForDisplay(article.summary || ''));
  }, []);

  // Debounced load more to prevent multiple triggers
  const handleLoadMoreRecent = useDebounce(() => {
    if (!hasMoreRecent || isLoadingMoreRecent || status !== 'ready') return;

    // Save current scroll position before loading more
    const currentPosition = scrollPositionRef.current;

    loadMoreRecent();

    // Restore scroll position after new items are loaded
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({
        offset: currentPosition,
        animated: false
      });
    }, 100);
  }, 500);

  // Debounced prefetch for better performance
  const handlePrefetchRecent = useDebounce(() => {
    if (status === 'ready' && hasMoreRecent) {
      prefetchRecent();
    }
  }, 1000);

  const handlePrefetchFeatured = useDebounce(() => {
    if (status === 'ready' && hasMoreFeatured) {
      prefetchFeatured();
    }
  }, 1000);

  const headerComponent = useMemo(() => (
    <View style={styles.headerContainer}>
      <ImageBackground
        source={require('../../assets/sadu_patterns/png/18.png')}
        resizeMode="cover"
        imageStyle={styles.headerPattern}
        style={styles.headerPatternWrapper}
      >
        <View style={styles.headerContent}>
          <Text style={styles.screenTitle}>أخبار القفاري</Text>
          <Text style={styles.screenSubtitle}>{headerDate}</Text>
        </View>
      </ImageBackground>
      <FeaturedNewsCarousel
        articles={featured}
        loading={status === 'loading' && featured.length === 0}
        loadingMore={isLoadingMoreFeatured}
        onArticlePress={handleOpenArticle}
        onEndReached={() => {
          if (!hasMoreFeatured || isLoadingMoreFeatured) return;
          loadMoreFeatured();
        }}
        onMomentumScrollEnd={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
          // Trigger prefetch at 90% scroll instead of 70%
          if (contentOffset.x + layoutMeasurement.width >= contentSize.width * 0.9) {
            handlePrefetchFeatured();
          }
        }}
      />
      <Text style={styles.sectionTitle}>آخر المقالات</Text>
    </View>
  ), [featured, headerDate, hasMoreFeatured, isLoadingMoreFeatured, loadMoreFeatured, handleOpenArticle, handlePrefetchFeatured, status]);

  if (status === 'error' && featured.length === 0 && recent.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <NetworkError onRetry={refresh} message={errorMessage} type="server" />
      </SafeAreaView>
    );
  }

  const isLoadingInitial = status === 'loading' && recent.length === 0;
  const listData = isLoadingInitial ? Array.from({ length: 6 }) : recent;

  const renderItem = useCallback(({ item }: { item: NewsArticle | any }) => {
    if (isLoadingInitial) {
      return <RecentArticleSkeleton />;
    }
    const article = item as NewsArticle;
    return (
      <ArticleWithDate
        article={article}
        onPress={() => handleOpenArticle(article)}
      />
    );
  }, [handleOpenArticle, isLoadingInitial]);

  const keyExtractor = useCallback((item: NewsArticle | any, index: number) => {
    if (isLoadingInitial) {
      return `loading-${index}`;
    }
    return `recent-${(item as NewsArticle).id}`;
  }, [isLoadingInitial]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        ref={flatListRef}
        data={listData as any[]}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={headerComponent}
        initialNumToRender={6}
        windowSize={5}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={tokens.colors.najdi.primary} />
        }
        contentContainerStyle={styles.listContent}
        onEndReachedThreshold={0.8}
        onEndReached={handleLoadMoreRecent}
        // Prevent scroll jump by maintaining position manually
        onScroll={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
          scrollPositionRef.current = contentOffset.y;

          // Trigger prefetch at 90% scroll
          if (contentOffset.y + layoutMeasurement.height >= contentSize.height * 0.9) {
            handlePrefetchRecent();
          }
        }}
        scrollEventThrottle={16}
        ListEmptyComponent={!isLoadingInitial ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>لا توجد أخبار حالياً</Text>
            <Text style={styles.emptySubtitle}>عد لاحقاً للاطلاع على آخر التحديثات</Text>
          </View>
        ) : undefined}
        ListFooterComponent={
          isLoadingMoreRecent ? (
            <View style={styles.footerSkeletons}>
              <RecentArticleSkeleton />
              <RecentArticleSkeleton />
            </View>
          ) : <View style={styles.footerSpacer} />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerContainer: {
    paddingBottom: 12,
    paddingTop: 12,
    gap: 12,
  },
  headerPatternWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  headerPattern: {
    opacity: 0.12,
  },
  headerContent: {
    backgroundColor: `${tokens.colors.najdi.background}EE`,
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 4,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
  },
  screenSubtitle: {
    fontSize: 14,
    color: tokens.colors.najdi.textMuted,
  },
  sectionTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: tokens.colors.najdi.textMuted,
  },
  footerSkeletons: {
    paddingVertical: 8,
    gap: 12,
  },
  footerSpacer: {
    height: 32,
  },
});

export default NewsScreen;
