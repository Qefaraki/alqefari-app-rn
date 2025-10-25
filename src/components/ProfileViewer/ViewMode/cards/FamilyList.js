import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tokens from '../../../ui/tokens';
import { formatNameWithTitle, getTitleAbbreviation } from '../../../../services/professionalTitleService';
import { getCompleteNameChain } from '../../../../utils/nameChainUtils';
import { toArabicNumerals } from '../../../../utils/dateUtils';
import { useSettings } from '../../../../contexts/SettingsContext';

const palette = tokens.colors.najdi;
const spacing = tokens.spacing;

const SKIP_PARTICLES = new Set(['بنت', 'بن', 'بني', 'آل', 'د.', 'م.', 'أ.د.', 'الشيخ', 'اللواء', 'عميد']);

const getFirstAndLastWord = (name = '') => {
  const words = name.trim().split(/\s+/);
  if (words.length <= 2) return name;

  const firstName = words.find((word) => !SKIP_PARTICLES.has(word)) || words[0];
  const lastName = words[words.length - 1];
  return firstName !== lastName ? `${firstName} ${lastName}` : firstName;
};

const buildRelative = (node, { fallbackId, fallbackName, label }) => {
  if (!node && !fallbackName) return null;

  let name;
  if (label === 'الوالدة') {
    const baseName = node?.full_name_chain || node?.name_chain || node?.fullNameChain || node?.name || fallbackName || '';
    const shortened = getFirstAndLastWord(baseName);
    const abbrev = getTitleAbbreviation(node || {});
    name = abbrev ? `${abbrev} ${shortened || baseName}`.trim() : (shortened || baseName);
  } else {
    name = formatNameWithTitle(node) || node?.name || fallbackName || '';
  }

  const id = node?.id ?? fallbackId ?? null;

  return {
    key: `${id || name}`,
    id,
    name,
    label,
    photoUrl: node?.photo_url || null,
  };
};

const FamilyList = React.memo(({
  father,
  mother,
  marriages = [],
  children = [],
  person,
  onNavigate,
}) => {
  const { settings } = useSettings();

  const familyMembers = useMemo(() => {
    const list = [];

    if (father) {
      list.push({ ...buildRelative(father, { label: 'الوالد' }), type: 'member' });
    }
    if (mother) {
      list.push({ ...buildRelative(mother, { label: 'الوالدة' }), type: 'member' });
    }

    // Note: Spouses/wives are intentionally NOT displayed per user requirement
    // All marriage/spouse rendering logic has been removed

    const hasChildren = Array.isArray(children) && children.length > 0;
    if (hasChildren) {
      const sortedChildren = [...children].sort((a, b) => {
        const orderA = a?.sibling_order ?? 999;
        const orderB = b?.sibling_order ?? 999;
        return orderA - orderB;
      });

      list.push({
        type: 'divider',
        key: 'divider-children',
        label: `الأبناء (${toArabicNumerals(String(sortedChildren.length))})`,
      });

      sortedChildren.forEach((child) => {
        const relationship = child?.gender === 'female' ? 'الابنة' : 'الابن';
        list.push({
          ...buildRelative(child, { label: relationship }),
          type: 'member',
        });
      });
    }

    return list.filter(Boolean);
  }, [father, mother, children, person?.gender, person?.id]);

  const hasFamilyData = familyMembers.some((item) => item.type === 'member');

  if (!hasFamilyData) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>العائلة</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>لا توجد معلومات عائلية</Text>
        </View>
      </View>
    );
  }

  // Calculate children count for summary
  const childrenCount = Array.isArray(children) ? children.length : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>
        العائلة{childrenCount > 0 ? ` (${settings.arabicNumerals ? toArabicNumerals(String(childrenCount)) : childrenCount})` : ''}
      </Text>
      {familyMembers.map((item, index) => {
        if (item.type === 'divider') {
          return (
            <View key={item.key || `divider-${index}`} style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{item.label}</Text>
              <View style={styles.dividerLine} />
            </View>
          );
        }

        const initials = item.name ? item.name.trim().charAt(0) : '?';
        const handlePress = () => {
          if (item.id && typeof onNavigate === 'function') {
            onNavigate(item.id);
          }
        };

        return (
          <TouchableOpacity
            key={item.key || item.id || `member-${index}`}
            style={styles.familyRow}
            onPress={handlePress}
            activeOpacity={0.85}
            disabled={!item.id}
            accessibilityRole={item.id ? 'button' : 'text'}
            accessibilityLabel={item.id ? `فتح ملف ${item.name}` : item.name}
          >
            {item.photoUrl ? (
              <Image
                source={{ uri: item.photoUrl }}
                style={styles.avatar}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{initials}</Text>
              </View>
            )}
            <View style={styles.nameBlock}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              {item.label ? (
                <Text style={styles.relationship} numberOfLines={1}>
                  {item.label}
                </Text>
              ) : null}
            </View>
            {item.id ? (
              <Ionicons
                name="chevron-back"
                size={20}
                color={palette.container}
                style={styles.chevron}
              />
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

FamilyList.displayName = 'FamilyList';

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: palette.text,
    marginBottom: spacing.sm,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: tokens.radii.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.text}15`,
  },
  emptyText: {
    fontSize: 15,
    color: `${palette.text}99`,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
    gap: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: `${palette.text}80`,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '600',
    color: `${palette.text}80`,
    paddingHorizontal: spacing.sm,
  },
  familyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: tokens.radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 60,
    marginBottom: spacing.xs,
    shadowColor: palette.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.container,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
  },
  nameBlock: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: palette.text,
  },
  relationship: {
    fontSize: 15,
    color: `${palette.text}99`,
    marginTop: 2,
  },
  chevron: {
    marginStart: spacing.sm,
  },
});

export default FamilyList;
