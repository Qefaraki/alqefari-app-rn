import React, { memo, useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import RenderHtml, {
  HTMLContentModel,
  HTMLElementModel,
  defaultSystemFonts,
  MixedStyleDeclaration,
} from 'react-native-render-html';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import tokens from '../../ui/tokens';

const { width: screenWidth } = Dimensions.get('window');
const CONTENT_WIDTH = screenWidth - 40; // 20px padding on each side

interface ArticleContentRendererProps {
  html: string;
  fontSize: number;
  onImagePress?: (imageUrl: string, index: number) => void;
  onImagesExtracted?: (images: string[]) => void;
}

// System fonts - let iOS choose the right Arabic font automatically
const SYSTEM_FONTS = [...defaultSystemFonts, 'System'];

// Ignored tags
const IGNORED_DOM_TAGS = ['video', 'iframe', 'script', 'audio', 'style'];

// Create tag styles with Najdi design system and better Arabic support
const createTagsStyles = (fontSize: number): Record<string, MixedStyleDeclaration> => ({
  body: {
    color: tokens.colors.najdi.text,
    fontSize: fontSize,
    lineHeight: fontSize * 2.0, // Increased for Arabic diacritics
    fontFamily: 'System',
    letterSpacing: 0.3,
  },
  p: {
    marginBottom: 24,
    color: tokens.colors.najdi.text,
    lineHeight: fontSize * 2.0,
  },
  h1: {
    fontSize: fontSize + 8,
    fontWeight: '700',
    marginTop: 32,
    marginBottom: 24,
    color: tokens.colors.najdi.text,
    letterSpacing: -0.5,
    lineHeight: (fontSize + 8) * 1.4,
    fontFamily: 'System',
  },
  h2: {
    fontSize: fontSize + 5,
    fontWeight: '600',
    marginTop: 28,
    marginBottom: 18,
    color: tokens.colors.najdi.text,
    letterSpacing: -0.3,
    fontFamily: 'System',
  },
  h3: {
    fontSize: fontSize + 3,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 14,
    color: tokens.colors.najdi.text,
    fontFamily: 'System',
  },
  h4: {
    fontSize: fontSize + 1,
    fontWeight: '500',
    marginTop: 20,
    marginBottom: 12,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'System',
  },
  a: {
    color: '#007AFF', // iOS blue
    textDecorationLine: 'none',
    fontWeight: '500',
  },
  strong: {
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  em: {
    fontStyle: 'italic',
    color: tokens.colors.najdi.text,
  },
  li: {
    marginBottom: 12,
    paddingLeft: 8,
    lineHeight: fontSize * 2.0,
    color: tokens.colors.najdi.text,
  },
  ul: {
    marginBottom: 24,
    paddingLeft: 20,
  },
  ol: {
    marginBottom: 24,
    paddingLeft: 20,
  },
  blockquote: {
    marginVertical: 28,
    marginHorizontal: 0,
    paddingHorizontal: 20,
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.najdi.primary,
    fontStyle: 'italic',
    fontSize: fontSize,
    lineHeight: fontSize * 1.8,
    color: tokens.colors.najdi.textMuted,
    backgroundColor: tokens.colors.najdi.container + '08',
    paddingVertical: 16,
    borderRadius: 8,
  },
  code: {
    backgroundColor: tokens.colors.najdi.container + '15',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    fontFamily: 'SF Mono',
    fontSize: fontSize - 2,
    color: tokens.colors.najdi.text,
  },
  pre: {
    backgroundColor: tokens.colors.najdi.container + '15',
    padding: 16,
    borderRadius: 8,
    marginVertical: 24,
    overflow: 'scroll',
    fontFamily: 'SF Mono',
  },
  hr: {
    marginVertical: 32,
    height: 0.5,
    backgroundColor: tokens.colors.najdi.container + '30',
  },
  figure: {
    marginVertical: 24,
    marginHorizontal: -20, // Break out to full width
  },
  figcaption: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 20,
    fontFamily: 'System',
    fontWeight: '400',
  },
  img: {
    marginVertical: 24,
    borderRadius: 0,
  },
  table: {
    borderWidth: 0.5,
    borderColor: tokens.colors.najdi.container + '40',
    marginVertical: 24,
    borderRadius: 8,
    overflow: 'hidden',
  },
  th: {
    backgroundColor: tokens.colors.najdi.container + '10',
    padding: 10,
    fontWeight: '600',
  },
  td: {
    padding: 10,
    borderTopWidth: 0.5,
    borderTopColor: tokens.colors.najdi.container + '20',
  },
});

// Classes styles for WordPress content
const CLASSES_STYLES: Record<string, MixedStyleDeclaration> = {
  'wp-block-image': {
    marginVertical: 24,
    marginHorizontal: -20, // Break out to full width
  },
  'wp-block-quote': {
    marginVertical: 28,
    paddingLeft: 20,
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.najdi.primary,
  },
  'wp-caption': {
    marginVertical: 24,
  },
  'wp-caption-text': {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 20,
    fontFamily: 'System',
    fontWeight: '400',
  },
  'aligncenter': {
    alignSelf: 'center',
  },
  'alignleft': {
    alignSelf: 'flex-start',
  },
  'alignright': {
    alignSelf: 'flex-end',
  },
};

// Custom renderers for better image and caption handling
const createRenderers = (onImagePress?: (url: string, index: number) => void, images?: string[]) => ({
  img: ({ TDefaultRenderer, ...props }: any) => {
    const { src, alt } = props.tnode.attributes || {};

    if (!src) return null;

    // Calculate image dimensions
    let imageWidth = screenWidth - 40; // With padding
    let imageHeight = imageWidth * 0.56; // Default 16:9 aspect ratio

    // Try to parse dimensions from attributes
    const width = props.tnode.attributes?.width;
    const height = props.tnode.attributes?.height;

    if (width && height) {
      const aspectRatio = parseInt(height) / parseInt(width);
      imageHeight = imageWidth * aspectRatio;
    }

    const handleImagePress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Find the index of this image in the array
      const imageIndex = images ? images.indexOf(src) : -1;
      if (onImagePress && imageIndex !== -1) {
        onImagePress(src, imageIndex);
      }
    };

    return (
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={handleImagePress}
        style={styles.imageContainer}
      >
        <Image
          source={{ uri: src }}
          style={[
            styles.inlineImage,
            {
              width: imageWidth,
              height: imageHeight
            }
          ]}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
        {/* Only show alt text if it's not a filename */}
        {alt && !alt.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
          <Text style={styles.imageCaption}>{alt}</Text>
        )}
      </TouchableOpacity>
    );
  },

  a: ({ TDefaultRenderer, ...props }: any) => {
    const { href } = props.tnode.attributes || {};

    const handleLinkPress = () => {
      if (href) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Linking.openURL(href).catch(() => {
          Alert.alert('خطأ', 'لا يمكن فتح الرابط');
        });
      }
    };

    return (
      <Text
        style={styles.link}
        onPress={handleLinkPress}
      >
        <TDefaultRenderer {...props} />
      </Text>
    );
  },

  blockquote: ({ TDefaultRenderer, ...props }: any) => {
    return (
      <View style={styles.blockquote}>
        <View style={styles.blockquoteContent}>
          <Text style={styles.quoteIcon}>"</Text>
          <TDefaultRenderer {...props} />
        </View>
      </View>
    );
  },

  // Render figcaption as-is without filtering
  figcaption: ({ TDefaultRenderer, ...props }: any) => {
    return <TDefaultRenderer {...props} />;
  },
});

const ArticleContentRenderer: React.FC<ArticleContentRendererProps> = memo(({
  html,
  fontSize,
  onImagePress,
  onImagesExtracted,
}) => {
  // Track all images in the article
  const [articleImages, setArticleImages] = useState<string[]>([]);

  // Extract images from HTML on mount or when HTML changes
  useEffect(() => {
    if (!html) return;

    // Extract all image URLs from HTML
    const imgRegex = /<img[^>]+src="([^"]+)"/gi;
    const images: string[] = [];
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      const imageUrl = match[1];
      // Skip tiny images (likely icons)
      if (!imageUrl.includes('20x20') && !imageUrl.includes('32x32')) {
        images.push(imageUrl.replace(/&amp;/g, '&'));
      }
    }

    setArticleImages(images);

    // Notify parent component about extracted images
    if (onImagesExtracted && images.length > 0) {
      onImagesExtracted(images);
    }
  }, [html, onImagesExtracted]);

  // Create styles based on font size
  const tagsStyles = useMemo(
    () => createTagsStyles(fontSize),
    [fontSize]
  );

  // Create renderers with image handling
  const renderers = useMemo(
    () => createRenderers(onImagePress, articleImages),
    [onImagePress, articleImages]
  );

  // Clean HTML for better rendering
  const cleanHtml = useMemo(() => {
    // Remove gallery shortcodes and clean up
    return html
      .replace(/\[gallery[^\]]*\]/g, '')
      .replace(/\[caption[^\]]*\](.*?)\[\/caption\]/g, '$1')
      .replace(/<!--more-->/g, '')
      .replace(/<!--nextpage-->/g, '');
  }, [html]);

  return (
    <View style={styles.container}>
      <RenderHtml
        contentWidth={CONTENT_WIDTH}
        source={{ html: cleanHtml }}
        renderers={renderers}
        tagsStyles={tagsStyles}
        classesStyles={CLASSES_STYLES}
        systemFonts={SYSTEM_FONTS}
        ignoredDomTags={IGNORED_DOM_TAGS}
        enableExperimentalMarginCollapsing={true}
        enableExperimentalBRCollapsing={true}
        defaultTextProps={{
          allowFontScaling: false,
          selectable: true,
        }}
        renderersProps={{
          img: {
            enableExperimentalPercentWidth: true,
          },
        }}
      />
    </View>
  );
});

ArticleContentRenderer.displayName = 'ArticleContentRenderer';

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  imageContainer: {
    marginVertical: 24,
    alignSelf: 'center',
  },
  inlineImage: {
    borderRadius: 8, // iOS-style corners
    backgroundColor: tokens.colors.najdi.container + '10',
  },
  imageCaption: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 20,
    fontFamily: 'System',
    fontWeight: '400',
  },
  link: {
    color: '#007AFF', // iOS blue
    fontWeight: '500',
  },
  blockquote: {
    marginVertical: 28,
    marginHorizontal: 0,
    backgroundColor: tokens.colors.najdi.container + '08',
    borderRadius: 8,
    padding: 20,
    borderRightWidth: 4,
    borderRightColor: tokens.colors.najdi.primary,
  },
  blockquoteContent: {
    position: 'relative',
  },
  quoteIcon: {
    position: 'absolute',
    top: -10,
    right: -10,
    fontSize: 48,
    color: tokens.colors.najdi.primary + '20',
    fontFamily: 'Georgia',
    fontWeight: '700',
  },
  figcaption: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 20,
    fontFamily: 'System',
    fontWeight: '400',
  },
});

export default ArticleContentRenderer;