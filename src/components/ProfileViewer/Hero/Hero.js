import React, { useMemo } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ProgressiveHeroImage } from '../../ProgressiveImage';
import HeroActions from './HeroActions';
import MetricsRow from './MetricsRow';
import { Ionicons } from '@expo/vector-icons';
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
}) => {
  const bioText = person.bio || person.biography || '';
  const hasBio = Boolean(bioText);
  const nodesMap = useTreeStore((s) => s.nodesMap);

  const lineage = useMemo(() => {
    if (!person) return '';
    if (person.common_name) return person.common_name;
    return constructCommonName(person, nodesMap);
  }, [nodesMap, person]);

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
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="إغلاق الملف"
          >
            <Ionicons name="close" size={20} color="#2a1620" />
          </TouchableOpacity>
          <HeroActions onMenuPress={onMenu} />
        </View>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{person?.name}</Text>
          {person?.status === 'deceased' ? (
            <Text style={styles.deceasedTag}>الله يرحمه</Text>
          ) : null}
        </View>
        {lineage ? (
          <Pressable
            onPress={() => onCopyChain?.(lineage)}
            accessibilityLabel="نسخ سلسلة النسب"
          >
            <Text style={styles.chain}>{lineage}</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: 32,
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
    paddingVertical: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2a1620',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    flexWrap: 'wrap',
  },
  deceasedTag: {
    fontSize: 14,
    color: '#874b5a',
    fontWeight: '600',
  },
  chain: {
    marginTop: 6,
    fontSize: 15,
    color: '#5f4652',
  },
  bio: {
    fontSize: 14,
    color: '#4c3841',
    lineHeight: 20,
  },
  expand: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#8c4d5d',
  },
});

export default Hero;
