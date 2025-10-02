import React from 'react';
import { View, Text } from 'react-native';

const InfoCard = ({ title, children, hint, collapsible = false, expanded = true, onToggle }) => {
  if (collapsible && !expanded) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
        <Text style={styles.collapsedText} onPress={onToggle}>
          عرض التفاصيل
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
};

const styles = {
  container: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2a1521',
  },
  hint: {
    fontSize: 12,
    color: '#7a6770',
  },
  body: {
    gap: 12,
  },
  collapsedText: {
    fontSize: 14,
    color: '#7a3f50',
    fontWeight: '600',
  },
};

export default InfoCard;
