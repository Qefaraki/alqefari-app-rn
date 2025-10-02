import React from 'react';
import { View, Text, TextInput } from 'react-native';
import SocialMediaEditor from '../../admin/SocialMediaEditor';

const Section = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.title}>{title}</Text>
    {children}
  </View>
);

const TabContact = ({ form, updateField }) => {
  const { draft } = form;

  return (
    <View style={{ gap: 24 }}>
      <Section title="رقم الهاتف">
        <TextInput
          style={styles.input}
          value={draft?.phone || ''}
          onChangeText={(text) => updateField('phone', text)}
          placeholder="أدخل رقم الهاتف"
          keyboardType="phone-pad"
        />
      </Section>

      <Section title="البريد الإلكتروني">
        <TextInput
          style={styles.input}
          value={draft?.email || ''}
          onChangeText={(text) => updateField('email', text)}
          placeholder="example@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </Section>

      <Section title="وسائل التواصل">
        <SocialMediaEditor
          values={draft?.social_media_links || {}}
          onChange={(links) => updateField('social_media_links', links)}
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

export default TabContact;
