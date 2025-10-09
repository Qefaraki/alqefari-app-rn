import React from 'react';
import { View, Text } from 'react-native';
import InfoCard from '../components/InfoCard';
import { useSettings } from '../../../../contexts/SettingsContext';
import { formatYearBySettings } from '../../../../utils/dateUtils';

const TimelineCard = React.memo(({ timeline }) => {
  const { settings } = useSettings();

  if (!Array.isArray(timeline) || timeline.length === 0) {
    return null;
  }

  return (
    <InfoCard title="الخط الزمني">
      <View style={{ gap: 12 }}>
        {timeline.map((event, index) => {
          const formattedYear = formatYearBySettings(event.year, settings);
          return (
            <View key={`${event.year}-${index}`} style={styles.eventRow}>
              <Text style={styles.year}>{formattedYear}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{event.event}</Text>
                {event.description ? (
                  <Text style={styles.description}>{event.description}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </InfoCard>
  );
});

TimelineCard.displayName = 'TimelineCard';

const styles = {
  eventRow: {
    flexDirection: 'row',
    gap: 16,
  },
  year: {
    fontSize: 15,
    fontWeight: '700',
    color: '#b45b6b',
    width: 56,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#35252c',
  },
  description: {
    fontSize: 13,
    color: '#6d5561',
    marginTop: 4,
  },
};

export default TimelineCard;
