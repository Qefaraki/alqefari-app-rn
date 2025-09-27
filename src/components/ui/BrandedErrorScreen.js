import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import tokens from './tokens';
import appConfig from '../../config/app.config';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BrandedErrorScreen = ({ error, errorInfo, onReset }) => {
  const handleReportError = () => {
    const errorDetails = error ? error.toString() : 'Unknown error';
    const subject = encodeURIComponent(appConfig.support.subject);
    const body = encodeURIComponent(`\n\n---\nتفاصيل الخطأ:\n${errorDetails}\n`);
    const mailtoUrl = `mailto:${appConfig.support.email}?subject=${subject}&body=${body}`;

    Linking.openURL(mailtoUrl).catch((err) => {
      console.error('Failed to open email client:', err);
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Compact Error Header with Small Logo */}
        <View style={styles.errorHeader}>
          <View style={styles.headerRow}>
            <Image
              source={require('../../../assets/logo/AlqefariEmblem.png')}
              style={styles.smallLogo}
              resizeMode="contain"
            />
            <View style={styles.errorIconContainer}>
              <Ionicons
                name="warning"
                size={32}
                color={tokens.colors.najdi.primary}
              />
            </View>
          </View>

          <Text style={styles.title}>حدث خطأ</Text>
          <Text style={styles.subtitle}>نعتذر عن هذا الإزعاج</Text>
        </View>

        {/* Error Details Card */}
        <View style={styles.errorCard}>
          <View style={styles.errorCardHeader}>
            <Ionicons
              name="information-circle"
              size={20}
              color={tokens.colors.najdi.primary}
            />
            <Text style={styles.errorCardTitle}>تفاصيل الخطأ</Text>
          </View>

          <Text style={styles.errorMessage}>
            {error && error.toString()}
          </Text>

          {__DEV__ && errorInfo && (
            <View style={styles.debugSection}>
              <Text style={styles.debugTitle}>معلومات تقنية:</Text>
              <ScrollView
                style={styles.debugScrollView}
                horizontal
                showsHorizontalScrollIndicator={true}
              >
                <Text style={styles.errorStack}>
                  {errorInfo.componentStack}
                </Text>
              </ScrollView>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onReset}
            activeOpacity={0.8}
          >
            <Ionicons
              name="refresh-circle"
              size={20}
              color="#F9F7F3"
              style={styles.buttonIcon}
            />
            <Text style={styles.primaryButtonText}>إعادة تشغيل التطبيق</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleReportError}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>الإبلاغ عن المشكلة</Text>
          </TouchableOpacity>
        </View>

        {/* Help Text */}
        <View style={styles.helpSection}>
          <Text style={styles.helpText}>
            إذا استمرت المشكلة، يرجى التواصل مع الدعم الفني
          </Text>
          <Text style={styles.helpSubtext}>
            {appConfig.support.email}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  errorHeader: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  smallLogo: {
    width: 32,
    height: 32,
    tintColor: tokens.colors.najdi.text,
    marginRight: 12,
  },
  errorIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.najdi.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
    fontFamily: 'SF Arabic',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF Arabic',
  },
  errorCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container + '20',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  errorCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  errorCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    fontFamily: 'SF Arabic',
    marginLeft: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: tokens.colors.najdi.text,
    fontFamily: Platform.select({ ios: 'SF Arabic', default: 'System' }),
    lineHeight: 22,
    marginBottom: 8,
  },
  debugSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.najdi.container + '20',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF Arabic',
    marginBottom: 8,
  },
  debugScrollView: {
    maxHeight: 120,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 8,
  },
  errorStack: {
    fontSize: 10,
    color: '#666',
    fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
    lineHeight: 14,
  },
  actionSection: {
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: tokens.colors.najdi.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: tokens.colors.najdi.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonIcon: {
    marginRight: 8,
  },
  primaryButtonText: {
    color: '#F9F7F3',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SF Arabic',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: tokens.colors.najdi.container,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: tokens.colors.najdi.text,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SF Arabic',
  },
  helpSection: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.najdi.container + '20',
  },
  helpText: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF Arabic',
    marginBottom: 4,
  },
  helpSubtext: {
    fontSize: 13,
    color: tokens.colors.najdi.primary,
    fontFamily: Platform.select({ ios: 'SF Arabic', default: 'System' }),
  },
});

export default BrandedErrorScreen;