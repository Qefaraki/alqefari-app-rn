import { create } from 'zustand';
import {
  fetchFeaturedNews,
  fetchRecentNews,
  clearNewsCache,
  NewsArticle,
} from '../services/news';

type Status = 'idle' | 'loading' | 'ready' | 'error';

type NewsStore = {
  // Data
  featured: NewsArticle[];
  recent: NewsArticle[];

  // Status
  status: Status;
  errorMessage?: string;
  isRefreshing: boolean;

  // Pagination state - SIMPLIFIED
  recentPage: number;
  featuredPage: number;
  hasMoreRecent: boolean;
  hasMoreFeatured: boolean;
  isLoadingMore: boolean;

  // Actions
  loadInitial: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMoreRecent: () => Promise<void>;
  loadMoreFeatured: () => Promise<void>;
};

export const useNewsStore = create<NewsStore>((set, get) => ({
  // Initial state
  featured: [],
  recent: [],
  status: 'idle',
  errorMessage: undefined,
  isRefreshing: false,
  recentPage: 0,
  featuredPage: 0,
  hasMoreRecent: true,
  hasMoreFeatured: true,
  isLoadingMore: false,

  // Load initial data
  loadInitial: async () => {
    const { status } = get();
    if (status === 'loading') return;

    set({ status: 'loading', errorMessage: undefined });

    try {
      const [featuredRes, recentRes] = await Promise.all([
        fetchFeaturedNews(1),
        fetchRecentNews(1),
      ]);

      set({
        featured: featuredRes.articles,
        recent: recentRes.articles,
        status: 'ready',
        featuredPage: 1,
        recentPage: 1,
        hasMoreFeatured: featuredRes.totalPages > 1,
        hasMoreRecent: recentRes.totalPages > 1,
      });
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'خطأ في تحميل الأخبار',
      });
    }
  },

  // Pull to refresh
  refresh: async () => {
    if (get().isRefreshing) return;

    set({ isRefreshing: true, errorMessage: undefined });

    try {
      // Clear cache for fresh content
      await clearNewsCache();

      const [featuredRes, recentRes] = await Promise.all([
        fetchFeaturedNews(1),
        fetchRecentNews(1),
      ]);

      set({
        featured: featuredRes.articles,
        recent: recentRes.articles,
        status: 'ready',
        featuredPage: 1,
        recentPage: 1,
        hasMoreFeatured: featuredRes.totalPages > 1,
        hasMoreRecent: recentRes.totalPages > 1,
        isRefreshing: false,
      });
    } catch (error) {
      set({
        isRefreshing: false,
        errorMessage: error instanceof Error ? error.message : 'خطأ في التحديث',
      });
    }
  },

  // Load more recent articles
  loadMoreRecent: async () => {
    const { isLoadingMore, hasMoreRecent, recentPage, recent } = get();

    // Prevent multiple simultaneous loads
    if (isLoadingMore || !hasMoreRecent) return;

    set({ isLoadingMore: true });

    try {
      const nextPage = recentPage + 1;
      const response = await fetchRecentNews(nextPage);

      set({
        recent: [...recent, ...response.articles],
        recentPage: nextPage,
        hasMoreRecent: nextPage < response.totalPages,
        isLoadingMore: false,
      });
    } catch (error) {
      set({
        isLoadingMore: false,
        errorMessage: 'فشل تحميل المزيد'
      });
    }
  },

  // Load more featured articles
  loadMoreFeatured: async () => {
    const { isLoadingMore, hasMoreFeatured, featuredPage, featured } = get();

    if (isLoadingMore || !hasMoreFeatured) return;

    set({ isLoadingMore: true });

    try {
      const nextPage = featuredPage + 1;
      const response = await fetchFeaturedNews(nextPage);

      set({
        featured: [...featured, ...response.articles],
        featuredPage: nextPage,
        hasMoreFeatured: nextPage < response.totalPages,
        isLoadingMore: false,
      });
    } catch (error) {
      set({
        isLoadingMore: false,
        errorMessage: 'فشل تحميل المزيد'
      });
    }
  },
}));