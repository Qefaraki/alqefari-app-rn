import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { Ionicons } from '@expo/vector-icons';
import SocialMediaEditor from '../../admin/SocialMediaEditor';
import tokens from '../../ui/tokens';
import { FormSection, FormField } from '../../ui/form';

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  const saudiRegex = /^(966|05)\d{8,9}$/;
  const intlRegex = /^\+\d{10,}$/;
  const cleaned = phone.replace(/[\s-()]/g, '');
  return saudiRegex.test(cleaned) || intlRegex.test(cleaned);
};

const ValidatedInput = ({
  value,
  onChange,
  label,
  placeholder,
  keyboardType,
  validate,
  hint,
  icon,
  autoCapitalize = 'sentences',
}) => {
  const [localValue, setLocalValue] = useState(value || '');
  const [isFocused, setIsFocused] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
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

  useEffect(() => {
    if (!isFocused && localValue) {
      setShowValidation(true);
    }
  }, [isFocused, localValue]);

  const isValid = !localValue || !validate || validate(localValue);
  const showError = showValidation && !isValid && localValue.length > 0;
  const showSuccess = showValidation && isValid && localValue.length > 0;

  return (
    <View style={styles.validatedWrapper}>
      <View style={styles.labelRow}>
        <View style={styles.labelGroup}>
          {icon ? (
            <Ionicons
              name={icon}
              size={16}
              color={tokens.colors.najdi.textMuted}
            />
          ) : null}
          <Text style={styles.labelText}>{label}</Text>
        </View>
        {showSuccess ? (
          <Ionicons name="checkmark-circle" size={18} color={tokens.colors.success} />
        ) : null}
        {showError ? (
          <Ionicons name="alert-circle" size={18} color={tokens.colors.danger} />
        ) : null}
      </View>

      <TextInput
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          showError && styles.inputError,
          showSuccess && styles.inputSuccess,
        ]}
        value={localValue}
        onChangeText={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={`${tokens.colors.najdi.textMuted  }80`}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />

      {hint && !showError ? <Text style={styles.hint}>{hint}</Text> : null}

      {showError ? (
        <View style={styles.errorRow}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={tokens.colors.danger}
          />
          <Text style={styles.errorText}>
            {keyboardType === 'phone-pad'
              ? 'رقم الهاتف غير صحيح. مثال: 966501234567'
              : 'البريد الإلكتروني غير صحيح'}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

ValidatedInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  keyboardType: PropTypes.string,
  validate: PropTypes.func,
  hint: PropTypes.string,
  icon: PropTypes.string,
  autoCapitalize: PropTypes.string,
};

const TabContact = ({ form, updateField }) => {
  const { draft } = form;

  return (
    <View style={styles.container}>
      <View style={styles.stack}>
        <FormSection
          title="معلومات التواصل"
          description="أكد على صحة البيانات المستخدمة للتواصل المباشر."
        >
          <FormField>
            <ValidatedInput
              value={draft?.phone || ''}
              onChange={(text) => updateField('phone', text)}
              label="رقم الهاتف"
              placeholder="966501234567"
              keyboardType="phone-pad"
              validate={validatePhone}
              hint="مثال: 966501234567 أو +966501234567"
              icon="call-outline"
            />
          </FormField>

          <FormField>
            <ValidatedInput
              value={draft?.email || ''}
              onChange={(text) => updateField('email', text)}
              label="البريد الإلكتروني"
              placeholder="example@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              validate={validateEmail}
              hint="سنستخدمه للإشعارات المهمة فقط."
              icon="mail-outline"
            />
          </FormField>
        </FormSection>

        <FormSection
          title="وسائل التواصل الاجتماعي"
          description="أضف روابط للحسابات التي ترغب بمشاركتها."
        >
          <FormField>
            <SocialMediaEditor
              values={draft?.social_media_links || {}}
              onChange={(links) => updateField('social_media_links', links)}
            />
          </FormField>
        </FormSection>
      </View>

      <View style={styles.bottomSpacer} />
    </View>
  );
};

TabContact.propTypes = {
  form: PropTypes.shape({
    draft: PropTypes.object,
  }).isRequired,
  updateField: PropTypes.func.isRequired,
};

export default React.memo(TabContact, (prev, next) => {
  return prev.form.draft === next.form.draft;
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stack: {
    gap: tokens.spacing.lg,
  },
  validatedWrapper: {
    gap: tokens.spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  input: {
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${tokens.colors.najdi.container}40`,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    fontSize: 16,
    fontWeight: '400',
    color: tokens.colors.najdi.text,
  },
  inputFocused: {
    borderColor: tokens.colors.najdi.focus,
  },
  inputSuccess: {
    borderColor: tokens.colors.success,
  },
  inputError: {
    borderColor: tokens.colors.danger,
    backgroundColor: `${tokens.colors.danger  }08`,
  },
  hint: {
    fontSize: 12,
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    color: tokens.colors.danger,
    flex: 1,
  },
  bottomSpacer: {
    height: tokens.spacing.xl,
  },
});
