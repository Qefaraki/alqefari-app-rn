import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import tokens from "../ui/tokens";

const COLORS = tokens.colors.najdi;

const PositionPicker = ({
  visible,
  currentPosition,
  totalPositions,
  onSelect,
  onClose,
}) => {
  const handleSelect = (position) => {
    if (position === currentPosition) {
      onClose();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(position);
    onClose();
  };

  // Generate position buttons
  const positions = Array.from({ length: totalPositions }, (_, i) => i + 1);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>اختر الترتيب الجديد</Text>
            <Text style={styles.headerSubtitle}>
              الترتيب الحالي: {currentPosition}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Position Grid */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.gridContainer}>
            {positions.map((position) => (
              <TouchableOpacity
                key={position}
                style={[
                  styles.positionButton,
                  position === currentPosition && styles.positionButtonCurrent,
                ]}
                onPress={() => handleSelect(position)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.positionText,
                    position === currentPosition && styles.positionTextCurrent,
                  ]}
                >
                  {position}
                </Text>
                {position === currentPosition && (
                  <View style={styles.currentBadge}>
                    <Ionicons name="checkmark" size={16} color={COLORS.background} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[
                styles.quickActionButton,
                currentPosition === 1 && styles.quickActionButtonDisabled,
              ]}
              onPress={() => handleSelect(1)}
              disabled={currentPosition === 1}
            >
              <Ionicons
                name="arrow-up"
                size={20}
                color={currentPosition === 1 ? COLORS.textMuted : COLORS.primary}
              />
              <Text
                style={[
                  styles.quickActionText,
                  currentPosition === 1 && styles.quickActionTextDisabled,
                ]}
              >
                نقل للأعلى
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickActionButton,
                currentPosition === totalPositions && styles.quickActionButtonDisabled,
              ]}
              onPress={() => handleSelect(totalPositions)}
              disabled={currentPosition === totalPositions}
            >
              <Ionicons
                name="arrow-down"
                size={20}
                color={
                  currentPosition === totalPositions
                    ? COLORS.textMuted
                    : COLORS.primary
                }
              />
              <Text
                style={[
                  styles.quickActionText,
                  currentPosition === totalPositions && styles.quickActionTextDisabled,
                ]}
              >
                نقل للأسفل
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: tokens.spacing.md, // 16px
    paddingVertical: tokens.spacing.sm, // 12px
    borderBottomWidth: 1,
    borderBottomColor: COLORS.container + "20",
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerSpacer: {
    width: 44,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: tokens.spacing.xxs, // 4px
  },
  scrollContent: {
    padding: tokens.spacing.md, // 16px
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm, // 12px
    justifyContent: "center",
  },
  positionButton: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: COLORS.container + "20",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  positionButtonCurrent: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  positionText: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.text,
  },
  positionTextCurrent: {
    color: COLORS.background,
  },
  currentBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.secondary,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActions: {
    marginTop: tokens.spacing.xl, // 24px
    gap: tokens.spacing.sm, // 12px
  },
  quickActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: tokens.spacing.md, // 16px
    paddingHorizontal: tokens.spacing.lg, // 20px
    borderRadius: 8,
    backgroundColor: COLORS.container + "20",
    gap: tokens.spacing.xs, // 8px
  },
  quickActionButtonDisabled: {
    opacity: 0.4,
  },
  quickActionText: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
  },
  quickActionTextDisabled: {
    color: COLORS.textMuted,
  },
});

export default PositionPicker;
