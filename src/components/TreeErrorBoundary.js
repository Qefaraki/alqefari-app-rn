import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

class TreeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Tree rendering error:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.errorContent}>
            <Ionicons name="alert-circle" size={48} color="#A13333" />
            <Text style={styles.title}>عذراً، حدث خطأ</Text>
            <Text style={styles.message}>
              {this.props.fallbackMessage || 'لم نتمكن من عرض شجرة العائلة'}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={this.reset}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>حاول مرة أخرى</Text>
              <Ionicons name="refresh" size={20} color="#F9F7F3" />
            </TouchableOpacity>
            {this.props.showAltAction && (
              <TouchableOpacity
                style={styles.altButton}
                onPress={this.props.onAltAction}
                activeOpacity={0.8}
              >
                <Text style={styles.altButtonText}>
                  {this.props.altActionText || 'تخطي'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F7F3',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorContent: {
    alignItems: 'center',
    maxWidth: 320,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'SF Arabic',
    color: '#242121',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    fontWeight: '400',
    fontFamily: 'SF Arabic',
    color: '#24212199',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#A13333',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 180,
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#F9F7F3',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SF Arabic',
  },
  altButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  altButtonText: {
    color: '#242121',
    fontSize: 15,
    fontWeight: '500',
    fontFamily: 'SF Arabic',
    textDecorationLine: 'underline',
  },
});

export default TreeErrorBoundary;