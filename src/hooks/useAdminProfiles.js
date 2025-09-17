import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import profilesService from '../services/profiles';
import { handleSupabaseError } from '../services/supabase';

/**
 * Custom hook for managing admin profiles with pagination and search
 * @param {Object} options - Configuration options
 * @param {string} options.initialQuery - Initial search query
 * @param {number} options.pageSize - Number of items per page (default: 50)
 * @returns {Object} Hook state and methods
 */
export const useAdminProfiles = ({ initialQuery = '', pageSize = 50 } = {}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState(null);

  // Load profiles with optional append for pagination
  const loadProfiles = useCallback(async (append = false, query = searchQuery) => {
    if (!append) {
      setLoading(true);
      setOffset(0);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = append ? offset : 0;
      const { data, error: fetchError } = await profilesService.searchProfiles(
        query || '',
        pageSize,
        currentOffset
      );

      if (fetchError) throw new Error(fetchError);
      
      const results = data || [];
      
      if (append) {
        setItems(prev => [...prev, ...results]);
      } else {
        setItems(results);
      }
      
      setHasMore(results.length === pageSize);
      setOffset(currentOffset + results.length);
      setError(null);
    } catch (err) {
      const errorMessage = handleSupabaseError(err) || 'فشل تحميل البيانات';
      setError(errorMessage);
      if (!append) {
        Alert.alert('خطأ', errorMessage);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, offset, pageSize]);

  // Search with debouncing
  const search = useCallback((query) => {
    setSearchQuery(query);
    setItems([]);
    setOffset(0);
    setHasMore(true);
    setError(null);
  }, []);

  // Load more items for pagination
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      loadProfiles(true);
    }
  }, [loadingMore, hasMore, loading, loadProfiles]);

  // Delete profile with optimistic update
  const deleteProfile = useCallback(async (profileId, version = 1) => {
    // Find the profile to delete
    const profileToDelete = items.find(p => p.id === profileId);
    if (!profileToDelete) return { error: 'Profile not found' };

    // Optimistic update - remove from UI immediately
    setItems(prev => prev.filter(p => p.id !== profileId));
    
    try {
      const { error: deleteError } = await profilesService.deleteProfile(
        profileId,
        version
      );

      if (deleteError) {
        // Revert optimistic update on error
        setItems(prev => {
          const updatedItems = [...prev, profileToDelete];
          // Re-sort by HID to maintain order
          return updatedItems.sort((a, b) => 
            (a.hid || '').localeCompare(b.hid || '')
          );
        });
        throw new Error(deleteError);
      }
      
      return { error: null };
    } catch (err) {
      const errorMessage = handleSupabaseError(err) || 'فشل حذف الملف الشخصي';
      return { error: errorMessage };
    }
  }, [items]);

  // Update profile in list (for after edit)
  const updateProfile = useCallback((updatedProfile) => {
    setItems(prev => prev.map(p => 
      p.id === updatedProfile.id ? updatedProfile : p
    ));
  }, []);

  // Refresh all data
  const refresh = useCallback(() => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
    loadProfiles(false, searchQuery);
  }, [searchQuery, loadProfiles]);

  // Initial load
  useEffect(() => {
    loadProfiles(false, searchQuery);
  }, [searchQuery]);

  return {
    // State
    items,
    loading,
    loadingMore,
    searchQuery,
    hasMore,
    error,
    
    // Methods
    search,
    loadMore,
    deleteProfile,
    updateProfile,
    refresh,
  };
};

export default useAdminProfiles;