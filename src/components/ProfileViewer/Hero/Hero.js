import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, I18nManager, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Galeria } from '@nandorojo/galeria';
import HeroActions from './HeroActions';
import MetricsRow from './MetricsRow';
import { useTreeStore } from '../../../stores/useTreeStore';
import { formatNameWithTitle } from '../../../services/professionalTitleService';

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

  // Only add connector after first ancestor, then just space-separate the rest
  let chain = `${firstConnector} ${firstAncestor}`;
  rest.forEach((ancestor) => {
    chain += ` ${ancestor}`;
  });

  return chain;
};

const Hero = React.memo(({
  person,
  onMenu,
  onCopyChain,
  bioExpanded,
  onToggleBio,
  metrics,
  onClose,
  topInset = 0,
}) => {
  const bioText = person.bio || person.biography || '';
  const hasBio = Boolean(bioText);
  const nodesMap = useTreeStore((s) => s.nodesMap);

  const lineage = useMemo(() => {
    if (!person) return '';
    if (person.common_name) return `${person.common_name} القفاري`;
    const chain = constructCommonName(person, nodesMap);
    return chain ? `${chain} القفاري` : '';
  }, [nodesMap, person]);

  // Prefer cropped variant if available (Option A fix)
  const photoUrl = person?.photo_url_cropped || person?.photo_url;

  const isRTL = I18nManager.isRTL;

  return (
    <View style={styles.container}>
      {photoUrl ? (
        <View style={styles.photoWrapper}>
          <Galeria urls={[photoUrl]}>
            <Galeria.Image index={0}>
              <Image
                source={{ uri: photoUrl }}
                style={styles.heroImage}
                resizeMode="cover"
              />
            </Galeria.Image>
          </Galeria>
          <LinearGradient
            colors={[
              'rgba(0,0,0,0.45)',
              'rgba(0,0,0,0.15)',
              'rgba(0,0,0,0)',
            ]}
            style={styles.gradient}
            pointerEvents="none"
          />
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <View style={styles.nameAndStatus}>
            <View style={styles.nameWithKunyaRow}>
              <Text style={styles.name} numberOfLines={2} adjustsFontSizeToFit>
                {formatNameWithTitle(person)}
              </Text>
              {person.kunya && (
                <>
                  <Text style={styles.kunyaBullet}>•</Text>
                  <Text style={styles.kunyaText}>{person.kunya}</Text>
                </>
              )}
            </View>
            {person?.status === 'deceased' ? (
              <Text style={styles.deceasedTag} adjustsFontSizeToFit numberOfLines={1}>
                الله يرحمه
              </Text>
            ) : null}
          </View>
          {!photoUrl ? (
            <HeroActions
              onMenuPress={onMenu}
              onClose={onClose}
              style={styles.actionsInline}
            />
          ) : null}
        </View>
        {lineage ? (
          <Pressable
            onPress={() => onCopyChain?.(lineage)}
            accessibilityLabel="نسخ سلسلة النسب"
          >
            <Text style={styles.chain} numberOfLines={2}>
              {lineage}
            </Text>
          </Pressable>
        ) : null}

        {hasBio ? (
          <View style={{ marginTop: 12 }}>
            <Text
              style={styles.bio}
              numberOfLines={bioExpanded ? undefined : 3}
            >
              {bioText}
            </Text>
            {bioText.length > 120 ? (
              <Pressable onPress={onToggleBio} accessibilityLabel="عرض المزيد من السيرة">
                <Text style={styles.expand}>{bioExpanded ? 'عرض أقل' : 'عرض المزيد'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <MetricsRow metrics={metrics} />
      </View>

      {photoUrl ? (
        <View
          pointerEvents="box-none"
          style={[styles.overlayControls, { top: 16 }]}
        >
          <HeroActions
            onMenuPress={onMenu}
            onClose={onClose}
            style={isRTL ? styles.actionsRtl : styles.actionsLtr}
          />
        </View>
      ) : null}
    </View>
  );
});

Hero.displayName = 'Hero';

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: '#f9f5f0',
  },
  photoWrapper: {
    height: 220,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  body: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#242121',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    flexWrap: 'wrap',
  },
  nameAndStatus: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    flexWrap: 'wrap',
    flex: 1,
  },
  nameWithKunyaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
  },
  kunyaBullet: {
    fontSize: 17,
    color: '#736372',
    marginHorizontal: 4,
  },
  kunyaText: {
    fontSize: 17,
    fontWeight: '400',
    color: '#736372',
    fontStyle: 'italic',
  },
  actionsInline: {
    // Aligned with name row baseline
  },
  deceasedTag: {
    fontSize: 13,
    color: '#A13333',
    fontWeight: '600',
  },
  chain: {
    marginTop: 8,
    fontSize: 15,
    color: '#736372',
  },
  bio: {
    fontSize: 15,
    color: '#242121',
    lineHeight: 20,
  },
  expand: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#A13333',
  },
  overlayControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 3,
  },
  actionsLtr: {
    alignSelf: 'flex-start', // Left side in LTR
  },
  actionsRtl: {
    alignSelf: 'flex-end', // Left side in RTL (flex-end = left in RTL)
  },
});

export default Hero;
