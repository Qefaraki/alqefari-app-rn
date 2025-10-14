/**
 * useFamilyData Hook
 *
 * Manages family data fetching, loading states, and mother options.
 * Encapsulates the complex logic for loading profile family data and mother candidates.
 *
 * Features:
 * - Automatic data loading on person.id change
 * - Pull-to-refresh support
 * - Mother options loading with optimized RPC
 * - Error handling with user-friendly alerts
 *
 * @module useFamilyData
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../../../services/supabase';

/**
 * Custom hook for managing family data fetching
 *
 * @param {object} person - Profile object with id
 * @returns {object} Family data state and actions
 */
export const useFamilyData = (person) => {
  const [familyData, setFamilyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [motherOptions, setMotherOptions] = useState([]);
  const [loadingMotherOptions, setLoadingMotherOptions] = useState(false);

  /**
   * Load family data with inline mother options loading
   * Uses optimized get_father_wives_minimal RPC for 80-90% bandwidth reduction
   */
  const loadFamilyData = useCallback(
    async (isRefresh = false) => {
      if (!person?.id) return;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const { data, error } = await supabase.rpc('get_profile_family_data', {
          p_profile_id: person.id,
        });

        if (error) {
          if (__DEV__) {
            console.error('❌ Failed to load family data:', error);
          }
          Alert.alert('خطأ', `فشل تحميل بيانات العائلة: ${error.message || error.code}`);
          setFamilyData(null);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        if (data?.error) {
          if (__DEV__) {
            console.error('❌ SQL error in RPC result:', data.error);
          }
          Alert.alert('خطأ في قاعدة البيانات', data.error);
          setFamilyData(null);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        setFamilyData(data);

        // Inline mother options loading with optimized RPC (80-90% bandwidth reduction)
        if (data?.father?.id) {
          setLoadingMotherOptions(true);
          try {
            // Use lightweight get_father_wives_minimal instead of full get_profile_family_data
            // Returns only: marriage_id, status, children_count, minimal spouse_profile
            const { data: motherData, error: motherError } = await supabase.rpc(
              'get_father_wives_minimal',
              {
                p_father_id: data.father.id,
              }
            );

            if (motherError) throw motherError;

            // Data is already in the correct format (array of spouse objects)
            setMotherOptions(motherData || []);
          } catch (motherErr) {
            if (__DEV__) {
              console.error('Error loading mother options:', motherErr);
            }
            setMotherOptions([]);
          } finally {
            setLoadingMotherOptions(false);
          }
        } else {
          setMotherOptions([]);
          setLoadingMotherOptions(false);
        }
      } catch (err) {
        if (__DEV__) {
          console.error('Error loading family data:', err);
        }
        Alert.alert('خطأ', `حدث خطأ أثناء تحميل البيانات: ${err.message}`);
        setFamilyData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [person?.id]
  );

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = useCallback(() => {
    loadFamilyData(true);
  }, [loadFamilyData]);

  /**
   * Load family data on mount and when person.id changes
   */
  useEffect(() => {
    if (person?.id) {
      loadFamilyData();
    }
  }, [person?.id, loadFamilyData]);

  return {
    familyData,
    loading,
    refreshing,
    motherOptions,
    loadingMotherOptions,
    loadFamilyData,
    handleRefresh,
  };
};

export default useFamilyData;
