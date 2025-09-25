import { create } from 'zustand';
import {
  fetchFeaturedNews,
  fetchRecentNews,
  clearNewsCache,
  NewsArticle,
} from '../services/news';

interface OptimizedNewsStore {
  // Data arrays
  featured: NewsArticle[];
  recent: NewsArticle[];

  // Pre-fetched data (ready to append when user scrolls)
  prefetchedRecent: NewsArticle[];
  prefetchedFeatured: NewsArticle[];

  // Pagination state
  recentPage: number;
  featuredPage: number;
  hasMoreRecent: boolean;
  hasMoreFeatured: boolean;

  // Loading states
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isPrefetching: boolean;

  // Scroll position tracking
  lastScrollOffset: number;
  lastScrollIndex: number;

  // Error handling
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMoreRecent: () => void; // Instant from prefetch
  loadMoreFeatured: () => void; // Instant from prefetch
  prefetchNextRecent: () => Promise<void>; // Background fetch
  prefetchNextFeatured: () => Promise<void>; // Background fetch
  setScrollPosition: (offset: number, index: number) => void;
  clearError: () => void;
}

export const useOptimizedNewsStore = create<OptimizedNewsStore>((set, get) => ({
  // Initial state
  featured: [],
  recent: [],
  prefetchedRecent: [],
  prefetchedFeatured: [],
  recentPage: 0,
  featuredPage: 0,
  hasMoreRecent: true,
  hasMoreFeatured: true,
  isInitialLoading: false,
  isRefreshing: false,
  isPrefetching: false,
  lastScrollOffset: 0,
  lastScrollIndex: 0,
  error: null,

  // Initialize the feed
  initialize: async () => {
    const { isInitialLoading, featured, recent } = get();

    // Skip if already loading or has data
    if (isInitialLoading || (featured.length > 0 && recent.length > 0)) {
      return;
    }

    set({ isInitialLoading: true, error: null });

    try {
      // Load initial data in parallel
      const [featuredRes, recentRes] = await Promise.all([
        fetchFeaturedNews(1),
        fetchRecentNews(1),
      ]);

      set({
        featured: featuredRes.articles,
        recent: recentRes.articles,
        featuredPage: 1,
        recentPage: 1,
        hasMoreFeatured: featuredRes.totalPages > 1,
        hasMoreRecent: recentRes.totalPages > 1,
        isInitialLoading: false,
      });

      // Immediately prefetch next batch in background
      const state = get();
      if (state.hasMoreRecent) {
        state.prefetchNextRecent();
      }
      if (state.hasMoreFeatured) {
        state.prefetchNextFeatured();
      }
    } catch (error) {
      set({
        isInitialLoading: false,
        error: error instanceof Error ? error.message : 'فشل تحميل الأخبار',
      });
    }
  },

  // Pull to refresh
  refresh: async () => {
    const { isRefreshing } = get();
    if (isRefreshing) return;

    set({ isRefreshing: true, error: null });

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
        prefetchedFeatured: [], // Clear prefetch
        prefetchedRecent: [], // Clear prefetch
        featuredPage: 1,
        recentPage: 1,
        hasMoreFeatured: featuredRes.totalPages > 1,
        hasMoreRecent: recentRes.totalPages > 1,
        isRefreshing: false,
        lastScrollOffset: 0, // Reset scroll position
        lastScrollIndex: 0,
      });

      // Prefetch next batch
      const state = get();
      if (state.hasMoreRecent) {
        state.prefetchNextRecent();
      }
    } catch (error) {
      set({
        isRefreshing: false,
        error: error instanceof Error ? error.message : 'فشل التحديث',
      });
    }
  },

  // Instantly append prefetched recent articles
  loadMoreRecent: () => {
    const { prefetchedRecent, recent, hasMoreRecent, isPrefetching } = get();

    // If we don't have prefetched data but can fetch more, do it silently
    if (hasMoreRecent && prefetchedRecent.length === 0 && !isPrefetching) {
      get().prefetchNextRecent();
      return;
    }

    if (!hasMoreRecent || prefetchedRecent.length === 0) {
      return;
    }

    // Instantly append prefetched data
    set({
      recent: [...recent, ...prefetchedRecent],
      prefetchedRecent: [],
    });

    // Immediately prefetch next batch in background
    setTimeout(() => get().prefetchNextRecent(), 0);
  },

  // Instantly append prefetched featured articles
  loadMoreFeatured: () => {
    const { prefetchedFeatured, featured, hasMoreFeatured } = get();

    if (!hasMoreFeatured || prefetchedFeatured.length === 0) {
      return;
    }

    // Instantly append prefetched data
    set({
      featured: [...featured, ...prefetchedFeatured],
      prefetchedFeatured: [],
    });

    // Prefetch next batch in background
    get().prefetchNextFeatured();
  },

  // Background prefetch for recent articles
  prefetchNextRecent: async () => {
    const { isPrefetching, hasMoreRecent, recentPage, prefetchedRecent } = get();

    // Skip if already prefetching or no more data or already have prefetched data
    if (isPrefetching || !hasMoreRecent || prefetchedRecent.length > 0) {
      return;
    }

    set({ isPrefetching: true });

    try {
      const nextPage = recentPage + 1;
      const response = await fetchRecentNews(nextPage);

      set({
        prefetchedRecent: response.articles,
        recentPage: nextPage,
        hasMoreRecent: nextPage < response.totalPages,
        isPrefetching: false,
      });
    } catch (error) {
      // Silent failure for prefetch - user won't notice
      set({ isPrefetching: false });
    }
  },

  // Background prefetch for featured articles
  prefetchNextFeatured: async () => {
    const { isPrefetching, hasMoreFeatured, featuredPage, prefetchedFeatured } = get();

    // Skip if already prefetching or no more data or already have prefetched data
    if (isPrefetching || !hasMoreFeatured || prefetchedFeatured.length > 0) {
      return;
    }

    set({ isPrefetching: true });

    try {
      const nextPage = featuredPage + 1;
      const response = await fetchFeaturedNews(nextPage);

      set({
        prefetchedFeatured: response.articles,
        featuredPage: nextPage,
        hasMoreFeatured: nextPage < response.totalPages,
        isPrefetching: false,
      });
    } catch (error) {
      // Silent failure for prefetch
      set({ isPrefetching: false });
    }
  },

  // Save scroll position before navigation
  setScrollPosition: (offset: number, index: number) => {
    set({ lastScrollOffset: offset, lastScrollIndex: index });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));