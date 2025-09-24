import React from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '../Surface';
import tokens from '../tokens';
import CachedImage from '../../CachedImage';
import { NewsArticle } from '../../../services/news';
import { useRelativeDate } from '../../../hooks/useFormattedDate';
import { useSettings } from '../../../contexts/SettingsContext';

type Props = {
  article: NewsArticle;
  onPress: () => void;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
// Match carousel card width calculation
const CARD_WIDTH = Math.floor(SCREEN_WIDTH * 0.85);
const HERO_HEIGHT = 168;

const NewsCardComponent: React.FC<Props> = ({ article, onPress }) => {
  const subtitle = useRelativeDate(article.publishedAt);
  // Get settings to trigger re-render on settings change
  const { settings } = useSettings();

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

// Remove memoization to ensure settings changes trigger re-renders
// The performance impact is minimal since we're only rendering a few cards at a time

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    backgroundColor: tokens.colors.najdi.background,
  },
  pressable: {
    flex: 1,
  },
  hero: {
    width: '100%',
    height: HERO_HEIGHT,
    // Removed aspectRatio to avoid conflict with fixed height
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
    minHeight: 120,
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

export default NewsCardComponent; // Removed memo to allow settings updates
