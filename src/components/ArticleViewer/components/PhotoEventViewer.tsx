import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { NewsArticle } from '../../../services/news';
import tokens from '../../ui/tokens';
import {
  extractGalleryLink,
  extractPreviewImages,
  getLinkButtonText,
  countImages,
  LinkType,
} from '../utils/linkExtractor';

const { width: screenWidth } = Dimensions.get('window');
const GRID_SIZE = 3;
const PADDING = 4;
const IMAGE_SIZE = (screenWidth - PADDING * (GRID_SIZE + 1)) / GRID_SIZE;

interface PhotoEventViewerProps {
  article: NewsArticle;
  isNightMode: boolean;
}

const PhotoEventViewer: React.FC<PhotoEventViewerProps> = ({
  article,
  isNightMode,
}) => {
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [externalLink, setExternalLink] = useState('');
  const [linkType, setLinkType] = useState<LinkType>('article');
  const [imageCount, setImageCount] = useState(0);
  const [isLoadingPreviews, setIsLoadingPreviews] = useState(true);

  console.log('PhotoEventViewer rendering for:', article?.title);

  // Extract data from article
  useEffect(() => {
    if (!article?.html) {
      console.log('No HTML content for PhotoEventViewer');
      return;
    }

    try {
      console.log('Extracting data for PhotoEventViewer, HTML length:', article.html.length);

      // Extract link and type
      const linkData = extractGalleryLink(article.html, article);
      setExternalLink(linkData.url);
      setLinkType(linkData.type);
      console.log('Extracted link:', linkData.url, 'type:', linkData.type);

      // Count total images
      const count = countImages(article.html);
      setImageCount(count);
      console.log('Image count:', count);

      // Extract preview images
      const previews = extractPreviewImages(article.html, 9); // 3x3 grid
      setPreviewImages(previews);
      console.log('Preview images extracted:', previews.length);

      setIsLoadingPreviews(false);
    } catch (error) {
      console.error('Error extracting data for PhotoEventViewer:', error);
      // Set fallback values
      setExternalLink(article.permalink || '');
      setLinkType('article');
      setImageCount(0);
      setPreviewImages([]);
      setIsLoadingPreviews(false);
    }
  }, [article]);

  // Extract clean summary text
  const summaryText = useMemo(() => {
    if (!article.summary) return '';

    // Clean up summary - remove HTML if any
    const cleanText = article.summary
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-z]+;/gi, '')
      .trim();

    // Limit to reasonable length
    return cleanText.length > 300
      ? cleanText.substring(0, 300) + '...'
      : cleanText;
  }, [article.summary]);

  // Handle external link press
  const handleExternalLink = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await Linking.openURL(externalLink);
    } catch (error) {
      console.error('Failed to open link:', error);
    }
  };

  return (
    <BottomSheetScrollView
      style={[styles.container, isNightMode && styles.containerDark]}
      showsVerticalScrollIndicator={false}
    >
      {/* Article Title */}
      <View style={styles.header}>
        <Text style={[styles.title, isNightMode && styles.titleDark]}>
          {article.title}
        </Text>
      </View>

      {/* Article Summary */}
      {summaryText ? (
        <View style={styles.summaryContainer}>
          <Text style={[styles.summary, isNightMode && styles.summaryDark]}>
            {summaryText}
          </Text>
        </View>
      ) : null}

      {/* Photo Count Badge */}
      <View style={styles.photoCountContainer}>
        <View style={[styles.photoCountBadge, isNightMode && styles.photoCountBadgeDark]}>
          <Ionicons
            name="images"
            size={20}
            color={isNightMode ? '#FFFFFF' : tokens.colors.najdi.text}
          />
          <Text style={[styles.photoCountText, isNightMode && styles.photoCountTextDark]}>
            {imageCount} صورة من الحدث
          </Text>
        </View>
      </View>

      {/* Preview Grid */}
      {isLoadingPreviews ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tokens.colors.najdi.primary} />
        </View>
      ) : previewImages.length > 0 ? (
        <View style={styles.previewGrid}>
          {previewImages.slice(0, 9).map((imageUrl, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.gridItem,
                index % GRID_SIZE === 0 && styles.gridItemLeft,
                index % GRID_SIZE === GRID_SIZE - 1 && styles.gridItemRight,
              ]}
              activeOpacity={0.9}
              onPress={handleExternalLink}
            >
              <Image
                source={{ uri: imageUrl }}
                style={styles.gridImage}
                contentFit="cover"
                transition={300}
                cachePolicy="memory-disk"
              />

              {/* Overlay for last item if more images exist */}
              {index === 8 && imageCount > 9 && (
                <View style={styles.moreOverlay}>
                  <Text style={styles.moreText}>+{imageCount - 9}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* External Link Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.externalButton, isNightMode && styles.externalButtonDark]}
          onPress={handleExternalLink}
          activeOpacity={0.8}
        >
          <View style={styles.buttonContent}>
            <Text style={[styles.buttonText, isNightMode && styles.buttonTextDark]}>
              {getLinkButtonText(linkType, imageCount)}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={isNightMode ? '#FFFFFF' : tokens.colors.najdi.text}
            />
          </View>
        </TouchableOpacity>

        {/* Secondary info */}
        {linkType === 'article' && (
          <Text style={[styles.helperText, isNightMode && styles.helperTextDark]}>
            سيتم فتح المقال في المتصفح لعرض جميع الصور
          </Text>
        )}

        {linkType === 'drive' && (
          <Text style={[styles.helperText, isNightMode && styles.helperTextDark]}>
            الصور متوفرة بالجودة الكاملة على Google Drive
          </Text>
        )}
      </View>

      {/* Spacer at bottom */}
      <View style={{ height: 100 }} />
    </BottomSheetScrollView>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
    lineHeight: 32,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  summaryContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  summary: {
    fontSize: 16,
    lineHeight: 24,
    color: tokens.colors.najdi.textMuted,
  },
  summaryDark: {
    color: 'rgba(255,255,255,0.7)',
  },
  photoCountContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  photoCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.najdi.container + '20',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  photoCountBadgeDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  photoCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  photoCountTextDark: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    height: screenWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: PADDING,
    paddingBottom: 20,
  },
  gridItem: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    marginBottom: PADDING,
    marginHorizontal: PADDING / 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  gridItemLeft: {
    marginLeft: PADDING,
  },
  gridItemRight: {
    marginRight: PADDING,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  externalButton: {
    backgroundColor: tokens.colors.najdi.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  externalButtonDark: {
    backgroundColor: tokens.colors.najdi.primary,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  buttonTextDark: {
    color: '#FFFFFF',
  },
  helperText: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },
  helperTextDark: {
    color: 'rgba(255,255,255,0.5)',
  },
});

export default PhotoEventViewer;