import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GlassSurface from "../components/glass/GlassSurface";
import GlassButton from "../components/glass/GlassButton";
import { supabase, handleSupabaseError } from "../services/supabase";

const AuditLogViewer = ({ navigation, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filters, setFilters] = useState({
    action: null,
    table_name: null,
    date_from: null,
    date_to: null,
  });
  const [showFilters, setShowFilters] = useState(false);

  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const loadLogs = async (append = false) => {
    if (!append) {
      setLoading(true);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = append ? offset : 0;

      let query = supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .range(currentOffset, currentOffset + ITEMS_PER_PAGE - 1);

      // Apply filters
      if (filters.action) {
        query = query.eq("action", filters.action);
      }
      if (filters.table_name) {
        query = query.eq("table_name", filters.table_name);
      }
      if (filters.date_from) {
        query = query.gte("created_at", filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte("created_at", filters.date_to);
      }

      const { data, error } = await query;

      if (error) throw error;

      const results = data || [];
      if (append) {
        setLogs((prev) => [...prev, ...results]);
      } else {
        setLogs(results);
      }

      setHasMore(results.length === ITEMS_PER_PAGE);
      setOffset(currentOffset + results.length);
    } catch (error) {
      Alert.alert("خطأ", handleSupabaseError(error) || "فشل تحميل سجل التدقيق");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadLogs(true);
    }
  }, [loadingMore, hasMore, offset]);

  const getActionIcon = (action) => {
    const actionIcons = {
      create: { name: "add-circle", color: "#34C759" },
      update: { name: "create", color: "#007AFF" },
      delete: { name: "trash", color: "#FF3B30" },
      revert: { name: "arrow-undo", color: "#FF9500" },
    };
    return actionIcons[action] || { name: "ellipse", color: "#8E8E93" };
  };

  const getActionLabel = (action) => {
    const labels = {
      create: "إنشاء",
      update: "تحديث",
      delete: "حذف",
      revert: "تراجع",
    };
    return labels[action] || action;
  };

  const getTableLabel = (tableName) => {
    const labels = {
      profiles: "الملفات الشخصية",
      marriages: "الزيجات",
      audit_log: "سجل التدقيق",
    };
    return labels[tableName] || tableName;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString("ar-SA") + " " + date.toLocaleTimeString("ar-SA")
    );
  };

  const renderLogItem = (log) => {
    const actionInfo = getActionIcon(log.action);

    return (
      <TouchableOpacity
        key={log.id}
        onPress={() => {
          setSelectedLog(log);
          setShowDetails(true);
        }}
      >
        <GlassSurface style={styles.logItem}>
          <View style={styles.logHeader}>
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: `${actionInfo.color}20` },
              ]}
            >
              <Ionicons
                name={actionInfo.name}
                size={20}
                color={actionInfo.color}
              />
            </View>
            <View style={styles.logInfo}>
              <View style={styles.logTitleRow}>
                <Text style={styles.logAction}>
                  {getActionLabel(log.action)}
                </Text>
                <Text style={styles.logTable}>
                  {getTableLabel(log.table_name)}
                </Text>
              </View>
              <Text style={styles.logDate}>{formatDate(log.created_at)}</Text>
            </View>
          </View>

          {log.changes && (
            <View style={styles.logPreview}>
              <Text style={styles.previewText} numberOfLines={2}>
                {JSON.stringify(log.changes).substring(0, 100)}...
              </Text>
            </View>
          )}
        </GlassSurface>
      </TouchableOpacity>
    );
  };

  const renderDetailsModal = () => {
    if (!selectedLog) return null;

    return (
      <Modal
        visible={showDetails}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تفاصيل السجل</Text>
              <TouchableOpacity onPress={() => setShowDetails(false)}>
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>المعرف:</Text>
                <Text style={styles.detailValue}>{selectedLog.id}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>الإجراء:</Text>
                <Text style={styles.detailValue}>
                  {getActionLabel(selectedLog.action)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>الجدول:</Text>
                <Text style={styles.detailValue}>
                  {getTableLabel(selectedLog.table_name)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>معرف السجل:</Text>
                <Text style={styles.detailValue}>{selectedLog.record_id}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>معرف المستخدم:</Text>
                <Text style={styles.detailValue}>
                  {selectedLog.actor_id || "غير محدد"}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>التاريخ:</Text>
                <Text style={styles.detailValue}>
                  {formatDate(selectedLog.created_at)}
                </Text>
              </View>

              {selectedLog.changes && (
                <View style={styles.changesSection}>
                  <Text style={styles.changesTitle}>التغييرات:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Text style={styles.changesJson}>
                      {JSON.stringify(selectedLog.changes, null, 2)}
                    </Text>
                  </ScrollView>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderFiltersModal = () => {
    return (
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تصفية السجلات</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.filterLabel}>نوع الإجراء:</Text>
              <View style={styles.filterOptions}>
                {["create", "update", "delete", "revert"].map((action) => (
                  <TouchableOpacity
                    key={action}
                    style={[
                      styles.filterOption,
                      filters.action === action && styles.filterOptionActive,
                    ]}
                    onPress={() =>
                      setFilters((prev) => ({
                        ...prev,
                        action: prev.action === action ? null : action,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filters.action === action &&
                          styles.filterOptionTextActive,
                      ]}
                    >
                      {getActionLabel(action)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>الجدول:</Text>
              <View style={styles.filterOptions}>
                {["profiles", "marriages"].map((table) => (
                  <TouchableOpacity
                    key={table}
                    style={[
                      styles.filterOption,
                      filters.table_name === table && styles.filterOptionActive,
                    ]}
                    onPress={() =>
                      setFilters((prev) => ({
                        ...prev,
                        table_name: prev.table_name === table ? null : table,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filters.table_name === table &&
                          styles.filterOptionTextActive,
                      ]}
                    >
                      {getTableLabel(table)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <GlassButton
                title="مسح الفلاتر"
                onPress={() => {
                  setFilters({
                    action: null,
                    table_name: null,
                    date_from: null,
                    date_to: null,
                  });
                  setShowFilters(false);
                }}
                style={styles.clearButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading && logs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>جاري تحميل سجل التدقيق...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (onClose ? onClose() : navigation?.goBack())}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سجل التدقيق</Text>
        <TouchableOpacity
          onPress={() => setShowFilters(true)}
          style={styles.filterButton}
        >
          <Ionicons name="filter" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Active Filters */}
      {(filters.action || filters.table_name) && (
        <View style={styles.activeFilters}>
          {filters.action && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {getActionLabel(filters.action)}
              </Text>
            </View>
          )}
          {filters.table_name && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {getTableLabel(filters.table_name)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Logs List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScrollEndDrag={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - 50
          ) {
            loadMore();
          }
        }}
      >
        {logs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyStateTitle}>لا توجد سجلات</Text>
            <Text style={styles.emptyStateText}>
              لم يتم العثور على سجلات مطابقة للفلاتر
            </Text>
          </View>
        ) : (
          <>
            {logs.map(renderLogItem)}

            {hasMore && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Text style={styles.loadMoreText}>تحميل المزيد</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {renderDetailsModal()}
      {renderFiltersModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
  },
  filterButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666666",
  },
  activeFilters: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },
  activeFilter: {
    backgroundColor: "#007AFF20",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  activeFilterText: {
    fontSize: 13,
    color: "#007AFF",
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  logItem: {
    marginBottom: 12,
    padding: 12,
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  logInfo: {
    flex: 1,
  },
  logTitleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  logAction: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000000",
  },
  logTable: {
    fontSize: 15,
    color: "#666666",
  },
  logDate: {
    fontSize: 13,
    color: "#8E8E93",
  },
  logPreview: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
  },
  previewText: {
    fontSize: 12,
    color: "#666666",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#666666",
    marginTop: 8,
    textAlign: "center",
  },
  loadMoreButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    marginVertical: 8,
  },
  loadMoreText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
  },
  modalBody: {
    padding: 16,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: "#666666",
    width: 100,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: "#000000",
  },
  changesSection: {
    marginTop: 16,
  },
  changesTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 8,
  },
  changesJson: {
    fontSize: 12,
    color: "#666666",
    backgroundColor: "#F2F2F7",
    padding: 12,
    borderRadius: 8,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginTop: 16,
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  filterOptionActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  filterOptionText: {
    fontSize: 14,
    color: "#666666",
  },
  filterOptionTextActive: {
    color: "#FFFFFF",
  },
  clearButton: {
    marginTop: 24,
  },
});

export default AuditLogViewer;
