import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import profilesService from "../services/profiles";

/**
 * SimpleBranchView - A simple text-based tree view for verifying identity
 * Shows the person's position in the family hierarchy
 */
const SimpleBranchView = ({ focusPersonId }) => {
  const [loading, setLoading] = useState(true);
  const [branchData, setBranchData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!focusPersonId) return;
    loadBranchContext();
  }, [focusPersonId]);

  const loadBranchContext = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load the focus person
      const { data: person, error: personError } =
        await profilesService.getProfile(focusPersonId);

      if (personError || !person) {
        throw personError || new Error("Person not found");
      }

      // Load ancestors
      const ancestors = [];
      let currentId = person.father_id;
      let depth = 0;

      while (currentId && depth < 10) {
        const { data: ancestor } = await profilesService.getProfile(currentId);
        if (!ancestor) break;
        ancestors.push(ancestor);
        currentId = ancestor.father_id;
        depth++;
      }

      // Load siblings
      const siblings = [];
      if (person.father_id) {
        const { data: siblingData } = await profilesService.getChildren(
          person.father_id,
        );
        if (siblingData) {
          siblings.push(...siblingData.filter((s) => s.id !== focusPersonId));
        }
      }

      // Load children
      const { data: children } =
        await profilesService.getChildren(focusPersonId);

      // Load uncles (father's siblings)
      const uncles = [];
      if (person.father_id) {
        const { data: father } = await profilesService.getProfile(
          person.father_id,
        );
        if (father && father.father_id) {
          const { data: unclesData } = await profilesService.getChildren(
            father.father_id,
          );
          if (unclesData) {
            uncles.push(...unclesData.filter((u) => u.id !== person.father_id));
          }
        }
      }

      setBranchData({
        person,
        ancestors: ancestors.reverse(), // Root to parent order
        siblings: siblings || [],
        children: children || [],
        uncles: uncles || [],
      });
    } catch (err) {
      console.error("Error loading branch context:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#A13333" />
        <Text style={styles.loadingText}>جاري تحميل معلومات العائلة...</Text>
      </View>
    );
  }

  if (error || !branchData) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>حدث خطأ في تحميل البيانات</Text>
      </View>
    );
  }

  const { person, ancestors, siblings, children, uncles } = branchData;

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.content}
    >
      {/* Ancestors Path */}
      {ancestors.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>السلسلة النسبية</Text>
          <View style={styles.ancestorChain}>
            {ancestors.map((ancestor, index) => (
              <View key={ancestor.id} style={styles.ancestorItem}>
                <View style={styles.personCard}>
                  <Text style={styles.personName}>{ancestor.name}</Text>
                </View>
                {index < ancestors.length - 1 && (
                  <Ionicons
                    name="arrow-down"
                    size={20}
                    color="#D1BBA3"
                    style={styles.arrow}
                  />
                )}
              </View>
            ))}
            {/* Arrow to focus person */}
            {ancestors.length > 0 && (
              <Ionicons
                name="arrow-down"
                size={20}
                color="#D1BBA3"
                style={styles.arrow}
              />
            )}
          </View>
        </View>
      )}

      {/* Focus Person */}
      <View style={styles.focusSection}>
        <View style={styles.focusCard}>
          <Ionicons name="person" size={24} color="#F9F7F3" />
          <Text style={styles.focusName}>{person.name}</Text>
          <Text style={styles.focusLabel}>أنت</Text>
        </View>
      </View>

      {/* Family Context */}
      <View style={styles.familyContext}>
        {/* Siblings */}
        {siblings.length > 0 && (
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>
              الإخوة ({siblings.length})
            </Text>
            <View style={styles.peopleGrid}>
              {siblings.slice(0, 6).map((sibling) => (
                <View key={sibling.id} style={styles.miniCard}>
                  <Text style={styles.miniName} numberOfLines={1}>
                    {sibling.name}
                  </Text>
                </View>
              ))}
              {siblings.length > 6 && (
                <View style={styles.moreCard}>
                  <Text style={styles.moreText}>+{siblings.length - 6}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Children */}
        {children.length > 0 && (
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>
              الأبناء ({children.length})
            </Text>
            <View style={styles.peopleGrid}>
              {children.slice(0, 6).map((child) => (
                <View key={child.id} style={styles.miniCard}>
                  <Text style={styles.miniName} numberOfLines={1}>
                    {child.name}
                  </Text>
                </View>
              ))}
              {children.length > 6 && (
                <View style={styles.moreCard}>
                  <Text style={styles.moreText}>+{children.length - 6}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Uncles */}
        {uncles.length > 0 && (
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>
              الأعمام ({uncles.length})
            </Text>
            <View style={styles.peopleGrid}>
              {uncles.slice(0, 4).map((uncle) => (
                <View key={uncle.id} style={styles.miniCard}>
                  <Text style={styles.miniName} numberOfLines={1}>
                    {uncle.name}
                  </Text>
                </View>
              ))}
              {uncles.length > 4 && (
                <View style={styles.moreCard}>
                  <Text style={styles.moreText}>+{uncles.length - 4}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Help Text */}
      <Text style={styles.helpText}>
        تحقق من أن هذه المعلومات تطابق موقعك في شجرة العائلة
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#242121",
    fontFamily: "SF Arabic",
  },
  errorText: {
    fontSize: 14,
    color: "#A13333",
    fontFamily: "SF Arabic",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#242121",
    fontFamily: "SF Arabic",
    marginBottom: 12,
  },
  ancestorChain: {
    alignItems: "center",
  },
  ancestorItem: {
    alignItems: "center",
  },
  personCard: {
    backgroundColor: "#D1BBA320",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#D1BBA340",
  },
  personName: {
    fontSize: 14,
    color: "#242121",
    fontFamily: "SF Arabic",
  },
  arrow: {
    marginVertical: 8,
  },
  focusSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  focusCard: {
    backgroundColor: "#A13333",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  focusName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F9F7F3",
    fontFamily: "SF Arabic",
    marginTop: 8,
  },
  focusLabel: {
    fontSize: 12,
    color: "#F9F7F3CC",
    fontFamily: "SF Arabic",
    marginTop: 4,
  },
  familyContext: {
    marginBottom: 24,
  },
  subsection: {
    marginBottom: 20,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#24212199",
    fontFamily: "SF Arabic",
    marginBottom: 8,
  },
  peopleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  miniCard: {
    backgroundColor: "#F9F7F3",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#D1BBA340",
  },
  miniName: {
    fontSize: 12,
    color: "#242121",
    fontFamily: "SF Arabic",
  },
  moreCard: {
    backgroundColor: "#D1BBA320",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#D1BBA340",
  },
  moreText: {
    fontSize: 12,
    color: "#24212199",
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },
  helpText: {
    fontSize: 13,
    color: "#24212199",
    fontFamily: "SF Arabic",
    textAlign: "center",
    marginTop: 16,
    fontStyle: "italic",
  },
});

export default SimpleBranchView;
