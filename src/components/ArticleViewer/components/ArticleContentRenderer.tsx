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

// System fonts
const SYSTEM_FONTS = [...defaultSystemFonts, 'SF Arabic', 'System'];

// Ignored tags
const IGNORED_DOM_TAGS = ['video', 'iframe', 'script', 'audio'];

// Create tag styles with improved typography
const createTagsStyles = (fontSize: number): Record<string, MixedStyleDeclaration> => ({
  body: {
    color: '#1C1C1E',
    fontSize: fontSize,
    lineHeight: fontSize * 1.7,
    fontFamily: 'System',
    letterSpacing: 0.1,
  },
  p: {
    marginBottom: 24,
    color: '#1C1C1E',
  },
  h1: {
    fontSize: fontSize + 8,
    fontWeight: '800',
    marginTop: 32,
    marginBottom: 24,
    color: '#000000',
    letterSpacing: -0.5,
    lineHeight: (fontSize + 8) * 1.2,
    fontFamily: 'SF Arabic',
  },
  h2: {
    fontSize: fontSize + 5,
    fontWeight: '700',
    marginTop: 28,
    marginBottom: 16,
    color: '#000000',
    letterSpacing: -0.3,
    fontFamily: 'SF Arabic',
  },
  h3: {
    fontSize: fontSize + 3,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
    color: '#1C1C1E',
    fontFamily: 'SF Arabic',
  },
  h4: {
    fontSize: fontSize + 1,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    color: '#3C3C43',
    fontFamily: 'SF Arabic',
  },
  a: {
    color: tokens.colors.najdi.primary,
    textDecorationLine: 'none',
    fontWeight: '500',
  },
  strong: {
    fontWeight: '700',
    color: '#000000',
  },
  em: {
    fontStyle: 'italic',
    color: '#3C3C43',
  },
  li: {
    marginBottom: 12,
    paddingLeft: 8,
    lineHeight: fontSize * 1.7,
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
    marginVertical: 32,
    marginHorizontal: 0,
    paddingLeft: 20,
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.najdi.primary,
    fontStyle: 'italic',
    fontSize: fontSize + 1,
    lineHeight: (fontSize + 1) * 1.6,
    color: '#48484A',
  },
  code: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'Menlo',
    fontSize: fontSize - 2,
    color: '#000000',
  },
  pre: {
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 12,
    marginVertical: 24,
    overflow: 'scroll',
    fontFamily: 'Menlo',
  },
  hr: {
    marginVertical: 32,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C6C6C8',
  },
  figure: {
    marginVertical: 24,
    marginHorizontal: -20, // Break out to full width
  },
  figcaption: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 20,
    fontFamily: 'SF Arabic',
  },
  img: {
    marginVertical: 24,
    borderRadius: 0, // Full width, no radius
  }
});

// Classes styles for WordPress content
const CLASSES_STYLES: Record<string, MixedStyleDeclaration> = {
  'wp-block-image': {
    marginVertical: 24,
    marginHorizontal: -20, // Break out to full width
  },
  'wp-block-quote': {
    marginVertical: 32,
    paddingLeft: 20,
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.najdi.primary,
  },
  'wp-caption': {
    marginVertical: 24,
  },
  'wp-caption-text': {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 20,
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
    const { src, alt } = props.tnode.attributes || {};

    if (!src) return null;

    // Calculate image dimensions
    let imageWidth = screenWidth; // Full width
    let imageHeight = screenWidth * 0.56; // Default 16:9 aspect ratio

    // Try to parse dimensions from attributes
    const width = props.tnode.attributes?.width;
    const height = props.tnode.attributes?.height;

    if (width && height) {
      const aspectRatio = parseInt(height) / parseInt(width);
      imageHeight = imageWidth * aspectRatio;
    }

    const handleImagePress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Could implement image viewer here
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
            { height: imageHeight }
          ]}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
        {alt && (
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
        <View style={styles.blockquoteBorder} />
        <View style={styles.blockquoteContent}>
          <TDefaultRenderer {...props} />
        </View>
      </View>
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
    // Remove gallery shortcodes and other WordPress artifacts
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
    marginHorizontal: -20, // Break out to full width
    marginVertical: 24,
  },
  inlineImage: {
    width: screenWidth,
    backgroundColor: '#F2F2F7',
  },
  imageCaption: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 20,
    fontFamily: 'SF Arabic',
  },
  link: {
    color: tokens.colors.najdi.primary,
    fontWeight: '500',
  },
  blockquote: {
    flexDirection: 'row',
    marginVertical: 32,
    marginHorizontal: 0,
  },
  blockquoteBorder: {
    width: 3,
    backgroundColor: tokens.colors.najdi.primary,
    marginRight: 20,
    borderRadius: 1.5,
  },
  blockquoteContent: {
    flex: 1,
    paddingRight: 20,
  },
});

export default ArticleContentRenderer;