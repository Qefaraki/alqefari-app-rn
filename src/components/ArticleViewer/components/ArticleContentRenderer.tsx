import React, { memo, useMemo } from 'react';
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
}

// System fonts with Arabic support - iOS native stack
const SYSTEM_FONTS = [...defaultSystemFonts, 'SF Arabic Rounded', 'SF Arabic', 'System'];

// Ignored tags
const IGNORED_DOM_TAGS = ['video', 'iframe', 'script', 'audio', 'style'];

// Create tag styles with Najdi design system and better Arabic support
const createTagsStyles = (fontSize: number): Record<string, MixedStyleDeclaration> => ({
  body: {
    color: tokens.colors.najdi.text,
    fontSize: fontSize,
    lineHeight: fontSize * 2.0, // Increased for Arabic diacritics
    fontFamily: 'SF Arabic',
    letterSpacing: 0.3,
    textAlign: 'right',
    writingDirection: 'rtl',
    direction: 'rtl',
  },
  p: {
    marginBottom: 24,
    color: tokens.colors.najdi.text,
    textAlign: 'right',
    writingDirection: 'rtl',
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
    fontFamily: 'SF Arabic',
    textAlign: 'right',
  },
  h2: {
    fontSize: fontSize + 5,
    fontWeight: '600',
    marginTop: 28,
    marginBottom: 18,
    color: tokens.colors.najdi.text,
    letterSpacing: -0.3,
    fontFamily: 'SF Arabic',
    textAlign: 'right',
  },
  h3: {
    fontSize: fontSize + 3,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 14,
    color: tokens.colors.najdi.text,
    fontFamily: 'SF Arabic',
    textAlign: 'right',
  },
  h4: {
    fontSize: fontSize + 1,
    fontWeight: '500',
    marginTop: 20,
    marginBottom: 12,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF Arabic',
    textAlign: 'right',
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
    paddingRight: 8,
    lineHeight: fontSize * 2.0,
    textAlign: 'right',
    color: tokens.colors.najdi.text,
    direction: 'rtl',
  },
  ul: {
    marginBottom: 24,
    paddingRight: 20,
    direction: 'rtl',
  },
  ol: {
    marginBottom: 24,
    paddingRight: 20,
    direction: 'rtl',
  },
  blockquote: {
    marginVertical: 28,
    marginHorizontal: 0,
    paddingRight: 20,
    paddingLeft: 20,
    borderRightWidth: 4,
    borderRightColor: tokens.colors.najdi.primary,
    borderLeftWidth: 0,
    fontStyle: 'italic',
    fontSize: fontSize,
    lineHeight: fontSize * 1.8,
    color: tokens.colors.najdi.textMuted,
    backgroundColor: tokens.colors.najdi.container + '08',
    paddingVertical: 16,
    borderRadius: 8,
    textAlign: 'center',
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
    fontFamily: 'SF Arabic',
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
    textAlign: 'right',
  },
  td: {
    padding: 10,
    borderTopWidth: 0.5,
    borderTopColor: tokens.colors.najdi.container + '20',
    textAlign: 'right',
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
    paddingRight: 20,
    borderRightWidth: 4,
    borderRightColor: tokens.colors.najdi.primary,
    borderLeftWidth: 0,
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
const createRenderers = () => ({
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
      // Could implement full-screen image viewer here
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

  // Smart figcaption - filter out filenames
  figcaption: ({ TDefaultRenderer, ...props }: any) => {
    // Get the text content
    const text = props.tnode.children?.[0]?.data || '';

    // Skip if it's just a filename
    if (text.match(/^[^.]+\.(jpg|jpeg|png|gif|webp)$/i)) {
      return null;
    }

    // Skip if it's empty or just whitespace
    if (!text.trim()) {
      return null;
    }

    return (
      <Text style={styles.figcaption}>
        {text}
      </Text>
    );
  },
});

const ArticleContentRenderer: React.FC<ArticleContentRendererProps> = memo(({
  html,
  fontSize,
}) => {
  // Create styles based on font size
  const tagsStyles = useMemo(
    () => createTagsStyles(fontSize),
    [fontSize]
  );

  // Create renderers once
  const renderers = useMemo(
    () => createRenderers(),
    []
  );

  // Clean HTML for better rendering
  const cleanHtml = useMemo(() => {
    // Remove gallery shortcodes and clean up
    let cleaned = html
      .replace(/\[gallery[^\]]*\]/g, '')
      .replace(/\[caption[^\]]*\](.*?)\[\/caption\]/g, '$1')
      .replace(/<!--more-->/g, '')
      .replace(/<!--nextpage-->/g, '');

    // Add RTL direction to root if not present
    if (!cleaned.includes('dir="rtl"')) {
      cleaned = `<div dir="rtl">${cleaned}</div>`;
    }

    return cleaned;
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
          style: {
            textAlign: 'right',
            writingDirection: 'rtl',
          }
        }}
        renderersProps={{
          img: {
            enableExperimentalPercentWidth: true,
          },
        }}
        baseStyle={{
          direction: 'rtl',
          textAlign: 'right',
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
    direction: 'rtl',
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
    fontFamily: 'SF Arabic',
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
    fontFamily: 'SF Arabic',
    fontWeight: '400',
  },
});

export default ArticleContentRenderer;