import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ImageBackground,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  SharedValue,
  Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { NewsArticle } from '../../../services/news';
import { useSettings } from '../../../contexts/SettingsContext';
import { formatDateByPreference } from '../../../utils/dateDisplay';
import tokens from '../../ui/tokens';

const { width: screenWidth } = Dimensions.get('window');
const HERO_HEIGHT = screenWidth * 0.6; // 16:9 aspect ratio

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
  const { settings } = useSettings();

  // Format date based on user preferences
  const formattedDate = useMemo(() => {
    if (!article.publishedAt) return '';

    const dateObj = new Date(article.publishedAt);
    return formatDateByPreference(
      {
        type: 'gregorian',
        year: dateObj.getFullYear(),
        month: dateObj.getMonth() + 1,
        day: dateObj.getDate(),
      },
      settings
    );
  }, [article.publishedAt, settings]);

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

  // Gradient opacity based on scroll
  const gradientAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, HERO_HEIGHT / 2],
      [1, 0.4],
      Extrapolation.CLAMP
    );

    return { opacity };
  });

  // No hero image fallback
  if (!article.heroImage) {
    return (
      <View style={[styles.headerContainer, isNightMode && styles.headerContainerDark]}>
        {/* Decorative Sadu pattern background */}
        <ImageBackground
          source={require('../../../../assets/sadu_patterns/png/18.png')}
          resizeMode="cover"
          imageStyle={styles.patternBackground}
          style={styles.patternWrapper}
        >
          <LinearGradient
            colors={
              isNightMode
                ? ['rgba(26,26,26,0.95)', 'rgba(26,26,26,1)']
                : ['rgba(249,247,243,0.95)', 'rgba(249,247,243,1)']
            }
            style={styles.noImageHeader}
          >
            <View style={styles.noImageContent}>
              {/* Category badge */}
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>أخبار</Text>
              </View>

              {/* Title */}
              <Text style={[styles.title, isNightMode && styles.titleDark]}>
                {article.title}
              </Text>

              {/* Metadata row */}
              <View style={styles.metadataRow}>
                <View style={styles.metaPill}>
                  <Text style={styles.metaText}>
                    {readingTime} دقيقة قراءة
                  </Text>
                </View>
                <View style={styles.metaPill}>
                  <Text style={styles.metaText}>
                    {wordCount} كلمة
                  </Text>
                </View>
                {formattedDate && (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaText}>{formattedDate}</Text>
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      </View>
    );
  }

  return (
    <View style={styles.headerContainer}>
      <Animated.View style={[styles.heroContainer, heroAnimatedStyle]}>
        <Image
          source={{ uri: article.heroImage }}
          style={styles.heroImage}
          contentFit="cover"
          transition={300}
          placeholder={require('../../../../assets/icon.png')}
        />

        {/* Ken Burns effect overlay */}
        <Animated.View style={[StyleSheet.absoluteFillObject, gradientAnimatedStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
        </Animated.View>

        {/* Content overlay */}
        <View style={styles.heroOverlay}>
          <View style={styles.heroContent}>
            {/* Category badge */}
            <View style={[styles.categoryBadge, styles.categoryBadgeOverlay]}>
              <Text style={[styles.categoryText, styles.categoryTextOverlay]}>
                أخبار
              </Text>
            </View>

            {/* Title with backdrop blur */}
            <BlurView intensity={80} tint="dark" style={styles.titleBlurContainer}>
              <Text style={styles.heroTitle}>{article.title}</Text>
            </BlurView>

            {/* Metadata row */}
            <View style={styles.heroMetadataRow}>
              <BlurView intensity={60} tint="dark" style={styles.metaPillBlur}>
                <Text style={styles.heroMetaText}>
                  {readingTime} دقيقة
                </Text>
              </BlurView>
              <BlurView intensity={60} tint="dark" style={styles.metaPillBlur}>
                <Text style={styles.heroMetaText}>
                  {wordCount} كلمة
                </Text>
              </BlurView>
              {formattedDate && (
                <BlurView intensity={60} tint="dark" style={styles.metaPillBlur}>
                  <Text style={styles.heroMetaText}>{formattedDate}</Text>
                </BlurView>
              )}
            </View>
          </View>
        </View>
      </Animated.View>
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
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  heroContent: {
    padding: 16,
    paddingBottom: 20,
  },
  titleBlurContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    padding: 12,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'right',
    lineHeight: 32,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroMetadataRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaPillBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroMetaText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },

  // No image styles
  patternWrapper: {
    width: '100%',
    minHeight: 200,
  },
  patternBackground: {
    opacity: 0.06,
  },
  noImageHeader: {
    minHeight: 200,
    justifyContent: 'center',
  },
  noImageContent: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
    textAlign: 'right',
    marginBottom: 16,
    lineHeight: 36,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  metadataRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaPill: {
    backgroundColor: tokens.colors.najdi.container + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container + '40',
  },
  metaText: {
    fontSize: 13,
    color: tokens.colors.najdi.text,
    fontWeight: '500',
  },

  // Category badge
  categoryBadge: {
    alignSelf: 'flex-end',
    backgroundColor: tokens.colors.najdi.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  categoryBadgeOverlay: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  categoryTextOverlay: {
    color: '#FFFFFF',
  },
});

export default ArticleHeader;