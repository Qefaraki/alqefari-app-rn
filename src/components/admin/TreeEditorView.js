import React, { useState, useEffect, useCallback } from 'react';
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
import ProfileCard from './ProfileCard';
import GlassButton from '../glass/GlassButton';
import profilesService from '../../services/profiles';
import { handleSupabaseError } from '../../services/supabase';

const TreeEditorView = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [deletingId, setDeletingId] = useState(null);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    loadProfiles();
  }, [searchQuery]);

  const loadProfiles = async (append = false) => {
    if (!append) {
      setLoading(true);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = append ? offset : 0;
      const { data, error } = await profilesService.searchProfiles(
        searchQuery || '',
        ITEMS_PER_PAGE,
        currentOffset
      );

      if (error) throw new Error(error);
      
      const results = data || [];
      if (append) {
        setProfiles(prev => [...prev, ...results]);
      } else {
        setProfiles(results);
      }
      
      setHasMore(results.length === ITEMS_PER_PAGE);
      setOffset(currentOffset + results.length);
    } catch (error) {
      Alert.alert('خطأ', handleSupabaseError(error) || 'فشل تحميل البيانات');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSearch = useCallback((text) => {
    setSearchQuery(text);
    setProfiles([]);
    setOffset(0);
    setHasMore(true);
  }, []);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadProfiles(true);
    }
  }, [loadingMore, hasMore, offset]);

  // Search is now handled server-side, no need for client-side filtering
  const filteredProfiles = profiles;

  const handleAddChildren = useCallback((profile) => {
    navigation.navigate('TreeView', {
      adminAction: 'addChildren',
      targetProfile: profile,
    });
  }, [navigation]);

  const handleEditProfile = useCallback((profile) => {
    navigation.navigate('EditProfile', { profile });
  }, [navigation]);

  const handleDeleteProfile = useCallback(async (profile) => {
    Alert.alert(
      'تأكيد الحذف',
      `هل أنت متأكد من حذف ${profile.name}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(profile.id);
            
            // Optimistic update - remove from UI immediately
            setProfiles(prev => prev.filter(p => p.id !== profile.id));
            
            try {
              const { error } = await profilesService.deleteProfile(
                profile.id,
                profile.version || 1
              );

              if (error) {
                // Revert optimistic update on error
                setProfiles(prev => [...prev, profile].sort((a, b) => 
                  a.hid.localeCompare(b.hid)
                ));
                throw new Error(error);
              }
              
              Alert.alert('نجح', 'تم حذف الملف الشخصي');
            } catch (error) {
              Alert.alert('خطأ', handleSupabaseError(error) || 'فشل حذف الملف الشخصي');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  }, []);

  // ProfileCard component is now imported from separate file

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
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        onScrollEndDrag={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 50) {
            loadMore();
          }
        }}
      >
        {filteredProfiles.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyStateText}>لا توجد نتائج</Text>
          </View>
        ) : (
          <>
            {filteredProfiles.map((profile) => (
              <ProfileCard 
                key={profile.id} 
                profile={profile}
                onAddChildren={handleAddChildren}
                onEditProfile={handleEditProfile}
                onDeleteProfile={handleDeleteProfile}
                disabled={deletingId === profile.id}
              />
            ))}
            
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

      {/* Removed global loading overlay - using per-card loading state instead */}
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
  loadMoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginVertical: 8,
  },
  loadMoreText: {
    fontSize: 16,
    color: '#007AFF',
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
});

export default TreeEditorView;