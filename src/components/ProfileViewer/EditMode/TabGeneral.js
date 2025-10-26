import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Animated,
  StyleSheet,
} from 'react-native';
import PropTypes from 'prop-types';
import * as Haptics from 'expo-haptics';
import PhotoEditor from '../../admin/fields/PhotoEditor';
import NameEditor from '../../admin/fields/NameEditor';
import DateEditor from '../../admin/fields/DateEditor';
import TitleSelector from '../../admin/fields/TitleSelector';
import tokens from '../../ui/tokens';
import ChoiceChip from '../../ui/ChoiceChip';
import { FormField, ProfileFormCard } from '../../ui/form';
import PhotoGallerySimple from '../../PhotoGallerySimple';

/**
 * Responsive toggle pills with subtle haptics.
 * Extracted so the same wrapper can be reused across tabs.
 */
const ToggleGroup = ({ value, options, onChange }) => {
  const scaleAnimsRef = useRef([]);

  if (!scaleAnimsRef.current.length || scaleAnimsRef.current.length !== options.length) {
    scaleAnimsRef.current = options.map(() => new Animated.Value(1));
  }

  const handlePress = (option, index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Animated.sequence([
      Animated.timing(scaleAnimsRef.current[index], {
        toValue: 0.96,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnimsRef.current[index], {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();

    onChange(option.value);
  };

  return (
    <View style={styles.toggleContainer}>
      {options.map((option, index) => {
        const isActive = option.value === value;
        const shouldSpanFull =
          options.length % 2 !== 0 && index === options.length - 1;

        return (
          <Animated.View
            key={option.value}
            style={[
              styles.toggleWrapper,
              shouldSpanFull && styles.toggleWrapperFull,
              { transform: [{ scale: scaleAnimsRef.current[index] }] },
            ]}
          >
            <ChoiceChip
              label={option.label}
              selected={isActive}
              onPress={() => handlePress(option, index)}
              grow={shouldSpanFull}
            />
          </Animated.View>
        );
      })}
    </View>
  );
};

ToggleGroup.propTypes = {
  value: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ).isRequired,
  onChange: PropTypes.func.isRequired,
};

const TabGeneral = ({ form, updateField }) => {
  const { draft, original } = form;
  const profileId = original?.id || draft?.id;

  const [kunyaValue, setKunyaValue] = useState(draft?.kunya || '');
  const kunyaTimeoutRef = useRef(null);

  useEffect(() => {
    setKunyaValue(draft?.kunya || '');
  }, [draft?.kunya]);

  const handleKunyaChange = useCallback((text) => {
    setKunyaValue(text);
    if (kunyaTimeoutRef.current) {
      clearTimeout(kunyaTimeoutRef.current);
    }

    kunyaTimeoutRef.current = setTimeout(() => {
      updateField('kunya', text);
    }, 300);
  }, [updateField]);

  useEffect(() => {
    return () => {
      if (kunyaTimeoutRef.current) {
        clearTimeout(kunyaTimeoutRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.stack}>
        <ProfileFormCard style={styles.card}>
          <Text style={styles.cardCaption}>الصورة</Text>
          <View style={styles.cardContent}>
            <PhotoEditor
              value={draft?.photo_url || ''}
              onChange={(url) => updateField('photo_url', url)}
              currentPhotoUrl={draft?.photo_url}
              personName={draft?.name}
              profileId={profileId}
            />
          </View>
        </ProfileFormCard>

        <ProfileFormCard style={styles.card}>
          <Text style={styles.cardCaption}>البيانات الشخصية</Text>
          <View style={styles.cardContent}>
            <FormField label="الاسم الكامل" required>
              <NameEditor
                value={draft?.name || ''}
                onChange={(text) => updateField('name', text)}
                placeholder="الاسم الكامل"
                fontSize={18}
                variant="form"
              />
            </FormField>

            <FormField label="الكنية">
              <TextInput
                style={styles.textInput}
                value={kunyaValue}
                onChangeText={handleKunyaChange}
                placeholder="أبو محمد"
                placeholderTextColor={`${tokens.colors.najdi.textMuted}80`}
              />
            </FormField>

            <FormField label="اللقب المهني">
              <TitleSelector
                value={draft?.professional_title}
                customValue={draft?.title_abbreviation}
                onChange={({ professional_title, title_abbreviation }) => {
                  updateField('professional_title', professional_title);
                  updateField('title_abbreviation', title_abbreviation);
                }}
                personName={draft?.name}
              />
            </FormField>
          </View>
        </ProfileFormCard>

        <ProfileFormCard style={styles.card}>
          <Text style={styles.cardCaption}>الاختيارات</Text>
          <View style={styles.cardContent}>
            <FormField label="الجنس">
              <ToggleGroup
                value={draft?.gender || 'male'}
                onChange={(val) => updateField('gender', val)}
                options={[
                  { value: 'male', label: 'ذكر' },
                  { value: 'female', label: 'أنثى' },
                ]}
              />
            </FormField>

            <FormField label="الحالة">
              <ToggleGroup
                value={draft?.status || 'alive'}
                onChange={(val) => updateField('status', val)}
                options={[
                  { value: 'alive', label: 'حي' },
                  { value: 'deceased', label: 'متوفى' },
                ]}
              />
            </FormField>
          </View>
        </ProfileFormCard>

        <ProfileFormCard style={styles.card}>
          <Text style={styles.cardCaption}>التواريخ</Text>
          <View style={styles.cardContent}>
            <FormField label="تاريخ الميلاد">
              <DateEditor
                value={draft?.dob_data}
                onChange={(value) => updateField('dob_data', value)}
              />
            </FormField>

            {draft?.status === 'deceased' ? (
              <FormField label="تاريخ الوفاة">
                <DateEditor
                  value={draft?.dod_data}
                  onChange={(value) => updateField('dod_data', value)}
                />
              </FormField>
            ) : null}
          </View>
        </ProfileFormCard>

        <ProfileFormCard style={styles.card}>
          <Text style={styles.cardCaption}>الخصوصية</Text>
          <View style={styles.cardContent}>
            <FormField label="مشاركة تاريخ الميلاد">
              <ToggleGroup
                value={draft?.dob_is_public === false ? 'private' : 'public'}
                onChange={(val) => updateField('dob_is_public', val === 'public')}
                options={[
                  { value: 'public', label: 'مرئي للعائلة' },
                  { value: 'private', label: 'مخفي' },
                ]}
              />
            </FormField>
          </View>
        </ProfileFormCard>

        <ProfileFormCard style={styles.card}>
          <Text style={styles.cardCaption}>الصور</Text>
            {profileId ? (
              <PhotoGallerySimple
                profileId={profileId}
                isEditMode={true}
              />
            ) : (
              <View style={styles.cardContent}>
                <Text style={styles.galleryHint}>
                  سيظهر محرر الصور بعد إنشاء الملف وحفظه للمرة الأولى.
                </Text>
              </View>
            )}
        </ProfileFormCard>
      </View>
    </View>
  );
};

TabGeneral.propTypes = {
  form: PropTypes.shape({
    draft: PropTypes.object,
    original: PropTypes.object,
  }).isRequired,
  updateField: PropTypes.func.isRequired,
};

export default React.memo(TabGeneral, (prev, next) => {
  return (
    prev.form.draft === next.form.draft &&
    prev.updateField === next.updateField
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: tokens.spacing.xl,
  },
  stack: {
    gap: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
  },
  card: {
    gap: tokens.spacing.md,
  },
  cardCaption: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF Arabic',
  },
  cardContent: {
    gap: tokens.spacing.md,
  },
  galleryContent: {
    gap: tokens.spacing.sm,
  },
  galleryHint: {
    fontSize: 14,
    color: tokens.colors.najdi.textMuted,
    lineHeight: 20,
  },
  galleryWrapper: {
    borderRadius: tokens.radii.lg,
    backgroundColor: 'transparent',
  },
  textInput: {
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + '50',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    fontSize: 16,
    fontWeight: '400',
    color: tokens.colors.najdi.text,
  },
  toggleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  toggleWrapper: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  toggleWrapperFull: {
    flexBasis: '100%',
  },
});
