import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import GlassSurface from '../glass/GlassSurface';
import GlassButton from '../glass/GlassButton';
import profilesService from '../../services/profiles';

const TreeEditorView = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('hid', { ascending: true });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
      Alert.alert('خطأ', 'فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
  };

  const filteredProfiles = profiles.filter(profile =>
    profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    profile.hid.includes(searchQuery)
  );

  const handleAddChildren = (profile) => {
    navigation.navigate('TreeView', {
      adminAction: 'addChildren',
      targetProfile: profile,
    });
  };

  const handleEditProfile = (profile) => {
    navigation.navigate('EditProfile', { profile });
  };

  const handleDeleteProfile = async (profile) => {
    Alert.alert(
      'تأكيد الحذف',
      `هل أنت متأكد من حذف ${profile.name}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { error } = await supabase
                .from('profiles')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', profile.id);

              if (error) throw error;
              Alert.alert('نجح', 'تم حذف الملف الشخصي');
              loadProfiles();
            } catch (error) {
              console.error('Error deleting profile:', error);
              Alert.alert('خطأ', 'فشل حذف الملف الشخصي');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const ProfileCard = ({ profile }) => (
    <GlassSurface style={styles.profileCard}>
      <View style={styles.profileHeader}>
        <View>
          <Text style={styles.profileName}>{profile.name}</Text>
          <Text style={styles.profileHID}>HID: {profile.hid}</Text>
          {profile.birth_year && (
            <Text style={styles.profileInfo}>مواليد: {profile.birth_year}</Text>
          )}
        </View>
        <View style={styles.profileGender}>
          <Ionicons
            name={profile.gender === 'M' ? 'male' : 'female'}
            size={24}
            color={profile.gender === 'M' ? '#007AFF' : '#FF375F'}
          />
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#34C759' }]}
          onPress={() => handleAddChildren(profile)}
        >
          <Ionicons name="person-add" size={18} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>إضافة أطفال</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#007AFF' }]}
          onPress={() => handleEditProfile(profile)}
        >
          <Ionicons name="pencil" size={18} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>تعديل</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#FF3B30' }]}
          onPress={() => handleDeleteProfile(profile)}
        >
          <Ionicons name="trash" size={18} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>حذف</Text>
        </TouchableOpacity>
      </View>
    </GlassSurface>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>جاري التحميل...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666666" />
          <TextInput
            style={styles.searchInput}
            placeholder="البحث بالاسم أو HID..."
            value={searchQuery}
            onChangeText={handleSearch}
            textAlign="right"
          />
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('AddUnlinkedPerson')}
        >
          <Ionicons name="person-add-outline" size={20} color="#007AFF" />
          <Text style={styles.quickActionText}>إضافة شخص غير مرتبط</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('BulkImport')}
        >
          <Ionicons name="cloud-upload-outline" size={20} color="#007AFF" />
          <Text style={styles.quickActionText}>استيراد مجمع</Text>
        </TouchableOpacity>
      </View>

      {/* Profiles List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {filteredProfiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyStateText}>لا توجد نتائج</Text>
          </View>
        ) : (
          filteredProfiles.map((profile) => (
            <ProfileCard key={profile.id} profile={profile} />
          ))
        )}
      </ScrollView>

      {actionLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
    color: '#000000',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  profileCard: {
    marginBottom: 12,
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  profileHID: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  profileInfo: {
    fontSize: 14,
    color: '#666666',
  },
  profileGender: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TreeEditorView;