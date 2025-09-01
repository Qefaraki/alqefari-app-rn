import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const socialPlatforms = [
  { key: 'twitter', label: 'Twitter/X', icon: 'logo-twitter', placeholder: 'https://twitter.com/username' },
  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram', placeholder: 'https://instagram.com/username' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin', placeholder: 'https://linkedin.com/in/username' },
  { key: 'facebook', label: 'Facebook', icon: 'logo-facebook', placeholder: 'https://facebook.com/username' },
  { key: 'youtube', label: 'YouTube', icon: 'logo-youtube', placeholder: 'https://youtube.com/@username' },
  { key: 'website', label: 'Website', icon: 'globe-outline', placeholder: 'https://example.com' },
];

const SocialMediaEditor = ({ links, onChange }) => {
  const handleLinkChange = (platform, value) => {
    const newLinks = { ...links };
    if (value.trim()) {
      newLinks[platform] = value.trim();
    } else {
      delete newLinks[platform];
    }
    onChange(newLinks);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>روابط التواصل الاجتماعي</Text>
      {socialPlatforms.map((platform) => (
        <View key={platform.key} style={styles.platformRow}>
          <View style={styles.platformHeader}>
            <Ionicons name={platform.icon} size={20} color="#666" />
            <Text style={styles.platformLabel}>{platform.label}</Text>
          </View>
          <TextInput
            style={styles.platformInput}
            value={links[platform.key] || ''}
            onChangeText={(value) => handleLinkChange(platform.key, value)}
            placeholder={platform.placeholder}
            textAlign="left"
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'right',
  },
  platformRow: {
    gap: 8,
  },
  platformHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  platformLabel: {
    fontSize: 14,
    color: '#666666',
  },
  platformInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000000',
  },
});

export default SocialMediaEditor;