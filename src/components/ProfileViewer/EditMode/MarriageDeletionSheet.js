import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import tokens from '../../ui/tokens';

/**
 * MarriageDeletionSheet
 *
 * Simple iOS-style confirmation sheet for marriage deletion.
 * Clean design with clear warning - no technical details.
 */
const MarriageDeletionSheet = ({ visible, spouseName, onConfirm, onCancel }) => {
  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onConfirm();
  };

  const handleCancel = () => {
    Haptics.selectionAsync();
    onCancel();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <BlurView intensity={40} style={styles.overlay} tint="dark">
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleCancel}
        />

        <View style={styles.sheet}>
          {/* Warning Icon */}
          <View style={styles.iconContainer}>
            <Ionicons
              name="warning"
              size={48}
              color={tokens.colors.najdi.crimson}
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>هل أنت متأكد؟</Text>

          {/* Spouse Name */}
          {spouseName && (
            <Text style={styles.spouseName}>حذف الزواج مع {spouseName}</Text>
          )}

          {/* Warning Message */}
          <Text style={styles.warningText}>
            هذا الإجراء لا يمكن التراجع عنه
          </Text>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteButtonText}>حذف</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              activeOpacity={0.6}
            >
              <Text style={styles.cancelButtonText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(36, 33, 33, 0.4)', // Sadu Night at 40%
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: tokens.colors.najdi.camelHair,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.xl,
    paddingBottom: tokens.spacing.xxl,
    gap: tokens.spacing.lg,
    // iOS-style shadow
    shadowColor: tokens.colors.najdi.text,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
    textAlign: 'center',
    marginBottom: tokens.spacing.xs,
  },
  spouseName: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 15,
    fontWeight: '500',
    color: tokens.colors.najdi.crimson,
    textAlign: 'center',
    marginBottom: tokens.spacing.sm,
  },
  actions: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  deleteButton: {
    backgroundColor: tokens.colors.najdi.crimson,
    borderRadius: tokens.radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    // Subtle inner shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  deleteButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.surface,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderRadius: tokens.radii.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
});

export default MarriageDeletionSheet;
