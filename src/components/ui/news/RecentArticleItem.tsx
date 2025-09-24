import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tokens from '../tokens';
import CachedImage from '../../CachedImage';
import { NewsArticle } from '../../../services/news';
import Surface from '../Surface';
import SkeletonLoader, { SkeletonText } from '../SkeletonLoader';

type Props = {
  article: NewsArticle;
  subtitle: string;
  onPress: () => void;
};

export const RecentArticleItem: React.FC<Props> = ({ article, subtitle, onPress }) => {
  return (
    <Surface style={styles.surface} radius={16}>
      <Pressable style={styles.row} onPress={onPress} android_ripple={{ color: 'rgba(0,0,0,0.04)' }}>
        <View style={styles.thumbnailWrapper}>
          {article.heroImage ? (
            <CachedImage source={{ uri: article.heroImage }} style={styles.thumbnail} contentFit="cover" />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailFallback]}>
              <Ionicons name="image" size={20} color={tokens.colors.najdi.secondary} />
            </View>
          )}
        </View>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {article.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Pressable>
    </Surface>
  );
};

export const RecentArticleSkeleton: React.FC = () => {
  return (
    <Surface style={styles.surface} radius={16}>
      <View style={styles.row}>
        <SkeletonLoader width={64} height={64} borderRadius={12} />
        <View style={styles.content}>
          <SkeletonLoader width="90%" height={18} style={styles.skeletonLine} />
          <SkeletonText lines={1} />
        </View>
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  surface: {
    marginBottom: 12,
    backgroundColor: tokens.colors.najdi.background,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  thumbnailWrapper: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `${tokens.colors.najdi.container}55`,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${tokens.colors.najdi.container}33`,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  subtitle: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
    maxWidth: '100%',
  },
  skeletonLine: {
    marginBottom: 8,
  },
});

export default RecentArticleItem;
