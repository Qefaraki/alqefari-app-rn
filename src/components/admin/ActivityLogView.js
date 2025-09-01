import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import GlassSurface from '../glass/GlassSurface';
import { formatDateDisplay } from '../../services/migrationHelpers';

const ActivityLogView = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadActivityLogs();
  }, []);

  const loadActivityLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select(`
          *,
          profiles!target_profile_id (
            name,
            hid
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading activity logs:', error);
      Alert.alert('خطأ', 'فشل تحميل سجل النشاط');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadActivityLogs();
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'INSERT':
        return { name: 'add-circle', color: '#34C759' };
      case 'UPDATE':
        return { name: 'create', color: '#007AFF' };
      case 'DELETE':
        return { name: 'trash', color: '#FF3B30' };
      case 'REVERT':
        return { name: 'arrow-undo', color: '#FF9500' };
      default:
        return { name: 'information-circle', color: '#666666' };
    }
  };

  const getActionText = (action) => {
    switch (action) {
      case 'INSERT':
        return 'إضافة';
      case 'UPDATE':
        return 'تعديل';
      case 'DELETE':
        return 'حذف';
      case 'REVERT':
        return 'تراجع';
      default:
        return action;
    }
  };

  const handleRevert = async (log) => {
    if (log.action === 'REVERT') {
      Alert.alert('تنبيه', 'لا يمكن التراجع عن عملية تراجع');
      return;
    }

    Alert.alert(
      'تأكيد التراجع',
      `هل تريد التراجع عن ${getActionText(log.action)} لـ ${log.profiles?.name || 'Unknown'}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تراجع',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data, error } = await supabase.rpc('admin_revert_action', {
                audit_log_id: log.id,
                dry_run: false,
              });

              if (error) throw error;
              Alert.alert('نجح', 'تم التراجع عن العملية');
              loadActivityLogs();
            } catch (error) {
              console.error('Error reverting action:', error);
              Alert.alert('خطأ', 'فشل التراجع عن العملية');
            }
          },
        },
      ]
    );
  };

  const LogItem = ({ log }) => {
    const icon = getActionIcon(log.action);
    const canRevert = log.action !== 'REVERT' && log.table_name === 'profiles';

    return (
      <GlassSurface style={styles.logItem}>
        <View style={styles.logHeader}>
          <View style={styles.logInfo}>
            <View style={[styles.actionIcon, { backgroundColor: `${icon.color}20` }]}>
              <Ionicons name={icon.name} size={20} color={icon.color} />
            </View>
            <View style={styles.logDetails}>
              <Text style={styles.logAction}>{getActionText(log.action)}</Text>
              <Text style={styles.logTarget}>
                {log.profiles?.name || 'Unknown'} ({log.profiles?.hid || 'N/A'})
              </Text>
              <Text style={styles.logTime}>
                {formatDateDisplay(log.created_at)}
              </Text>
            </View>
          </View>
          {canRevert && (
            <TouchableOpacity
              style={styles.revertButton}
              onPress={() => handleRevert(log)}
            >
              <Ionicons name="arrow-undo" size={18} color="#FF9500" />
              <Text style={styles.revertButtonText}>تراجع</Text>
            </TouchableOpacity>
          )}
        </View>

        {log.changes && Object.keys(log.changes).length > 0 && (
          <View style={styles.changesContainer}>
            <Text style={styles.changesTitle}>التغييرات:</Text>
            {Object.entries(log.changes).map(([field, value]) => (
              <Text key={field} style={styles.changeItem}>
                • {field}: {JSON.stringify(value)}
              </Text>
            ))}
          </View>
        )}
      </GlassSurface>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>جاري تحميل السجل...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {logs.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color="#C7C7CC" />
          <Text style={styles.emptyStateText}>لا توجد أنشطة مسجلة</Text>
        </View>
      ) : (
        logs.map((log) => <LogItem key={log.id} log={log} />)
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
  },
  logItem: {
    marginBottom: 12,
    padding: 16,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logDetails: {
    flex: 1,
  },
  logAction: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  logTarget: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  logTime: {
    fontSize: 12,
    color: '#999999',
  },
  revertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF950020',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  revertButtonText: {
    fontSize: 13,
    color: '#FF9500',
    fontWeight: '600',
  },
  changesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  changesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
  },
  changeItem: {
    fontSize: 13,
    color: '#999999',
    marginBottom: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#C7C7CC',
    marginTop: 12,
  },
});

export default ActivityLogView;