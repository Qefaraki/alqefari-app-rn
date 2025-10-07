import React, { useState, useEffect } from "react";
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
    placeholder: "https://x.com/username or @username",
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: "logo-instagram",
    iconFamily: "Ionicons",
    placeholder: "https://instagram.com/username or @username",
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

  // Local state to manage input values while typing
  const [localValues, setLocalValues] = useState({});

  // Initialize local state from props
  useEffect(() => {
    setLocalValues({ ...socialLinks });
  }, [JSON.stringify(socialLinks)]);
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
    // Update local state only while typing
    setLocalValues(prev => ({
      ...prev,
      [platform]: value
    }));
  };

  const isValidUrl = (url) => {
    // Match database constraint regex: ^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}
    const urlPattern = /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    return urlPattern.test(url);
  };

  const handleBlur = (platform) => {
    const value = localValues[platform];
    const newLinks = { ...socialLinks };

    if (value && value.trim()) {
      // Format when user finishes typing
      const formattedLink = formatSocialLink(platform, value);

      // Only save if it's a valid URL
      if (formattedLink && isValidUrl(formattedLink)) {
        newLinks[platform] = formattedLink;
      } else {
        // Remove invalid URLs
        delete newLinks[platform];
        // Reset local state to empty
        setLocalValues(prev => ({
          ...prev,
          [platform]: ''
        }));
      }
    } else {
      // Remove empty values
      delete newLinks[platform];
    }

    // Update parent state only on blur
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
              value={localValues[platform.key] || ''}
              onChangeText={(value) => handleLinkChange(platform.key, value)}
              onBlur={() => handleBlur(platform.key)}
              placeholder={platform.placeholder}
              placeholderTextColor="#999"
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
