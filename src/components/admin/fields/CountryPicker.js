import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import tokens from '../../ui/tokens';
import { lookupPlaceByName } from '../../../services/locationLookup';

const COUNTRIES = [
  // Saudi Arabia first
  '🇸🇦 السعودية',
  '─────────',
  // Top study destinations
  '🇺🇸 الولايات المتحدة',
  '🇬🇧 بريطانيا',
  '🇨🇦 كندا',
  '🇦🇺 أستراليا',
  '🇩🇪 ألمانيا',
  '─────────',
  // Gulf countries
  '🇦🇪 الإمارات',
  '🇰🇼 الكويت',
  '🇧🇭 البحرين',
  '🇶🇦 قطر',
  '🇴🇲 عمان',
  '─────────',
  // Arab countries (Levant + Egypt + Iraq + Yemen + North Africa)
  '🇪🇬 مصر',
  '🇯🇴 الأردن',
  '🇱🇧 لبنان',
  '🇸🇾 سوريا',
  '🇮🇶 العراق',
  '🇵🇸 فلسطين',
  '🇾🇪 اليمن',
  '🇩🇿 الجزائر',
  '🇹🇳 تونس',
  '🇲🇦 المغرب',
  '🇱🇾 ليبيا',
  '🇸🇩 السودان',
  '─────────',
  // Other international countries
  '🇫🇷 فرنسا',
  '🇮🇹 إيطاليا',
  '🇪🇸 إسبانيا',
  '🇹🇷 تركيا',
  '🇨🇳 الصين',
  '🇮🇳 الهند',
  '🇵🇰 باكستان',
  '🇯🇵 اليابان',
  '🇰🇷 كوريا الجنوبية',
  '─────────',
  'دول أخرى',
];

const CountryPicker = ({ label, value, onChange, onNormalizedChange, placeholder }) => {
  // Filter out separator lines for validation
  const validCountries = useMemo(
    () => COUNTRIES.filter((c) => !c.startsWith('─')),
    []
  );

  const handleChange = useCallback(async (itemValue) => {
    if (itemValue && !itemValue.startsWith('─')) {
      // Strip emoji and spaces, keep only country name
      const cleanValue = itemValue.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '').trim();

      // Call text onChange immediately
      onChange(cleanValue);

      // Lookup normalized data from database
      if (onNormalizedChange) {
        const normalized = await lookupPlaceByName(cleanValue);
        if (normalized) {
          onNormalizedChange(normalized);
        }
      }
    }
  }, [onChange, onNormalizedChange]);

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
    </View>
  );
};

CountryPicker.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onNormalizedChange: PropTypes.func,
  placeholder: PropTypes.string,
};

CountryPicker.defaultProps = {
  value: '',
  onNormalizedChange: undefined,
  placeholder: 'اختر دولة',
  label: null,
};

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: `${tokens.colors.najdi.text  }C0`,
    paddingHorizontal: tokens.spacing.xs,
  },
  pickerWrapper: {
    backgroundColor: tokens.colors.najdi.background,
    borderColor: `${tokens.colors.najdi.container  }60`,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    overflow: 'hidden',
    minHeight: tokens.touchTarget.minimum,
  },
  picker: {
    color: tokens.colors.najdi.text,
    backgroundColor: tokens.colors.najdi.background,
    ...(Platform.OS === 'ios' && {
      fontSize: 17,
    }),
    ...(Platform.OS === 'android' && {
      fontSize: 17,
    }),
  },
  pickerItem: {
    fontSize: 17,
    color: tokens.colors.najdi.text,
  },
});

export default CountryPicker;
