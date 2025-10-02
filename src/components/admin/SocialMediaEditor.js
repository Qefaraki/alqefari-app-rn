import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const socialPlatforms = [
  {
    key: "twitter",
    label: "Twitter/X",
    icon: "logo-twitter",
    placeholder: "https://twitter.com/username",
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: "logo-instagram",
    placeholder: "https://instagram.com/username",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: "logo-linkedin",
    placeholder: "https://linkedin.com/in/username",
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: "logo-facebook",
    placeholder: "https://facebook.com/username",
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: "logo-youtube",
    placeholder: "https://youtube.com/@username",
  },
  {
    key: "website",
    label: "Website",
    icon: "globe-outline",
    placeholder: "https://example.com",
  },
];

const SocialMediaEditor = ({ links = {}, onChange }) => {
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
        // Remove @ if present and create full URL
        const twitterHandle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
        return `https://twitter.com/${twitterHandle}`;
      
      case 'instagram':
        // Remove @ if present and create full URL
        const instaHandle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
        return `https://instagram.com/${instaHandle}`;
      
      case 'linkedin':
        // If just username, create full URL
        return trimmed.includes('linkedin.com') ? trimmed : `https://linkedin.com/in/${trimmed}`;
      
      case 'facebook':
        // If just username, create full URL
        return trimmed.includes('facebook.com') ? trimmed : `https://facebook.com/${trimmed}`;
      
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
    const newLinks = { ...links };
    if (value.trim()) {
      // Format the link properly before saving
      const formattedLink = formatSocialLink(platform, value);
      if (formattedLink) {
        newLinks[platform] = formattedLink;
      }
    } else {
      delete newLinks[platform];
    }
    onChange(newLinks);
  };

  // Helper to extract username from URL for display
  const extractUsername = (platform, url) => {
    if (!url) return '';
    
    // For display, show simplified version
    switch (platform) {
      case 'twitter':
        if (url.includes('twitter.com/')) {
          const username = url.split('twitter.com/')[1]?.split('?')[0]?.split('/')[0];
          return username ? `@${username}` : url;
        }
        return url;
      
      case 'instagram':
        if (url.includes('instagram.com/')) {
          const username = url.split('instagram.com/')[1]?.split('?')[0]?.split('/')[0];
          return username ? `@${username}` : url;
        }
        return url;
      
      default:
        return url;
    }
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
            value={extractUsername(platform.key, links?.[platform.key]) || ""}
            onChangeText={(value) => handleLinkChange(platform.key, value)}
            placeholder={platform.placeholder}
            textAlign="right"
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
    fontWeight: "600",
    color: "#000000",
    marginBottom: 8,
    textAlign: "right",
    writingDirection: "rtl",
    fontFamily: "SF Arabic",
  },
  platformRow: {
    gap: 8,
  },
  platformHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  platformLabel: {
    fontSize: 14,
    color: "#666666",
    textAlign: "right",
    writingDirection: "rtl",
    fontFamily: "SF Arabic",
  },
  platformInput: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#000000",
    textAlign: "right",
    writingDirection: "rtl",
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
  },
  platformInput: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#000000",
  },
});

export default SocialMediaEditor;
