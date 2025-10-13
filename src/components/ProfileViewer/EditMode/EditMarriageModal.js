import React from 'react';
import { Modal, KeyboardAvoidingView, Platform, View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import tokens from '../../ui/tokens';
import { InlineMarriageEditor } from './InlineRelationshipEditors';

const EditMarriageModal = ({ visible, marriage, onClose, onSaved }) => {
  const handleClose = () => {
    Haptics.selectionAsync();
    onClose?.();
  };

  const handleSaved = (updatedMarriage) => {
    onSaved?.(updatedMarriage);
    handleClose();
  };

  if (!marriage) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <InlineMarriageEditor marriage={marriage} onCancel={handleClose} onSaved={handleSaved} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    padding: tokens.spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    borderRadius: tokens.radii.xl,
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.lg,
  },
});

export default EditMarriageModal;
