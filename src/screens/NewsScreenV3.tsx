import React, { useCallback, useEffect, useRef } from 'react';
import {
  Alert,
  ImageBackground,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useOptimizedNewsStore } from '../stores/useOptimizedNewsStore';
import { useAbsoluteDateNoMemo } from '../hooks/useFormattedDateNoMemo';
import { NewsArticle, stripHtmlForDisplay } from '../services/news';
import EnhancedCarousel from '../components/ui/news/EnhancedCarousel';
import { WorldClassNewsCard } from '../components/ui/news/WorldClassNewsCard';
import { NewsListItemSkeleton } from '../components/ui/news/NewsListItem';
import NetworkError from '../components/NetworkError';
import tokens from '../components/ui/tokens';

// Item types for mixed list
type ListItem =
  | { type: 'header' }
  | { type: 'article'; data: NewsArticle; index: number }
  | { type: 'skeleton'; id: number };

const NewsScreenV3: React.FC = () => {
  const flashListRef = useRef<FlashList<ListItem>>(null);
  const scrollOffsetRef = useRef(0);

  // Store state
  const {
    featured,
    recent,
    isInitialLoading,
    isRefreshing,
    hasMoreRecent,
    error,
    lastScrollOffset,
    initialize,
    refresh,
    loadMoreRecent,
    loadMoreFeatured,
    prefetchNextRecent,
    setScrollPosition,
    clearError,
    cleanup,
  } = useOptimizedNewsStore();

  // Get current date for header
  const headerDate = useAbsoluteDateNoMemo(new Date());

  // Initialize on mount and cleanup on unmount
  useEffect(() => {
    initialize();

    // Cleanup timers on unmount
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [initialize, cleanup]);

  // Restore scroll position when returning to screen
  useEffect(() => {
    if (lastScrollOffset > 0 && flashListRef.current) {
      // Small delay to ensure list is ready
      setTimeout(() => {
        flashListRef.current?.scrollToOffset({
          offset: lastScrollOffset,
          animated: false,
        });
      }, 100);
    }
  }, [lastScrollOffset]);

  // Handle article press
  const handleArticlePress = useCallback((article: NewsArticle) => {
    // Save scroll position before navigating
    setScrollPosition(scrollOffsetRef.current, 0);

    if (article.permalink) {
      Linking.openURL(article.permalink).catch(() => {
        Alert.alert('تعذر فتح الرابط', 'حاول مرة أخرى لاحقاً.');
      });
      return;
    }
    Alert.alert('لا يوجد رابط', stripHtmlForDisplay(article.summary || ''));
  }, [setScrollPosition]);

  // Handle scroll for pre-fetching
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      scrollOffsetRef.current = contentOffset.y;

      // Calculate scroll percentage
      const scrollPercentage =
        (contentOffset.y + layoutMeasurement.height) / contentSize.height;

      // Pre-fetch when scrolled 40% down (very aggressive)
      if (scrollPercentage > 0.4 && hasMoreRecent) {
        prefetchNextRecent();
      }

      // Load more when scrolled 70% down
      if (scrollPercentage > 0.7 && hasMoreRecent && !isInitialLoading) {
        loadMoreRecent();
      }
    },
    [hasMoreRecent, prefetchNextRecent, loadMoreRecent, isInitialLoading]
  );

  // Handle end reached - backup trigger
  const handleEndReached = useCallback(() => {
    if (hasMoreRecent && !isInitialLoading) {
      loadMoreRecent();
      // Immediately start prefetching next batch
      setTimeout(() => prefetchNextRecent(), 100);
    }
  }, [hasMoreRecent, isInitialLoading, loadMoreRecent, prefetchNextRecent]);

  // Header component
  const renderHeader = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        {/* Title section - matching Settings page style */}
        <View style={styles.header}>
          <Text style={styles.title}>أخبار القفاري</Text>
          <Text style={styles.subtitle}>{headerDate}</Text>
        </View>

        {/* Featured carousel */}
        <EnhancedCarousel
          articles={featured}
          onArticlePress={handleArticlePress}
          onReachEnd={loadMoreFeatured}
          loading={isInitialLoading && featured.length === 0}
          loadingMore={false}
        />

        {/* Section title */}
        <Text style={styles.sectionTitle}>آخر المقالات</Text>
      </View>
    );
  }, [featured, headerDate, isInitialLoading, handleArticlePress, loadMoreFeatured]);

  // Render list item
  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      switch (item.type) {
        case 'header':
          return renderHeader();
        case 'article':
          return (
            <WorldClassNewsCard
              article={item.data}
              onPress={handleArticlePress}
              index={item.index}
            />
          );
        case 'skeleton':
          return <NewsListItemSkeleton />;
        default:
          return null;
      }
    },
    [renderHeader, handleArticlePress]
  );

  // Key extractor
  const keyExtractor = useCallback((item: ListItem) => {
    switch (item.type) {
      case 'header':
        return 'header';
      case 'article':
        return `article-${item.data.id}`;
      case 'skeleton':
        return `skeleton-${item.id}`;
      default:
        return 'unknown';
    }
  }, []);

  // Prepare data for FlashList
  const listData: ListItem[] = [
    { type: 'header' },
    ...(isInitialLoading && recent.length === 0
      ? Array.from({ length: 6 }, (_, i) => ({ type: 'skeleton' as const, id: i }))
      : recent.map((article, index) => ({ type: 'article' as const, data: article, index }))
    ),
  ];

  // Get item type for FlashList optimization
  const getItemType = useCallback((item: ListItem) => {
    return item.type;
  }, []);

  // Footer component - Sadu pattern end indicator
  const renderFooter = useCallback(() => {
    if (!hasMoreRecent && recent.length > 0) {
      return (
        <View style={styles.endIndicator}>
          <View style={styles.endLine} />
          <View style={styles.endPatternWrapper}>
            <ImageBackground
              source={require('../../assets/sadu_patterns/png/1.png')}
              style={styles.endPatternContainer}
              imageStyle={styles.endPatternImage}
            />
          </View>
          <View style={styles.endLine} />
        </View>
      );
    }
    return null;
  }, [hasMoreRecent, recent.length]);

  // Error state
  if (error && featured.length === 0 && recent.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <NetworkError
          onRetry={() => {
            clearError();
            initialize();
          }}
          message={error}
          type="server"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlashList
        ref={flashListRef}
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        estimatedItemSize={150} // Updated for clean cards
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={tokens.colors.najdi.primary}
          />
        }
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.listContent}
        // Maintain scroll position when adding items
        maintainVisibleContentPosition={{
          minIndexForVisible: 1,
        }}
        // Performance optimizations
        removeClippedSubviews={true}
        drawDistance={200}
        updateCellsBatchingPeriod={50}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={10}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },
  headerContainer: {
    paddingBottom: 12,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
    fontFamily: 'SF Arabic',
  },
  subtitle: {
    fontSize: 15,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF Arabic',
    marginTop: 4,
  },
  sectionTitle: {
    marginTop: 12,
    marginHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
  },
  endIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  endLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D1BBA31A',
  },
  endPatternWrapper: {
    marginHorizontal: 16,
    backgroundColor: tokens.colors.najdi.primary + '15', // Light crimson background
    borderRadius: 8,
    padding: 4,
  },
  endPatternContainer: {
    width: 72,
    height: 24,
  },
  endPatternImage: {
    resizeMode: 'contain',
    opacity: 0.6,
    tintColor: tokens.colors.najdi.primary, // Najdi Crimson tint
  },
  listContent: {
    paddingBottom: 100, // Extra padding to ensure last item is fully visible
  },
});

export default NewsScreenV3;