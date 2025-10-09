import React from 'react';
import { View, Text, Linking, TouchableOpacity } from 'react-native';
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

const ContactCard = React.memo(({ person }) => {
  const socials = person?.social_media_links;
  const hasSocials = socials && Object.keys(socials).length > 0;

  if (!person?.phone && !person?.email && !hasSocials) {
    return null;
  }

  const openUrl = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <InfoCard title="التواصل">
      {person?.phone ? (
        <FieldRow
          label="الهاتف"
          value={person.phone}
          copyable
        />
      ) : null}
      {person?.email ? (
        <FieldRow label="البريد" value={person.email} copyable />
      ) : null}
      {hasSocials ? (
        <View>
          <Text style={styles.label}>روابط التواصل</Text>
          {Object.entries(socials).map(([platform, url]) => (
            <TouchableOpacity
              key={platform}
              onPress={() => openUrl(url)}
              accessibilityRole="link"
              accessibilityLabel={`فتح ${formatPlatform(platform)}`}
              style={styles.linkButton}
            >
              <Text style={styles.link}>{formatPlatform(platform)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </InfoCard>
  );
});

ContactCard.displayName = 'ContactCard';

const styles = {
  label: {
    fontSize: 13,
    color: '#736372',
    marginBottom: 8,
  },
  linkButton: {
    paddingVertical: 8,
  },
  link: {
    fontSize: 15,
    color: '#A13333',
    fontWeight: '600',
  },
};

export default ContactCard;
