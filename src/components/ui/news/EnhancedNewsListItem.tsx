import React, { memo, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import CachedImage from '../../CachedImage';
import { NewsArticle, stripHtmlForDisplay } from '../../../services/news';
import Surface from '../Surface';
import tokens from '../tokens';
import { useRelativeDateNoMemo } from '../../../hooks/useFormattedDateNoMemo';

interface EnhancedNewsListItemProps {
  article: NewsArticle;
  onPress: (article: NewsArticle) => void;
  variant?: 'hero' | 'standard' | 'compact';
  index: number;
}

// Extract category from article title or content
const extractCategory = (article: NewsArticle): string | null => {
  const title = article.title.toLowerCase();
  const summary = (article.summary || '').toLowerCase();

  if (title.includes('دعوة') || summary.includes('دعوة')) return 'دعوة';
  if (title.includes('مخيم') || summary.includes('مخيم')) return 'مخيم';
  if (title.includes('عيد') || summary.includes('عيد')) return 'احتفال';
  if (title.includes('وفاة') || title.includes('رحل')) return 'عزاء';
  if (title.includes('زواج') || title.includes('زفاف')) return 'مناسبة';
  return null;
};

// Estimate reading time
const estimateReadingTime = (article: NewsArticle): number => {
  const text = stripHtmlForDisplay(article.html || article.summary || '');
  const wordsPerMinute = 200; // Average Arabic reading speed
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
};

// Category colors
const categoryColors: Record<string, string> = {
  'دعوة': tokens.colors.najdi.primary,
  'مخيم': tokens.colors.najdi.ochre,
  'احتفال': '#4CAF50',
  'عزاء': '#757575',
  'مناسبة': '#9C27B0',
};

// Hero Card Component - Full width with large image
const HeroCard: React.FC<EnhancedNewsListItemProps> = ({ article, onPress }) => {
  const relativeDate = useRelativeDateNoMemo(article.publishedAt);
  const category = extractCategory(article);
  const readingTime = estimateReadingTime(article);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(article);
  };

  return (
    <Animated.View
      style={[
        styles.heroContainer,
        { transform: [{ scale: scaleAnim }] }
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.heroPressable}
      >
        {article.heroImage ? (
          <ImageBackground
            source={{ uri: article.heroImage }}
            style={styles.heroImage}
            imageStyle={styles.heroImageStyle}
          >
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.heroGradient}
            >
              {category && (
                <View style={[styles.categoryBadge, { backgroundColor: categoryColors[category] }]}>
                  <Text style={styles.categoryText}>{category}</Text>
                </View>
              )}
              <View style={styles.heroContent}>
                <Text style={styles.heroTitle} numberOfLines={3}>
                  {article.title}
                </Text>
                <View style={styles.heroMeta}>
                  <Text style={styles.heroDate}>{relativeDate}</Text>
                  <Text style={styles.heroDot}>•</Text>
                  <Text style={styles.heroReadTime}>قراءة {readingTime} دقائق</Text>
                </View>
              </View>
            </LinearGradient>
          </ImageBackground>
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <LinearGradient
              colors={[`${tokens.colors.najdi.container}10`, `${tokens.colors.najdi.container}30`]}
              style={styles.heroGradient}
            >
              {category && (
                <View style={[styles.categoryBadge, { backgroundColor: categoryColors[category] }]}>
                  <Text style={styles.categoryText}>{category}</Text>
                </View>
              )}
              <View style={styles.heroContent}>
                <Text style={styles.heroTitle} numberOfLines={3}>
                  {article.title}
                </Text>
                <View style={styles.heroMeta}>
                  <Text style={styles.heroDate}>{relativeDate}</Text>
                  <Text style={styles.heroDot}>•</Text>
                  <Text style={styles.heroReadTime}>قراءة {readingTime} دقائق</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

// Standard Card Component - Enhanced current layout
const StandardCard: React.FC<EnhancedNewsListItemProps> = ({ article, onPress }) => {
  const relativeDate = useRelativeDateNoMemo(article.publishedAt);
  const category = extractCategory(article);
  const readingTime = estimateReadingTime(article);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(article);
  };

  return (
    <Surface style={styles.standardContainer} radius={16}>
      <Pressable
        style={({ pressed }) => [
          styles.standardPressable,
          pressed && styles.pressed
        ]}
        onPress={handlePress}
      >
        <View style={styles.standardContent}>
          <View style={styles.textContainer}>
            {category && (
              <View style={styles.inlineCategoryContainer}>
                <View style={[styles.inlineCategoryBadge, { backgroundColor: `${categoryColors[category]}20` }]}>
                  <Text style={[styles.inlineCategoryText, { color: categoryColors[category] }]}>
                    {category}
                  </Text>
                </View>
              </View>
            )}
            <Text style={styles.standardTitle} numberOfLines={2}>
              {article.title}
            </Text>
            {article.summary && (
              <Text style={styles.standardSummary} numberOfLines={2}>
                {stripHtmlForDisplay(article.summary)}
              </Text>
            )}
            <View style={styles.standardMeta}>
              <Text style={styles.standardDate}>{relativeDate}</Text>
              <Text style={styles.separator}>•</Text>
              <Ionicons name="time-outline" size={12} color={tokens.colors.najdi.textMuted} />
              <Text style={styles.readTime}>{readingTime} دقائق</Text>
            </View>
          </View>

          {article.heroImage ? (
            <View style={styles.standardImageContainer}>
              <CachedImage
                source={{ uri: article.heroImage }}
                style={styles.standardImage}
                contentFit="cover"
              />
              {category && (
                <View style={[styles.imageCategoryBadge, { backgroundColor: categoryColors[category] }]}>
                  <Text style={styles.imageCategoryText}>{category}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.standardImageContainer, styles.imagePlaceholder]}>
              <Ionicons
                name="image-outline"
                size={32}
                color={tokens.colors.najdi.textMuted}
              />
            </View>
          )}
        </View>
      </Pressable>
    </Surface>
  );
};

// Compact Card Component - Smaller for older articles
const CompactCard: React.FC<EnhancedNewsListItemProps> = ({ article, onPress }) => {
  const relativeDate = useRelativeDateNoMemo(article.publishedAt);
  const category = extractCategory(article);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(article);
  };

  return (
    <Surface style={styles.compactContainer} radius={12}>
      <Pressable
        style={({ pressed }) => [
          styles.compactPressable,
          pressed && styles.pressed
        ]}
        onPress={handlePress}
      >
        <View style={styles.compactContent}>
          {article.heroImage ? (
            <CachedImage
              source={{ uri: article.heroImage }}
              style={styles.compactImage}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.compactImage, styles.compactImagePlaceholder]}>
              <Ionicons
                name="image-outline"
                size={20}
                color={tokens.colors.najdi.textMuted}
              />
            </View>
          )}

          <View style={styles.compactTextContainer}>
            <View style={styles.compactHeader}>
              {category && (
                <Text style={[styles.compactCategory, { color: categoryColors[category] }]}>
                  {category}
                </Text>
              )}
              <Text style={styles.compactDate}>{relativeDate}</Text>
            </View>
            <Text style={styles.compactTitle} numberOfLines={2}>
              {article.title}
            </Text>
          </View>
        </View>
      </Pressable>
    </Surface>
  );
};

// Main component that chooses the right variant
const EnhancedNewsListItemComponent: React.FC<EnhancedNewsListItemProps> = (props) => {
  const { variant = 'standard', index } = props;

  // Automatically determine variant based on index if not specified
  let finalVariant = variant;
  if (variant === 'standard') {
    if (index % 7 === 0) finalVariant = 'hero';
    else if (index > 15) finalVariant = 'compact';
  }

  switch (finalVariant) {
    case 'hero':
      return <HeroCard {...props} />;
    case 'compact':
      return <CompactCard {...props} />;
    default:
      return <StandardCard {...props} />;
  }
};

export const EnhancedNewsListItem = memo(EnhancedNewsListItemComponent, (prevProps, nextProps) => {
  return prevProps.article.id === nextProps.article.id && prevProps.index === nextProps.index;
});

const styles = StyleSheet.create({
  // Hero Card Styles
  heroContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  heroPressable: {
    width: '100%',
  },
  heroImage: {
    width: '100%',
    height: 280,
  },
  heroImageStyle: {
    borderRadius: 16,
  },
  heroPlaceholder: {
    backgroundColor: `${tokens.colors.najdi.container}10`,
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  heroContent: {
    marginTop: 'auto',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 30,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroDate: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  heroDot: {
    marginHorizontal: 8,
    color: 'rgba(255,255,255,0.9)',
  },
  heroReadTime: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },

  // Standard Card Styles
  standardContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: tokens.colors.najdi.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  standardPressable: {
    padding: 16,
  },
  pressed: {
    opacity: 0.95,
  },
  standardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  textContainer: {
    flex: 1,
    gap: 6,
  },
  standardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    lineHeight: 24,
    marginBottom: 4,
  },
  standardSummary: {
    fontSize: 14,
    color: tokens.colors.najdi.textMuted,
    lineHeight: 20,
    marginBottom: 4,
  },
  standardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 4,
  },
  standardDate: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
  },
  separator: {
    marginHorizontal: 6,
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
  },
  readTime: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
    marginLeft: 4,
  },
  standardImageContainer: {
    width: 140,
    height: 105,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: `${tokens.colors.najdi.container}10`,
  },
  standardImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${tokens.colors.najdi.container}20`,
  },

  // Compact Card Styles
  compactContainer: {
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: tokens.colors.najdi.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  compactPressable: {
    padding: 12,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: `${tokens.colors.najdi.container}10`,
  },
  compactImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${tokens.colors.najdi.container}20`,
  },
  compactTextContainer: {
    flex: 1,
    gap: 4,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  compactCategory: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  compactDate: {
    fontSize: 11,
    color: tokens.colors.najdi.textMuted,
  },
  compactTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: tokens.colors.najdi.text,
    lineHeight: 20,
  },

  // Category Badge Styles
  categoryBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  inlineCategoryContainer: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  inlineCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inlineCategoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  imageCategoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  imageCategoryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default EnhancedNewsListItem;