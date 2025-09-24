import { create } from 'zustand';
import {
  fetchFeaturedNews,
  fetchRecentNews,
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
  loadInitial: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMoreFeatured: () => Promise<void>;
  loadMoreRecent: () => Promise<void>;
};

const createErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'حدث خطأ أثناء تحميل الأخبار.';
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
      });
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
      const [featuredRes, recentRes] = await Promise.all([
        fetchFeaturedNews(1),
        fetchRecentNews(1),
      ]);

      const featured = featuredRes.articles;
      const recent = recentRes.articles;

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
      });
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
      const next = await fetchFeaturedNews(nextPage);
      set((state) => ({
        featured: [...state.featured, ...next.articles],
        featuredPage: next.articles.length ? nextPage : state.featuredPage,
        featuredTotalPages: next.totalPages,
        hasMoreFeatured: nextPage < next.totalPages,
      }));
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
      const next = await fetchRecentNews(nextPage);
      set((state) => ({
        recent: [...state.recent, ...next.articles],
        recentPage: next.articles.length ? nextPage : state.recentPage,
        recentTotalPages: next.totalPages,
        hasMoreRecent: nextPage < next.totalPages,
      }));
    } catch (error) {
      set({ errorMessage: createErrorMessage(error) });
    } finally {
      set({ isLoadingMoreRecent: false });
    }
  },
}));
