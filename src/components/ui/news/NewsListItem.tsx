import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CachedImage from '../../CachedImage';
import { NewsArticle, stripHtmlForDisplay } from '../../../services/news';
import tokens from '../tokens';
import { useRelativeDateNoMemo } from '../../../hooks/useFormattedDateNoMemo';

interface NewsListItemProps {
  article: NewsArticle;
  onPress: (article: NewsArticle) => void;
}

// Optimized list item for FlashList
// No key prop should be added when using this component!
const NewsListItemComponent: React.FC<NewsListItemProps> = ({ article, onPress }) => {
  // Date formatting without memoization
  const relativeDate = useRelativeDateNoMemo(article.publishedAt);

  const handlePress = () => {
    onPress(article);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed
      ]}
      onPress={handlePress}
      android_ripple={{ color: 'rgba(0,0,0,0.04)' }}
    >
      <View style={styles.content}>
        <View style={styles.textContainer}>
          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>
            {article.title}
          </Text>

          {/* Summary */}
          {article.summary && (
            <Text style={styles.summary} numberOfLines={2}>
              {stripHtmlForDisplay(article.summary)}
            </Text>
          )}

          {/* Metadata */}
          <View style={styles.metadata}>
            <Text style={styles.date}>{relativeDate}</Text>
            {article.source && (
              <>
                <Text style={styles.separator}>·</Text>
                <Text style={styles.source}>{article.source}</Text>
              </>
            )}
          </View>
        </View>

        {/* Thumbnail */}
        {article.heroImage ? (
          <View style={styles.imageContainer}>
            <CachedImage
              source={{ uri: article.heroImage }}
              style={styles.image}
              contentFit="cover"
            />
          </View>
        ) : (
          <View style={[styles.imageContainer, styles.imagePlaceholder]}>
            <Ionicons
              name="image-outline"
              size={24}
              color={tokens.colors.najdi.textMuted}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
};

// Use memo with custom comparison for better performance
// Only re-render if article ID changes
export const NewsListItem = memo(NewsListItemComponent, (prevProps, nextProps) => {
  return prevProps.article.id === nextProps.article.id;
});

// Skeleton component for loading state
export const NewsListItemSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          {/* Title skeleton */}
          <View style={[styles.skeletonLine, styles.skeletonTitle]} />
          <View style={[styles.skeletonLine, styles.skeletonTitle, { width: '70%' }]} />

          {/* Summary skeleton */}
          <View style={[styles.skeletonLine, styles.skeletonSummary]} />
          <View style={[styles.skeletonLine, styles.skeletonSummary, { width: '85%' }]} />

          {/* Metadata skeleton */}
          <View style={styles.metadata}>
            <View style={[styles.skeletonLine, { width: 80 }]} />
            <Text style={styles.separator}>·</Text>
            <View style={[styles.skeletonLine, { width: 60 }]} />
          </View>
        </View>

        {/* Image skeleton */}
        <View style={[styles.imageContainer, styles.skeletonImage]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.najdi.background,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: `${tokens.colors.najdi.container}20`,
  },
  pressed: {
    backgroundColor: `${tokens.colors.najdi.container}10`,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  textContainer: {
    flex: 1,
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    lineHeight: 24,
  },
  summary: {
    fontSize: 14,
    color: tokens.colors.najdi.textMuted,
    lineHeight: 20,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  date: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },
  separator: {
    marginHorizontal: 6,
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },
  source: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    backgroundColor: `${tokens.colors.najdi.container}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Skeleton styles
  skeletonLine: {
    height: 12,
    backgroundColor: `${tokens.colors.najdi.container}30`,
    borderRadius: 6,
  },
  skeletonTitle: {
    height: 14,
    marginBottom: 4,
  },
  skeletonSummary: {
    height: 10,
    marginBottom: 3,
  },
  skeletonImage: {
    backgroundColor: `${tokens.colors.najdi.container}30`,
  },
});