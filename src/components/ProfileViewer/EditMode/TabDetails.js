import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import BioEditor from '../../admin/fields/BioEditor';
import AchievementsEditor from '../../admin/AchievementsEditor';
import TimelineEditor from '../../admin/TimelineEditor';
import CountryPicker from '../../admin/fields/CountryPicker';
import SaudiCityPicker from '../../admin/fields/SaudiCityPicker';
import tokens from '../../ui/tokens';
import { FormSection, FormField } from '../../ui/form';

const LimitedInput = ({
  value,
  onChange,
  placeholder,
  maxLength = 100,
  multiline = false,
  hint,
}) => {
  const [localValue, setLocalValue] = useState(value || '');
  const timeoutRef = useRef(null);

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleChange = useCallback((text) => {
    setLocalValue(text);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onChange(text);
    }, 300);
  }, [onChange]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const charCount = localValue?.length || 0;
  const isNearLimit = charCount > maxLength * 0.8;
  const isOverLimit = charCount > maxLength;

  return (
    <View style={styles.limitedField}>
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          isOverLimit && styles.inputError,
        ]}
        value={localValue}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={`${tokens.colors.najdi.textMuted  }70`}
        maxLength={maxLength + 1}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      <View style={styles.inputFooter}>
        {hint ? <Text style={styles.hint}>{hint}</Text> : <View />}
        <Text
          style={[
            styles.charCount,
            isNearLimit && styles.charCountWarning,
            isOverLimit && styles.charCountError,
          ]}
        >
          {charCount}/{maxLength}
        </Text>
      </View>
    </View>
  );
};

LimitedInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  maxLength: PropTypes.number,
  multiline: PropTypes.bool,
  hint: PropTypes.string,
};

const TabDetails = ({ form, updateField }) => {
  const { draft } = form;

  return (
    <View style={styles.container}>
      <View style={styles.stack}>
        <FormSection
          title="السيرة الذاتية"
          description="اكتب نبذة مختصرة عن الشخصية والإنجازات الأبرز."
        >
          <FormField>
            <BioEditor
              value={draft?.bio || draft?.biography || ''}
              onChange={(text) => updateField('bio', text)}
              maxLength={500}
            />
          </FormField>
        </FormSection>

        <FormSection
          title="المسار المهني"
          description="أضف معلومات مختصرة عن العمل والدراسة."
        >
          <FormField label="المهنة" hint="مثال: مهندس برمجيات، طبيب، معلم...">
            <LimitedInput
              value={draft?.occupation || ''}
              onChange={(text) => updateField('occupation', text)}
              placeholder="مثال: مهندس برمجيات"
              maxLength={100}
            />
          </FormField>

          <FormField
            label="التعليم"
            hint="يمكنك إضافة الدرجة، التخصص، والجامعة."
          >
            <LimitedInput
              value={draft?.education || ''}
              onChange={(text) => updateField('education', text)}
              placeholder="مثال: بكالوريوس علوم حاسب - جامعة الملك سعود"
              maxLength={150}
              multiline
            />
          </FormField>
        </FormSection>

        <FormSection
          title="المواقع"
          description="ساعد العائلة على معرفة أماكن الميلاد والإقامة."
        >
          <FormField label="مكان الميلاد" hint="مثال: الرياض، جدة، القاهرة...">
            <LimitedInput
              value={draft?.birth_place || ''}
              onChange={(text) => updateField('birth_place', text)}
              placeholder="اختر مدينة أو دولة الميلاد"
              maxLength={100}
            />
          </FormField>

          <FormField label="الدولة الحالية">
            <CountryPicker
              label=""
              value={draft?.current_residence_normalized?.country?.ar || ''}
              onChange={(country) => {
                updateField('current_residence', country);
              }}
              onNormalizedChange={(normalized) => {
                updateField('current_residence_normalized', normalized);
                // Clear city if country changed from Saudi Arabia
                if (normalized?.country?.ar !== 'السعودية') {
                  const clearedNormalized = {
                    ...normalized,
                    city: undefined,
                  };
                  updateField('current_residence_normalized', clearedNormalized);
                }
              }}
              placeholder="اختر دولة"
            />
          </FormField>

          <FormField
            label="المدينة الحالية"
            hint="يتوفر الاختيار عند تحديد السعودية كدولة."
          >
            <SaudiCityPicker
              label=""
              value={draft?.current_residence_normalized?.city?.ar || ''}
              onChange={(city) => {
                updateField('current_residence', city);
              }}
              onNormalizedChange={(normalized) => {
                // Merge city into existing normalized data
                const updated = {
                  ...draft?.current_residence_normalized,
                  original: normalized.city?.ar || normalized.original,
                  city: normalized.city,
                  confidence: normalized.confidence,
                };
                updateField('current_residence_normalized', updated);
              }}
              placeholder="اختر مدينة"
              enabled={draft?.current_residence_normalized?.country?.ar === 'السعودية'}
            />
          </FormField>
        </FormSection>

        <FormSection
          title="الإنجازات"
          description="أبرز الجوائز أو الإسهامات التي تود مشاركتها."
        >
          <FormField>
            <AchievementsEditor
              achievements={draft?.achievements || []}
              onChange={(items) => updateField('achievements', items)}
            />
          </FormField>
        </FormSection>

        <FormSection
          title="الخط الزمني"
          description="رتب الأحداث والمحطات المهمة في حياة الشخص."
        >
          <FormField>
            <TimelineEditor
              timeline={draft?.timeline || []}
              onChange={(items) => updateField('timeline', items)}
            />
          </FormField>
        </FormSection>
      </View>

      <View style={styles.bottomSpacer} />
    </View>
  );
};

TabDetails.propTypes = {
  form: PropTypes.shape({
    draft: PropTypes.object,
  }).isRequired,
  updateField: PropTypes.func.isRequired,
};

export default React.memo(TabDetails, (prev, next) => {
  return prev.form.draft === next.form.draft;
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stack: {
    gap: tokens.spacing.xl,
  },
  limitedField: {
    gap: tokens.spacing.sm,
  },
  input: {
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${tokens.colors.najdi.container  }50`,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    fontSize: 16,
    fontWeight: '400',
    color: tokens.colors.najdi.text,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: tokens.colors.danger,
  },
  inputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hint: {
    fontSize: 12,
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
  },
  charCount: {
    fontSize: 12,
    fontWeight: '500',
    color: tokens.colors.najdi.textMuted,
  },
  charCountWarning: {
    color: tokens.colors.najdi.secondary,
  },
  charCountError: {
    color: tokens.colors.danger,
  },
  bottomSpacer: {
    height: tokens.spacing.xl,
  },
});
