import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons, FontAwesome6 } from "@expo/vector-icons";

const socialPlatforms = [
  {
    key: "twitter",
    label: "X (Twitter سابقاً)",
    icon: "x-twitter",
    iconFamily: "FontAwesome6",
    placeholder: "https://x.com/username",
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: "logo-instagram",
    iconFamily: "Ionicons",
    placeholder: "https://instagram.com/username",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: "logo-linkedin",
    iconFamily: "Ionicons",
    placeholder: "https://linkedin.com/in/username",
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: "logo-youtube",
    iconFamily: "Ionicons",
    placeholder: "https://youtube.com/@username",
  },
  {
    key: "website",
    label: "موقع إلكتروني",
    icon: "globe-outline",
    iconFamily: "Ionicons",
    placeholder: "https://example.com",
  },
];

const SocialMediaEditor = ({ links = {}, values = {}, onChange }) => {
  // Support both 'links' and 'values' prop names for backward compatibility
  const socialLinks = links || values || {};
  // Helper to convert username to full URL if needed
  const formatSocialLink = (platform, value) => {
    if (!value || !value.trim()) return '';

    const trimmed = value.trim();

    // If already a full URL, return as-is
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    // Convert username/handle to full URL based on platform
    switch (platform) {
      case 'twitter':
        // Remove @ if present and create full URL (using x.com now)
        const twitterHandle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
        return `https://x.com/${twitterHandle}`;

      case 'instagram':
        // Remove @ if present and create full URL
        const instaHandle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
        return `https://instagram.com/${instaHandle}`;

      case 'linkedin':
        // If just username, create full URL
        return trimmed.includes('linkedin.com') ? trimmed : `https://linkedin.com/in/${trimmed}`;

      case 'youtube':
        // Handle @ usernames
        const ytHandle = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
        return trimmed.includes('youtube.com') ? trimmed : `https://youtube.com/${ytHandle}`;

      case 'website':
        // Add https:// if no protocol
        return trimmed.includes('://') ? trimmed : `https://${trimmed}`;

      default:
        return trimmed;
    }
  };

  const handleLinkChange = (platform, value) => {
    const newLinks = { ...socialLinks };
    if (value) {
      // Store raw value as user types (don't trim while typing!)
      newLinks[platform] = value;
    } else {
      delete newLinks[platform];
    }
    onChange(newLinks);
  };

  const handleBlur = (platform, value) => {
    // Format only when user finishes typing
    const newLinks = { ...socialLinks };
    if (value.trim()) {
      const formattedLink = formatSocialLink(platform, value);
      if (formattedLink) {
        newLinks[platform] = formattedLink;
      }
    }
    onChange(newLinks);
  };

  return (
    <View style={styles.container}>
      {socialPlatforms.map((platform) => {
        const IconComponent = platform.iconFamily === "FontAwesome6" ? FontAwesome6 : Ionicons;

        return (
          <View key={platform.key} style={styles.platformRow}>
            <View style={styles.platformHeader}>
              <IconComponent name={platform.icon} size={20} color="#666" />
              <Text style={styles.platformLabel}>{platform.label}</Text>
            </View>
            <TextInput
              style={styles.platformInput}
              value={socialLinks?.[platform.key] || ''}
              onChangeText={(value) => handleLinkChange(platform.key, value)}
              onBlur={(e) => handleBlur(platform.key, e.nativeEvent.text)}
              placeholder={platform.placeholder}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  platformRow: {
    gap: 8,
  },
  platformHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  platformLabel: {
    fontSize: 14,
    color: "#666666",
    fontFamily: "SF Arabic",
  },
  platformInput: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#000000",
    fontFamily: "SF Arabic",
  },
});

export default SocialMediaEditor;
