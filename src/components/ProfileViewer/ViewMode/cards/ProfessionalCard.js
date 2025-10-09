import React from 'react';
import { View, Text } from 'react-native';
import InfoCard from '../components/InfoCard';
import FieldRow from '../components/FieldRow';

const ProfessionalCard = React.memo(({ person }) => {
  const hasAchievements = Array.isArray(person?.achievements) && person.achievements.length > 0;
  if (!person?.education && !hasAchievements) {
    return null;
  }

  return (
    <InfoCard title="السيرة المهنية">
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
});

ProfessionalCard.displayName = 'ProfessionalCard';

const styles = {
  label: {
    fontSize: 13,
    color: '#736372',
    marginBottom: 8,
  },
  bullet: {
    fontSize: 15,
    color: '#242121',
    lineHeight: 20,
  },
};

export default ProfessionalCard;
