import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

const AchievementsList = ({ items = [], initialCount = 3, collapsible = true }) => {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = !collapsible ? items : expanded ? items : items.slice(0, initialCount);

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(v => !v);
  };

  if (!items || items.length === 0) return null;

  return (
    <View>
      <View style={{ gap: 8 }}>
        {visibleItems.map((a, i) => (
          <View key={i} style={styles.row}>
            <View style={styles.dot} />
            <Text style={styles.text}>{a}</Text>
          </View>
        ))}
      </View>
      {collapsible && items.length > initialCount && (
        <Pressable onPress={toggle} style={styles.moreBtn} accessibilityLabel={expanded ? 'عرض أقل' : 'إظهار المزيد'}>
          <Text style={styles.moreText}>{expanded ? 'عرض أقل' : 'إظهار المزيد'}</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginTop: 2,
  },
  text: {
    fontSize: 15,
    color: '#1f2937',
    fontFamily: 'SF Arabic',
    textAlign: 'right',
    flexShrink: 1,
  },
  moreBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  moreText: {
    fontSize: 14,
    color: '#2563eb',
    fontFamily: 'SF Arabic',
  },
});

export default AchievementsList;


