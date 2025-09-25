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

  // Loading states - SEPARATE FLAGS FOR PARALLEL LOADING
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isPrefetchingRecent: boolean; // Separate flag
  isPrefetchingFeatured: boolean; // Separate flag

  // Scroll position tracking
  lastScrollOffset: number;
  lastScrollIndex: number;

  // Error handling
  error: string | null;
  recentFetchErrors: number; // Count consecutive errors
  featuredFetchErrors: number; // Count consecutive errors

  // Debounce timers
  recentDebounceTimer?: NodeJS.Timeout;
  featuredDebounceTimer?: NodeJS.Timeout;

  // Actions
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMoreRecent: () => void;
  loadMoreFeatured: () => void;
  prefetchNextRecent: () => Promise<void>;
  prefetchNextFeatured: () => Promise<void>;
  setScrollPosition: (offset: number, index: number) => void;
  clearError: () => void;
  cleanup: () => void; // Cleanup timers
}

// Helper to remove duplicate articles
const removeDuplicates = (articles: NewsArticle[]): NewsArticle[] => {
  const seen = new Set<number>();
  return articles.filter(article => {
    if (seen.has(article.id)) return false;
    seen.add(article.id);
    return true;
  });
};

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
  isPrefetchingRecent: false,
  isPrefetchingFeatured: false,
  lastScrollOffset: 0,
  lastScrollIndex: 0,
  error: null,
  recentFetchErrors: 0,
  featuredFetchErrors: 0,
  recentDebounceTimer: undefined,
  featuredDebounceTimer: undefined,

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
        featured: removeDuplicates(featuredRes.articles),
        recent: removeDuplicates(recentRes.articles),
        featuredPage: 1,
        recentPage: 1,
        hasMoreFeatured: featuredRes.totalPages > 1,
        hasMoreRecent: recentRes.totalPages > 1,
        isInitialLoading: false,
        recentFetchErrors: 0,
        featuredFetchErrors: 0,
      });

      // Immediately prefetch next batch in background (both can run in parallel)
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

    // Cleanup any pending timers
    get().cleanup();

    set({ isRefreshing: true, error: null });

    try {
      // Clear cache for fresh content
      await clearNewsCache();

      const [featuredRes, recentRes] = await Promise.all([
        fetchFeaturedNews(1),
        fetchRecentNews(1),
      ]);

      set({
        featured: removeDuplicates(featuredRes.articles),
        recent: removeDuplicates(recentRes.articles),
        prefetchedFeatured: [],
        prefetchedRecent: [],
        featuredPage: 1,
        recentPage: 1,
        hasMoreFeatured: featuredRes.totalPages > 1,
        hasMoreRecent: recentRes.totalPages > 1,
        isRefreshing: false,
        lastScrollOffset: 0,
        lastScrollIndex: 0,
        recentFetchErrors: 0,
        featuredFetchErrors: 0,
      });

      // Prefetch next batch
      const state = get();
      if (state.hasMoreRecent) {
        state.prefetchNextRecent();
      }
      if (state.hasMoreFeatured) {
        state.prefetchNextFeatured();
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
    const { prefetchedRecent, recent, hasMoreRecent, recentDebounceTimer } = get();

    // Clear any existing debounce timer
    if (recentDebounceTimer) {
      clearTimeout(recentDebounceTimer);
    }

    // If we have prefetched data, use it
    if (prefetchedRecent.length > 0) {
      const combined = [...recent, ...prefetchedRecent];
      set({
        recent: removeDuplicates(combined),
        prefetchedRecent: [],
      });
    }

    // Debounce prefetch to avoid rapid requests (300ms)
    if (hasMoreRecent) {
      const timer = setTimeout(() => {
        get().prefetchNextRecent();
      }, 300);
      set({ recentDebounceTimer: timer });
    }
  },

  // Instantly append prefetched featured articles
  loadMoreFeatured: () => {
    const { prefetchedFeatured, featured, hasMoreFeatured, featuredDebounceTimer } = get();

    // Clear any existing debounce timer
    if (featuredDebounceTimer) {
      clearTimeout(featuredDebounceTimer);
    }

    // If we have prefetched data, use it
    if (prefetchedFeatured.length > 0) {
      const combined = [...featured, ...prefetchedFeatured];
      set({
        featured: removeDuplicates(combined),
        prefetchedFeatured: [],
      });
    }

    // Debounce prefetch to avoid rapid requests (300ms)
    if (hasMoreFeatured) {
      const timer = setTimeout(() => {
        get().prefetchNextFeatured();
      }, 300);
      set({ featuredDebounceTimer: timer });
    }
  },

  // Background prefetch for recent articles
  prefetchNextRecent: async () => {
    const { isPrefetchingRecent, hasMoreRecent, recentPage, recentFetchErrors } = get();

    // Skip if already prefetching or no more data
    if (isPrefetchingRecent || !hasMoreRecent) {
      return;
    }

    // Stop trying after 3 consecutive errors
    if (recentFetchErrors >= 3) {
      console.warn('Stopping recent prefetch after 3 errors');
      return;
    }

    set({ isPrefetchingRecent: true });

    try {
      const nextPage = recentPage + 1;
      const response = await fetchRecentNews(nextPage);

      const uniqueArticles = removeDuplicates(response.articles);

      set({
        prefetchedRecent: uniqueArticles,
        recentPage: nextPage,
        hasMoreRecent: nextPage < response.totalPages,
        isPrefetchingRecent: false,
        recentFetchErrors: 0, // Reset error count on success
      });

      // Pre-fetch next page if we're running low
      if (uniqueArticles.length < 3 && get().hasMoreRecent) {
        setTimeout(() => get().prefetchNextRecent(), 500);
      }
    } catch (error) {
      console.error('Failed to prefetch recent:', error);
      set({
        isPrefetchingRecent: false,
        recentFetchErrors: get().recentFetchErrors + 1,
      });

      // Retry after delay with exponential backoff
      const retryDelay = Math.min(1000 * Math.pow(2, get().recentFetchErrors), 10000);
      setTimeout(() => {
        if (get().hasMoreRecent && get().recentFetchErrors < 3) {
          get().prefetchNextRecent();
        }
      }, retryDelay);
    }
  },

  // Background prefetch for featured articles
  prefetchNextFeatured: async () => {
    const { isPrefetchingFeatured, hasMoreFeatured, featuredPage, featuredFetchErrors } = get();

    // Skip if already prefetching or no more data
    if (isPrefetchingFeatured || !hasMoreFeatured) {
      return;
    }

    // Stop trying after 3 consecutive errors
    if (featuredFetchErrors >= 3) {
      console.warn('Stopping featured prefetch after 3 errors');
      return;
    }

    set({ isPrefetchingFeatured: true });

    try {
      const nextPage = featuredPage + 1;
      const response = await fetchFeaturedNews(nextPage);

      const uniqueArticles = removeDuplicates(response.articles);

      set({
        prefetchedFeatured: uniqueArticles,
        featuredPage: nextPage,
        hasMoreFeatured: nextPage < response.totalPages,
        isPrefetchingFeatured: false,
        featuredFetchErrors: 0, // Reset error count on success
      });

      // Pre-fetch next page if we're running low
      if (uniqueArticles.length < 3 && get().hasMoreFeatured) {
        setTimeout(() => get().prefetchNextFeatured(), 500);
      }
    } catch (error) {
      console.error('Failed to prefetch featured:', error);
      set({
        isPrefetchingFeatured: false,
        featuredFetchErrors: get().featuredFetchErrors + 1,
      });

      // Retry after delay with exponential backoff
      const retryDelay = Math.min(1000 * Math.pow(2, get().featuredFetchErrors), 10000);
      setTimeout(() => {
        if (get().hasMoreFeatured && get().featuredFetchErrors < 3) {
          get().prefetchNextFeatured();
        }
      }, retryDelay);
    }
  },

  // Save scroll position before navigation
  setScrollPosition: (offset: number, index: number) => {
    set({ lastScrollOffset: offset, lastScrollIndex: index });
  },

  // Clear error
  clearError: () => {
    set({ error: null, recentFetchErrors: 0, featuredFetchErrors: 0 });
  },

  // Cleanup timers
  cleanup: () => {
    const { recentDebounceTimer, featuredDebounceTimer } = get();
    if (recentDebounceTimer) clearTimeout(recentDebounceTimer);
    if (featuredDebounceTimer) clearTimeout(featuredDebounceTimer);
    set({ recentDebounceTimer: undefined, featuredDebounceTimer: undefined });
  },
}));