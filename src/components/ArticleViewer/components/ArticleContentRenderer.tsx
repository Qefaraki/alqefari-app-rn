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

// System fonts with Arabic support
const SYSTEM_FONTS = [...defaultSystemFonts, 'SF Arabic', 'System'];

// Ignored tags
const IGNORED_DOM_TAGS = ['video', 'iframe', 'script', 'audio', 'style'];

// Create tag styles with Najdi design system
const createTagsStyles = (fontSize: number): Record<string, MixedStyleDeclaration> => ({
  body: {
    color: tokens.colors.najdi.text,
    fontSize: fontSize,
    lineHeight: fontSize * 1.8,
    fontFamily: 'System',
    letterSpacing: 0.2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  p: {
    marginBottom: 20,
    color: tokens.colors.najdi.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  h1: {
    fontSize: fontSize + 7,
    fontWeight: '800',
    marginTop: 28,
    marginBottom: 20,
    color: tokens.colors.najdi.text,
    letterSpacing: -0.3,
    lineHeight: (fontSize + 7) * 1.3,
    fontFamily: 'SF Arabic',
    textAlign: 'right',
  },
  h2: {
    fontSize: fontSize + 4,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 16,
    color: tokens.colors.najdi.text,
    letterSpacing: -0.2,
    fontFamily: 'SF Arabic',
    textAlign: 'right',
  },
  h3: {
    fontSize: fontSize + 2,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
    color: tokens.colors.najdi.text,
    fontFamily: 'SF Arabic',
    textAlign: 'right',
  },
  h4: {
    fontSize: fontSize + 1,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 10,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF Arabic',
    textAlign: 'right',
  },
  a: {
    color: tokens.colors.najdi.primary,
    textDecorationLine: 'none',
    fontWeight: '500',
  },
  strong: {
    fontWeight: '700',
    color: tokens.colors.najdi.text,
  },
  em: {
    fontStyle: 'italic',
    color: tokens.colors.najdi.text,
  },
  li: {
    marginBottom: 10,
    paddingLeft: 8,
    lineHeight: fontSize * 1.8,
    textAlign: 'right',
    color: tokens.colors.najdi.text,
  },
  ul: {
    marginBottom: 20,
    paddingLeft: 20,
  },
  ol: {
    marginBottom: 20,
    paddingLeft: 20,
  },
  blockquote: {
    marginVertical: 24,
    marginHorizontal: 0,
    paddingLeft: 16,
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.najdi.primary,
    fontStyle: 'italic',
    fontSize: fontSize,
    lineHeight: fontSize * 1.7,
    color: tokens.colors.najdi.textMuted,
    backgroundColor: tokens.colors.najdi.container + '10',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  code: {
    backgroundColor: tokens.colors.najdi.container + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'Menlo',
    fontSize: fontSize - 2,
    color: tokens.colors.najdi.text,
  },
  pre: {
    backgroundColor: tokens.colors.najdi.container + '20',
    padding: 16,
    borderRadius: 8,
    marginVertical: 20,
    overflow: 'scroll',
    fontFamily: 'Menlo',
  },
  hr: {
    marginVertical: 28,
    height: 1,
    backgroundColor: tokens.colors.najdi.container + '40',
  },
  figure: {
    marginVertical: 20,
    marginHorizontal: -20, // Break out to full width
  },
  figcaption: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
    paddingHorizontal: 20,
    lineHeight: 18,
    fontFamily: 'SF Arabic',
  },
  img: {
    marginVertical: 20,
    borderRadius: 0,
  }
});

// Classes styles for WordPress content
const CLASSES_STYLES: Record<string, MixedStyleDeclaration> = {
  'wp-block-image': {
    marginVertical: 20,
    marginHorizontal: -20, // Break out to full width
  },
  'wp-block-quote': {
    marginVertical: 24,
    paddingLeft: 16,
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.najdi.primary,
  },
  'wp-caption': {
    marginVertical: 20,
  },
  'wp-caption-text': {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
    paddingHorizontal: 20,
    lineHeight: 18,
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

// Custom renderers for better image handling
const createRenderers = () => ({
  img: ({ TDefaultRenderer, ...props }: any) => {
    const { src } = props.tnode.attributes || {};

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
        <View style={styles.blockquoteBorder} />
        <View style={styles.blockquoteContent}>
          <TDefaultRenderer {...props} />
        </View>
      </View>
    );
  },

  // Remove figcaption to prevent filename showing
  figcaption: () => null,
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
    // Remove gallery shortcodes, captions, and clean up
    return html
      .replace(/\[gallery[^\]]*\]/g, '')
      .replace(/\[caption[^\]]*\](.*?)\[\/caption\]/g, '$1')
      .replace(/<!--more-->/g, '')
      .replace(/<!--nextpage-->/g, '')
      // Remove img alt attributes that might be filenames
      .replace(/<img([^>]*?)alt=["'][^"']*\.(jpg|jpeg|png|gif|webp)["']/gi, '<img$1alt=""')
      // Remove title attributes that might be filenames
      .replace(/<img([^>]*?)title=["'][^"']*\.(jpg|jpeg|png|gif|webp)["']/gi, '<img$1');
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
    marginVertical: 20,
    alignSelf: 'center',
  },
  inlineImage: {
    borderRadius: 12,
    backgroundColor: tokens.colors.najdi.container + '10',
  },
  link: {
    color: tokens.colors.najdi.primary,
    fontWeight: '500',
  },
  blockquote: {
    flexDirection: 'row',
    marginVertical: 24,
    marginHorizontal: 0,
    backgroundColor: tokens.colors.najdi.container + '10',
    borderRadius: 8,
    padding: 16,
  },
  blockquoteBorder: {
    width: 3,
    backgroundColor: tokens.colors.najdi.primary,
    marginRight: 16,
    borderRadius: 1.5,
  },
  blockquoteContent: {
    flex: 1,
    paddingRight: 4,
  },
});

export default ArticleContentRenderer;