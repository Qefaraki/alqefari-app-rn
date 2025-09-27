import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import phoneAuthService from '../../services/phoneAuth';

const AdminMessagesManager = () => {
  const [messages, setMessages] = useState([]);
  const [linkRequests, setLinkRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' or 'messages'
  const [adminNotes, setAdminNotes] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load both link requests and admin messages
      const [requestsResult, messagesResult] = await Promise.all([
        phoneAuthService.getPendingLinkRequests(),
        phoneAuthService.getAdminMessages()
      ]);

      if (requestsResult.success) {
        setLinkRequests(requestsResult.data);
      }

      if (messagesResult.success) {
        setMessages(messagesResult.data);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
      Alert.alert('خطأ', 'فشل تحميل البيانات');
    }
    setLoading(false);
    setRefreshing(false);
  };

  const handleApprove = async (request) => {
    Alert.alert(
      'موافقة على الطلب',
      `هل تريد الموافقة على ربط ${request.name_chain}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'موافق',
          onPress: async () => {
            const result = await phoneAuthService.approveProfileLink(
              request.id,
              adminNotes[request.id]
            );

            if (result.success) {
              Alert.alert('نجح', result.message);
              loadData();
            } else {
              Alert.alert('خطأ', result.error);
            }
          }
        }
      ]
    );
  };

  const handleReject = async (request) => {
    Alert.alert(
      'رفض الطلب',
      `هل تريد رفض طلب ${request.name_chain}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'رفض',
          style: 'destructive',
          onPress: async () => {
            const result = await phoneAuthService.rejectProfileLink(
              request.id,
              adminNotes[request.id]
            );

            if (result.success) {
              Alert.alert('تم', result.message);
              loadData();
            } else {
              Alert.alert('خطأ', result.error);
            }
          }
        }
      ]
    );
  };

  const handleMarkAsRead = async (messageId) => {
    const result = await phoneAuthService.markMessageAsRead(messageId);
    if (result.success) {
      loadData();
    }
  };

  const renderLinkRequest = (request) => (
    <View key={request.id} style={styles.card}>
      <View style={styles.requestHeader}>
        <View>
          <Text style={styles.name}>{request.name_chain}</Text>
          <Text style={styles.phone}>{request.phone}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>قيد الانتظار</Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="person" size={16} color="#736372" />
        <Text style={styles.infoText}>
          الملف المطلوب: {request.profile_id}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="time" size={16} color="#736372" />
        <Text style={styles.infoText}>
          {new Date(request.created_at).toLocaleDateString('ar-SA')}
        </Text>
      </View>

      <TextInput
        style={styles.notesInput}
        placeholder="ملاحظات المشرف (اختياري)"
        value={adminNotes[request.id] || ''}
        onChangeText={(text) => setAdminNotes({ ...adminNotes, [request.id]: text })}
        multiline
      />

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.approveButton]}
          onPress={() => handleApprove(request)}
        >
          <Ionicons name="checkmark" size={20} color="#F9F7F3" />
          <Text style={styles.buttonText}>موافقة</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.rejectButton]}
          onPress={() => handleReject(request)}
        >
          <Ionicons name="close" size={20} color="#F9F7F3" />
          <Text style={styles.buttonText}>رفض</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMessage = (message) => (
    <TouchableOpacity
      key={message.id}
      style={[styles.card, message.status === 'unread' && styles.unreadCard]}
      onPress={() => handleMarkAsRead(message.id)}
    >
      <View style={styles.messageHeader}>
        <View>
          <Text style={styles.name}>{message.name_chain || 'غير محدد'}</Text>
          <Text style={styles.phone}>{message.phone}</Text>
        </View>
        {message.status === 'unread' && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>جديد</Text>
          </View>
        )}
      </View>

      <Text style={styles.messageContent}>{message.message}</Text>

      <View style={styles.messageFooter}>
        <View style={styles.infoRow}>
          <Ionicons name="time" size={14} color="#736372" />
          <Text style={styles.infoText}>
            {new Date(message.created_at).toLocaleDateString('ar-SA')}
          </Text>
        </View>

        {message.type === 'no_profile_found' && (
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>لم يجد ملفه</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A13333" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
            طلبات الربط ({linkRequests.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
          onPress={() => setActiveTab('messages')}
        >
          <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>
            الرسائل ({messages.filter(m => m.status === 'unread').length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
          />
        }
      >
        {activeTab === 'requests' ? (
          linkRequests.length > 0 ? (
            linkRequests.map(renderLinkRequest)
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={48} color="#D1BBA3" />
              <Text style={styles.emptyText}>لا توجد طلبات قيد الانتظار</Text>
            </View>
          )
        ) : (
          messages.length > 0 ? (
            messages.map(renderMessage)
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="mail" size={48} color="#D1BBA3" />
              <Text style={styles.emptyText}>لا توجد رسائل</Text>
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F7F3',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#D1BBA3' + '40',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#A13333',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#736372',
  },
  activeTabText: {
    color: '#A13333',
  },
  card: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1BBA3' + '40',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#A13333',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#242121',
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
    color: '#736372',
  },
  statusBadge: {
    backgroundColor: '#D58C4A' + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#D58C4A',
    fontSize: 12,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#A13333',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unreadText: {
    color: '#F9F7F3',
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#736372',
  },
  notesInput: {
    backgroundColor: '#F9F7F3',
    borderWidth: 1,
    borderColor: '#D1BBA3' + '40',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 16,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 0.48,
  },
  approveButton: {
    backgroundColor: '#22C55E',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  buttonText: {
    color: '#F9F7F3',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  messageContent: {
    fontSize: 15,
    lineHeight: 22,
    color: '#242121',
    marginVertical: 12,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    backgroundColor: '#957EB5' + '20',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  typeText: {
    color: '#957EB5',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#736372',
  },
});

export default AdminMessagesManager;