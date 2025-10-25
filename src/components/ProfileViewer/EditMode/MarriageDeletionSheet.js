import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import tokens from '../../ui/tokens';
import { supabase } from '../../../services/supabase';

/**
 * MarriageDeletionSheet
 *
 * Minimal, direct confirmation sheet for marriage deletion.
 *
 * Shows:
 * - Who will be deleted (spouse name)
 * - Whether spouse profile survives (cousin marriage or munasib with other marriages)
 * - Permanent warning
 *
 * Features:
 * - Network timeout (10 seconds) to prevent infinite loading
 * - Retry button on network errors
 * - Simplified messaging (no children, profile, or marriage type explanations)
 */

// Timeout wrapper for network operations
const fetchWithTimeout = (promise, ms = 10000) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error('انتهى وقت الاتصال. تحقق من اتصال الإنترنت.')),
      ms
    )
  );
  return Promise.race([promise, timeout]);
};

const MarriageDeletionSheet = ({ visible, marriage, onConfirm, onCancel }) => {
  const [loading, setLoading] = useState(true);
  const [deletionInfo, setDeletionInfo] = useState(null);
  const [error, setError] = useState(null);

  // Fetch deletion consequences when sheet opens
  useEffect(() => {
    if (visible && marriage?.spouse_profile) {
      fetchDeletionInfo();
    } else {
      setLoading(false);
      setDeletionInfo(null);
      setError(null);
    }
  }, [visible, marriage]);

  const fetchDeletionInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const spouse = marriage.spouse_profile;
      const spouseId = spouse.id;

      if (!spouseId) {
        throw new Error('بيانات الزوج/الزوجة غير متوفرة');
      }

      // Determine if cousin marriage (Al-Qefari family member)
      const isCousinMarriage = spouse.hid !== null && spouse.hid?.trim() !== '';

      // For Munasib only: Check if spouse has other marriages
      let willDeleteProfile = false;

      if (!isCousinMarriage) {
        const marriageQuery = supabase
          .from('marriages')
          .select('id', { count: 'exact', head: true })
          .or(`husband_id.eq.${spouseId},wife_id.eq.${spouseId}`)
          .neq('id', marriage.marriage_id)
          .is('deleted_at', null);

        const { count, error: marriageError } = await fetchWithTimeout(marriageQuery);

        if (marriageError) throw marriageError;

        const otherMarriagesCount = count || 0;
        willDeleteProfile = otherMarriagesCount === 0;
      }

      setDeletionInfo({
        willDeleteProfile,
        spouseName: spouse.name,
      });
    } catch (err) {
      if (__DEV__) {
        console.error('[MarriageDeletionSheet] Error fetching deletion info:', err);
      }
      setError('فشل تحميل معلومات الحذف. يرجى المحاولة مرة أخرى.');
      setDeletionInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const getWarningText = () => {
    if (!deletionInfo) return '';

    const { willDeleteProfile, spouseName } = deletionInfo;

    if (willDeleteProfile) {
      return `سيتم حذف ${spouseName} نهائياً من الشجرة.`;
    } else {
      return `سيتم حذف الزواج فقط.\n\n${spouseName} سيبقى في الشجرة.`;
    }
  };

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
      <BlurView intensity={20} style={styles.overlay} tint="dark">
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleCancel}
        />

        <View style={styles.sheet}>
          {/* Warning Icon */}
          <View style={styles.iconContainer}>
            <Ionicons
              name="trash-outline"
              size={48}
              color={tokens.colors.najdi.crimson}
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>حذف زواج</Text>

          {/* Content: Loading, Error, or Data */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={tokens.colors.najdi.primary} />
              <Text style={styles.loadingText}>جارٍ تحميل معلومات الحذف...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainerWrapper}>
              <View style={styles.errorContainer}>
                <Ionicons
                  name="alert-circle-outline"
                  size={24}
                  color={tokens.colors.najdi.crimson}
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={fetchDeletionInfo}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="refresh-outline"
                  size={16}
                  color={tokens.colors.najdi.primary}
                />
                <Text style={styles.retryButtonText}>حاول مرة أخرى</Text>
              </TouchableOpacity>
            </View>
          ) : deletionInfo ? (
            <View style={styles.contentContainer}>
              {/* Warning Box */}
              <View style={styles.warningBox}>
                <Ionicons
                  name="warning-outline"
                  size={20}
                  color={tokens.colors.najdi.crimson}
                />
                <Text style={styles.warningText}>{getWarningText()}</Text>
              </View>

              {/* Permanent Warning */}
              <Text style={styles.permanentWarning}>
                لا يمكن التراجع عن هذا الإجراء.
              </Text>
            </View>
          ) : (
            <Text style={styles.errorText}>بيانات الزواج غير متوفرة</Text>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              activeOpacity={0.6}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>إلغاء</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteButton, (loading || error) && styles.deleteButtonDisabled]}
              onPress={handleConfirm}
              activeOpacity={0.8}
              disabled={loading || !!error}
            >
              <Ionicons name="trash-outline" size={18} color={tokens.colors.surface} />
              <Text style={styles.deleteButtonText}>حذف الزواج</Text>
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
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.xl,
    gap: tokens.spacing.md,
  },
  loadingText: {
    fontSize: 15,
    color: tokens.colors.najdi.textMuted,
  },
  errorContainerWrapper: {
    gap: tokens.spacing.md,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.lg,
  },
  errorText: {
    flex: 1,
    fontSize: 15,
    color: tokens.colors.najdi.text,
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.primary,
    backgroundColor: tokens.colors.najdi.background,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.primary,
  },
  contentContainer: {
    gap: tokens.spacing.lg,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
  },
  warningText: {
    flex: 1,
    fontSize: 15,
    color: tokens.colors.najdi.text,
    lineHeight: 22,
  },
  permanentWarning: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.najdi.crimson,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    gap: tokens.spacing.xs,
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
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.surface,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: tokens.radii.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderColor: tokens.colors.divider,
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
});

export default MarriageDeletionSheet;
