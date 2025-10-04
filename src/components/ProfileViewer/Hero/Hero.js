import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, I18nManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ProgressiveHeroImage } from '../../ProgressiveImage';
import HeroActions from './HeroActions';
import MetricsRow from './MetricsRow';
import { useTreeStore } from '../../../stores/useTreeStore';

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

const Hero = ({
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
    if (person.common_name) return person.common_name;
    return constructCommonName(person, nodesMap);
  }, [nodesMap, person]);

  const isRTL = I18nManager.isRTL;

  return (
    <View style={styles.container}>
      {person?.photo_url ? (
        <View style={styles.photoWrapper}>
          <ProgressiveHeroImage
            source={{ uri: person.photo_url }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={[
              'rgba(0,0,0,0.45)',
              'rgba(0,0,0,0.15)',
              'rgba(0,0,0,0)',
            ]}
            style={styles.gradient}
          />
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={2} adjustsFontSizeToFit>{person?.name}</Text>
          {person?.status === 'deceased' ? (
            <Text style={styles.deceasedTag} adjustsFontSizeToFit numberOfLines={1}>
              الله يرحمه
            </Text>
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

      <View
        pointerEvents="box-none"
        style={[
          styles.overlayControls,
          { top: person?.photo_url ? 16 : 80 }, // Push down if no photo to avoid name overlap
        ]}
      >
        <HeroActions
          onMenuPress={onMenu}
          onClose={onClose}
          style={isRTL ? styles.actionsRtl : styles.actionsLtr}
        />
      </View>
    </View>
  );
};

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
