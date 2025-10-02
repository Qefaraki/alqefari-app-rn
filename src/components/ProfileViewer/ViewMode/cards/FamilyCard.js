import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import InfoCard from '../components/InfoCard';
import FieldRow from '../components/FieldRow';

const FamilyCard = ({ father, mother, marriages = [], children = [], person, onNavigate, showMarriages }) => {
  const hasMarriages = showMarriages ? marriages.length > 0 : false;
  if (!father && !mother && !hasMarriages && children.length === 0 && !person?.family_origin) {
    return null;
  }

  return (
    <InfoCard title="العائلة">
      {father ? (
        <TouchableOpacity onPress={() => onNavigate?.(father.id)} style={styles.row}>
          <FieldRow label="👨 الوالد" value={father.name} icon="chevron-back" />
        </TouchableOpacity>
      ) : null}
      {mother ? (
        <TouchableOpacity onPress={() => onNavigate?.(mother.id)} style={styles.row}>
          <FieldRow label="👩 الوالدة" value={mother.name} icon="chevron-back" />
        </TouchableOpacity>
      ) : null}

      {showMarriages && marriages.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>الزوجات ({marriages.length})</Text>
          {marriages.map((marriage) => {
            const spouseName = marriage.spouse_name || marriage.spouse?.name;
            return (
              <TouchableOpacity
                key={marriage.id || marriage.marriage_id}
                onPress={() => onNavigate?.(marriage.spouse_id)}
                style={styles.row}
              >
                <View style={styles.inlineRow}>
                  <Ionicons name="heart" size={16} color="#c26a7a" />
                  <Text style={styles.value}>{spouseName}</Text>
                </View>
                <Ionicons name="chevron-back" size={18} color="#8a7480" />
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {children.length > 0 ? (
        <View>
          <Text style={styles.label}>الأبناء ({children.length})</Text>
          <View style={{ gap: 8 }}>
            {children.map((child) => (
              <TouchableOpacity
                key={child.id}
                onPress={() => onNavigate?.(child.id)}
                style={styles.row}
              >
                <Text style={styles.value}>{child.name}</Text>
                <Ionicons name="chevron-back" size={18} color="#8a7480" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {person?.family_origin && !person?.hid ? (
        <FieldRow label="الأصل العائلي" value={person.family_origin} />
      ) : null}
    </InfoCard>
  );
};

const styles = {
  label: {
    fontSize: 13,
    color: '#7a6571',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  value: {
    fontSize: 15,
    color: '#332129',
    fontWeight: '600',
  },
};

export default FamilyCard;
