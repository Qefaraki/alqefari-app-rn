import React from 'react';
import { View, Text } from 'react-native';
import InfoCard from '../components/InfoCard';
import FieldRow from '../components/FieldRow';

const ProfessionalCard = ({ person }) => {
  const hasAchievements = Array.isArray(person?.achievements) && person.achievements.length > 0;
  if (!person?.occupation && !person?.education && !hasAchievements) {
    return null;
  }

  return (
    <InfoCard title="المعلومات المهنية">
      {person?.occupation ? (
        <FieldRow label="المهنة" value={person.occupation} />
      ) : null}
      {person?.education ? (
        <FieldRow label="التعليم" value={person.education} />
      ) : null}
      {hasAchievements ? (
        <View>
          <Text style={styles.label}>الإنجازات</Text>
          {person.achievements.map((achievement, index) => (
            <Text key={index} style={styles.bullet}>
              • {achievement}
            </Text>
          ))}
        </View>
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
  bullet: {
    fontSize: 14,
    color: '#312028',
    lineHeight: 20,
  },
};

export default ProfessionalCard;
