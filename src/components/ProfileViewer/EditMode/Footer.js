import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Footer = ({ onCancel, onSubmit, saving, canSubmit, accessMode }) => {
  const submitLabel = accessMode === 'review' ? 'إرسال للمراجعة' : 'حفظ التغييرات';

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.container}>
        <TouchableOpacity
          onPress={onCancel}
          style={styles.secondaryButton}
          accessibilityRole="button"
          accessibilityLabel="إلغاء التعديلات"
        >
          <Text style={styles.secondaryLabel}>إلغاء</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSubmit}
          style={[styles.primaryButton, !canSubmit || saving ? styles.disabled : null]}
          disabled={!canSubmit || saving}
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
        >
          <Text style={styles.primaryLabel}>
            {saving ? 'جاري الحفظ…' : submitLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = {
  safeArea: {
    backgroundColor: '#fff',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c8b7be',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 15,
    color: '#5a3c47',
    fontWeight: '600',
  },
  primaryButton: {
    flex: 2,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#7b2742',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  disabled: {
    opacity: 0.5,
  },
  primaryLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
};

export default Footer;
