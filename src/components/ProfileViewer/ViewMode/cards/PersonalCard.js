import React from 'react';
import { View, Text } from 'react-native';
import InfoCard from '../components/InfoCard';
import { getTitleLabel } from '../../../../services/professionalTitleService';

const PersonalCard = ({ person }) => {
  if (!person) return null;

  const rows = [
    person.birth_place ? { label: 'مكان الميلاد', value: person.birth_place } : null,
    person.family_origin ? { label: 'الأصل العائلي', value: person.family_origin } : null,
  ].filter(Boolean);

  if (rows.length === 0) return null;

  return (
    <InfoCard title="المعلومات الشخصية">
      <View style={styles.grid}>
        {rows.map((row) => (
          <View key={row.label} style={styles.gridItem}>
            <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>
              {row.label}
            </Text>
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
    backgroundColor: '#D1BBA320',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexShrink: 1,
  },
  label: {
    fontSize: 12,
    color: '#736372',
    marginBottom: 8,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#242121',
  },
};

export default PersonalCard;
