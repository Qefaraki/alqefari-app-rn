import { create } from 'zustand';
import { Image } from 'react-native';
import {
  fetchFeaturedNews,
  fetchRecentNews,
  clearNewsCache,
  NewsArticle,
  NewsResponse,
} from '../services/news';

type Status = 'idle' | 'loading' | 'ready' | 'error';

type NewsStore = {
  featured: NewsArticle[];
  recent: NewsArticle[];
  status: Status;
  errorMessage?: string;
  isRefreshing: boolean;
  isLoadingMoreFeatured: boolean;
  isLoadingMoreRecent: boolean;
  hasMoreFeatured: boolean;
  hasMoreRecent: boolean;
  featuredPage: number;
  recentPage: number;
  featuredTotalPages: number;
  recentTotalPages: number;
  featuredPrefetch?: NewsResponse | null;
  recentPrefetch?: NewsResponse | null;
  isPrefetchingFeatured: boolean;
  isPrefetchingRecent: boolean;
  loadInitial: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMoreFeatured: () => Promise<void>;
  loadMoreRecent: () => Promise<void>;
  prefetchFeatured: () => Promise<void>;
  prefetchRecent: () => Promise<void>;
};

const createErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'حدث خطأ أثناء تحميل الأخبار.';
};

const prefetchHeroImages = (articles: NewsArticle[]) => {
  articles.forEach((article) => {
    if (article.heroImage) {
      Image.prefetch(article.heroImage).catch(() => {
        // Ignore prefetch failures
      });
    }
  });
};

export const useNewsStore = create<NewsStore>((set, get) => ({
  featured: [],
  recent: [],
  status: 'idle',
  errorMessage: undefined,
  isRefreshing: false,
  isLoadingMoreFeatured: false,
  isLoadingMoreRecent: false,
  hasMoreFeatured: false,
  hasMoreRecent: false,
  featuredPage: 0,
  recentPage: 0,
  featuredTotalPages: 0,
  recentTotalPages: 0,
  featuredPrefetch: null,
  recentPrefetch: null,
  isPrefetchingFeatured: false,
  isPrefetchingRecent: false,

  loadInitial: async () => {
    const { status } = get();
    if (status === 'loading') return;

    set({ status: 'loading', errorMessage: undefined });

    try {
      const [featuredRes, recentRes] = await Promise.all([
        fetchFeaturedNews(1),
        fetchRecentNews(1),
      ]);

      const featured = featuredRes.articles;
      const recent = recentRes.articles;

      prefetchHeroImages(featured);
      prefetchHeroImages(recent);

      set({
        featured,
        recent,
        status: 'ready',
        featuredPage: featured.length ? 1 : 0,
        recentPage: recent.length ? 1 : 0,
        featuredTotalPages: featuredRes.totalPages,
        recentTotalPages: recentRes.totalPages,
        hasMoreFeatured: featuredRes.totalPages > 1,
        hasMoreRecent: recentRes.totalPages > 1,
        featuredPrefetch: null,
        recentPrefetch: null,
      });

      if (featuredRes.totalPages > 1) {
        get().prefetchFeatured();
      }
      if (recentRes.totalPages > 1) {
        get().prefetchRecent();
      }
    } catch (error) {
      set({
        status: 'error',
        errorMessage: createErrorMessage(error),
      });
    }
  },

  refresh: async () => {
    if (get().isRefreshing) return;

    set({ isRefreshing: true, errorMessage: undefined });

    try {
      // Clear cache on pull-to-refresh for immediate fresh content
      await clearNewsCache();

      const [featuredRes, recentRes] = await Promise.all([
        fetchFeaturedNews(1),
        fetchRecentNews(1),
      ]);

      const featured = featuredRes.articles;
      const recent = recentRes.articles;

      prefetchHeroImages(featured);
      prefetchHeroImages(recent);

      set({
        featured,
        recent,
        status: 'ready',
        featuredPage: featured.length ? 1 : 0,
        recentPage: recent.length ? 1 : 0,
        featuredTotalPages: featuredRes.totalPages,
        recentTotalPages: recentRes.totalPages,
        hasMoreFeatured: featuredRes.totalPages > 1,
        hasMoreRecent: recentRes.totalPages > 1,
        featuredPrefetch: null,
        recentPrefetch: null,
      });

      if (featuredRes.totalPages > 1) {
        get().prefetchFeatured();
      }
      if (recentRes.totalPages > 1) {
        get().prefetchRecent();
      }
    } catch (error) {
      set({ errorMessage: createErrorMessage(error) });
    } finally {
      set({ isRefreshing: false });
    }
  },

  loadMoreFeatured: async () => {
    const {
      hasMoreFeatured,
      isLoadingMoreFeatured,
      featured,
      featuredPage,
      featuredTotalPages,
    } = get();
    if (!hasMoreFeatured || isLoadingMoreFeatured) return;
    if (featuredTotalPages === 0 || featuredPage >= featuredTotalPages) {
      set({ hasMoreFeatured: false });
      return;
    }

    set({ isLoadingMoreFeatured: true });

    try {
      const nextPage = featuredPage + 1;
      const prefetched = get().featuredPrefetch;
      let response: NewsResponse = prefetched ?? (await fetchFeaturedNews(nextPage));

      prefetchHeroImages(response.articles);

      set((state) => ({
        featured: [...state.featured, ...response.articles],
        featuredPage: response.articles.length ? nextPage : state.featuredPage,
        featuredTotalPages: response.totalPages,
        hasMoreFeatured: nextPage < response.totalPages,
        featuredPrefetch: null,
      }));

      if (response.totalPages > nextPage) {
        get().prefetchFeatured();
      }
    } catch (error) {
      set({ errorMessage: createErrorMessage(error) });
    } finally {
      set({ isLoadingMoreFeatured: false });
    }
  },

  loadMoreRecent: async () => {
    const {
      hasMoreRecent,
      isLoadingMoreRecent,
      recentPage,
      recentTotalPages,
    } = get();

    if (!hasMoreRecent || isLoadingMoreRecent) return;
    if (recentTotalPages === 0 || recentPage >= recentTotalPages) {
      set({ hasMoreRecent: false });
      return;
    }

    set({ isLoadingMoreRecent: true });

    try {
      const nextPage = recentPage + 1;
      const prefetched = get().recentPrefetch;
      let response: NewsResponse = prefetched ?? (await fetchRecentNews(nextPage));

      prefetchHeroImages(response.articles);

      set((state) => ({
        recent: [...state.recent, ...response.articles],
        recentPage: response.articles.length ? nextPage : state.recentPage,
        recentTotalPages: response.totalPages,
        hasMoreRecent: nextPage < response.totalPages,
        recentPrefetch: null,
      }));

      if (response.totalPages > nextPage) {
        get().prefetchRecent();
      }
    } catch (error) {
      set({ errorMessage: createErrorMessage(error) });
    } finally {
      set({ isLoadingMoreRecent: false });
    }
  },

  prefetchFeatured: async () => {
    const {
      hasMoreFeatured,
      featuredPage,
      featuredTotalPages,
      isPrefetchingFeatured,
      featuredPrefetch,
    } = get();

    if (!hasMoreFeatured || isPrefetchingFeatured || featuredPrefetch) return;
    if (featuredTotalPages === 0 || featuredPage >= featuredTotalPages) return;

    set({ isPrefetchingFeatured: true });

    try {
      const nextPage = featuredPage + 1;
      const response = await fetchFeaturedNews(nextPage);
      prefetchHeroImages(response.articles);
      set({ featuredPrefetch: response });
    } catch (error) {
      // Prefetch failures are non-fatal, ignore
    } finally {
      set({ isPrefetchingFeatured: false });
    }
  },

  prefetchRecent: async () => {
    const {
      hasMoreRecent,
      recentPage,
      recentTotalPages,
      isPrefetchingRecent,
      recentPrefetch,
    } = get();

    if (!hasMoreRecent || isPrefetchingRecent || recentPrefetch) return;
    if (recentTotalPages === 0 || recentPage >= recentTotalPages) return;

    set({ isPrefetchingRecent: true });

    try {
      const nextPage = recentPage + 1;
      const response = await fetchRecentNews(nextPage);
      prefetchHeroImages(response.articles);
      set({ recentPrefetch: response });
    } catch (error) {
      // Ignore prefetch errors
    } finally {
      set({ isPrefetchingRecent: false });
    }
  },
}));
