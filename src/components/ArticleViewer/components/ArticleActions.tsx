import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { NewsArticle } from '../../../services/news';
import tokens from '../../ui/tokens';

interface ArticleActionsProps {
  article: NewsArticle;
  fontSize: number;
  onFontSizeChange: (delta: number) => void;
  isNightMode: boolean;
  onToggleNightMode: () => void;
  readingProgress: number;
}

const ArticleActions: React.FC<ArticleActionsProps> = ({
  article,
  fontSize,
  onFontSizeChange,
  isNightMode,
  onToggleNightMode,
  readingProgress,
}) => {
  // Share article
  const handleShare = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const message = `${article.title}\n\n${article.permalink || ''}`;

      await Share.share({
        message,
        title: article.title,
        url: article.permalink,
      });
    } catch (error) {
      Alert.alert('خطأ', 'فشل مشاركة المقال');
    }
  };

  return (
    <View style={[styles.container, isNightMode && styles.containerDark]}>
      {/* Reading Progress Indicator */}
      {readingProgress > 0 && readingProgress < 100 && (
        <View style={styles.progressIndicator}>
          <Text style={[styles.progressText, isNightMode && styles.textDark]}>
            {readingProgress}%
          </Text>
        </View>
      )}

      {/* Font Size Controls */}
      <View style={styles.fontSizeControls}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onFontSizeChange(-2);
          }}
          disabled={fontSize <= 12}
        >
          <Text style={[
            styles.fontSizeText,
            fontSize <= 12 && styles.disabledText,
            isNightMode && styles.textDark,
          ]}>
            -
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onFontSizeChange(2);
          }}
          disabled={fontSize >= 24}
        >
          <Text style={[
            styles.fontSizeText,
            fontSize >= 24 && styles.disabledText,
            isNightMode && styles.textDark,
          ]}>
            +
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.separator} />

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {/* Night Mode Toggle */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggleNightMode();
          }}
        >
          <Ionicons
            name={isNightMode ? 'sunny' : 'moon'}
            size={20}
            color={isNightMode ? '#FFFFFF' : tokens.colors.najdi.text}
          />
        </TouchableOpacity>

        {/* Share using native iOS SF symbol */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleShare}
        >
          {Platform.OS === 'ios' ? (
            <Ionicons
              name="share-outline"
              size={20}
              color={isNightMode ? '#FFFFFF' : tokens.colors.najdi.text}
            />
          ) : (
            <Ionicons
              name="share-social-outline"
              size={20}
              color={isNightMode ? '#FFFFFF' : tokens.colors.najdi.text}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  containerDark: {
    backgroundColor: 'rgba(26,26,26,0.95)',
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  progressIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: tokens.colors.najdi.primary + '20',
    borderRadius: 12,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.najdi.primary,
  },
  fontSizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fontSizeText: {
    fontSize: 20,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    minWidth: 24,
    textAlign: 'center',
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledText: {
    opacity: 0.3,
  },
  textDark: {
    color: '#FFFFFF',
  },
});

export default ArticleActions;