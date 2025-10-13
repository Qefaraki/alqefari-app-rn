import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import InfoCard from '../components/InfoCard';
import { ProgressiveThumbnail } from '../../../ProgressiveImage';
import { formatNameWithTitle } from '../../../../services/professionalTitleService';

const buildRelative = (node, { fallbackId, fallbackName, label }) => {
  if (!node && !fallbackName) return null;

  const name = formatNameWithTitle(node) || node?.name || fallbackName || '';
  const id = node?.id ?? fallbackId ?? null;

  return {
    key: `${id || name}`,
    id,
    name,
    label,
    photoUrl: node?.photo_url || null,
    accessibilityLabel: id ? `فتح ملف ${name}` : name,
  };
};

const FamilyCard = React.memo(
  ({
    father,
    mother,
    marriages = [],
    children = [],
    person,
    onNavigate,
    showMarriages,
  }) => {
    const allMembers = useMemo(() => {
      const list = [];

      // Add parents first with labels
      if (father) {
        list.push({ ...buildRelative(father, { label: 'الوالد' }), type: 'parent' });
      }
      if (mother) {
        list.push({ ...buildRelative(mother, { label: 'الوالدة' }), type: 'parent' });
      }

      // Add CURRENT spouses only (Munasib profiles only to avoid UX change)
      if (marriages && marriages.length > 0 && person?.hid === null) {
        // Filter: ONLY current marriages (no divorced/past spouses)
        const currentMarriages = marriages.filter(m =>
          m.status === 'current' || m.status === 'married' // Backward compat
        );

        if (currentMarriages.length > 0) {
          // Add divider if we have parents above
          if (list.length > 0) {
            list.push({ type: 'divider', key: 'divider-spouses' });
          }

          currentMarriages.forEach((marriage, index) => {
            const spouse = marriage.spouse_profile;
            // Safety checks: exists, not deleted, not circular reference
            if (spouse && !spouse.deleted_at && spouse.id !== person.id) {
              const label = person.gender === 'male' ? 'الزوجة' : 'الزوج';
              list.push({
                ...buildRelative(spouse, { label }),
                type: 'spouse',
                key: `spouse-${spouse.id || index}`
              });
            }
          });
        }
      }

      // Add divider before children
      if (list.length > 0 && children.length > 0) {
        list.push({ type: 'divider', key: 'divider-children' });
      }

      // Sort children by sibling_order (0 = oldest)
      const sortedChildren = [...children].sort((a, b) => {
        const orderA = a.sibling_order ?? 999;
        const orderB = b.sibling_order ?? 999;
        return orderA - orderB;
      });

      // Native RTL mode handles visual direction automatically
      sortedChildren.forEach(child => {
        list.push({ ...buildRelative(child, {}), type: 'child' });
      });

      return list;
    }, [children, father, mother, marriages, person]);

  if (allMembers.length === 0) {
    return null;
  }

  const renderTile = (item, index) => {
    const handlePress = () => {
      if (item.id && typeof onNavigate === 'function') {
        onNavigate(item.id);
      }
    };

    const initials = item.name ? item.name.slice(0, 2) : '';

    return (
      <TouchableOpacity
        key={item.key || item.id}
        style={[styles.tile, !item.id && styles.tileDisabled]}
        onPress={handlePress}
        accessibilityRole={item.id ? 'button' : 'text'}
        accessibilityLabel={item.accessibilityLabel}
        disabled={!item.id || !onNavigate}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <View style={styles.avatarWrapper}>
          {item.photoUrl ? (
            <ProgressiveThumbnail
              source={{ uri: item.photoUrl }}
              size={40}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial} numberOfLines={1} adjustsFontSizeToFit>
                {initials}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.tileName} numberOfLines={2}>
          {item.name}
        </Text>
        {item.label && (
          <Text style={styles.tileLabel} numberOfLines={1}>
            {item.label}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <InfoCard title="العائلة">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.familyRow}
      >
        {allMembers.map((item, index) => {
          if (item.type === 'divider') {
            return <View key="divider" style={styles.divider} />;
          }
          return renderTile(item, index);
        })}
      </ScrollView>
    </InfoCard>
  );
},
(prevProps, nextProps) => {
  // Only re-render if family members changed
  return (
    prevProps.father?.id === nextProps.father?.id &&
    prevProps.mother?.id === nextProps.mother?.id &&
    prevProps.children?.length === nextProps.children?.length &&
    prevProps.children?.every((child, index) => child.id === nextProps.children?.[index]?.id) &&
    prevProps.marriages?.length === nextProps.marriages?.length &&
    prevProps.person?.hid === nextProps.person?.hid &&
    prevProps.showMarriages === nextProps.showMarriages
  );
}
);

FamilyCard.displayName = 'FamilyCard';

const styles = StyleSheet.create({
  familyRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 12,
  },
  divider: {
    width: 1,
    height: 60,
    backgroundColor: '#D1BBA3',
    opacity: 0.5,
    marginHorizontal: 16,
    alignSelf: 'center',
  },
  tile: {
    width: 88,
    borderRadius: 16,
    backgroundColor: '#f7f1f4',
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  tileDisabled: {
    opacity: 0.6,
  },
  avatarWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D1BBA320',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6b3f4e',
  },
  tileName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#242121',
    textAlign: 'center',
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: '#736372',
    textAlign: 'center',
    marginTop: 2,
  },
});

export default FamilyCard;
