import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { phoneAuthService } from "../../services/phoneAuth";

// Component to display tree context
const TreeContextView = ({ context }) => {
  if (!context) return null;

  const {
    profile,
    lineage,
    siblings,
    father_siblings,
    grandfather_siblings,
    children_count,
  } = context;

  return (
    <ScrollView
      style={styles.contextContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Main Profile */}
      <View style={styles.mainProfileSection}>
        <Text style={styles.sectionTitle}>الملف المطابق</Text>
        <View style={styles.mainProfileCard}>
          <Text style={styles.mainProfileName}>{profile.name}</Text>
          <Text style={styles.mainProfileInfo}>
            الجيل {profile.generation} • {profile.hid}
          </Text>
          {profile.status === "deceased" && (
            <Text style={styles.deceasedBadge}>متوفى</Text>
          )}
        </View>
      </View>

      {/* Lineage (Ancestors) */}
      {lineage && lineage.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>السلسلة النسبية</Text>
          <View style={styles.lineageContainer}>
            {lineage.map((ancestor, index) => (
              <View key={ancestor.id} style={styles.lineageItem}>
                <View style={styles.lineageNode}>
                  <Text style={styles.lineageName}>{ancestor.name}</Text>
                  <Text style={styles.lineageGeneration}>
                    الجيل {ancestor.generation}
                  </Text>
                </View>
                {index < lineage.length - 1 && (
                  <View style={styles.lineageConnector}>
                    <Ionicons name="arrow-up" size={16} color="#999" />
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Siblings */}
      {siblings && siblings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الإخوة والأخوات</Text>
          <View style={styles.relativesGrid}>
            {siblings.map((sibling) => (
              <View key={sibling.id} style={styles.relativeCard}>
                <Ionicons
                  name={sibling.gender === "male" ? "man" : "woman"}
                  size={20}
                  color={sibling.gender === "male" ? "#007AFF" : "#FF69B4"}
                />
                <Text style={styles.relativeName}>{sibling.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Father's Siblings */}
      {father_siblings && father_siblings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الأعمام والعمات</Text>
          <View style={styles.relativesGrid}>
            {father_siblings.map((uncle) => (
              <View key={uncle.id} style={styles.relativeCard}>
                <Ionicons
                  name={uncle.gender === "male" ? "man" : "woman"}
                  size={20}
                  color={uncle.gender === "male" ? "#007AFF" : "#FF69B4"}
                />
                <Text style={styles.relativeName}>{uncle.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Grandfather's Siblings */}
      {grandfather_siblings && grandfather_siblings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>إخوة الجد</Text>
          <View style={styles.relativesGrid}>
            {grandfather_siblings.map((grandUncle) => (
              <View key={grandUncle.id} style={styles.relativeCard}>
                <Ionicons
                  name={grandUncle.gender === "male" ? "man" : "woman"}
                  size={20}
                  color={grandUncle.gender === "male" ? "#007AFF" : "#FF69B4"}
                />
                <Text style={styles.relativeName}>{grandUncle.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Children Count */}
      {children_count > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الأبناء</Text>
          <View style={styles.childrenInfo}>
            <Ionicons name="people" size={24} color="#666" />
            <Text style={styles.childrenCount}>{children_count} أطفال</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default function ProfileMatchingScreen({ navigation, route }) {
  const { profiles, nameChain, user } = route.params;
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [treeContext, setTreeContext] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showContextModal, setShowContextModal] = useState(false);

  const loadTreeContext = async (profileId) => {
    setLoadingContext(true);
    setSelectedProfile(profileId);

    const result = await phoneAuthService.getProfileTreeContext(profileId);

    if (result.success) {
      setTreeContext(result.context);
      setShowContextModal(true);
    } else {
      Alert.alert("خطأ", "فشل تحميل معلومات الشجرة");
    }

    setLoadingContext(false);
  };

  const handleConfirmProfile = async () => {
    if (!selectedProfile) return;

    setSubmitting(true);
    const result = await phoneAuthService.submitProfileLinkRequest(
      selectedProfile,
      nameChain,
    );

    if (result.success) {
      Alert.alert("تم إرسال الطلب", result.message, [
        { text: "موافق", onPress: () => navigation.replace("Main") },
      ]);
    } else {
      Alert.alert("خطأ", result.error);
    }

    setSubmitting(false);
  };

  const handleContactAdmin = () => {
    navigation.navigate("ContactAdmin", { user, nameChain });
  };

  const renderProfile = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.profileCard,
        selectedProfile === item.id && styles.profileCardSelected,
      ]}
      onPress={() => loadTreeContext(item.id)}
    >
      <View style={styles.profileHeader}>
        <Text style={styles.profileName}>{item.name}</Text>
        {item.has_auth && (
          <View style={styles.linkedBadge}>
            <Ionicons name="link" size={12} color="white" />
            <Text style={styles.linkedText}>مرتبط</Text>
          </View>
        )}
      </View>

      {item.father_name && (
        <Text style={styles.profileInfo}>والد: {item.father_name}</Text>
      )}
      {item.grandfather_name && (
        <Text style={styles.profileInfo}>جد: {item.grandfather_name}</Text>
      )}

      <View style={styles.profileMeta}>
        <Text style={styles.profileMetaText}>الجيل {item.generation}</Text>
        <Text style={styles.profileMetaText}>{item.hid}</Text>
      </View>

      <View style={styles.matchScore}>
        <Text style={styles.matchScoreText}>
          نسبة التطابق: {item.match_score}%
        </Text>
        <View style={styles.matchScoreBar}>
          <View
            style={[styles.matchScoreFill, { width: `${item.match_score}%` }]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.title}>اختر ملفك الشخصي</Text>
      </View>

      <View style={styles.nameChainDisplay}>
        <Text style={styles.nameChainLabel}>البحث عن:</Text>
        <Text style={styles.nameChainText}>{nameChain}</Text>
      </View>

      {profiles.length === 0 ? (
        <View style={styles.noResultsContainer}>
          <Ionicons name="search-outline" size={64} color="#ccc" />
          <Text style={styles.noResultsText}>
            لم يتم العثور على نتائج مطابقة
          </Text>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={handleContactAdmin}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            <Text style={styles.contactButtonText}>تواصل مع المشرف</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.instructionText}>
            اضغط على الملف لعرض السياق العائلي
          </Text>

          <FlatList
            data={profiles}
            renderItem={renderProfile}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.notFoundButton}
              onPress={handleContactAdmin}
            >
              <Text style={styles.notFoundText}>لم أجد ملفي</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Tree Context Modal */}
      <Modal
        visible={showContextModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowContextModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>السياق العائلي</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowContextModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {loadingContext ? (
              <ActivityIndicator
                size="large"
                color="#007AFF"
                style={styles.loader}
              />
            ) : (
              <>
                <TreeContextView context={treeContext} />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[
                      styles.confirmButton,
                      submitting && styles.buttonDisabled,
                    ]}
                    onPress={handleConfirmProfile}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <>
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color="white"
                        />
                        <Text style={styles.confirmButtonText}>
                          نعم، هذا أنا
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowContextModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>ليس أنا</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1a1a1a",
    flex: 1,
  },
  nameChainDisplay: {
    backgroundColor: "#f8f9fa",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  nameChainLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 5,
  },
  nameChainText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  instructionText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  profileCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  profileCardSelected: {
    borderColor: "#007AFF",
    borderWidth: 2,
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  linkedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF9800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  linkedText: {
    fontSize: 10,
    color: "white",
    marginLeft: 3,
  },
  profileInfo: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  profileMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  profileMetaText: {
    fontSize: 12,
    color: "#999",
  },
  matchScore: {
    marginTop: 10,
  },
  matchScoreText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 5,
  },
  matchScoreBar: {
    height: 4,
    backgroundColor: "#f0f0f0",
    borderRadius: 2,
    overflow: "hidden",
  },
  matchScoreFill: {
    height: "100%",
    backgroundColor: "#4CAF50",
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    backgroundColor: "white",
  },
  notFoundButton: {
    alignItems: "center",
    paddingVertical: 10,
  },
  notFoundText: {
    color: "#007AFF",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  noResultsText: {
    fontSize: 16,
    color: "#666",
    marginVertical: 20,
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#25D366",
  },
  contactButtonText: {
    color: "#25D366",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  modalCloseButton: {
    padding: 5,
  },
  contextContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 10,
  },
  mainProfileSection: {
    marginBottom: 25,
  },
  mainProfileCard: {
    backgroundColor: "#f8f9fa",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  mainProfileName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 5,
  },
  mainProfileInfo: {
    fontSize: 14,
    color: "#666",
  },
  deceasedBadge: {
    fontSize: 12,
    color: "#FF5252",
    marginTop: 5,
  },
  lineageContainer: {
    alignItems: "center",
  },
  lineageItem: {
    alignItems: "center",
  },
  lineageNode: {
    backgroundColor: "white",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    alignItems: "center",
    minWidth: 120,
  },
  lineageName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  lineageGeneration: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  lineageConnector: {
    paddingVertical: 5,
  },
  relativesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  relativeCard: {
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    flexDirection: "row",
    alignItems: "center",
  },
  relativeName: {
    fontSize: 13,
    color: "#1a1a1a",
    marginLeft: 5,
  },
  childrenInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  childrenCount: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  confirmButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 10,
  },
  confirmButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  cancelButton: {
    paddingVertical: 15,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  loader: {
    paddingVertical: 50,
  },
});
