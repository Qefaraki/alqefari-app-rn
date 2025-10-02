import React from 'react';
import { View, Text, Linking } from 'react-native';
import InfoCard from '../components/InfoCard';
import FieldRow from '../components/FieldRow';

const formatPlatform = (platform) => {
  switch (platform) {
    case 'twitter':
      return 'تويتر';
    case 'instagram':
      return 'انستجرام';
    case 'linkedin':
      return 'لينكد إن';
    case 'facebook':
      return 'فيسبوك';
    case 'snapchat':
      return 'سناب شات';
    default:
      return platform;
  }
};

const ContactCard = ({ person }) => {
  const socials = person?.social_media_links;
  const hasSocials = socials && Object.keys(socials).length > 0;

  if (!person?.phone && !person?.email && !hasSocials) {
    return null;
  }

  return (
    <InfoCard title="التواصل">
      {person?.phone ? (
        <FieldRow
          label="📱 الهاتف"
          value={person.phone}
          copyable
        />
      ) : null}
      {person?.email ? (
        <FieldRow label="📧 البريد" value={person.email} copyable />
      ) : null}
      {hasSocials ? (
        <View>
          <Text style={styles.label}>روابط التواصل</Text>
          {Object.entries(socials).map(([platform, url]) => (
            <Text
              key={platform}
              style={styles.link}
              onPress={() => Linking.openURL(url)}
            >
              {formatPlatform(platform)}
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
  link: {
    fontSize: 14,
    color: '#6b3f4e',
    marginBottom: 6,
  },
};

export default ContactCard;
