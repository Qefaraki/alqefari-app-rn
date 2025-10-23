import React from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import tokens from '../../ui/tokens';

const SAUDI_CITIES = [
  'الرياض',
  'جدة',
  'مكة المكرمة',
  'المدينة المنورة',
  'الدمام',
  'الطائف',
  'تبوك',
  'القطيف',
  'الخبر',
  'بريدة',
  'الأحساء',
  'نجران',
  'جازان',
  'ينبع',
  'أبها',
  'حائل',
  'الجبيل',
  'الباحة',
  'المجمعة',
  'حفر الباطن',
  'الرس',
  'عنيزة',
  'سكاكا',
  'أملج',
  'رابغ',
];

const SaudiCityPicker = ({ label, value, onChange, placeholder, enabled = true }) => {
  const handleChange = (itemValue) => {
    if (itemValue) {
      onChange(itemValue);
    }
  };

  return (
    <View style={[styles.container, !enabled && styles.disabled]}>
      {label && <Text style={[styles.label, !enabled && styles.labelDisabled]}>{label}</Text>}
      <View style={[styles.pickerWrapper, !enabled && styles.pickerWrapperDisabled]}>
        <Picker
          selectedValue={value || ''}
          onValueChange={handleChange}
          style={styles.picker}
          itemStyle={styles.pickerItem}
          mode="dropdown"
          enabled={enabled}
        >
          <Picker.Item label={placeholder || 'اختر مدينة'} value="" />
          {SAUDI_CITIES.map((city, index) => (
            <Picker.Item
              key={`${city}-${index}`}
              label={city}
              value={city}
            />
          ))}
        </Picker>
      </View>
      {value && (
        <Text style={[styles.selectedValue, !enabled && styles.selectedValueDisabled]}>
          {value}
        </Text>
      )}
      {!enabled && (
        <Text style={styles.disabledMessage}>
          متاح فقط عند اختيار السعودية
        </Text>
      )}
    </View>
  );
};

SaudiCityPicker.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  enabled: PropTypes.bool,
};

SaudiCityPicker.defaultProps = {
  value: '',
  placeholder: 'اختر مدينة',
  label: null,
  enabled: true,
};

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.xs,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
    paddingHorizontal: tokens.spacing.xs,
  },
  labelDisabled: {
    color: tokens.colors.najdi.textMuted + '80',
  },
  pickerWrapper: {
    backgroundColor: tokens.colors.najdi.background,
    borderColor: tokens.colors.najdi.container + '40',
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    overflow: 'hidden',
    minHeight: tokens.touchTarget.minimum,
  },
  pickerWrapperDisabled: {
    backgroundColor: tokens.colors.najdi.background + '80',
    borderColor: tokens.colors.najdi.container + '20',
  },
  picker: {
    color: tokens.colors.najdi.text,
    backgroundColor: tokens.colors.najdi.background,
    ...(Platform.OS === 'ios' && {
      fontSize: 16,
    }),
    ...(Platform.OS === 'android' && {
      fontSize: 16,
    }),
  },
  pickerItem: {
    fontSize: 16,
    color: tokens.colors.najdi.text,
  },
  selectedValue: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
    paddingHorizontal: tokens.spacing.xs,
    fontStyle: 'italic',
  },
  selectedValueDisabled: {
    color: tokens.colors.najdi.textMuted + '80',
  },
  disabledMessage: {
    fontSize: 11,
    color: tokens.colors.najdi.textMuted,
    paddingHorizontal: tokens.spacing.xs,
    fontStyle: 'italic',
    fontWeight: '300',
  },
});

export default SaudiCityPicker;
