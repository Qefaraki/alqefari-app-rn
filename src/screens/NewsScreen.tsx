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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNewsStore } from '../stores/useNewsStore';
import { useAbsoluteDateNoMemo as useAbsoluteDate, useRelativeDateNoMemo as useRelativeDate } from '../hooks/useFormattedDateNoMemo';
import { useSettings } from '../contexts/SettingsContext';
import FeaturedNewsCarousel from '../components/ui/news/FeaturedNewsCarousel';
import { RecentArticleItem, RecentArticleSkeleton } from '../components/ui/news/RecentArticleItem';
import { NewsArticle, stripHtmlForDisplay } from '../services/news';
import tokens from '../components/ui/tokens';
import NetworkError from '../components/NetworkError';

const NewsScreen: React.FC = () => {
  const flatListRef = useRef<FlatList>(null);

  // Get settings to force re-renders when they change
  const { settings } = useSettings();

  // Get date for header - will update on settings change
  const headerDate = useAbsoluteDate(new Date());

  // Get state from simplified store
  const featured = useNewsStore((state) => state.featured);
  const recent = useNewsStore((state) => state.recent);
  const status = useNewsStore((state) => state.status);
  const errorMessage = useNewsStore((state) => state.errorMessage);
  const isRefreshing = useNewsStore((state) => state.isRefreshing);
  const isLoadingMore = useNewsStore((state) => state.isLoadingMore);
  const hasMoreRecent = useNewsStore((state) => state.hasMoreRecent);
  const hasMoreFeatured = useNewsStore((state) => state.hasMoreFeatured);

  // Get actions
  const loadInitial = useNewsStore((state) => state.loadInitial);
  const refresh = useNewsStore((state) => state.refresh);
  const loadMoreRecent = useNewsStore((state) => state.loadMoreRecent);
  const loadMoreFeatured = useNewsStore((state) => state.loadMoreFeatured);

  // Load initial data
  useEffect(() => {
    loadInitial();
  }, []);

  // Handle article opening
  const handleOpenArticle = useCallback((article: NewsArticle) => {
    if (article.permalink) {
      Linking.openURL(article.permalink).catch(() => {
        Alert.alert('تعذر فتح الرابط', 'حاول مرة أخرى لاحقاً.');
      });
      return;
    }
    Alert.alert('لا يوجد رابط', stripHtmlForDisplay(article.summary || ''));
  }, []);

  // Simple onEndReached handler without debouncing
  const handleLoadMore = useCallback(() => {
    // Only load more if we're ready and not already loading
    if (status === 'ready' && !isLoadingMore && hasMoreRecent) {
      loadMoreRecent();
    }
  }, [status, isLoadingMore, hasMoreRecent, loadMoreRecent]);

  // Header component - removed useMemo to ensure settings updates are reflected
  const headerComponent = (
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
        loadingMore={false}
        onArticlePress={handleOpenArticle}
        onEndReached={() => {
          if (hasMoreFeatured && !isLoadingMore) {
            loadMoreFeatured();
          }
        }}
      />

      <Text style={styles.sectionTitle}>آخر المقالات</Text>
    </View>
  );

  // Footer component for loading indicator - removed useCallback for consistency
  const footerComponent = () => {
    if (!isLoadingMore) return null;

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={tokens.colors.najdi.primary} />
        <Text style={styles.loadingText}>جاري التحميل...</Text>
      </View>
    );
  };

  // Render error state
  if (status === 'error' && featured.length === 0 && recent.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <NetworkError onRetry={refresh} message={errorMessage} type="server" />
      </SafeAreaView>
    );
  }

  // Show loading skeletons for initial load
  const isLoadingInitial = status === 'loading' && recent.length === 0;
  const listData = isLoadingInitial ? Array.from({ length: 6 }) : recent;

  // Create a component for list items that can use hooks properly
  const ListItem = ({ item, isLoading }: { item: NewsArticle | any; isLoading: boolean }) => {
    if (isLoading) {
      return <RecentArticleSkeleton />;
    }
    const article = item as NewsArticle;

    // Now we can use hooks properly inside a component
    const subtitle = useRelativeDate(article.publishedAt);

    return (
      <RecentArticleItem
        article={article}
        subtitle={subtitle}
        onPress={() => handleOpenArticle(article)}
      />
    );
  };

  // Render item - now just calls our component
  const renderItem = ({ item }: { item: NewsArticle | any }) => {
    return <ListItem item={item} isLoading={isLoadingInitial} />;
  };

  // Key extractor - simplified since FlatList key handles settings changes
  const keyExtractor = (item: NewsArticle | any, index: number) => {
    if (isLoadingInitial) {
      return `loading-${index}`;
    }
    return `recent-${(item as NewsArticle).id}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        key={`news-list-${settings.defaultCalendar}-${settings.dateFormat}-${settings.arabicNumerals}-${settings.showBothCalendars}`}
        ref={flatListRef}
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={headerComponent}
        // Force re-render when settings change
        extraData={settings}
        ListFooterComponent={footerComponent}
        ListEmptyComponent={
          !isLoadingInitial ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>لا توجد أخبار حالياً</Text>
              <Text style={styles.emptySubtitle}>عد لاحقاً للاطلاع على آخر التحديثات</Text>
            </View>
          ) : undefined
        }
        contentContainerStyle={styles.listContent}

        // Pagination settings - SIMPLIFIED
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}

        // Performance settings
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={10}

        // Pull to refresh
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={tokens.colors.najdi.primary}
          />
        }

        // Prevent bouncing at bottom when loading
        bounces={!isLoadingMore}
        showsVerticalScrollIndicator={true}
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
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: tokens.colors.najdi.textMuted,
  },
});

export default NewsScreen;