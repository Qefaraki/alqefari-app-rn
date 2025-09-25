import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import SimplifiedTreeView from "./SimplifiedTreeView";

/**
 * Modal that shows a branch tree view for verifying profile identity
 */
const BranchTreeModal = ({ visible, profile, onConfirm, onClose }) => {
  if (!profile) return null;

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={28} color="#242121" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>تأكيد الهوية</Text>
            <Text style={styles.headerSubtitle}>
              تحقق من موقع {profile.name} في شجرة العائلة
            </Text>
          </View>
        </View>

        {/* Profile Info Bar */}
        <View style={styles.profileBar}>
          <View style={styles.profileInfo}>
            {profile.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {profile.name?.charAt(0) || "؟"}
                </Text>
              </View>
            )}
            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>{profile.name}</Text>
              {profile.birth_year_hijri && (
                <Text style={styles.profileMeta}>
                  ولد عام {profile.birth_year_hijri} هـ
                </Text>
              )}
              {profile.generation && (
                <Text style={styles.profileMeta}>
                  الجيل {profile.generation}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Simplified Tree View with Glow Effect */}
        <View style={styles.treeContainer}>
          <SimplifiedTreeView focusPersonId={profile.id} />
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => onConfirm(profile)}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmButtonText}>هذا أنا</Text>
            <Ionicons name="checkmark-circle" size={20} color="#F9F7F3" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>ليس أنا</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#D1BBA340",
  },
  closeButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#242121",
    fontFamily: "SF Arabic",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#24212199",
    fontFamily: "SF Arabic",
    marginTop: 2,
  },
  profileBar: {
    backgroundColor: "#D1BBA320",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#D1BBA340",
  },
  profileInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    backgroundColor: "#A13333",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F9F7F3",
    fontFamily: "SF Arabic",
  },
  profileDetails: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#242121",
    fontFamily: "SF Arabic",
  },
  profileMeta: {
    fontSize: 13,
    color: "#24212199",
    fontFamily: "SF Arabic",
    marginTop: 2,
  },
  treeContainer: {
    flex: 1,
    backgroundColor: "#F9F7F3",
  },
  treeView: {
    flex: 1,
  },
  actions: {
    padding: 16,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  confirmButton: {
    backgroundColor: "#A13333",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  confirmButtonText: {
    color: "#F9F7F3",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    marginRight: 8,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#D1BBA3",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#242121",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
});

export default BranchTreeModal;
