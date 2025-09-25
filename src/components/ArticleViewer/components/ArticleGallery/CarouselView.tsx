import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import tokens from '../../../ui/tokens';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const CAROUSEL_HEIGHT = screenHeight * 0.5;
const THUMBNAIL_SIZE = 60;

interface CarouselViewProps {
  images: string[];
  isNightMode: boolean;
}

const CarouselView: React.FC<CarouselViewProps> = ({ images, isNightMode }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const mainCarouselRef = useRef<FlatList>(null);
  const thumbnailRef = useRef<FlatList>(null);
  const autoPlayTimer = useRef<NodeJS.Timeout>();
  const scrollX = useSharedValue(0);

  // Auto-play functionality
  const startAutoPlay = useCallback(() => {
    setIsAutoPlaying(true);
    autoPlayTimer.current = setInterval(() => {
      const nextIndex = (currentIndex + 1) % images.length;
      mainCarouselRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }, 3000);
  }, [currentIndex, images.length]);

  const stopAutoPlay = useCallback(() => {
    setIsAutoPlaying(false);
    if (autoPlayTimer.current) {
      clearInterval(autoPlayTimer.current);
    }
  }, []);

  // Handle main carousel scroll
  const handleScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / screenWidth);

    scrollX.value = offsetX;

    if (index !== currentIndex && index >= 0 && index < images.length) {
      setCurrentIndex(index);
      // Scroll thumbnail list to show current
      thumbnailRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      });
    }
  }, [currentIndex, images.length, scrollX]);

  // Handle thumbnail press
  const handleThumbnailPress = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    mainCarouselRef.current?.scrollToIndex({ index, animated: true });
    setCurrentIndex(index);
    stopAutoPlay();
  }, [stopAutoPlay]);

  // Handle image press for full screen
  const handleImagePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Open full screen viewer
    Alert.alert('معاينة', 'سيتم فتح معاينة الصورة بالحجم الكامل قريباً');
  }, []);

  // Render main carousel item
  const renderCarouselItem = useCallback(({ item, index }: { item: string; index: number }) => {
    const inputRange = [
      (index - 1) * screenWidth,
      index * screenWidth,
      (index + 1) * screenWidth,
    ];

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: interpolate(
        scrollX.value,
        inputRange,
        [0.8, 1, 0.8],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          scale: interpolate(
            scrollX.value,
            inputRange,
            [0.9, 1, 0.9],
            Extrapolation.CLAMP
          ),
        },
      ],
    }));

    return (
      <Animated.View style={[styles.carouselItem, animatedStyle]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleImagePress}
          style={styles.imageWrapper}
        >
          <Image
            source={{ uri: item }}
            style={styles.carouselImage}
            contentFit="contain"
            transition={300}
          />
        </TouchableOpacity>

        {/* Image counter */}
        <View style={styles.imageCounter}>
          <Text style={styles.counterText}>
            {index + 1} / {images.length}
          </Text>
        </View>
      </Animated.View>
    );
  }, [scrollX, images.length, handleImagePress]);

  // Render thumbnail item
  const renderThumbnail = useCallback(({ item, index }: { item: string; index: number }) => {
    const isActive = index === currentIndex;

    return (
      <TouchableOpacity
        style={[
          styles.thumbnail,
          isActive && styles.activeThumbnail,
        ]}
        onPress={() => handleThumbnailPress(index)}
      >
        <Image
          source={{ uri: item }}
          style={styles.thumbnailImage}
          contentFit="cover"
          transition={200}
        />
        {isActive && (
          <View style={styles.activeThumbnailOverlay} />
        )}
      </TouchableOpacity>
    );
  }, [currentIndex, handleThumbnailPress]);

  return (
    <View style={[styles.container, isNightMode && styles.containerDark]}>
      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, isAutoPlaying && styles.controlButtonActive]}
          onPress={isAutoPlaying ? stopAutoPlay : startAutoPlay}
        >
          <Ionicons
            name={isAutoPlaying ? 'pause' : 'play'}
            size={20}
            color={isAutoPlaying ? '#FFFFFF' : tokens.colors.najdi.text}
          />
          <Text style={[styles.controlText, isAutoPlaying && styles.controlTextActive]}>
            {isAutoPlaying ? 'إيقاف' : 'تشغيل تلقائي'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Carousel */}
      <FlatList
        ref={mainCarouselRef}
        data={images}
        renderItem={renderCarouselItem}
        keyExtractor={(item, index) => `carousel-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.carousel}
        onScrollBeginDrag={stopAutoPlay}
      />

      {/* Thumbnail Strip */}
      <View style={styles.thumbnailContainer}>
        <FlatList
          ref={thumbnailRef}
          data={images}
          renderItem={renderThumbnail}
          keyExtractor={(item, index) => `thumb-${index}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailList}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.najdi.background,
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    gap: 8,
  },
  controlButtonActive: {
    backgroundColor: tokens.colors.najdi.primary,
  },
  controlText: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.colors.najdi.text,
  },
  controlTextActive: {
    color: '#FFFFFF',
  },
  carousel: {
    height: CAROUSEL_HEIGHT,
  },
  carouselItem: {
    width: screenWidth,
    height: CAROUSEL_HEIGHT,
  },
  imageWrapper: {
    flex: 1,
    padding: 16,
  },
  carouselImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  imageCounter: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  thumbnailContainer: {
    height: THUMBNAIL_SIZE + 20,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  thumbnailList: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    marginHorizontal: 4,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeThumbnail: {
    borderColor: tokens.colors.najdi.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  activeThumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(161,51,51,0.2)',
  },
});

export default CarouselView;