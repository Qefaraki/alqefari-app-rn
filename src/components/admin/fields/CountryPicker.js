import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import tokens from '../../ui/tokens';

const COUNTRIES = [
  'السعودية',
  '─────────',
  'الإمارات',
  'الكويت',
  'البحرين',
  'قطر',
  'عمان',
  '─────────',
  'مصر',
  'الأردن',
  'لبنان',
  'سوريا',
  'العراق',
  'اليمن',
  'فلسطين',
  '─────────',
  'الجزائر',
  'تونس',
  'المغرب',
  'ليبيا',
  'السودان',
  '─────────',
  'الولايات المتحدة',
  'كندا',
  'بريطانيا',
  'فرنسا',
  'ألمانيا',
  'إيطاليا',
  'إسبانيا',
  '─────────',
  'دول أخرى',
];

const CountryPicker = ({ label, value, onChange, placeholder }) => {
  // Filter out separator lines for validation
  const validCountries = useMemo(
    () => COUNTRIES.filter((c) => !c.startsWith('─')),
    []
  );

  const handleChange = (itemValue) => {
    if (itemValue && !itemValue.startsWith('─')) {
      onChange(itemValue);
    }
  };

  const displayValue = value || (placeholder || 'اختر دولة');

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={value || ''}
          onValueChange={handleChange}
          style={styles.picker}
          itemStyle={styles.pickerItem}
          mode="dropdown"
        >
          <Picker.Item label={placeholder || 'اختر دولة'} value="" />
          {COUNTRIES.map((country, index) => (
            <Picker.Item
              key={`${country}-${index}`}
              label={country}
              value={country}
              enabled={!country.startsWith('─')}
            />
          ))}
        </Picker>
      </View>
      {value && (
        <Text style={styles.selectedValue}>{value}</Text>
      )}
    </View>
  );
};

CountryPicker.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

CountryPicker.defaultProps = {
  value: '',
  placeholder: 'اختر دولة',
  label: null,
};

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
    paddingHorizontal: tokens.spacing.xs,
  },
  pickerWrapper: {
    backgroundColor: tokens.colors.najdi.background,
    borderColor: tokens.colors.najdi.container + '40',
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    overflow: 'hidden',
    minHeight: tokens.touchTarget.minimum,
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
});

export default CountryPicker;
