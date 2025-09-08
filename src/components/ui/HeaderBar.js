import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, I18nManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tokens from './tokens';

const HeaderBar = ({ title, onClose, rightSlot = null }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onClose} style={styles.iconButton} accessibilityLabel="إغلاق">
        <Ionicons name="close" size={24} color={tokens.colors.text} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.right}>{rightSlot}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.divider,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.text,
    textAlign: 'center',
    flex: 1,
  },
  right: {
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default HeaderBar;
