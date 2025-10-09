import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import SocialMediaEditor from '../../admin/SocialMediaEditor';
import tokens from '../../ui/tokens';
import { Ionicons } from '@expo/vector-icons';

// Validation helpers
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  // Saudi phone: starts with 966 or 05, 10 digits
  const saudiRegex = /^(966|05)\d{8,9}$/;
  // International: starts with +, at least 10 digits
  const intlRegex = /^\+\d{10,}$/;
  const cleaned = phone.replace(/[\s-()]/g, '');
  return saudiRegex.test(cleaned) || intlRegex.test(cleaned);
};

// Validated Input Component with debouncing
const ValidatedInput = ({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  autoCapitalize = 'sentences',
  validate,
  hint,
  icon,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
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
    }, 400); // 400ms debounce for validation inputs
  }, [onChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const isValid = !localValue || !validate || validate(localValue);
  const showError = showValidation && !isValid && localValue.length > 0;
  const showSuccess = showValidation && isValid && localValue.length > 0;

  useEffect(() => {
    // Show validation after user has entered something and blurred
    if (!isFocused && localValue) {
      setShowValidation(true);
    }
  }, [isFocused, localValue]);

  return (
    <View style={styles.validatedInputContainer}>
      <View style={styles.inputHeader}>
        <View style={styles.labelRow}>
          {icon && (
            <Ionicons
              name={icon}
              size={16}
              color={tokens.colors.najdi.textMuted}
            />
          )}
          <Text style={styles.inputLabel}>{label}</Text>
        </View>
        {showSuccess && (
          <Ionicons
            name="checkmark-circle"
            size={16}
            color={tokens.colors.success}
          />
        )}
        {showError && (
          <Ionicons
            name="alert-circle"
            size={16}
            color={tokens.colors.danger}
          />
        )}
      </View>

      <TextInput
        style={[
          styles.validatedInput,
          isFocused && styles.validatedInputFocused,
          showError && styles.validatedInputError,
          showSuccess && styles.validatedInputSuccess,
        ]}
        value={localValue}
        onChangeText={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={tokens.colors.najdi.textMuted + '80'}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />

      {hint && !showError && <Text style={styles.inputHint}>{hint}</Text>}

      {showError && (
        <View style={styles.errorContainer}>
          <Ionicons
            name="information-circle-outline"
            size={14}
            color={tokens.colors.danger}
          />
          <Text style={styles.errorText}>
            {keyboardType === 'phone-pad'
              ? 'رقم الهاتف غير صحيح. مثال: 966501234567'
              : 'البريد الإلكتروني غير صحيح'}
          </Text>
        </View>
      )}
    </View>
  );
};

// Section Component
const Section = ({ title, subtitle, children, isLast }) => (
  <View style={[styles.section, !isLast && styles.sectionDivider]}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
    <View style={styles.sectionContent}>{children}</View>
  </View>
);

const TabContact = ({ form, updateField }) => {
  const { draft } = form;

  return (
    <View style={styles.container}>
      <Section
        title="معلومات التواصل"
        subtitle="البيانات المستخدمة للتواصل المباشر"
      >
        <ValidatedInput
          label="رقم الهاتف"
          value={draft?.phone || ''}
          onChange={(text) => updateField('phone', text)}
          placeholder="966501234567"
          keyboardType="phone-pad"
          validate={validatePhone}
          hint="مثال: 966501234567 أو 0501234567"
          icon="call-outline"
        />

        <ValidatedInput
          label="البريد الإلكتروني"
          value={draft?.email || ''}
          onChange={(text) => updateField('email', text)}
          placeholder="example@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          validate={validateEmail}
          hint="سيتم استخدامه للإشعارات المهمة"
          icon="mail-outline"
        />
      </Section>

      <Section
        title="وسائل التواصل الاجتماعي"
        subtitle="الحسابات على منصات التواصل"
        isLast
      >
        <SocialMediaEditor
          values={draft?.social_media_links || {}}
          onChange={(links) => updateField('social_media_links', links)}
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
    marginBottom: tokens.spacing.md,
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
    gap: tokens.spacing.lg,
  },

  // Validated Input Styles
  validatedInputContainer: {
    gap: tokens.spacing.xs,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xxs,
  },
  inputLabel: {
    fontSize: 13, // iOS caption1
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  validatedInput: {
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    fontSize: 17, // iOS body
    fontWeight: '400',
    color: tokens.colors.najdi.text,
    borderWidth: 1.5,
    borderColor: tokens.colors.najdi.container + '60',
    minHeight: tokens.touchTarget.minimum,
  },
  validatedInputFocused: {
    borderColor: tokens.colors.najdi.focus,
    backgroundColor: tokens.colors.najdi.background,
  },
  validatedInputError: {
    borderColor: tokens.colors.danger,
    backgroundColor: tokens.colors.danger + '05',
  },
  validatedInputSuccess: {
    borderColor: tokens.colors.success,
  },
  inputHint: {
    fontSize: 12, // iOS caption1
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
    paddingHorizontal: tokens.spacing.xxs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xxs,
    paddingHorizontal: tokens.spacing.xxs,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
    color: tokens.colors.danger,
  },
});

TabContact.propTypes = {
  form: PropTypes.shape({
    draft: PropTypes.object,
  }).isRequired,
  updateField: PropTypes.func.isRequired,
};

// Memoize to prevent re-renders of inactive tabs
export default React.memo(TabContact, (prev, next) => {
  return prev.form.draft === next.form.draft;
});
