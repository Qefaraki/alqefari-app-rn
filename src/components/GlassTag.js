import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import GlassSurface from './glass/GlassSurface';

const GlassTag = ({ children, icon, style, textStyle, radius = 12 }) => {
  return (
    <GlassSurface radius={radius} style={[styles.wrapper, style]} contentStyle={styles.content}>
      <View style={styles.row}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <Text numberOfLines={1} style={[styles.text, textStyle]}>{children}</Text>
      </View>
    </GlassSurface>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  content: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    marginTop: 1,
  },
  text: {
    fontSize: 13,
    color: '#111827',
    fontFamily: 'SF Arabic',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default GlassTag;


