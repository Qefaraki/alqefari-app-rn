import React, { useMemo, useState, useCallback, memo } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Text,
  ActivityIndicator,
  Alert,
  ListRenderItemInfo,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import tokens from '../../../ui/tokens';

const { width: screenWidth } = Dimensions.get('window');
const PADDING = 8;
const COLUMNS = 2;
const COLUMN_WIDTH = (screenWidth - PADDING * (COLUMNS + 1)) / COLUMNS;
const DEFAULT_ASPECT_RATIO = 1;
const ESTIMATED_ITEM_HEIGHT = COLUMN_WIDTH / DEFAULT_ASPECT_RATIO + PADDING;

interface MasonryViewProps {
  images: string[];
  isNightMode: boolean;
  isSelectionMode?: boolean;
  selectedImages?: Set<string>;
  onToggleSelection?: (url: string) => void;
}

interface MasonryRow {
  id: string;
  items: Array<{ url: string; columnIndex: number }>;
  height: number;
}

// Memoized image item component
const MasonryImageItem = memo(({
  url,
  isSelected,
  isSelectionMode,
  selectedIndex,
  onPress,
  isNightMode,
}: {
  url: string;
  isSelected: boolean;
  isSelectionMode: boolean;
  selectedIndex: number;
  onPress: () => void;
  isNightMode: boolean;
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <TouchableOpacity
      style={[
        styles.imageContainer,
        isSelected && styles.selectedContainer,
      ]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <Image
        source={{ uri: url }}
        style={styles.image}
        contentFit="cover"
        transition={300}
        onLoad={() => setIsLoaded(true)}
        recyclingKey={url}
        cachePolicy="memory-disk"
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
                {selectedIndex + 1}
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
}, (prevProps, nextProps) => {
  // Custom comparison for better memo performance
  return (
    prevProps.url === nextProps.url &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.selectedIndex === nextProps.selectedIndex &&
    prevProps.isNightMode === nextProps.isNightMode
  );
});

MasonryImageItem.displayName = 'MasonryImageItem';

const MasonryView: React.FC<MasonryViewProps> = ({
  images,
  isNightMode,
  isSelectionMode = false,
  selectedImages = new Set(),
  onToggleSelection,
}) => {
  // Pre-calculate masonry layout as rows for FlatList
  const masonryRows = useMemo(() => {
    const rows: MasonryRow[] = [];
    let currentRow: Array<{ url: string; columnIndex: number }> = [];
    let rowId = 0;

    for (let i = 0; i < images.length; i += COLUMNS) {
      currentRow = [];

      // Fill the current row with up to COLUMNS items
      for (let j = 0; j < COLUMNS && i + j < images.length; j++) {
        currentRow.push({
          url: images[i + j],
          columnIndex: j,
        });
      }

      rows.push({
        id: `row-${rowId}`,
        items: currentRow,
        height: ESTIMATED_ITEM_HEIGHT,
      });
      rowId++;
    }

    return rows;
  }, [images]);

  // Handle image press with memoization
  const handleImagePress = useCallback((url: string) => {
    if (isSelectionMode && onToggleSelection) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onToggleSelection(url);
    } else {
      // Open full screen viewer
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert('معاينة', 'سيتم فتح معاينة الصورة بالحجم الكامل قريباً');
    }
  }, [isSelectionMode, onToggleSelection]);

  // Get selected index for a URL
  const getSelectedIndex = useCallback((url: string) => {
    if (!selectedImages.has(url)) return -1;
    return Array.from(selectedImages).indexOf(url);
  }, [selectedImages]);

  // Render a row of masonry items
  const renderRow = useCallback(({ item }: ListRenderItemInfo<MasonryRow>) => {
    return (
      <View style={styles.row}>
        {item.items.map((imageItem, index) => (
          <View
            key={imageItem.url}
            style={[
              styles.columnItem,
              { width: COLUMN_WIDTH },
              index > 0 && { marginLeft: PADDING },
            ]}
          >
            <MasonryImageItem
              url={imageItem.url}
              isSelected={selectedImages.has(imageItem.url)}
              isSelectionMode={isSelectionMode}
              selectedIndex={getSelectedIndex(imageItem.url)}
              onPress={() => handleImagePress(imageItem.url)}
              isNightMode={isNightMode}
            />
          </View>
        ))}
        {/* Add empty space for incomplete rows */}
        {item.items.length < COLUMNS && (
          <View
            style={[
              styles.columnItem,
              {
                width: COLUMN_WIDTH * (COLUMNS - item.items.length) + PADDING * (COLUMNS - item.items.length - 1),
                marginLeft: PADDING,
              },
            ]}
          />
        )}
      </View>
    );
  }, [selectedImages, isSelectionMode, getSelectedIndex, handleImagePress, isNightMode]);

  // Key extractor
  const keyExtractor = useCallback((item: MasonryRow) => item.id, []);

  // Get item layout for performance
  const getItemLayout = useCallback((data: MasonryRow[] | null | undefined, index: number) => ({
    length: ESTIMATED_ITEM_HEIGHT,
    offset: ESTIMATED_ITEM_HEIGHT * index,
    index,
  }), []);

  return (
    <FlatList
      data={masonryRows}
      renderItem={renderRow}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      style={[styles.container, isNightMode && styles.containerDark]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
      maxToRenderPerBatch={4}
      updateCellsBatchingPeriod={50}
      initialNumToRender={6}
      windowSize={10}
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
      }}
    />
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
    paddingHorizontal: PADDING,
  },
  row: {
    flexDirection: 'row',
    marginBottom: PADDING,
  },
  columnItem: {
    height: ESTIMATED_ITEM_HEIGHT - PADDING,
  },
  imageContainer: {
    flex: 1,
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