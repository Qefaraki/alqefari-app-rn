import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import PropTypes from 'prop-types';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import tokens from '../../ui/tokens';

const EditHeader = ({ onCancel, onSubmit, saving, canSubmit, accessMode }) => {
  const submitLabel = accessMode === 'review' ? 'إرسال' : 'حفظ';

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  const handleSubmit = () => {
    if (!canSubmit || saving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit();
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.headerContainer}>
        {/* Cancel Button */}
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.cancelButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={saving}
        >
          <Ionicons
            name="close-circle"
            size={28}
            color={
              saving
                ? tokens.colors.najdi.textMuted
                : tokens.colors.najdi.primary
            }
          />
        </TouchableOpacity>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>تعديل الملف</Text>
          {saving && <Text style={styles.headerSubtitle}>جاري الحفظ...</Text>}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          style={[
            styles.saveButton,
            (!canSubmit || saving) && styles.saveButtonDisabled,
          ]}
          disabled={!canSubmit || saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator
              color={tokens.colors.najdi.background}
              size="small"
            />
          ) : (
            <Text style={styles.saveButtonText}>{submitLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#f7f2ed', // Match BottomSheet sheetBackground
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: `${tokens.colors.najdi.container  }40`,
    overflow: 'hidden', // Ensure rounded corners clip properly
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    minHeight: 52,
  },
  cancelButton: {
    width: tokens.touchTarget.minimum,
    height: tokens.touchTarget.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    fontSize: 17, // iOS headline
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  headerSubtitle: {
    fontSize: 12, // iOS caption1
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
  },
  saveButton: {
    backgroundColor: tokens.colors.najdi.primary,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.sm,
    minWidth: 80,
    height: tokens.touchTarget.minimum - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: tokens.colors.najdi.background,
    fontSize: 15, // iOS subheadline
    fontWeight: '600',
  },
});

EditHeader.propTypes = {
  onCancel: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  saving: PropTypes.bool,
  canSubmit: PropTypes.bool,
  accessMode: PropTypes.oneOf(['direct', 'review']),
};

EditHeader.defaultProps = {
  saving: false,
  canSubmit: false,
  accessMode: 'direct',
};

export default EditHeader;
