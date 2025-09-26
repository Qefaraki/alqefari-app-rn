import React, { memo, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import CachedImage from '../../CachedImage';
import { NewsArticle, stripHtmlForDisplay } from '../../../services/news';
import { useRelativeDateNoMemo } from '../../../hooks/useFormattedDateNoMemo';
import { getSaduPattern } from './SaduPatternProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface WorldClassNewsCardProps {
  article: NewsArticle;
  onPress: (article: NewsArticle) => void;
  index: number;
}

// Feature Card - First item, full-width hero style
const FeatureCard: React.FC<{ article: NewsArticle; onPress: (article: NewsArticle) => void }> = ({ article, onPress }) => {
  const relativeDate = useRelativeDateNoMemo(article.publishedAt);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const saduPattern = getSaduPattern(article.id, 'hero', article.title);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.99,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(article);
  };

  return (
    <Animated.View
      style={[
        styles.featureContainer,
        { transform: [{ scale: scaleAnim }] }
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.featurePressable}
      >
        {article.heroImage ? (
          <ImageBackground
            source={{ uri: article.heroImage }}
            style={styles.featureImage}
            imageStyle={styles.featureImageStyle}
          >
            <LinearGradient
              colors={['transparent', 'transparent', 'rgba(0,0,0,0.7)']}
              style={styles.featureGradient}
            >
              <View style={styles.featureContent}>
                <View style={styles.featureBadge}>
                  <View style={styles.featureDot} />
                  <Text style={styles.featureBadgeText}>جديد</Text>
                </View>
                <Text style={styles.featureTitle} numberOfLines={3}>
                  {article.title}
                </Text>
                <View style={styles.featureMeta}>
                  <Text style={styles.featureDate}>{relativeDate}</Text>
                  {article.source && (
                    <>
                      <Text style={styles.featureSeparator}>·</Text>
                      <Text style={styles.featureSource}>من الرياض</Text>
                    </>
                  )}
                </View>
              </View>
            </LinearGradient>
          </ImageBackground>
        ) : (
          <View style={[styles.featureImage, styles.featurePlaceholder]}>
            <ImageBackground
              source={saduPattern}
              style={StyleSheet.absoluteFillObject}
              imageStyle={styles.featurePatternStyle}
            >
              <LinearGradient
                colors={['#D1BBA310', '#D1BBA330']}
                style={styles.featureGradient}
              >
                <View style={styles.featureContent}>
                  <Text style={[styles.featureTitle, { color: '#242121' }]} numberOfLines={3}>
                    {article.title}
                  </Text>
                  <Text style={[styles.featureDate, { color: '#24212199' }]}>{relativeDate}</Text>
                </View>
              </LinearGradient>
            </ImageBackground>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

// Large Story Card - Full width with image on top
const LargeStoryCard: React.FC<{ article: NewsArticle; onPress: (article: NewsArticle) => void }> = ({ article, onPress }) => {
  const relativeDate = useRelativeDateNoMemo(article.publishedAt);
  const saduPattern = getSaduPattern(article.id, 'large', article.title);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(article);
  };

  return (
    <View style={styles.largeContainer}>
      <Pressable
        style={({ pressed }) => [
          styles.largePressable,
          pressed && styles.pressed
        ]}
        onPress={handlePress}
      >
        {article.heroImage ? (
          <CachedImage
            source={{ uri: article.heroImage }}
            style={styles.largeImage}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.largeImage, styles.largePlaceholder]}>
            <ImageBackground
              source={saduPattern}
              style={StyleSheet.absoluteFillObject}
              imageStyle={styles.largePatternStyle}
            >
              <View style={styles.largePlaceholderContent}>
                <Ionicons
                  name="image-outline"
                  size={40}
                  color="#D1BBA360"
                />
              </View>
            </ImageBackground>
          </View>
        )}

        <View style={styles.largeContent}>
          <Text style={styles.largeTitle} numberOfLines={2}>
            {article.title}
          </Text>
          {article.summary && (
            <Text style={styles.largeSummary} numberOfLines={2}>
              {stripHtmlForDisplay(article.summary)}
            </Text>
          )}
          <View style={styles.largeMeta}>
            <Text style={styles.largeDate}>{relativeDate}</Text>
            {article.source && (
              <Text style={styles.largeSource}>من الرياض</Text>
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
};

// Side by Side Card - 50/50 split with larger image
const SideBySideCard: React.FC<{ article: NewsArticle; onPress: (article: NewsArticle) => void }> = ({ article, onPress }) => {
  const relativeDate = useRelativeDateNoMemo(article.publishedAt);
  const saduPattern = getSaduPattern(article.id, 'side', article.title);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(article);
  };

  return (
    <View style={styles.sideContainer}>
      <Pressable
        style={({ pressed }) => [
          styles.sidePressable,
          pressed && styles.pressed
        ]}
        onPress={handlePress}
      >
        <View style={styles.sideContent}>
          <View style={styles.sideTextContainer}>
            <Text style={styles.sideTitle} numberOfLines={3}>
              {article.title}
            </Text>
            {article.summary && (
              <Text style={styles.sideSummary} numberOfLines={2}>
                {stripHtmlForDisplay(article.summary)}
              </Text>
            )}
            <Text style={styles.sideDate}>{relativeDate}</Text>
          </View>

          {article.heroImage ? (
            <CachedImage
              source={{ uri: article.heroImage }}
              style={styles.sideImage}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.sideImage, styles.sidePlaceholder]}>
              <ImageBackground
                source={saduPattern}
                style={StyleSheet.absoluteFillObject}
                imageStyle={styles.sidePatternStyle}
              >
                <View style={styles.sidePlaceholderContent}>
                  <Ionicons
                    name="image-outline"
                    size={32}
                    color="#D1BBA360"
                  />
                </View>
              </ImageBackground>
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
};

// Text Only Card - When no image, focus on typography
const TextOnlyCard: React.FC<{ article: NewsArticle; onPress: (article: NewsArticle) => void }> = ({ article, onPress }) => {
  const relativeDate = useRelativeDateNoMemo(article.publishedAt);
  const saduPattern = getSaduPattern(article.id, 'text', article.title);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(article);
  };

  return (
    <View style={styles.textContainer}>
      <ImageBackground
        source={saduPattern}
        style={StyleSheet.absoluteFillObject}
        imageStyle={styles.textPatternStyle}
      >
        <Pressable
          style={({ pressed }) => [
            styles.textPressable,
            pressed && styles.pressed
          ]}
          onPress={handlePress}
        >
          <View style={styles.textAccent} />
          <View style={styles.textContent}>
          <Text style={styles.textTitle} numberOfLines={3}>
            {article.title}
          </Text>
          {article.summary && (
            <Text style={styles.textSummary} numberOfLines={3}>
              {stripHtmlForDisplay(article.summary)}
            </Text>
          )}
          <View style={styles.textMeta}>
            <Text style={styles.textDate}>{relativeDate}</Text>
            {article.source && (
              <Text style={styles.textSource}>من الرياض</Text>
            )}
          </View>
        </View>
      </Pressable>
      </ImageBackground>
    </View>
  );
};

// Main component that chooses the right variant
const WorldClassNewsCardComponent: React.FC<WorldClassNewsCardProps> = ({ article, onPress, index }) => {
  // Variant selection logic for world-class variety
  if (index === 0) {
    return <FeatureCard article={article} onPress={onPress} />;
  } else if (index % 5 === 0) {
    return <LargeStoryCard article={article} onPress={onPress} />;
  } else if (!article.heroImage && index % 3 === 0) {
    return <TextOnlyCard article={article} onPress={onPress} />;
  } else {
    return <SideBySideCard article={article} onPress={onPress} />;
  }
};

export const WorldClassNewsCard = memo(WorldClassNewsCardComponent, (prevProps, nextProps) => {
  return prevProps.article.id === nextProps.article.id && prevProps.index === nextProps.index;
});

const styles = StyleSheet.create({
  // Feature Card Styles
  featureContainer: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1BBA310',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  featurePressable: {
    width: '100%',
  },
  featureImage: {
    width: '100%',
    height: 320,
  },
  featureImageStyle: {
    borderRadius: 10,
  },
  featurePlaceholder: {
    backgroundColor: '#D1BBA310',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featurePatternStyle: {
    opacity: 0.08,
    resizeMode: 'repeat',
  },
  featureGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  featureContent: {
    marginTop: 'auto',
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#A13333',
    marginRight: 6,
  },
  featureBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'SF Arabic',
  },
  featureTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 30,
    letterSpacing: -0.3,
    fontFamily: 'SF Arabic',
    marginBottom: 8,
  },
  featureMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'SF Arabic',
  },
  featureSeparator: {
    marginHorizontal: 6,
    color: 'rgba(255,255,255,0.6)',
  },
  featureSource: {
    fontSize: 12,
    color: '#D58C4A',
    fontFamily: 'SF Arabic',
  },

  // Large Story Card Styles
  largeContainer: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#D1BBA310',
  },
  largePressable: {
    width: '100%',
  },
  largeImage: {
    width: '100%',
    height: 200,
  },
  largePlaceholder: {
    backgroundColor: '#D1BBA310',
    overflow: 'hidden',
  },
  largePatternStyle: {
    opacity: 0.08,
    resizeMode: 'repeat',
  },
  largePlaceholderContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeContent: {
    padding: 20,
  },
  largeTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#242121',
    lineHeight: 26,
    letterSpacing: -0.3,
    fontFamily: 'SF Arabic',
    marginBottom: 8,
  },
  largeSummary: {
    fontSize: 15,
    fontWeight: '400',
    color: '#242121B3',
    lineHeight: 22,
    fontFamily: 'SF Arabic',
    marginBottom: 12,
  },
  largeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  largeDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A13333',
    fontFamily: 'SF Arabic',
  },
  largeSource: {
    fontSize: 12,
    fontWeight: '500',
    color: '#D58C4A',
    fontFamily: 'SF Arabic',
  },

  // Side by Side Card Styles
  sideContainer: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#D1BBA310',
  },
  sidePressable: {
    padding: 20,
  },
  sideContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  sideTextContainer: {
    flex: 1,
    paddingTop: 2,
  },
  sideTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#242121',
    lineHeight: 26,
    letterSpacing: -0.3,
    fontFamily: 'SF Arabic',
    marginBottom: 6,
  },
  sideSummary: {
    fontSize: 15,
    fontWeight: '400',
    color: '#242121B3',
    lineHeight: 22,
    fontFamily: 'SF Arabic',
    marginBottom: 10,
  },
  sideDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A13333',
    fontFamily: 'SF Arabic',
  },
  sideImage: {
    width: 160,
    height: 120,
    borderRadius: 10,
  },
  sidePlaceholder: {
    backgroundColor: '#D1BBA310',
    overflow: 'hidden',
  },
  sidePatternStyle: {
    opacity: 0.08,
    resizeMode: 'repeat',
  },
  sidePlaceholderContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Text Only Card Styles
  textContainer: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#D1BBA310',
  },
  textPressable: {
    padding: 20,
    flexDirection: 'row',
  },
  textAccent: {
    width: 3,
    backgroundColor: '#A13333',
    marginRight: 16,
    borderRadius: 1.5,
  },
  textContent: {
    flex: 1,
  },
  textTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#242121',
    lineHeight: 26,
    letterSpacing: -0.3,
    fontFamily: 'SF Arabic',
    marginBottom: 8,
  },
  textSummary: {
    fontSize: 15,
    fontWeight: '400',
    color: '#242121B3',
    lineHeight: 22,
    fontFamily: 'SF Arabic',
    marginBottom: 12,
  },
  textMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A13333',
    fontFamily: 'SF Arabic',
  },
  textSource: {
    fontSize: 12,
    fontWeight: '500',
    color: '#D58C4A',
    fontFamily: 'SF Arabic',
  },
  textPatternStyle: {
    opacity: 0.06,
    resizeMode: 'repeat',
  },

  // Common Styles
  pressed: {
    backgroundColor: '#A1333308',
  },
});

export default WorldClassNewsCard;