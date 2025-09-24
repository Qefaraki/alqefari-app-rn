import React, { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../contexts/SettingsContext';
import { useRelativeDate, useAbsoluteDate } from '../hooks/useFormattedDate';

export default function TestDateUpdate() {
  const { settings, updateSetting } = useSettings();
  const [testDate] = useState(new Date());

  // Direct hook usage
  const relativeDate = useRelativeDate(testDate);
  const absoluteDate = useAbsoluteDate(testDate);

  // Force re-render counter
  const [renderCount, setRenderCount] = useState(0);

  console.log('TestDateUpdate render:', {
    renderCount,
    settings: {
      defaultCalendar: settings.defaultCalendar,
      arabicNumerals: settings.arabicNumerals,
      dateFormat: settings.dateFormat
    },
    relativeDate,
    absoluteDate
  });

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Date Update Test</Text>

      <View style={styles.section}>
        <Text>Render Count: {renderCount}</Text>
        <Text>Calendar: {settings.defaultCalendar}</Text>
        <Text>Arabic Numerals: {settings.arabicNumerals ? 'ON' : 'OFF'}</Text>
        <Text>Format: {settings.dateFormat}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Relative Date:</Text>
        <Text style={styles.date}>{relativeDate}</Text>

        <Text style={styles.label}>Absolute Date:</Text>
        <Text style={styles.date}>{absoluteDate}</Text>
      </View>

      <View style={styles.buttons}>
        <Button
          title="Toggle Calendar"
          onPress={() => {
            const newCal = settings.defaultCalendar === 'hijri' ? 'gregorian' : 'hijri';
            updateSetting('defaultCalendar', newCal);
          }}
        />

        <Button
          title="Toggle Arabic Numerals"
          onPress={() => {
            updateSetting('arabicNumerals', !settings.arabicNumerals);
          }}
        />

        <Button
          title="Toggle Format"
          onPress={() => {
            const newFormat = settings.dateFormat === 'numeric' ? 'words' : 'numeric';
            updateSetting('dateFormat', newFormat);
          }}
        />

        <Button
          title="Force Re-render"
          onPress={() => setRenderCount(c => c + 1)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  label: {
    fontWeight: 'bold',
    marginTop: 10,
  },
  date: {
    fontSize: 18,
    marginBottom: 10,
  },
  buttons: {
    gap: 10,
  },
});