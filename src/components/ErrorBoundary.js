import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tokens from './ui/tokens';

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors in child components and displays a fallback UI
 * instead of crashing the entire app.
 *
 * @example
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component {
  state = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details in development
    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Store error info for display
    this.setState({ errorInfo });
  }

  handleReset = () => {
    // Reset error state to try rendering again
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="alert-circle"
              size={64}
              color={tokens.colors.danger}
            />
          </View>

          <Text style={styles.title}>حدث خطأ غير متوقع</Text>

          <Text style={styles.message}>
            {this.state.error?.message || 'خطأ غير معروف'}
          </Text>

          {__DEV__ && this.state.errorInfo && (
            <View style={styles.debugContainer}>
              <Text style={styles.debugTitle}>معلومات التصحيح:</Text>
              <Text style={styles.debugText} numberOfLines={5}>
                {this.state.errorInfo.componentStack}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={this.handleReset}
            activeOpacity={0.8}
          >
            <Ionicons
              name="refresh"
              size={18}
              color={tokens.colors.surface}
              style={styles.buttonIcon}
            />
            <Text style={styles.buttonText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.xxl,
    backgroundColor: tokens.colors.najdi.background,
  },
  iconContainer: {
    marginBottom: tokens.spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
    fontFamily: 'SF Arabic',
    marginBottom: tokens.spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF Arabic',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: tokens.spacing.xl,
    maxWidth: 300,
  },
  debugContainer: {
    backgroundColor: `${tokens.colors.najdi.container  }20`,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
    maxWidth: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${tokens.colors.najdi.container  }40`,
  },
  debugTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    fontFamily: 'SF Arabic',
    marginBottom: tokens.spacing.xs,
  },
  debugText: {
    fontSize: 11,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'Courier',
    lineHeight: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.najdi.primary,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    minHeight: tokens.touchTarget.minimum,
    gap: tokens.spacing.xs,
    ...tokens.shadow.ios,
    ...tokens.shadow.android,
  },
  buttonIcon: {
    marginEnd: tokens.spacing.xs,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.surface,
    fontFamily: 'SF Arabic',
  },
});
