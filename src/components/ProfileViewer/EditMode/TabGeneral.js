import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  Animated,
  StyleSheet,
} from 'react-native';
import PropTypes from 'prop-types';
import PhotoEditor from '../../admin/fields/PhotoEditor';
import NameEditor from '../../admin/fields/NameEditor';
import DateEditor from '../../admin/fields/DateEditor';
import TitleSelector from '../../admin/fields/TitleSelector';
import * as Haptics from 'expo-haptics';
import tokens from '../../ui/tokens';

// iOS-style Form Group with header
const FormGroup = ({ title, children, style }) => (
  <View style={[styles.formGroup, style]}>
    {title ? <Text style={styles.formGroupHeader}>{title}</Text> : null}
    <View style={styles.formGroupContent}>{children}</View>
  </View>
);

// Enhanced Toggle Group with proper iOS styling and haptics
const ToggleGroup = ({ label, value, options, onChange }) => {
  const scaleAnims = useRef(options.map(() => new Animated.Value(1))).current;

  const handlePress = (option, index) => {
    // Haptic feedback on selection
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Scale animation
    Animated.sequence([
      Animated.timing(scaleAnims[index], {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnims[index], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onChange(option.value);
  };

  return (
    <FormGroup title={label}>
      <View style={styles.toggleContainer}>
        {options.map((option, index) => {
          const isActive = option.value === value;
          return (
            <Animated.View
              key={option.value}
              style={[
                styles.toggleWrapper,
                { transform: [{ scale: scaleAnims[index] }] },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.toggleChip,
                  isActive && styles.toggleChipActive,
                ]}
                onPress={() => handlePress(option, index)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    isActive && styles.toggleLabelActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </FormGroup>
  );
};

const TabGeneral = ({ form, updateField }) => {
  const { draft, original } = form;
  const profileId = original?.id || draft?.id;

  // Local state for debounced kunya input
  const [kunyaValue, setKunyaValue] = useState(draft?.kunya || '');
  const kunyaTimeoutRef = useRef(null);

  // Sync local kunya value when draft changes
  useEffect(() => {
    setKunyaValue(draft?.kunya || '');
  }, [draft?.kunya]);

  // Debounced kunya update
  const handleKunyaChange = useCallback((text) => {
    setKunyaValue(text);

    if (kunyaTimeoutRef.current) {
      clearTimeout(kunyaTimeoutRef.current);
    }

    kunyaTimeoutRef.current = setTimeout(() => {
      updateField('kunya', text);
    }, 300);
  }, [updateField]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (kunyaTimeoutRef.current) {
        clearTimeout(kunyaTimeoutRef.current);
      }
    };
  }, []);

  // Animated height for DOD field (smooth reveal)
  const dodHeightAnim = useRef(new Animated.Value(0)).current;
  const dodOpacityAnim = useRef(new Animated.Value(0)).current;

  // Animate DOD field when status changes
  useEffect(() => {
    const isDeceased = draft?.status === 'deceased';

    Animated.parallel([
      Animated.spring(dodHeightAnim, {
        toValue: isDeceased ? 1 : 0,
        damping: 20,
        stiffness: 200,
        useNativeDriver: false,
      }),
      Animated.timing(dodOpacityAnim, {
        toValue: isDeceased ? 1 : 0,
        duration: 300,
        useNativeDriver: false, // Must be false when animating with height
      }),
    ]).start();
  }, [draft?.status]);

  const dodHeight = dodHeightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 360], // Full height for DateEditor with extra padding (was 120px)
  });

  return (
    <View style={styles.container}>
      {/* Photo Section - Standalone */}
      <PhotoEditor
        value={draft?.photo_url || ''}
        onChange={(url) => updateField('photo_url', url)}
        currentPhotoUrl={draft?.photo_url}
        personName={draft?.name}
        profileId={profileId}
      />

      {/* Basic Info Group */}
      <FormGroup title="المعلومات الأساسية">
        <View style={styles.groupedInputs}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>الاسم الكامل</Text>
            <NameEditor
              value={draft?.name || ''}
              onChange={(text) => updateField('name', text)}
              placeholder="الاسم الكامل"
              fontSize={17}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>الكنية</Text>
            <TextInput
              style={styles.input}
              value={kunyaValue}
              onChangeText={handleKunyaChange}
              placeholder="أبو محمد"
              placeholderTextColor={tokens.colors.najdi.textMuted + '80'}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>اللقب المهني</Text>
            <TitleSelector
              value={draft?.professional_title}
              customValue={draft?.title_abbreviation}
              onChange={({ professional_title, title_abbreviation }) => {
                updateField('professional_title', professional_title);
                updateField('title_abbreviation', title_abbreviation);
              }}
              personName={draft?.name}
            />
          </View>
        </View>
      </FormGroup>

      {/* Gender Selection */}
      <ToggleGroup
        label="الجنس"
        value={draft?.gender || 'male'}
        onChange={(value) => updateField('gender', value)}
        options={[
          { value: 'male', label: 'ذكر' },
          { value: 'female', label: 'أنثى' },
        ]}
      />

      {/* Status Selection */}
      <ToggleGroup
        label="الحالة"
        value={draft?.status || 'alive'}
        onChange={(value) => updateField('status', value)}
        options={[
          { value: 'alive', label: 'حي' },
          { value: 'deceased', label: 'متوفى' },
        ]}
      />

      {/* Dates Group */}
      <FormGroup title="التواريخ">
        <View style={styles.dateContainer}>
          <Text style={styles.dateLabel}>تاريخ الميلاد</Text>
          <DateEditor
            value={draft?.dob_data}
            onChange={(value) => updateField('dob_data', value)}
          />
        </View>

        {/* Animated DOD Field */}
        <Animated.View
          style={[
            styles.dodAnimatedContainer,
            {
              height: dodHeight,
              opacity: dodOpacityAnim,
              overflow: 'hidden',
            },
          ]}
          pointerEvents={draft?.status === 'deceased' ? 'auto' : 'none'}
        >
          <View style={styles.dateContainer}>
            <Text style={styles.dateLabel}>تاريخ الوفاة</Text>
            <DateEditor
              value={draft?.dod_data}
              onChange={(value) => updateField('dod_data', value)}
            />
          </View>
        </Animated.View>
      </FormGroup>

      {/* Privacy Settings */}
      <FormGroup>
        <View style={styles.switchRow}>
          <Switch
            value={draft?.dob_is_public !== false}
            onValueChange={(value) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              updateField('dob_is_public', value);
            }}
            trackColor={{
              false: tokens.colors.najdi.container + '60',
              true: tokens.colors.najdi.secondary,
            }}
            thumbColor={tokens.colors.najdi.background}
            ios_backgroundColor={tokens.colors.najdi.container + '60'}
          />
          <View style={styles.switchTextContainer}>
            <Text style={styles.switchLabel}>عرض تاريخ الميلاد للعائلة</Text>
            <Text style={styles.switchHint}>
              يمكن لأفراد العائلة رؤية تاريخ الميلاد الكامل
            </Text>
          </View>
        </View>
      </FormGroup>

      {/* Bottom spacing for scroll comfort */}
      <View style={{ height: 32 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.xl,
  },

  // Form Group Styles (iOS Inset Grouped List)
  formGroup: {
    gap: tokens.spacing.xs,
  },
  formGroupHeader: {
    fontSize: 13, // iOS caption1
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.xxs,
  },
  formGroupContent: {
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container + '40',
    overflow: 'hidden',
  },

  // Grouped Inputs (like iOS Settings)
  groupedInputs: {
    gap: 1, // Thin divider
    backgroundColor: tokens.colors.najdi.container + '20',
  },
  inputWrapper: {
    backgroundColor: tokens.colors.najdi.background,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.xxs,
  },
  inputLabel: {
    fontSize: 13, // iOS caption1
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
  },
  input: {
    fontSize: 17, // iOS body
    fontWeight: '400',
    color: tokens.colors.najdi.text,
    paddingVertical: tokens.spacing.xxs,
    minHeight: tokens.touchTarget.minimum,
  },

  // Toggle Group Styles (Najdi Sadu)
  toggleContainer: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    padding: tokens.spacing.sm,
  },
  toggleWrapper: {
    minWidth: 80, // Prevents squishing, allows natural growth
  },
  toggleChip: {
    height: tokens.touchTarget.minimum,
    borderRadius: tokens.radii.sm,
    borderWidth: 1.5,
    borderColor: tokens.colors.najdi.container,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.najdi.background,
    paddingHorizontal: tokens.spacing.md, // 16px horizontal padding for breathing room
    minWidth: 80, // Ensures minimum comfort size
  },
  toggleChipActive: {
    borderColor: tokens.colors.najdi.primary,
    backgroundColor: tokens.colors.najdi.primary + '10',
  },
  toggleLabel: {
    fontSize: 15, // iOS subheadline
    fontWeight: '600',
    color: tokens.colors.najdi.textMuted,
  },
  toggleLabelActive: {
    color: tokens.colors.najdi.primary,
  },

  // Date Section
  dateContainer: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
  },
  dodAnimatedContainer: {
    // Animated height and opacity handled inline
  },

  // Switch Row (iOS Style)
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.sm,
    minHeight: tokens.touchTarget.minimum,
  },
  switchTextContainer: {
    flex: 1,
    gap: tokens.spacing.xxs,
  },
  switchLabel: {
    fontSize: 17, // iOS body
    fontWeight: '400',
    color: tokens.colors.najdi.text,
  },
  switchHint: {
    fontSize: 13, // iOS caption1
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
    lineHeight: 18,
  },
});

TabGeneral.propTypes = {
  form: PropTypes.shape({
    draft: PropTypes.object,
    original: PropTypes.object,
  }).isRequired,
  updateField: PropTypes.func.isRequired,
};

export default TabGeneral;
