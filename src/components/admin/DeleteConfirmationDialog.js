import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import CardSurface from "../ios/CardSurface";

const DeleteConfirmationDialog = ({
  visible,
  onClose,
  target,
  impact,
  loading,
  onConfirm,
}) => {
  if (!visible) return null;

  const hasDescendants = impact?.total_descendants > 0;
  const requiresCascade = impact?.direct_children > 0;

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onConfirm(false); // Simple delete
  };

  const handleCascadeDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onConfirm(true); // Cascade delete
  };

  const renderImpactDetails = () => {
    if (!impact?.details?.descendants_by_generation) return null;

    const generations = impact.details.descendants_by_generation;

    return Object.entries(generations).map(([generation, data]) => (
      <View key={generation} style={styles.generationRow}>
        <Text style={styles.generationLabel}>{generation}:</Text>
        <Text style={styles.generationCount}>{data.count} شخص</Text>
      </View>
    ));
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.dialogContainer}>
          <CardSurface>
            <View style={styles.dialog}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.warningIcon}>
                  <Ionicons name="warning" size={32} color="#FF9500" />
                </View>
                <Text style={styles.title}>
                  {hasDescendants ? "تحذير: حذف شامل" : "تأكيد الحذف"}
                </Text>
              </View>

              {/* Content */}
              <ScrollView style={styles.content}>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>جارِ حساب التأثير...</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.targetName}>
                      حذف: {target?.name || "غير معروف"}
                    </Text>

                    {hasDescendants ? (
                      <View style={styles.impactContainer}>
                        <Text style={styles.impactTitle}>
                          سيؤدي هذا الحذف إلى:
                        </Text>

                        <View style={styles.impactDetails}>
                          {renderImpactDetails()}

                          <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>
                              المجموع الكلي:
                            </Text>
                            <Text style={styles.totalCount}>
                              {impact.total_affected} شخص
                            </Text>
                          </View>
                        </View>

                        <View style={styles.warningBox}>
                          <Ionicons
                            name="information-circle"
                            size={20}
                            color="#FF9500"
                          />
                          <Text style={styles.warningText}>
                            هذا الإجراء لا يمكن التراجع عنه بسهولة. سيتم حذف
                            جميع الأشخاص المذكورين بشكل نهائي.
                          </Text>
                        </View>
                      </View>
                    ) : requiresCascade ? (
                      <View style={styles.impactContainer}>
                        <Text style={styles.impactTitle}>
                          لديه {impact.direct_children} أبناء مباشرين
                        </Text>
                        <Text style={styles.impactDescription}>
                          لا يمكن حذف شخص لديه أبناء. يجب حذف الأبناء أولاً أو
                          استخدام الحذف الشامل.
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.simpleDeleteText}>
                        سيتم حذف هذا الشخص فقط. لا يوجد أبناء أو أحفاد.
                      </Text>
                    )}
                  </>
                )}
              </ScrollView>

              {/* Actions */}
              {!loading && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={onClose}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>إلغاء</Text>
                  </TouchableOpacity>

                  {hasDescendants ? (
                    <TouchableOpacity
                      style={styles.cascadeDeleteButton}
                      onPress={handleCascadeDelete}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                      <Text style={styles.cascadeDeleteButtonText}>
                        حذف الجميع ({impact.total_affected})
                      </Text>
                    </TouchableOpacity>
                  ) : requiresCascade ? (
                    <View style={styles.disabledButton}>
                      <Text style={styles.disabledButtonText}>
                        يجب حذف الأبناء أولاً
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={handleDelete}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.deleteButtonText}>حذف</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </CardSurface>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  dialogContainer: {
    width: "90%",
    maxWidth: 400,
  },
  dialog: {
    borderRadius: 12,
    overflow: "hidden",
  },
  header: {
    alignItems: "center",
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  warningIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFF3E0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  content: {
    maxHeight: 300,
    padding: 20,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  targetName: {
    fontSize: 18,
    fontWeight: "500",
    color: "#000000",
    marginBottom: 16,
    textAlign: "center",
    fontFamily: "SF Arabic Regular",
  },
  impactContainer: {
    marginTop: 12,
  },
  impactTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000000",
    marginBottom: 12,
    fontFamily: "SF Arabic Regular",
  },
  impactDescription: {
    fontSize: 15,
    color: "#666666",
    lineHeight: 22,
    fontFamily: "SF Arabic Regular",
  },
  impactDetails: {
    backgroundColor: "#F7F7FA",
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
  },
  generationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  generationLabel: {
    fontSize: 15,
    color: "#666666",
    fontFamily: "SF Arabic Regular",
  },
  generationCount: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  totalCount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF3B30",
    fontFamily: "SF Arabic Regular",
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: "#F57C00",
    lineHeight: 20,
    fontFamily: "SF Arabic Regular",
  },
  simpleDeleteText: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
    lineHeight: 24,
    fontFamily: "SF Arabic Regular",
  },
  actions: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#F7F7FA",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  deleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#FF3B30",
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "SF Arabic Regular",
  },
  cascadeDeleteButton: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#FF3B30",
  },
  cascadeDeleteButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "SF Arabic Regular",
  },
  disabledButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#E5E5EA",
    alignItems: "center",
  },
  disabledButtonText: {
    fontSize: 15,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
});

export default DeleteConfirmationDialog;
