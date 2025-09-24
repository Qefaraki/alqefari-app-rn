import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '../Surface';
import tokens from '../tokens';
import CachedImage from '../../CachedImage';
import { NewsArticle } from '../../../services/news';

type Props = {
  article: NewsArticle;
  subtitle: string;
  onPress: () => void;
};

const NewsCard: React.FC<Props> = ({ article, subtitle, onPress }) => {
  return (
    <Surface style={styles.container} radius={18}>
      <Pressable style={styles.pressable} onPress={onPress} android_ripple={{ color: 'rgba(0,0,0,0.04)' }}>
        {article.heroImage ? (
          <CachedImage source={{ uri: article.heroImage }} style={styles.hero} contentFit="cover" />
        ) : (
          <View style={[styles.hero, styles.heroFallback]}>
            <Ionicons name="image" size={32} color={tokens.colors.najdi.secondary} />
          </View>
        )}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {article.title}
          </Text>
          {!!article.summary && (
            <Text style={styles.summary} numberOfLines={2}>
              {article.summary}
            </Text>
          )}
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Pressable>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 300,
    backgroundColor: tokens.colors.najdi.background,
  },
  pressable: {
    flex: 1,
  },
  hero: {
    width: '100%',
    height: 160,
  },
  heroFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${tokens.colors.najdi.container}33`,
  },
  content: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
  },
  summary: {
    fontSize: 14,
    color: tokens.colors.najdi.textMuted,
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },
});

export default NewsCard;
