import React, { memo } from 'react';
import {
  View,
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
const CONTENT_WIDTH = screenWidth - 32; // 16px padding on each side

// Static configuration - defined outside component to prevent re-creation
const SYSTEM_FONTS = [...defaultSystemFonts, 'SF Arabic', 'System'];

// Ignored tags to prevent warnings
const IGNORED_DOM_TAGS = ['video', 'iframe', 'script', 'audio'];

// Static classes styles
const CLASSES_STYLES = {
  'wp-block-image': {
    marginVertical: 16,
  },
  'wp-block-quote': {
    marginVertical: 20,
    paddingLeft: 16,
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.najdi.primary,
  },
  'wp-block-embed': {
    marginVertical: 20,
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

// Static renderers props
const RENDERERS_PROPS = {
  img: {
    enableExperimentalPercentWidth: true,
  },
};

// Static default text props
const DEFAULT_TEXT_PROPS = {
  allowFontScaling: false,
};

// Create tag styles factory function
const createTagsStyles = (fontSize: number, isNightMode: boolean): Record<string, MixedStyleDeclaration> => ({
  body: {
    color: isNightMode ? '#E5E5E5' : tokens.colors.najdi.text,
    fontSize: fontSize,
    lineHeight: fontSize * 1.6,
    fontFamily: 'System',
  },
  p: {
    marginBottom: 16,
  },
  h1: {
    fontSize: fontSize + 12,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 16,
    color: isNightMode ? '#FFFFFF' : tokens.colors.najdi.text,
  },
  h2: {
    fontSize: fontSize + 8,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
    color: isNightMode ? '#FFFFFF' : tokens.colors.najdi.text,
  },
  h3: {
    fontSize: fontSize + 4,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: isNightMode ? '#FFFFFF' : tokens.colors.najdi.text,
  },
  h4: {
    fontSize: fontSize + 2,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
    color: isNightMode ? '#FFFFFF' : tokens.colors.najdi.text,
  },
  a: {
    color: tokens.colors.najdi.primary,
    textDecorationLine: 'underline',
  },
  strong: {
    fontWeight: '700',
  },
  em: {
    fontStyle: 'italic',
  },
  li: {
    marginBottom: 8,
  },
  blockquote: {
    marginVertical: 16,
    paddingHorizontal: 16,
    fontStyle: 'italic',
    color: isNightMode ? '#B0B0B0' : tokens.colors.najdi.textMuted,
    backgroundColor: isNightMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
    borderRadius: 8,
  },
  code: {
    backgroundColor: isNightMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'Courier',
    fontSize: fontSize - 2,
  },
  pre: {
    backgroundColor: isNightMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
    overflow: 'scroll',
  },
  hr: {
    marginVertical: 24,
    height: 1,
    backgroundColor: isNightMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
  },
  table: {
    borderWidth: 1,
    borderColor: isNightMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
    marginVertical: 16,
  },
  th: {
    backgroundColor: isNightMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    padding: 8,
    fontWeight: '600',
  },
  td: {
    padding: 8,
    borderWidth: 1,
    borderColor: isNightMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  },
});

// Static renderers - these don't change
const createRenderers = () => ({
  img: ({ TDefaultRenderer, ...props }: any) => {
    const { src, alt } = props.tnode.attributes || {};

    if (!src) return null;

    const handleImagePress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert('صورة', 'سيتم فتح معاينة الصورة قريباً');
    };

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleImagePress}
        style={styles.imageContainer}
      >
        <Image
          source={{ uri: src }}
          style={styles.inlineImage}
          contentFit="cover"
          transition={300}
          placeholder={require('../../../../assets/icon.png')}
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
      <TouchableOpacity onPress={handleLinkPress}>
        <TDefaultRenderer {...props} />
      </TouchableOpacity>
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
  ul: ({ TDefaultRenderer, ...props }: any) => {
    return (
      <View style={styles.listContainer}>
        <TDefaultRenderer {...props} />
      </View>
    );
  },
  ol: ({ TDefaultRenderer, ...props }: any) => {
    return (
      <View style={styles.listContainer}>
        <TDefaultRenderer {...props} />
      </View>
    );
  },
});

// Create static renderers instance
const STATIC_RENDERERS = createRenderers();

interface ArticleContentProps {
  html: string;
  fontSize: number;
  isNightMode: boolean;
  settings: any;
}

// Custom comparison function for memo
const arePropsEqual = (prevProps: ArticleContentProps, nextProps: ArticleContentProps) => {
  return (
    prevProps.html === nextProps.html &&
    prevProps.fontSize === nextProps.fontSize &&
    prevProps.isNightMode === nextProps.isNightMode
  );
};

const ArticleContent: React.FC<ArticleContentProps> = memo(({
  html,
  fontSize,
  isNightMode,
  settings,
}) => {
  // Only create tagsStyles when fontSize or isNightMode changes
  const tagsStyles = React.useMemo(
    () => createTagsStyles(fontSize, isNightMode),
    [fontSize, isNightMode]
  );

  return (
    <View style={[styles.container, isNightMode && styles.containerDark]}>
      <RenderHtml
        contentWidth={CONTENT_WIDTH}
        source={{ html }}
        renderers={STATIC_RENDERERS}
        tagsStyles={tagsStyles}
        classesStyles={CLASSES_STYLES}
        systemFonts={SYSTEM_FONTS}
        ignoredDomTags={IGNORED_DOM_TAGS}
        enableExperimentalMarginCollapsing={true}
        enableExperimentalBRCollapsing={true}
        defaultTextProps={DEFAULT_TEXT_PROPS}
        renderersProps={RENDERERS_PROPS}
      />
    </View>
  );
}, arePropsEqual);

ArticleContent.displayName = 'ArticleContent';

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: tokens.colors.najdi.background,
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  imageContainer: {
    marginVertical: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  inlineImage: {
    width: '100%',
    minHeight: 200,
    maxHeight: 400,
  },
  blockquote: {
    flexDirection: 'row',
    marginVertical: 16,
  },
  blockquoteBorder: {
    width: 4,
    backgroundColor: tokens.colors.najdi.primary,
    borderRadius: 2,
    marginRight: 12,
  },
  blockquoteContent: {
    flex: 1,
    paddingVertical: 8,
  },
  listContainer: {
    paddingRight: 16,
  },
});

export default ArticleContent;