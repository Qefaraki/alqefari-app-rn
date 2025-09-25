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

interface CleanNewsListItemProps {
  article: NewsArticle;
  onPress: (article: NewsArticle) => void;
  index: number;
}

// Hero Card Component - Full width with large image (every 8th item)
const HeroCard: React.FC<{ article: NewsArticle; onPress: (article: NewsArticle) => void }> = ({ article, onPress }) => {
  const relativeDate = useRelativeDateNoMemo(article.publishedAt);
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
      <Surface style={styles.heroSurface} radius={12}>
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
                colors={['transparent', 'rgba(0,0,0,0.6)']}
                style={styles.heroGradient}
              >
                <View style={styles.heroContent}>
                  <Text style={styles.heroTitle} numberOfLines={3}>
                    {article.title}
                  </Text>
                  <Text style={styles.heroDate}>{relativeDate}</Text>
                </View>
              </LinearGradient>
            </ImageBackground>
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <LinearGradient
                colors={[`${tokens.colors.najdi.container}10`, `${tokens.colors.najdi.container}20`]}
                style={styles.heroGradient}
              >
                <View style={styles.heroContent}>
                  <Text style={styles.heroTitle} numberOfLines={3}>
                    {article.title}
                  </Text>
                  <Text style={styles.heroDate}>{relativeDate}</Text>
                </View>
              </LinearGradient>
            </View>
          )}
        </Pressable>
      </Surface>
    </Animated.View>
  );
};

// Standard Card Component - Clean design following design system
const StandardCard: React.FC<{ article: NewsArticle; onPress: (article: NewsArticle) => void }> = ({ article, onPress }) => {
  const relativeDate = useRelativeDateNoMemo(article.publishedAt);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(article);
  };

  return (
    <Surface style={styles.standardContainer} radius={12}>
      <Pressable
        style={({ pressed }) => [
          styles.standardPressable,
          pressed && styles.pressed
        ]}
        onPress={handlePress}
      >
        <View style={styles.standardContent}>
          {/* Text Content */}
          <View style={styles.textContainer}>
            <Text style={styles.standardTitle} numberOfLines={2}>
              {article.title}
            </Text>
            {article.summary && (
              <Text style={styles.standardSummary} numberOfLines={2}>
                {stripHtmlForDisplay(article.summary)}
              </Text>
            )}
            <Text style={styles.standardDate}>{relativeDate}</Text>
          </View>

          {/* Image */}
          {article.heroImage ? (
            <View style={styles.standardImageContainer}>
              <CachedImage
                source={{ uri: article.heroImage }}
                style={styles.standardImage}
                contentFit="cover"
              />
            </View>
          ) : (
            <View style={[styles.standardImageContainer, styles.imagePlaceholder]}>
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

// Main component that chooses the right variant
const CleanNewsListItemComponent: React.FC<CleanNewsListItemProps> = ({ article, onPress, index }) => {
  // Show hero card every 8th item (0, 8, 16, etc.)
  const isHero = index % 8 === 0;

  if (isHero) {
    return <HeroCard article={article} onPress={onPress} />;
  }

  return <StandardCard article={article} onPress={onPress} />;
};

export const CleanNewsListItem = memo(CleanNewsListItemComponent, (prevProps, nextProps) => {
  return prevProps.article.id === nextProps.article.id && prevProps.index === nextProps.index;
});

const styles = StyleSheet.create({
  // Hero Card Styles
  heroContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  heroSurface: {
    backgroundColor: tokens.colors.najdi.background,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `${tokens.colors.najdi.container}40`,
  },
  heroPressable: {
    width: '100%',
  },
  heroImage: {
    width: '100%',
    height: 260,
  },
  heroImageStyle: {
    borderRadius: 11, // Slightly less than container to prevent corner bleed
  },
  heroPlaceholder: {
    backgroundColor: `${tokens.colors.najdi.container}10`,
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 24,
  },
  heroContent: {
    marginTop: 'auto',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 28,
    marginBottom: 6,
    fontFamily: 'SF Arabic',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroDate: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'SF Arabic',
  },

  // Standard Card Styles
  standardContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: tokens.colors.najdi.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, // Per design system
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: `${tokens.colors.najdi.container}40`, // Camel Hair Beige 40%
  },
  standardPressable: {
    padding: 24, // Per design system
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
    gap: 8,
  },
  standardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    lineHeight: 24,
    fontFamily: 'SF Arabic',
  },
  standardSummary: {
    fontSize: 15,
    color: `${tokens.colors.najdi.text}CC`, // 80% opacity
    lineHeight: 22,
    fontFamily: 'SF Arabic',
  },
  standardDate: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    marginTop: 4,
    fontFamily: 'SF Arabic',
  },
  standardImageContainer: {
    width: 120,
    height: 90,
    borderRadius: 10,
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
});

export default CleanNewsListItem;