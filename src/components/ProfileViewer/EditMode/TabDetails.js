import React from 'react';
import { View, Text, TextInput } from 'react-native';
import BioEditor from '../../admin/fields/BioEditor';
import AchievementsEditor from '../../admin/AchievementsEditor';
import TimelineEditor from '../../admin/TimelineEditor';

const Section = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.title}>{title}</Text>
    {children}
  </View>
);

const TabDetails = ({ form, updateField }) => {
  const { draft } = form;

  return (
    <View style={{ gap: 24 }}>
      <Section title="السيرة">
        <BioEditor
          value={draft?.bio || draft?.biography || ''}
          onChange={(text) => updateField('bio', text)}
          maxLength={500}
        />
      </Section>

      <Section title="المهنة">
        <TextInput
          style={styles.input}
          value={draft?.occupation || ''}
          onChangeText={(text) => updateField('occupation', text)}
          placeholder="أدخل المهنة"
        />
      </Section>

      <Section title="التعليم">
        <TextInput
          style={styles.input}
          value={draft?.education || ''}
          onChangeText={(text) => updateField('education', text)}
          placeholder="أدخل التعليم"
        />
      </Section>

      <Section title="الإنجازات">
        <AchievementsEditor
          achievements={draft?.achievements || []}
          onChange={(items) => updateField('achievements', items)}
        />
      </Section>

      <Section title="الخط الزمني">
        <TimelineEditor
          timeline={draft?.timeline || []}
          onChange={(items) => updateField('timeline', items)}
        />
      </Section>
    </View>
  );
};

const styles = {
  section: {
    gap: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4d3440',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#321f27',
    borderWidth: 1,
    borderColor: '#e8d9df',
  },
};

export default TabDetails;
