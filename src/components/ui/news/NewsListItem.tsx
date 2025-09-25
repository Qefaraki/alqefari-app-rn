import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import CachedImage from '../../CachedImage';
import { NewsArticle, stripHtmlForDisplay } from '../../../services/news';
import Surface from '../Surface';
import tokens from '../tokens';
import { useRelativeDateNoMemo } from '../../../hooks/useFormattedDateNoMemo';

interface NewsListItemProps {
  article: NewsArticle;
  onPress: (article: NewsArticle) => void;
}

// Optimized list item for FlashList with standardized design
const NewsListItemComponent: React.FC<NewsListItemProps> = ({ article, onPress }) => {
  // Date formatting without memoization
  const relativeDate = useRelativeDateNoMemo(article.publishedAt);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(article);
  };

  return (
    <Surface style={styles.container} radius={16}>
      <Pressable
        style={({ pressed }) => [
          styles.pressable,
          pressed && styles.pressed
        ]}
        onPress={handlePress}
        android_ripple={{ color: 'rgba(0,0,0,0.04)' }}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`مقال: ${article.title}`}
        accessibilityHint={`اضغط لفتح المقال. ${relativeDate}`}
      >
        <View style={styles.content}>
          {/* Text Content - Left Side */}
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
                  <View style={styles.sourceContainer}>
                    <Ionicons
                      name="newspaper-outline"
                      size={12}
                      color={tokens.colors.najdi.textMuted}
                    />
                    <Text style={styles.source}>{article.source}</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Thumbnail - Right Side */}
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
                size={28}
                color={tokens.colors.najdi.textMuted}
              />
            </View>
          )}
        </View>
      </Pressable>
    </Surface>
  );
};

// Use memo with custom comparison for better performance
export const NewsListItem = memo(NewsListItemComponent, (prevProps, nextProps) => {
  return prevProps.article.id === nextProps.article.id;
});

// Skeleton component for loading state
export const NewsListItemSkeleton: React.FC = () => {
  return (
    <Surface style={styles.container} radius={16}>
      <View style={[styles.content, { padding: 16 }]}>
        <View style={styles.textContainer}>
          {/* Title skeleton */}
          <View style={[styles.skeletonLine, styles.skeletonTitle]} />
          <View style={[styles.skeletonLine, styles.skeletonTitle, { width: '70%' }]} />

          {/* Summary skeleton */}
          <View style={[styles.skeletonLine, styles.skeletonSummary]} />
          <View style={[styles.skeletonLine, styles.skeletonSummary, { width: '85%' }]} />

          {/* Metadata skeleton */}
          <View style={styles.metadata}>
            <View style={[styles.skeletonLine, { width: 80, height: 10 }]} />
            <Text style={styles.separator}>·</Text>
            <View style={[styles.skeletonLine, { width: 60, height: 10 }]} />
          </View>
        </View>

        {/* Image skeleton */}
        <View style={[styles.imageContainer, styles.skeletonImage]} />
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: tokens.colors.najdi.background,
    // Shadow for elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  pressable: {
    padding: 16,
  },
  pressed: {
    opacity: 0.95,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    minHeight: 100, // Standardized minimum height
  },
  textContainer: {
    flex: 1,
    gap: 6,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    lineHeight: 22,
    marginBottom: 2,
  },
  summary: {
    fontSize: 14,
    color: tokens.colors.najdi.textMuted,
    lineHeight: 19,
    flex: 1,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 4,
  },
  date: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
  },
  separator: {
    marginHorizontal: 6,
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
  },
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  source: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
  },
  imageContainer: {
    width: 120, // Wider for better aspect ratio
    height: 90, // 4:3 aspect ratio
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: `${tokens.colors.najdi.container}10`,
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
    backgroundColor: `${tokens.colors.najdi.container}30`,
    borderRadius: 6,
  },
  skeletonTitle: {
    height: 14,
    marginBottom: 4,
  },
  skeletonSummary: {
    height: 11,
    marginBottom: 3,
  },
  skeletonImage: {
    backgroundColor: `${tokens.colors.najdi.container}30`,
  },
});