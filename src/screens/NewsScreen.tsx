import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
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
import { useSettings } from '../contexts/SettingsContext';
import { formatDateByPreference } from '../utils/dateDisplay';
import { gregorianToHijri } from '../utils/hijriConverter';
import { toArabicNumerals } from '../utils/dateUtils';
import { useNewsStore } from '../stores/useNewsStore';
import FeaturedNewsCarousel from '../components/ui/news/FeaturedNewsCarousel';
import RecentArticleItem, {
  RecentArticleSkeleton,
} from '../components/ui/news/RecentArticleItem';
import { NewsArticle, stripHtmlForDisplay } from '../services/news';
import tokens from '../components/ui/tokens';
import NetworkError from '../components/NetworkError';

const formatRelativeTime = (isoDate: string, useArabicNumerals: boolean) => {
  const target = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const maybeConvert = (value: number) =>
    useArabicNumerals ? toArabicNumerals(value) : value;

  if (diffDays > 14) {
    const g = {
      day: target.getDate(),
      month: target.getMonth() + 1,
      year: target.getFullYear(),
    };
    const hijri = gregorianToHijri(g.year, g.month, g.day);
    return formatDateByPreference({ gregorian: g, hijri }, { arabicNumerals: true });
  }

  if (diffDays >= 7) {
    return diffDays < 14 ? 'منذ أسبوع' : 'منذ أسبوعين';
  }

  if (diffDays > 0) {
    return `منذ ${maybeConvert(diffDays)} يوم`;
  }

  if (diffHours > 0) {
    return `منذ ${maybeConvert(diffHours)} ساعة`;
  }

  if (diffMinutes > 0) {
    return `منذ ${maybeConvert(diffMinutes)} دقيقة`;
  }

  return 'قبل لحظات';
};

const buildSubtitle = (article: NewsArticle, settings: any) => {
  const date = new Date(article.publishedAt);
  const gregorian = {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
  const hijri = gregorianToHijri(gregorian.year, gregorian.month, gregorian.day);
  const formatted = formatDateByPreference({ gregorian, hijri }, settings);
  const relative = formatRelativeTime(article.publishedAt, settings?.arabicNumerals);
  if (formatted) {
    return `${relative} • ${formatted}`;
  }
  return relative;
};

const NewsScreen: React.FC = () => {
  const { settings } = useSettings();

  const featured = useNewsStore((state) => state.featured);
  const recent = useNewsStore((state) => state.recent);
  const status = useNewsStore((state) => state.status);
  const errorMessage = useNewsStore((state) => state.errorMessage);
  const isRefreshing = useNewsStore((state) => state.isRefreshing);
  const loadInitial = useNewsStore((state) => state.loadInitial);
  const refresh = useNewsStore((state) => state.refresh);
  const loadMoreRecent = useNewsStore((state) => state.loadMoreRecent);
  const loadMoreFeatured = useNewsStore((state) => state.loadMoreFeatured);
  const isLoadingMoreRecent = useNewsStore((state) => state.isLoadingMoreRecent);
  const isLoadingMoreFeatured = useNewsStore((state) => state.isLoadingMoreFeatured);
  const hasMoreRecent = useNewsStore((state) => state.hasMoreRecent);
  const hasMoreFeatured = useNewsStore((state) => state.hasMoreFeatured);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const headerDate = useMemo(() => {
    const now = new Date();
    const g = {
      day: now.getDate(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    };
    const hijri = gregorianToHijri(g.year, g.month, g.day);
    return formatDateByPreference({ gregorian: g, hijri }, settings);
  }, [settings]);

  const handleOpenArticle = useCallback((article: NewsArticle) => {
    if (article.permalink) {
      Linking.openURL(article.permalink).catch(() => {
        Alert.alert('تعذر فتح الرابط', 'حاول مرة أخرى لاحقاً.');
      });
      return;
    }

    Alert.alert('لا يوجد رابط', stripHtmlForDisplay(article.summary || ''));
  }, []);

  const handleLoadMoreRecent = useCallback(() => {
    if (!hasMoreRecent || isLoadingMoreRecent) return;
    loadMoreRecent();
  }, [hasMoreRecent, isLoadingMoreRecent, loadMoreRecent]);

  const renderHeader = () => (
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
        renderSubtitle={(article) =>
          formatRelativeTime(article.publishedAt, settings?.arabicNumerals)
        }
        onEndReached={() => {
          if (!hasMoreFeatured || isLoadingMoreFeatured) return;
          loadMoreFeatured();
        }}
      />
      <Text style={styles.sectionTitle}>آخر المقالات</Text>
    </View>
  );

  if (status === 'error' && featured.length === 0 && recent.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <NetworkError onRetry={refresh} message={errorMessage} type="server" />
      </SafeAreaView>
    );
  }

  const isLoadingInitial = status === 'loading' && recent.length === 0;
  const listData = isLoadingInitial ? Array.from({ length: 6 }) : recent;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={listData as any[]}
        keyExtractor={(item, index) => {
          if (isLoadingInitial) {
            return `loading-${index}`;
          }
          return `recent-${(item as NewsArticle).id}`;
        }}
        renderItem={({ item }) => {
          if (isLoadingInitial) {
            return <RecentArticleSkeleton />;
          }

          const article = item as NewsArticle;
          return (
            <RecentArticleItem
              article={article}
              subtitle={buildSubtitle(article, settings)}
              onPress={() => handleOpenArticle(article)}
            />
          );
        }}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={tokens.colors.najdi.primary} />
        }
        contentContainerStyle={styles.listContent}
        onEndReachedThreshold={0.6}
        onEndReached={handleLoadMoreRecent}
        ListEmptyComponent={!isLoadingInitial ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>لا توجد أخبار حالياً</Text>
            <Text style={styles.emptySubtitle}>عد لاحقاً للاطلاع على آخر التحديثات</Text>
          </View>
        ) : undefined}
        ListFooterComponent={
          isLoadingMoreRecent ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={tokens.colors.najdi.primary} />
            </View>
          ) : null
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
  footerLoader: {
    paddingVertical: 16,
  },
});

export default NewsScreen;
