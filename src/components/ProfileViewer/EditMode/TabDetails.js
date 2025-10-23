import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import BioEditor from '../../admin/fields/BioEditor';
import AchievementsEditor from '../../admin/AchievementsEditor';
import TimelineEditor from '../../admin/TimelineEditor';
import tokens from '../../ui/tokens';
import { Ionicons } from '@expo/vector-icons';

// Section with enhanced styling and icons
const Section = ({ title, subtitle, icon, children, isLast }) => (
  <View style={[styles.section, !isLast && styles.sectionDivider]}>
    <View style={styles.sectionHeader}>
      {icon && (
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={20} color={tokens.colors.najdi.primary} />
        </View>
      )}
      <View style={styles.sectionTitleContainer}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
    </View>
    <View style={styles.sectionContent}>{children}</View>
  </View>
);

// Enhanced Input with character count and debouncing
const LimitedInput = ({
  value,
  onChange,
  placeholder,
  maxLength = 100,
  multiline = false,
}) => {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef(null);

  // Sync local value when external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced onChange handler
  const handleChange = useCallback((text) => {
    setLocalValue(text);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onChange(text);
    }, 350); // 350ms debounce
  }, [onChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const charCount = localValue?.length || 0;
  const isNearLimit = charCount > maxLength * 0.8;

  return (
    <View style={styles.limitedInputContainer}>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={localValue}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={tokens.colors.najdi.textMuted + '80'}
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      <View style={styles.inputFooter}>
        <Text
          style={[
            styles.charCount,
            isNearLimit && styles.charCountWarning,
            charCount >= maxLength && styles.charCountError,
          ]}
        >
          {charCount}/{maxLength}
        </Text>
      </View>
    </View>
  );
};

const TabDetails = ({ form, updateField }) => {
  const { draft } = form;

  return (
    <View style={styles.container}>
      <Section
        title="السيرة الذاتية"
        subtitle="نبذة مختصرة عن الشخصية"
        icon="document-text-outline"
      >
        <BioEditor
          value={draft?.bio || draft?.biography || ''}
          onChange={(text) => updateField('bio', text)}
          maxLength={500}
        />
      </Section>

      <Section
        title="المهنة"
        subtitle="المجال المهني أو الحرفة"
        icon="briefcase-outline"
      >
        <LimitedInput
          value={draft?.occupation || ''}
          onChange={(text) => updateField('occupation', text)}
          placeholder="مثال: مهندس برمجيات، طبيب، معلم..."
          maxLength={100}
        />
      </Section>

      <Section
        title="التعليم"
        subtitle="المؤهلات العلمية والدراسية"
        icon="school-outline"
      >
        <LimitedInput
          value={draft?.education || ''}
          onChange={(text) => updateField('education', text)}
          placeholder="مثال: بكالوريوس علوم حاسب - جامعة الملك سعود"
          maxLength={150}
          multiline
        />
      </Section>

      <Section
        title="المواقع"
        subtitle="أماكن الميلاد والإقامة"
        icon="location-outline"
      >
        <View style={styles.locationFieldsContainer}>
          <View>
            <Text style={styles.locationFieldLabel}>مكان الميلاد</Text>
            <LimitedInput
              value={draft?.birth_place || ''}
              onChange={(text) => updateField('birth_place', text)}
              placeholder="مثال: الرياض، السعودية"
              maxLength={100}
            />
          </View>
          <View>
            <Text style={styles.locationFieldLabel}>مكان الإقامة الحالي</Text>
            <LimitedInput
              value={draft?.current_residence || ''}
              onChange={(text) => updateField('current_residence', text)}
              placeholder="مثال: جدة، السعودية"
              maxLength={100}
            />
          </View>
        </View>
      </Section>

      <Section
        title="الإنجازات"
        subtitle="الإنجازات والجوائز البارزة"
        icon="trophy-outline"
      >
        <AchievementsEditor
          achievements={draft?.achievements || []}
          onChange={(items) => updateField('achievements', items)}
        />
      </Section>

      <Section
        title="الخط الزمني"
        subtitle="الأحداث والمحطات المهمة"
        icon="time-outline"
        isLast
      >
        <TimelineEditor
          timeline={draft?.timeline || []}
          onChange={(items) => updateField('timeline', items)}
        />
      </Section>

      {/* Bottom spacing */}
      <View style={{ height: 32 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.xs,
  },

  // Section Styles
  section: {
    paddingVertical: tokens.spacing.lg,
  },
  sectionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.najdi.container + '30',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: tokens.colors.najdi.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleContainer: {
    flex: 1,
    gap: tokens.spacing.xxs,
  },
  sectionTitle: {
    fontSize: 20, // iOS title3
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    lineHeight: 25,
  },
  sectionSubtitle: {
    fontSize: 13, // iOS caption1
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
    lineHeight: 18,
  },
  sectionContent: {
    // Content goes here
  },

  // Input Styles
  limitedInputContainer: {
    gap: tokens.spacing.xs,
  },
  input: {
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    fontSize: 17, // iOS body
    fontWeight: '400',
    color: tokens.colors.najdi.text,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container + '40',
    minHeight: tokens.touchTarget.minimum,
  },
  inputMultiline: {
    minHeight: 88, // ~3 lines
    paddingTop: tokens.spacing.sm,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: tokens.spacing.xxs,
  },
  charCount: {
    fontSize: 12, // iOS caption1
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
  },
  charCountWarning: {
    color: tokens.colors.najdi.secondary,
  },
  charCountError: {
    color: tokens.colors.danger,
  },

  // Location Fields Styles
  locationFieldsContainer: {
    gap: tokens.spacing.md,
  },
  locationFieldLabel: {
    fontSize: 13, // iOS caption1
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
    marginBottom: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.xs,
  },
});

TabDetails.propTypes = {
  form: PropTypes.shape({
    draft: PropTypes.object,
  }).isRequired,
  updateField: PropTypes.func.isRequired,
};

// Memoize to prevent re-renders of inactive tabs
export default React.memo(TabDetails, (prev, next) => {
  return prev.form.draft === next.form.draft;
});
