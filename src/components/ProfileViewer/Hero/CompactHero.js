import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  I18nManager,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Galeria } from '@nandorojo/galeria';
import tokens from '../../ui/tokens';
import { formatNameWithTitle } from '../../../services/professionalTitleService';
import { useTreeStore } from '../../../stores/useTreeStore';
import { toArabicNumerals } from '../../../utils/dateUtils';

const { colors, spacing } = tokens;

const AVATAR_SIZE = 68;

const constructCommonName = (person, nodesMap) => {
  if (!person) return '';

  const ancestors = [];
  let currentId = person.father_id;

  while (currentId) {
    const ancestor = nodesMap.get(currentId);
    if (!ancestor) break;
    ancestors.push(ancestor.name);
    currentId = ancestor.father_id;
  }

  if (ancestors.length === 0) {
    return '';
  }

  const firstConnector = person.gender === 'female' ? 'بنت' : 'بن';
  const [firstAncestor, ...rest] = ancestors;

  let chain = `${firstConnector} ${firstAncestor}`;
  rest.forEach((ancestor) => {
    chain += ` ${ancestor}`;
  });

  return chain;
};

const getInitial = (value) => (value ? value.trim().charAt(0) : '?');

const CompactHero = ({
  person,
  metrics,
  onCopyChain,
  canEdit,
  onEdit,
  onMenuPress,
}) => {
  if (!person) {
    return null;
  }

  const nodesMap = useTreeStore((s) => s.nodesMap);
  const isRTL = I18nManager.isRTL;

  const lineage = useMemo(() => {
    if (!person) return '';
    if (person.common_name) return `${person.common_name} القفاري`;
    const chain = constructCommonName(person, nodesMap);
    return chain ? `${chain} القفاري` : '';
  }, [nodesMap, person]);

  const generationLabel = metrics?.generationLabel;
  const siblingsCount = metrics?.siblingsCount ?? person?.siblings_count ?? 0;
  const birthPlace = person?.birth_place;
  const birthYear = person?.dob_data?.year;
  const dobIsPublic = person?.dob_is_public !== false;
  const isDobApproximate = Boolean(person?.dob_data?.approximate);

  const metadataSegments = [];
  if (generationLabel) {
    metadataSegments.push(`الجيل ${generationLabel}`);
  }
  if (siblingsCount > 0) {
    const formatted = toArabicNumerals(String(siblingsCount));
    metadataSegments.push(`${formatted} إخوة`);
  }
  const metadata = metadataSegments.join(' • ');

  let birthYearDisplay = null;
  if (person?.dob_data) {
    if (!dobIsPublic) {
      birthYearDisplay = 'مخفي';
    } else if (birthYear) {
      const value = toArabicNumerals(String(birthYear));
      birthYearDisplay = isDobApproximate ? `حوالي ${value}` : value;
    }
  }

  const hasPersonalInfo = Boolean(birthPlace) || Boolean(birthYearDisplay);

  const renderAvatar = () => {
    if (!person?.photo_url) {
      return (
        <View style={styles.avatarFallback} accessibilityElementsHidden>
          <Text style={styles.avatarInitial} numberOfLines={1}>
            {getInitial(person?.name)}
          </Text>
        </View>
      );
    }

    return (
      <Galeria urls={[person.photo_url]}>
        <Galeria.Image index={0}>
          <Image
            source={{ uri: person.photo_url }}
            style={styles.avatarImage}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        </Galeria.Image>
      </Galeria>
    );
  };

  return (
    <View style={styles.container}>
      {/* Action Buttons - Top Right */}
      <View style={styles.actionButtons}>
        {canEdit && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel="تحرير الملف"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={onMenuPress}
          accessibilityRole="button"
          accessibilityLabel="المزيد من الخيارات"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.najdi.text} />
        </TouchableOpacity>
      </View>

      {/* Avatar - Centered */}
      <TouchableOpacity
        style={styles.avatarWrapper}
        accessibilityRole="imagebutton"
        accessibilityLabel={person?.photo_url ? 'عرض الصورة الشخصية' : 'الصورة الشخصية غير متوفرة'}
        disabled={!person?.photo_url}
        activeOpacity={0.8}
      >
        {renderAvatar()}
      </TouchableOpacity>

      {/* Text Block - Centered */}
      <View style={styles.textBlock}>
        <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
          {formatNameWithTitle(person)}
        </Text>
        {lineage ? (
          <TouchableOpacity
            onPress={() => onCopyChain?.(lineage)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="نسخ سلسلة النسب"
          >
            <Text style={styles.lineage} numberOfLines={2}>
              {lineage}
            </Text>
          </TouchableOpacity>
        ) : null}

        {metadata ? (
          <Text style={styles.metadata} numberOfLines={1}>
            {metadata}
          </Text>
        ) : null}

        {hasPersonalInfo ? (
          <View style={styles.personalRow}>
            {birthPlace ? (
              <View style={styles.personalItem}>
                <Ionicons name="location-outline" size={16} color="#D58C4A" />
                <Text style={styles.personalText} numberOfLines={1}>
                  {birthPlace}
                </Text>
              </View>
            ) : null}
            {birthYearDisplay ? (
              <View style={styles.personalItem}>
                <Ionicons name="calendar-outline" size={16} color="#D58C4A" />
                <Text style={styles.personalText} numberOfLines={1}>
                  {birthYearDisplay}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.najdi.background,
    borderRadius: tokens.radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: 104,
    position: 'relative',
    overflow: 'visible',
  },
  avatarWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.najdi.container,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: colors.najdi.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.najdi.container,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.najdi.text,
  },
  textBlock: {
    alignItems: 'center',
    width: '100%',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.najdi.text,
    textAlign: 'center',
  },
  lineage: {
    fontSize: 15,
    color: `${colors.najdi.text}B3`,
    marginTop: 4,
    textAlign: 'center',
  },
  metadata: {
    fontSize: 13,
    fontWeight: '600',
    color: `${colors.najdi.text}D9`,
    marginTop: 8,
    textAlign: 'center',
  },
  personalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
    justifyContent: 'center',
  },
  personalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  personalText: {
    fontSize: 13,
    color: '#D58C4A',
    maxWidth: 180,
    textAlign: 'center',
  },
  actionButtons: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    gap: spacing.sm,
    zIndex: 10,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#A13333',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D1BBA3',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
});

export default React.memo(CompactHero);
