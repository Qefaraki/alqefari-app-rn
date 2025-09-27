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
import { VideoPlayer } from 'expo-video';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import tokens from '../../ui/tokens';

const { width: screenWidth } = Dimensions.get('window');
const CONTENT_WIDTH = screenWidth - 40; // 20px padding on each side

interface ArticleContentRendererProps {
  html: string;
  fontSize: number;
  onImagePress?: (imageUrl: string, index: number) => void;
  onImagesExtracted?: (images: string[]) => void;
  isHeavyArticle?: boolean;
  allImages?: string[];
}

// System fonts - let iOS choose the right Arabic font automatically
const SYSTEM_FONTS = [...defaultSystemFonts, 'System'];

// Ignored tags - removed video and iframe to support them
const IGNORED_DOM_TAGS = ['script', 'audio', 'style'];

// Helper function to extract YouTube video ID
const extractYouTubeId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /^([^&\n?#]+)$/ // Just the ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

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
const createRenderers = (onImagePress?: (url: string, index: number) => void, allImages?: string[]) => ({
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
      if (onImagePress) {
        // Find the index of this image in the allImages array
        const imageIndex = allImages ? allImages.findIndex(img => img === src) : -1;
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

  // Figure renderer for WordPress video blocks
  figure: ({ tnode, TDefaultRenderer, ...props }: any) => {
    const className = tnode.attributes?.class || '';

    // Check if it's a WordPress video block
    if (className.includes('wp-block-video')) {
      const videoNode = tnode.children?.find((child: any) => child.tagName === 'video');
      if (videoNode) {
        // Try to get src from video tag or source child
        let videoSrc = videoNode.attributes?.src;
        if (!videoSrc) {
          const sourceNode = videoNode.children?.find((c: any) => c.tagName === 'source');
          videoSrc = sourceNode?.attributes?.src;
        }

        if (videoSrc) {
          return (
            <View style={styles.videoContainer}>
              <VideoPlayer
                source={{ uri: videoSrc }}
                style={styles.videoPlayer}
                showsControls={true}
              />
            </View>
          );
        }
      }
    }

    // Check if it's a WordPress YouTube embed block
    if (className.includes('wp-block-embed-youtube') || className.includes('wp-block-embed is-type-video')) {
      // Look for the embed wrapper div
      const wrapperNode = tnode.children?.find((child: any) =>
        child.attributes?.class?.includes('wp-block-embed__wrapper')
      );

      if (wrapperNode && wrapperNode.children?.[0]) {
        // The YouTube URL is usually in the text content
        const youtubeUrl = wrapperNode.children[0].data;
        if (youtubeUrl) {
          const videoId = extractYouTubeId(youtubeUrl);
          if (videoId) {
            return (
              <View style={styles.youtubeContainer}>
                <YoutubePlayer
                  height={200}
                  videoId={videoId}
                  play={false}
                />
              </View>
            );
          }
        }
      }
    }

    // For other figure types, render the children normally
    if (TDefaultRenderer) {
      return <TDefaultRenderer {...props} tnode={tnode} />;
    }

    // If no default renderer, just render as a view with children
    return <View />;
  },

  // Video renderer for direct video files
  video: ({ tnode, ...props }: any) => {
    // Check direct src attribute
    let videoSrc = tnode.attributes?.src;

    // If no src, check for source tags inside video
    if (!videoSrc) {
      const sourceNode = tnode.children?.find((child: any) => child.tagName === 'source');
      videoSrc = sourceNode?.attributes?.src;
    }

    if (videoSrc) {
      return (
        <View style={styles.videoContainer}>
          <VideoPlayer
            source={{ uri: videoSrc }}
            style={styles.videoPlayer}
            showsControls={true}
          />
        </View>
      );
    }

    return null;
  },

  // iframe renderer for embedded videos (YouTube, Vimeo, etc.)
  iframe: ({ tnode, ...props }: any) => {
    const { src, width, height } = tnode.attributes || {};

    if (!src) return null;

    // Check if it's a YouTube embed
    const isYouTube = src.includes('youtube.com') || src.includes('youtu.be');
    const isVimeo = src.includes('vimeo.com');

    if (isYouTube) {
      const videoId = extractYouTubeId(src);
      if (videoId) {
        return (
          <View style={styles.youtubeContainer}>
            <YoutubePlayer
              height={200}
              videoId={videoId}
              play={false}
            />
          </View>
        );
      }
      // Fallback if ID extraction fails
      return (
        <TouchableOpacity
          style={styles.videoEmbed}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Linking.openURL(src).catch(() => {
              Alert.alert('خطأ', 'لا يمكن فتح الفيديو');
            });
          }}
          activeOpacity={0.9}
        >
          <Ionicons name="play-circle" size={60} color={tokens.colors.najdi.primary} />
          <Text style={styles.videoEmbedText}>فتح فيديو YouTube</Text>
        </TouchableOpacity>
      );
    }

    if (isVimeo) {
      return (
        <TouchableOpacity
          style={styles.videoEmbed}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Linking.openURL(src).catch(() => {
              Alert.alert('خطأ', 'لا يمكن فتح الفيديو');
            });
          }}
          activeOpacity={0.9}
        >
          <Ionicons name="play-circle" size={60} color={tokens.colors.najdi.primary} />
          <Text style={styles.videoEmbedText}>فتح فيديو Vimeo</Text>
        </TouchableOpacity>
      );
    }

    // For other iframes, ignore them
    return null;
  },
});

const ArticleContentRenderer: React.FC<ArticleContentRendererProps> = memo(({
  html,
  fontSize,
  onImagePress,
  onImagesExtracted,
  isHeavyArticle = false,
  allImages = [],
}) => {

  // Create styles based on font size
  const tagsStyles = useMemo(
    () => createTagsStyles(fontSize),
    [fontSize]
  );

  // Create renderers with image handling
  const renderers = useMemo(
    () => createRenderers(onImagePress, allImages),
    [onImagePress, allImages]
  );

  // Custom HTML element models for video, iframe, and figure
  const customHTMLElementModels = useMemo(
    () => ({
      video: HTMLElementModel.fromCustomModel({
        tagName: 'video',
        contentModel: HTMLContentModel.block,
      }),
      iframe: HTMLElementModel.fromCustomModel({
        tagName: 'iframe',
        contentModel: HTMLContentModel.block,
      }),
      figure: HTMLElementModel.fromCustomModel({
        tagName: 'figure',
        contentModel: HTMLContentModel.block,
      }),
    }),
    []
  );

  // Clean HTML for better rendering
  const cleanHtml = useMemo(() => {
    let processedHtml = html
      .replace(/\[gallery[^\]]*\]/g, '')
      .replace(/\[caption[^\]]*\](.*?)\[\/caption\]/g, '$1')
      .replace(/<!--more-->/g, '')
      .replace(/<!--nextpage-->/g, '');

    // For heavy articles, truncate at gallery boundary
    if (isHeavyArticle && processedHtml.length > 100000) {
      // Strategy: Find where gallery starts and cut BEFORE it
      let cutPoint = 40000; // Fallback if no pattern found

      // Look for just 3 images appearing close together (gallery starting)
      const imgPattern = /(<img[^>]*>[\s\S]{0,500}){3,}/gi;
      const galleryMatch = imgPattern.exec(processedHtml);

      if (galleryMatch) {
        // Gallery found - now find the last paragraph BEFORE it
        const galleryStart = galleryMatch.index;

        // Search backwards from gallery start to find last </p>
        const beforeGallery = processedHtml.substring(0, galleryStart);
        const lastParagraph = beforeGallery.lastIndexOf('</p>');

        if (lastParagraph > 0) {
          cutPoint = lastParagraph + 4; // Include the </p>
        } else {
          // No paragraph found, cut well before gallery
          cutPoint = Math.max(10000, galleryStart - 1000);
        }
      } else {
        // No gallery pattern found, look for a good paragraph break
        const lastParagraph = processedHtml.lastIndexOf('</p>', cutPoint);
        if (lastParagraph > cutPoint * 0.7) {
          cutPoint = lastParagraph + 4;
        }
      }

      processedHtml = processedHtml.substring(0, cutPoint);
    }

    return processedHtml;
  }, [html, isHeavyArticle]);

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
        customHTMLElementModels={customHTMLElementModels}
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
  videoContainer: {
    marginVertical: 24,
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: tokens.colors.najdi.container + '10',
  },
  videoPlayer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  videoEmbed: {
    marginVertical: 24,
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: tokens.colors.najdi.container + '15',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container + '30',
  },
  videoEmbedText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    fontFamily: 'System',
  },
  youtubeContainer: {
    marginVertical: 24,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: tokens.colors.najdi.container + '10',
  },
});

export default ArticleContentRenderer;