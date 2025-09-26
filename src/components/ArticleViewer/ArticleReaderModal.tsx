import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  ActivityIndicator,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { NewsArticle } from '../../services/news';
import { useAbsoluteDateNoMemo } from '../../hooks/useFormattedDateNoMemo';
import ArticleContentRenderer from './components/ArticleContentRenderer';
import tokens from '../ui/tokens';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ArticleReaderModalProps {
  article: NewsArticle | null;
  visible: boolean;
  onClose: () => void;
}

const ArticleReaderModal: React.FC<ArticleReaderModalProps> = ({
  article,
  visible,
  onClose,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [isLoading, setIsLoading] = useState(true);
  const [fontSize, setFontSize] = useState(17);
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);

  // Format date
  const formattedDate = useAbsoluteDateNoMemo(article?.publishedAt ? new Date(article.publishedAt) : new Date());

  // Load content
  useEffect(() => {
    if (article) {
      // Simulate content processing
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
      }, 300);
    }
  }, [article]);

  // Handle scroll for header show/hide
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = event.nativeEvent.contentOffset.y;

    // Show/hide header based on scroll direction
    if (currentY > lastScrollY.current && currentY > 100) {
      // Scrolling down, hide header
      if (showHeader) setShowHeader(false);
    } else if (currentY < lastScrollY.current - 5) {
      // Scrolling up, show header
      if (!showHeader) setShowHeader(true);
    }

    lastScrollY.current = currentY;
  }, [showHeader]);

  // Handle close with haptic
  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  // Handle font size changes
  const adjustFontSize = useCallback((delta: number) => {
    setFontSize(prev => Math.max(14, Math.min(24, prev + delta)));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  if (!article) return null;

  // Calculate reading time
  const wordCount = article.html ? article.html.replace(/<[^>]*>/g, '').split(/\s+/).length : 0;
  const readingTime = Math.ceil(wordCount / 200);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" />

        {/* Floating Header */}
        <Animated.View
          style={[
            styles.header,
            {
              transform: [{
                translateY: showHeader ? 0 : -100
              }]
            }
          ]}
        >
          <BlurView intensity={100} tint="light" style={styles.headerBlur}>
            <View style={styles.headerContent}>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={28} color="#1C1C1E" />
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {article.title}
                </Text>
              </View>

              <View style={styles.fontControls}>
                <TouchableOpacity
                  onPress={() => adjustFontSize(-1)}
                  style={styles.fontButton}
                  disabled={fontSize <= 14}
                >
                  <Text style={[styles.fontButtonText, fontSize <= 14 && styles.disabledText]}>
                    ص
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => adjustFontSize(1)}
                  style={styles.fontButton}
                  disabled={fontSize >= 24}
                >
                  <Text style={[styles.fontButtonText, fontSize >= 24 && styles.disabledText]}>
                    ص
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </Animated.View>

        {/* Reading Progress Bar */}
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: scrollY.interpolate({
                inputRange: [0, 1000],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              })
            }
          ]}
        />

        {/* Content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            {
              useNativeDriver: false,
              listener: handleScroll
            }
          )}
          scrollEventThrottle={16}
        >
          {/* Hero Image */}
          {article.heroImage && (
            <Animated.Image
              source={{ uri: article.heroImage }}
              style={[
                styles.heroImage,
                {
                  transform: [{
                    translateY: scrollY.interpolate({
                      inputRange: [-100, 0, 100],
                      outputRange: [-50, 0, 50],
                      extrapolate: 'clamp',
                    })
                  }]
                }
              ]}
              resizeMode="cover"
            />
          )}

          {/* Article Header */}
          <View style={[
            styles.articleHeader,
            !article.heroImage && styles.articleHeaderNoImage
          ]}>
            <Text style={styles.articleTitle}>{article.title}</Text>

            <View style={styles.articleMeta}>
              <Text style={styles.articleDate}>{formattedDate}</Text>
              {readingTime > 0 && (
                <>
                  <Text style={styles.metaSeparator}>·</Text>
                  <Text style={styles.readingTime}>{readingTime} دقائق قراءة</Text>
                </>
              )}
            </View>
          </View>

          {/* Article Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={tokens.colors.najdi.primary} />
            </View>
          ) : (
            <ArticleContentRenderer
              html={article.html || ''}
              fontSize={fontSize}
            />
          )}

          {/* Bottom Padding */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
  },
  headerBlur: {
    paddingTop: Platform.OS === 'ios' ? 0 : 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 56,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    fontFamily: 'SF Arabic',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fontControls: {
    flexDirection: 'row',
    gap: 4,
  },
  fontButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 8,
  },
  fontButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  disabledText: {
    opacity: 0.3,
  },
  progressBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 88 : StatusBar.currentHeight + 56,
    left: 0,
    height: 2,
    backgroundColor: tokens.colors.najdi.primary,
    zIndex: 99,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 88 : StatusBar.currentHeight + 56,
  },
  heroImage: {
    width: screenWidth,
    height: screenWidth * 0.56,
    backgroundColor: '#F0F0F0',
  },
  articleHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  articleHeaderNoImage: {
    paddingTop: 32,
  },
  articleTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    lineHeight: 36,
    letterSpacing: -0.5,
    fontFamily: 'SF Arabic',
    marginBottom: 16,
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  articleDate: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: 'SF Arabic',
  },
  metaSeparator: {
    marginHorizontal: 8,
    color: '#C7C7CC',
  },
  readingTime: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: 'SF Arabic',
  },
  loadingContainer: {
    paddingVertical: 100,
    alignItems: 'center',
  },
});

export default ArticleReaderModal;