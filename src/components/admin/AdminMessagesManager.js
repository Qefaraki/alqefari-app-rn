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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import phoneAuthService from '../../services/phoneAuth';
import SegmentedControl from '../ui/SegmentedControl';

const AdminMessagesManager = ({ onClose }) => {
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
          {new Date(request.created_at + 'Z').toLocaleDateString('ar-SA')}
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
          <Text style={[styles.buttonText, styles.approveButtonText]}>موافقة</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.rejectButton]}
          onPress={() => handleReject(request)}
        >
          <Ionicons name="close" size={20} color="#F9F7F3" />
          <Text style={[styles.buttonText, styles.rejectButtonText]}>رفض</Text>
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
            {new Date(message.created_at + 'Z').toLocaleDateString('ar-SA')}
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="chevron-back" size={28} color="#242121" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الرسائل</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabsContainer}>
        <SegmentedControl
          options={[
            { id: 'requests', label: `طلبات الربط (${linkRequests.length})` },
            { id: 'messages', label: `الرسائل (${messages.filter(m => m.status === 'unread').length})` },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
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
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E3DC',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#242121',
  },
  tabsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#D1BBA3' + '40',
  },
  card: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 13,
    borderWidth: 0.5,
    borderColor: '#D1BBA320', // Camel Hair Beige 20%
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
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
    backgroundColor: '#A13333', // Najdi Crimson
  },
  rejectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1BBA360', // Camel Hair Beige 40%
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  approveButtonText: {
    color: '#F9F7F3', // Al-Jass White
  },
  rejectButtonText: {
    color: '#242121', // Sadu Night
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