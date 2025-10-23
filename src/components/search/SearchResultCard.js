import React from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
} from "react-native-reanimated";
import { toArabicNumerals } from "../../utils/dateUtils";

/**
 * SearchResultCard - Simple reusable search result card
 * Used by both SearchModal and SpouseManager
 */
const SearchResultCard = ({
  item,
  index,
  onPress,
}) => {
  const initials = item.name ? item.name.charAt(0) : "؟";

  return (
    <Animated.View entering={FadeIn.delay(100)}>
      <Pressable onPress={onPress}>
        <View style={styles.resultCard}>
          {/* Photo */}
          <View style={styles.photoContainer}>
            {item.photo_url ? (
              <Image
                source={{ uri: item.photo_url }}
                style={styles.photo}
                defaultSource={require("../../../assets/icon.png")}
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.initials}>{initials}</Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.primaryName}>{item.name}</Text>
            <Text style={styles.nameChain} numberOfLines={2}>
              {item.name_chain}
            </Text>
            <View style={styles.metaRow}>
              {/* Generation Badge - only show for Al-Qefari members (hid !== null) */}
              {item.generation && item?.hid !== null && (
                <View style={styles.generationBadge}>
                  <Text style={styles.generationText}>
                    الجيل {toArabicNumerals(item.generation?.toString() || "0")}
                  </Text>
                </View>
              )}
              {item.birth_year_hijri && (
                <Text style={styles.yearText}>
                  {toArabicNumerals(item.birth_year_hijri.toString())} هـ
                </Text>
              )}
            </View>
          </View>

          {/* Arrow */}
          <Ionicons name="chevron-forward" size={20} color="#8A8A8E" />
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
  },
  photoContainer: {
    marginRight: 12,
  },
  photo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F2F2F7",
  },
  photoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "SF Arabic",
  },
  infoContainer: {
    flex: 1,
  },
  primaryName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#000000",
    marginBottom: 2,
  },
  nameChain: {
    fontSize: 13,
    color: "#8A8A8E",
    fontFamily: "SF Arabic",
    marginBottom: 4,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  generationBadge: {
    backgroundColor: "#007AFF15",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  generationText: {
    fontSize: 11,
    color: "#007AFF",
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },
  yearText: {
    fontSize: 11,
    color: "#8A8A8E",
    fontFamily: "SF Arabic",
  },
});

export default SearchResultCard;
