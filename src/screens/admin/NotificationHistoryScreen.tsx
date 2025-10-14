/**
 * Notification History Screen
 *
 * Screen wrapper for AdminNotificationHistory
 * Accessible only to super admins
 */

import React from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AdminNotificationHistory from '../../components/admin/AdminNotificationHistory';
import { NAJDI_COLORS } from '../../constants/najdiColors';

export default function NotificationHistoryScreen() {
  const router = useRouter();

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityLabel="رجوع"
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={28} color={NAJDI_COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سجل الإشعارات</Text>
        <View style={styles.headerRight} />
      </View>

      {/* History List */}
      <AdminNotificationHistory />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAJDI_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${NAJDI_COLORS.text}20`,
    backgroundColor: NAJDI_COLORS.background,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: NAJDI_COLORS.text,
    fontFamily: 'SF Arabic',
  },
  headerRight: {
    width: 44,
  },
});
