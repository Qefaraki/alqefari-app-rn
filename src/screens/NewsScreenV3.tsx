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
import { useOptimizedNewsStore } from '../stores/useOptimizedNewsStore';
import { useAbsoluteDateNoMemo } from '../hooks/useFormattedDateNoMemo';
import { NewsArticle, stripHtmlForDisplay } from '../services/news';
import EnhancedCarousel from '../components/ui/news/EnhancedCarousel';
import { NewsListItem, NewsListItemSkeleton } from '../components/ui/news/NewsListItem';
import NetworkError from '../components/NetworkError';
import tokens from '../components/ui/tokens';

// Item types for mixed list
type ListItem =
  | { type: 'header' }
  | { type: 'article'; data: NewsArticle }
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
  } = useOptimizedNewsStore();

  // Get current date for header
  const headerDate = useAbsoluteDateNoMemo(new Date());

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, []);

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

      // Pre-fetch when scrolled 50% down (more aggressive)
      if (scrollPercentage > 0.5 && hasMoreRecent) {
        prefetchNextRecent();
      }

      // Load more when scrolled 80% down
      if (scrollPercentage > 0.8 && hasMoreRecent && !isInitialLoading) {
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
        {/* Title section */}
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
            <NewsListItem
              article={item.data}
              onPress={handleArticlePress}
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
      : recent.map(article => ({ type: 'article' as const, data: article }))
    ),
  ];

  // Get item type for FlashList optimization
  const getItemType = useCallback((item: ListItem) => {
    return item.type;
  }, []);

  // Footer component
  const renderFooter = useCallback(() => {
    if (!hasMoreRecent) {
      return (
        <View style={styles.endMessage}>
          <Text style={styles.endMessageText}>لا يوجد المزيد من الأخبار</Text>
        </View>
      );
    }
    return null;
  }, [hasMoreRecent]);

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
    <SafeAreaView style={styles.safeArea}>
      <FlashList
        ref={flashListRef}
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        estimatedItemSize={120} // Average item height
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
        // Maintain scroll position when adding items
        maintainVisibleContentPosition={{
          minIndexForVisible: 1,
        }}
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
    paddingTop: 12,
    gap: 12,
  },
  headerPatternWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
    marginHorizontal: 16,
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
    marginHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
  },
  endMessage: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  endMessageText: {
    fontSize: 14,
    color: tokens.colors.najdi.textMuted,
  },
});

export default NewsScreenV3;