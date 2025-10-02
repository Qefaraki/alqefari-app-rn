import React from 'react';
import { View, Text } from 'react-native';
import InfoCard from '../components/InfoCard';

const PersonalCard = ({ person }) => {
  if (!person) return null;

  const rows = [
    person.kunya ? { label: 'الكنية', value: person.kunya } : null,
    person.nickname ? { label: 'اللقب', value: person.nickname } : null,
  ].filter(Boolean);

  if (rows.length === 0) return null;

  return (
    <InfoCard title="المعلومات الشخصية">
      <View style={styles.grid}>
        {rows.map((row) => (
          <View key={row.label} style={styles.gridItem}>
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.value}>{row.value}</Text>
          </View>
        ))}
      </View>
    </InfoCard>
  );
};

const styles = {
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'flex-start',
  },
  gridItem: {
    backgroundColor: '#f7f1f4',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexShrink: 1,
  },
  label: {
    fontSize: 12,
    color: '#7a6571',
    marginBottom: 6,
  },
  value: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2f1823',
  },
};

export default PersonalCard;
