import * as FileSystem from 'expo-file-system/legacy';

const API_BASE = 'https://alqefari.com/wp-json/wp/v2/posts';
const FEATURED_CATEGORY = 1369;
const FEATURED_PAGE_SIZE = 10; // Increased from 5
const RECENT_PAGE_SIZE = 12; // Increased from 6
// Smart cache TTL: shorter for news content
const CACHE_TTL_RECENT = 3 * 60 * 60 * 1000; // 3 hours for recent articles
const CACHE_TTL_FEATURED = 6 * 60 * 60 * 1000; // 6 hours for featured articles
const CACHE_DIR = `${FileSystem.cacheDirectory}news-cache`;
const REQUEST_TIMEOUT = 8000; // 8 seconds

type WordPressMedia = {
  large?: string;
  medium?: string;
  thumbnail?: string;
};

type WordPressPost = {
  id: number;
  date: string;
  link?: string;
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  content?: { rendered?: string };
  blog_images?: WordPressMedia;
  jetpack_featured_media_url?: string;
};

export type NewsArticle = {
  id: number;
  title: string;
  summary: string;
  html: string;
  publishedAt: string;
  heroImage?: string;
  permalink?: string;
};

type CacheEntry = {
  timestamp: number;
  payload: NewsArticle[];
  totalPages: number;
  totalItems: number;
  cacheType?: 'recent' | 'featured';
};

export type NewsResponse = {
  articles: NewsArticle[];
  totalPages: number;
  totalItems: number;
};

const ensureCacheDir = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
  } catch (error) {
    // Cache directory failures shouldn’t break network requests
  }
};

const cachePathForKey = (key: string) => `${CACHE_DIR}/${key}.json`;

const readFromCache = async (key: string): Promise<CacheEntry | null> => {
  try {
    await ensureCacheDir();
    const filePath = cachePathForKey(key);
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      return null;
    }

    const raw = await FileSystem.readAsStringAsync(filePath);
    const parsed: CacheEntry = JSON.parse(raw);

    // Use different TTL based on cache type
    const isRecent = key.includes('recent');
    const ttl = isRecent ? CACHE_TTL_RECENT : CACHE_TTL_FEATURED;

    if (Date.now() - parsed.timestamp > ttl) {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
};

const writeToCache = async (
  key: string,
  payload: NewsArticle[],
  totalPages: number,
  totalItems: number,
) => {
  try {
    await ensureCacheDir();
    const entry: CacheEntry = {
      timestamp: Date.now(),
      payload,
      totalPages,
      totalItems,
      cacheType: key.includes('recent') ? 'recent' : 'featured',
    };
    await FileSystem.writeAsStringAsync(cachePathForKey(key), JSON.stringify(entry));
  } catch (error) {
    // Ignore cache write failures – fall back to network data
  }
};

const abortableFetch = async (url: string): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
};

const createUrl = (params: Record<string, string | number>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    query.append(key, String(value));
  });
  return `${API_BASE}?${query.toString()}`;
};

const decodeHtmlEntities = (value: string) => {
  if (!value) return '';
  const entityMap: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&lt;': '<',
    '&gt;': '>',
  };

  let decoded = value.replace(/&(nbsp|amp|quot|#39|apos|lt|gt);/gi, (match) => {
    const lower = match.toLowerCase();
    return entityMap[lower] ?? match;
  });

  decoded = decoded.replace(/&#(\d+);/g, (_, dec) => {
    const code = parseInt(dec, 10);
    return Number.isFinite(code) ? String.fromCharCode(code) : _;
  });

  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
    const code = parseInt(hex, 16);
    return Number.isFinite(code) ? String.fromCharCode(code) : _;
  });

  return decoded;
};

const stripHtml = (value?: string) => {
  if (!value) return '';
  const withoutTags = value.replace(/<[^>]*>/g, ' ');
  const decoded = decodeHtmlEntities(withoutTags);
  return decoded.replace(/\s+/g, ' ').trim();
};

const deriveHeroImage = (post: WordPressPost): string | undefined => {
  const images = post.blog_images;
  if (images?.large) return images.large;
  if (images?.medium) return images.medium;
  if (images?.thumbnail) return images.thumbnail;
  if (post.jetpack_featured_media_url) return post.jetpack_featured_media_url;
  return undefined;
};

const buildSummary = (post: WordPressPost) => {
  const rawExcerpt = stripHtml(post.excerpt?.rendered);
  if (rawExcerpt) {
    return rawExcerpt;
  }

  const rawContent = stripHtml(post.content?.rendered) ?? '';
  if (!rawContent) return '';

  if (rawContent.length <= 200) {
    return rawContent;
  }

  const trimmed = rawContent.slice(0, 200);
  const lastSpace = trimmed.lastIndexOf(' ');
  return `${trimmed.slice(0, lastSpace > 0 ? lastSpace : trimmed.length)}…`;
};

const mapPostToArticle = (post: WordPressPost): NewsArticle => {
  return {
    id: post.id,
    title: stripHtml(post.title?.rendered) || 'بدون عنوان',
    summary: buildSummary(post),
    html: post.content?.rendered ?? '',
    publishedAt: post.date,
    heroImage: deriveHeroImage(post),
    permalink: post.link,
  };
};

const fetchNews = async (
  key: string,
  params: Record<string, string | number>,
): Promise<NewsResponse> => {
  const cached = await readFromCache(key);
  if (cached) {
    // Kick off background refresh but return cached immediately
    refreshInBackground(key, params);
    return {
      articles: cached.payload,
      totalPages: cached.totalPages,
      totalItems: cached.totalItems,
    };
  }

  return await networkFetch(key, params);
};

const refreshInBackground = async (key: string, params: Record<string, string | number>) => {
  try {
    await networkFetch(key, params);
  } catch (error) {
    // Silently ignore background refresh failures
  }
};

const networkFetch = async (
  key: string,
  params: Record<string, string | number>,
): Promise<NewsResponse> => {
  const url = createUrl({ ...params, _embed: true });
  const response = await abortableFetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to load news (${response.status}): ${text}`);
  }

  const json: WordPressPost[] = await response.json();
  const articles = json.map(mapPostToArticle);
  const totalPages = parseInt(response.headers.get('X-WP-TotalPages') ?? '1', 10) || 1;
  const totalItems = parseInt(response.headers.get('X-WP-Total') ?? `${articles.length}`, 10) || articles.length;
  await writeToCache(key, articles, totalPages, totalItems);
  return {
    articles,
    totalPages,
    totalItems,
  };
};

export const fetchFeaturedNews = async (page = 1) => {
  return fetchNews(`featured-${page}`, {
    categories: FEATURED_CATEGORY,
    page,
    per_page: FEATURED_PAGE_SIZE,
  });
};

export const fetchRecentNews = async (page = 1) => {
  return fetchNews(`recent-${page}`, {
    categories_exclude: FEATURED_CATEGORY,
    page,
    per_page: RECENT_PAGE_SIZE,
  });
};

export const clearNewsCache = async () => {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (info.exists) {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    }
  } catch (error) {
    // No-op
  }
};

// Check if cache has newer content available
export const checkForNewContent = async (): Promise<boolean> => {
  try {
    // Quick HEAD request to check if content has changed
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${API_BASE}?per_page=1`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const lastModified = response.headers.get('Last-Modified');
      if (lastModified) {
        // Store and compare last modified times
        // Implementation depends on your needs
        return true; // For now, always suggest checking for new content
      }
    }
  } catch (error) {
    // Ignore check failures
  }
  return false;
};

export const stripHtmlForDisplay = stripHtml;
