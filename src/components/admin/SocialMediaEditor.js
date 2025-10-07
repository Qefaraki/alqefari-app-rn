import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons, FontAwesome6 } from "@expo/vector-icons";

const ICON_SIZE = 20; // Design system standard

const socialPlatforms = [
  {
    key: "twitter",
    label: "X (Twitter سابقاً)",
    icon: "x-twitter",
    iconFamily: "FontAwesome6",
    placeholder: "https://x.com/username أو @username",
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: "logo-instagram",
    iconFamily: "Ionicons",
    placeholder: "https://instagram.com/username أو @username",
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
    // Match database constraint PLUS allow paths, query params, fragments
    // ^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,} (database requirement)
    // Plus: /, ?, #, -, _, @, and other URL-safe characters
    const urlPattern = /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]*)?$/;
    return urlPattern.test(url);
  };

  const PLATFORM_DOMAINS = {
    twitter: ['x.com', 'twitter.com'],
    instagram: ['instagram.com'],
    linkedin: ['linkedin.com'],
    youtube: ['youtube.com', 'youtu.be'],
    website: null, // Any domain allowed
  };

  const validatePlatformMatch = (platform, url) => {
    if (!url) return true; // Empty is valid

    const allowedDomains = PLATFORM_DOMAINS[platform];
    if (!allowedDomains) return true; // No restrictions for this platform

    const domain = url.match(/https?:\/\/([^\/]+)/)?.[1]?.toLowerCase();
    return allowedDomains.some(allowed => domain?.includes(allowed));
  };

  const checkDuplicateUrls = (links) => {
    const urls = Object.values(links).filter(url => url && url.trim() !== '');
    const uniqueUrls = new Set(urls.map(u => u.toLowerCase()));
    return urls.length === uniqueUrls.size;
  };

  const handleBlur = (platform) => {
    const value = localValues[platform];

    // Build new links object with proper NULL handling
    const newLinks = {};

    // Copy existing links
    Object.keys(socialLinks).forEach(key => {
      if (socialLinks[key] && socialLinks[key].trim() !== '') {
        newLinks[key] = socialLinks[key];
      }
      // Omit empty/null values (store as NULL in database)
    });

    if (value && value.trim()) {
      // Format when user finishes typing
      const formattedLink = formatSocialLink(platform, value);

      // Validate URL format
      if (!formattedLink || !isValidUrl(formattedLink)) {
        // Reset local state to empty for invalid URLs
        setLocalValues(prev => ({
          ...prev,
          [platform]: ''
        }));
        delete newLinks[platform];
      }
      // Validate platform-specific domain
      else if (!validatePlatformMatch(platform, formattedLink)) {
        // Reset for wrong platform
        setLocalValues(prev => ({
          ...prev,
          [platform]: ''
        }));
        delete newLinks[platform];
      }
      // Valid URL
      else {
        newLinks[platform] = formattedLink;
      }
    } else {
      // Empty value - remove from object (store as NULL)
      delete newLinks[platform];
    }

    // Check for duplicate URLs
    if (!checkDuplicateUrls(newLinks)) {
      // If duplicates found, don't save the new value
      setLocalValues(prev => ({
        ...prev,
        [platform]: socialLinks[platform] || ''
      }));
      return;
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
              <IconComponent name={platform.icon} size={ICON_SIZE} color="#666" />
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
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
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
