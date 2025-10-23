import React, { useCallback } from 'react';
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

const SAUDI_CITIES = [
  // Riyadh region
  'الرياض',                // Capital - #1
  // Qassim region (user priority)
  'بريدة',                 // Buraida - #2
  'عنيزة',                 // Unaizah
  'الرس',                  // Ar Rass
  'المذنب',                // Al Mithnab
  'البكيرية',              // Al Bukayriyah
  '─────────',
  // Major cities
  'جدة',                   // Jeddah
  'مكة المكرمة',           // Mecca
  'المدينة المنورة',       // Medina
  'الدمام',                // Dammam
  'الخبر',                 // Khobar
  'القطيف',                // Qatif
  'الطائف',                // Taif
  'تبوك',                  // Tabuk
  'أبها',                  // Abha
  'جازان',                 // Jazan
  'نجران',                 // Najran
  'حائل',                  // Hail
  'الأحساء',               // Al-Ahsa
  'ينبع',                  // Yanbu
  'الجبيل',                // Jubail
  'الباحة',                // Al-Baha
  'عرعر',                  // Arar
  'سكاكا',                 // Sakaka
  'حفر الباطن',           // Hafr Al-Batin
];

const SaudiCityPicker = ({ label, value, onChange, onNormalizedChange, placeholder, enabled = true }) => {
  const handleChange = useCallback(async (itemValue) => {
    if (itemValue && !itemValue.startsWith('─')) {
      // Call text onChange immediately
      onChange(itemValue);

      // Lookup normalized data from database
      if (onNormalizedChange && enabled) {
        const normalized = await lookupPlaceByName(itemValue);
        if (normalized) {
          onNormalizedChange(normalized);
        }
      }
    }
  }, [onChange, onNormalizedChange, enabled]);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
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
              enabled={!city.startsWith('─')}
            />
          ))}
        </Picker>
      </View>
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
  onNormalizedChange: PropTypes.func,
  placeholder: PropTypes.string,
  enabled: PropTypes.bool,
};

SaudiCityPicker.defaultProps = {
  value: '',
  onNormalizedChange: undefined,
  placeholder: 'اختر مدينة',
  label: null,
  enabled: true,
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
  pickerWrapperDisabled: {
    backgroundColor: `${tokens.colors.najdi.background  }80`,
    borderColor: `${tokens.colors.najdi.secondary  }40`,
    borderStyle: 'dashed',
    borderWidth: 1.5,
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
  disabledMessage: {
    fontSize: 12,
    color: tokens.colors.najdi.secondary,
    paddingHorizontal: tokens.spacing.xs,
    fontWeight: '400',
  },
});

export default SaudiCityPicker;
