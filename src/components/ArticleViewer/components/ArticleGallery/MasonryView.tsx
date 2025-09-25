import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Text,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import tokens from '../../../ui/tokens';

const { width: screenWidth } = Dimensions.get('window');
const PADDING = 8;
const COLUMNS = 2;
const COLUMN_WIDTH = (screenWidth - PADDING * (COLUMNS + 1)) / COLUMNS;

interface MasonryViewProps {
  images: string[];
  isNightMode: boolean;
  isSelectionMode?: boolean;
  selectedImages?: Set<string>;
  onToggleSelection?: (url: string) => void;
}

interface MasonryItem {
  url: string;
  height: number;
  column: number;
}

const MasonryView: React.FC<MasonryViewProps> = ({
  images,
  isNightMode,
  isSelectionMode = false,
  selectedImages = new Set(),
  onToggleSelection,
}) => {
  const [imageDimensions, setImageDimensions] = useState<Map<string, { width: number; height: number }>>(new Map());
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  // Calculate masonry layout
  const masonryLayout = useMemo(() => {
    const columnHeights = Array(COLUMNS).fill(0);
    const items: MasonryItem[] = [];

    images.forEach(url => {
      // Find the shortest column
      const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));

      // Get image dimensions or use default aspect ratio
      const dimensions = imageDimensions.get(url);
      const aspectRatio = dimensions ? dimensions.width / dimensions.height : 1;
      const itemHeight = COLUMN_WIDTH / aspectRatio;

      items.push({
        url,
        height: itemHeight,
        column: shortestColumnIndex,
      });

      // Update column height
      columnHeights[shortestColumnIndex] += itemHeight + PADDING;
    });

    return { items, maxHeight: Math.max(...columnHeights) };
  }, [images, imageDimensions]);

  // Handle image load to get dimensions
  const handleImageLoad = useCallback((url: string, width: number, height: number) => {
    setImageDimensions(prev => {
      const newMap = new Map(prev);
      newMap.set(url, { width, height });
      return newMap;
    });
    setLoadedImages(prev => {
      const newSet = new Set(prev);
      newSet.add(url);
      return newSet;
    });
  }, []);

  // Handle image press
  const handleImagePress = useCallback((url: string) => {
    if (isSelectionMode && onToggleSelection) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onToggleSelection(url);
    } else {
      // Open full screen viewer
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // TODO: Implement full screen image viewer
      Alert.alert('معاينة', 'سيتم فتح معاينة الصورة بالحجم الكامل قريباً');
    }
  }, [isSelectionMode, onToggleSelection]);

  // Group items by column
  const columns = useMemo(() => {
    const cols: MasonryItem[][] = Array.from({ length: COLUMNS }, () => []);

    masonryLayout.items.forEach(item => {
      cols[item.column].push(item);
    });

    return cols;
  }, [masonryLayout]);

  return (
    <ScrollView
      style={[styles.container, isNightMode && styles.containerDark]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.masonryContainer}>
        {columns.map((column, columnIndex) => (
          <View key={columnIndex} style={styles.column}>
            {column.map((item, itemIndex) => {
              const isSelected = selectedImages.has(item.url);
              const isLoaded = loadedImages.has(item.url);

              return (
                <TouchableOpacity
                  key={`${columnIndex}-${itemIndex}`}
                  style={[
                    styles.imageContainer,
                    { height: item.height },
                    isSelected && styles.selectedContainer,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleImagePress(item.url)}
                >
                  <Image
                    source={{ uri: item.url }}
                    style={styles.image}
                    contentFit="cover"
                    transition={300}
                    onLoad={(event) => {
                      const { width, height } = event.source;
                      handleImageLoad(item.url, width, height);
                    }}
                  />

                  {/* Loading indicator */}
                  {!isLoaded && (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="small" color={tokens.colors.najdi.primary} />
                    </View>
                  )}

                  {/* Selection overlay */}
                  {isSelectionMode && (
                    <View style={[styles.selectionOverlay, isSelected && styles.selectedOverlay]}>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && (
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        )}
                      </View>
                      {isSelected && (
                        <View style={styles.selectedBadge}>
                          <Text style={styles.selectedNumber}>
                            {Array.from(selectedImages).indexOf(item.url) + 1}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Gradient overlay for better visibility */}
                  {isSelectionMode && (
                    <View style={styles.gradientOverlay} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  contentContainer: {
    paddingVertical: PADDING,
  },
  masonryContainer: {
    flexDirection: 'row',
    paddingHorizontal: PADDING,
  },
  column: {
    flex: 1,
    paddingHorizontal: PADDING / 2,
  },
  imageContainer: {
    marginBottom: PADDING,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  selectedContainer: {
    borderWidth: 3,
    borderColor: tokens.colors.najdi.primary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 8,
  },
  selectedOverlay: {
    backgroundColor: 'rgba(161,51,51,0.2)', // Najdi Crimson with transparency
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  checkbox: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: tokens.colors.najdi.primary,
    borderColor: tokens.colors.najdi.primary,
  },
  selectedBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.colors.najdi.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedNumber: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default MasonryView;