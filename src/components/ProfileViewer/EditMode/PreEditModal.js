import React from 'react';
import { Modal, View, Text, TouchableOpacity, Switch } from 'react-native';

const PreEditModal = ({ visible, onCancel, onContinue, remember, onToggleRemember }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <Text style={styles.title}>تحرير الملف</Text>
          <Text style={styles.body}>تغييراتك تُراجع قبل نشرها للعائلة.</Text>
          <View style={styles.rememberRow}>
            <Switch value={remember} onValueChange={onToggleRemember} />
            <Text style={styles.rememberText}>لا تُظهر مجدداً</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondary} onPress={onCancel}>
              <Text style={styles.secondaryText}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primary} onPress={onContinue}>
              <Text style={styles.primaryText}>متابعة</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = {
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#331b23',
  },
  body: {
    fontSize: 15,
    color: '#5f4652',
    lineHeight: 22,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rememberText: {
    fontSize: 14,
    color: '#5f4652',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondary: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c8b7be',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5f4652',
  },
  primary: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#7b2742',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
};

export default PreEditModal;
