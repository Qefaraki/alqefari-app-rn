import React, { useMemo } from 'react';
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

interface ArticleContentProps {
  html: string;
  fontSize: number;
  isNightMode: boolean;
  settings: any;
}

const ArticleContent: React.FC<ArticleContentProps> = ({
  html,
  fontSize,
  isNightMode,
  settings,
}) => {
  // Custom renderers for specific HTML elements
  const renderers = useMemo(
    () => ({
      img: ({ TDefaultRenderer, ...props }: any) => {
        const { src, alt } = props.tnode.attributes || {};

        if (!src) return null;

        return (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // TODO: Open image viewer
              Alert.alert('صورة', 'سيتم فتح معاينة الصورة قريباً');
            }}
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

        return (
          <TouchableOpacity
            onPress={() => {
              if (href) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Linking.openURL(href).catch(() => {
                  Alert.alert('خطأ', 'لا يمكن فتح الرابط');
                });
              }
            }}
          >
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
    }),
    []
  );

  // Tag styles based on current theme and font size
  const tagsStyles = useMemo<Record<string, MixedStyleDeclaration>>(
    () => ({
      body: {
        color: isNightMode ? '#E5E5E5' : tokens.colors.najdi.text,
        fontSize: fontSize,
        lineHeight: fontSize * 1.6,
        textAlign: 'right',
        writingDirection: 'rtl',
        fontFamily: 'System',
      },
      p: {
        marginBottom: 16,
        textAlign: 'right',
        writingDirection: 'rtl',
      },
      h1: {
        fontSize: fontSize + 12,
        fontWeight: '700',
        marginTop: 24,
        marginBottom: 16,
        color: isNightMode ? '#FFFFFF' : tokens.colors.najdi.text,
        textAlign: 'right',
      },
      h2: {
        fontSize: fontSize + 8,
        fontWeight: '700',
        marginTop: 20,
        marginBottom: 12,
        color: isNightMode ? '#FFFFFF' : tokens.colors.najdi.text,
        textAlign: 'right',
      },
      h3: {
        fontSize: fontSize + 4,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
        color: isNightMode ? '#FFFFFF' : tokens.colors.najdi.text,
        textAlign: 'right',
      },
      h4: {
        fontSize: fontSize + 2,
        fontWeight: '600',
        marginTop: 12,
        marginBottom: 8,
        color: isNightMode ? '#FFFFFF' : tokens.colors.najdi.text,
        textAlign: 'right',
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
        textAlign: 'right',
        writingDirection: 'rtl',
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
        textAlign: 'right',
      },
      td: {
        padding: 8,
        borderWidth: 1,
        borderColor: isNightMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
        textAlign: 'right',
      },
    }),
    [fontSize, isNightMode]
  );

  // Classes styles for WordPress-specific classes
  const classesStyles = useMemo(
    () => ({
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
    }),
    []
  );

  // System fonts with Arabic support
  const systemFonts = [...defaultSystemFonts, 'SF Arabic', 'System'];

  return (
    <View style={[styles.container, isNightMode && styles.containerDark]}>
      <RenderHtml
        contentWidth={CONTENT_WIDTH}
        source={{ html }}
        renderers={renderers}
        tagsStyles={tagsStyles}
        classesStyles={classesStyles}
        systemFonts={systemFonts}
        enableExperimentalMarginCollapsing={true}
        enableExperimentalBRCollapsing={true}
        defaultTextProps={{
          allowFontScaling: false,
          textAlign: 'right',
        }}
        renderersProps={{
          img: {
            enableExperimentalPercentWidth: true,
          },
        }}
      />
    </View>
  );
};

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