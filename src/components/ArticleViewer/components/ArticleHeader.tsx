import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  SharedValue,
  Extrapolation,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { NewsArticle } from '../../../services/news';
import tokens from '../../ui/tokens';
import { getWordPressImageSizes } from '../utils/imageOptimizer';

const { width: screenWidth } = Dimensions.get('window');
const HERO_HEIGHT = screenWidth * 0.56; // 16:9 aspect ratio

interface ArticleHeaderProps {
  article: NewsArticle;
  readingTime: number;
  wordCount: number;
  scrollY: SharedValue<number>;
  isNightMode: boolean;
}

const ArticleHeader: React.FC<ArticleHeaderProps> = ({
  article,
  readingTime,
  wordCount,
  scrollY,
  isNightMode,
}) => {
  // Animated styles for parallax effect
  const heroAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [-100, 0, HERO_HEIGHT],
      [-20, 0, HERO_HEIGHT * 0.4],
      Extrapolation.CLAMP
    );

    const scale = interpolate(
      scrollY.value,
      [-100, 0],
      [1.1, 1],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateY },
        { scale },
      ],
    };
  });

  // No hero image fallback
  if (!article.heroImage) {
    return (
      <View style={[styles.headerContainer, isNightMode && styles.headerContainerDark]}>
        <View style={[styles.noImagePlaceholder, isNightMode && styles.noImagePlaceholderDark]}>
          <Text style={styles.noImageText}>📰</Text>
        </View>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, isNightMode && styles.titleDark]}>
            {article.title}
          </Text>
        </View>
      </View>
    );
  }

  const [imageUrl, setImageUrl] = useState<string>('');
  const [isImageLoading, setIsImageLoading] = useState(true);

  useEffect(() => {
    if (!article.heroImage) return;

    // Get different image sizes
    const sizes = getWordPressImageSizes(article.heroImage);

    // Start with medium size for faster loading
    setImageUrl(sizes.medium);
    setIsImageLoading(true);

    // Then load full size
    Image.prefetch(article.heroImage).then(() => {
      setImageUrl(article.heroImage);
      setIsImageLoading(false);
    }).catch(() => {
      // Keep medium if full fails
      setIsImageLoading(false);
    });
  }, [article.heroImage]);

  return (
    <View style={styles.headerContainer}>
      <Animated.View style={[styles.heroContainer, heroAnimatedStyle]}>
        {isImageLoading && (
          <View style={styles.imageLoadingContainer}>
            <ActivityIndicator size="small" color={tokens.colors.najdi.primary} />
          </View>
        )}
        <Image
          source={{ uri: imageUrl || article.heroImage }}
          style={styles.heroImage}
          contentFit="cover"
          transition={300}
          cachePolicy="memory-disk"
          priority="high"
        />
      </Animated.View>

      <View style={[styles.titleContainer, isNightMode && styles.titleContainerDark]}>
        <Text style={[styles.title, isNightMode && styles.titleDark]}>
          {article.title}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: tokens.colors.najdi.background,
  },
  headerContainerDark: {
    backgroundColor: '#1a1a1a',
  },
  heroContainer: {
    width: screenWidth,
    height: HERO_HEIGHT,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  noImagePlaceholder: {
    width: screenWidth,
    height: HERO_HEIGHT,
    backgroundColor: tokens.colors.najdi.container + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImagePlaceholderDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  noImageText: {
    fontSize: 64,
    opacity: 0.3,
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: tokens.colors.najdi.background,
  },
  titleContainerDark: {
    backgroundColor: '#1a1a1a',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
    lineHeight: 34,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  imageLoadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: tokens.colors.najdi.container + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ArticleHeader;