import React, { createContext, useContext, useEffect, useRef } from 'react';
import useBranchTreeStore from '../hooks/useBranchTreeStore';
import { supabase } from '../services/supabase';

/**
 * BranchTreeProvider - Context provider for isolated branch tree functionality
 * 
 * This provider manages the isolated branch tree state and data loading
 * without interfering with the main tree. It loads a focused branch of the
 * tree centered on the target person.
 * 
 * Key features:
 * - Independent data loading via get_branch_data RPC
 * - Proper lifecycle management with cleanup
 * - Loading state protection to prevent concurrent requests
 * - Error handling with user-friendly messages
 */
const BranchTreeContext = createContext(null);

export const useBranchTreeContext = () => {
  const context = useContext(BranchTreeContext);
  if (!context) {
    throw new Error('useBranchTreeContext must be used within BranchTreeProvider');
  }
  return context;
};

export const BranchTreeProvider = ({ children, focusPersonId }) => {
  const store = useBranchTreeStore();
  const isLoadingRef = useRef(false);
  
  /**
   * Load branch tree data centered on the focus person
   * Uses get_branch_data RPC with correct parameters learned from V1
   */
  const loadBranchTree = async (targetPersonId) => {
    if (!targetPersonId || isLoadingRef.current) return;
    
    try {
      isLoadingRef.current = true;
      store.setLoading(true);
      store.setError(null);
      
      console.log('[BranchTreeProvider] Loading branch tree for person:', targetPersonId);
      
      // Load branch data using correct RPC parameters (fixed from V1)
      const { data, error } = await supabase.rpc('get_branch_data', {
        p_hid: targetPersonId,     // Correct parameter name
        p_max_depth: 3,           // Limit depth for modal viewing
        p_limit: 20               // Reasonable limit for modal performance
      });
      
      if (error) {
        console.error('[BranchTreeProvider] Error loading branch data:', error);
        store.setError(error.message);
        return;
      }
      
      console.log('[BranchTreeProvider] Loaded branch data:', data?.length || 0, 'profiles');
      
      // Set the tree data and focus
      store.setTreeData(data || []);
      store.setFocusPersonId(targetPersonId);
      store.setHighlightProfileId(targetPersonId);
      
    } catch (err) {
      console.error('[BranchTreeProvider] Exception loading branch tree:', err);
      store.setError('فشل في تحميل بيانات الشجرة');
    } finally {
      isLoadingRef.current = false;
      store.setLoading(false);
    }
  };
  
  // Load tree when focus person changes
  useEffect(() => {
    if (focusPersonId) {
      loadBranchTree(focusPersonId);
    }
    
    // Reset store when unmounting or focus changes
    return () => {
      if (!focusPersonId) {
        store.reset();
      }
    };
  }, [focusPersonId]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      store.reset();
      isLoadingRef.current = false;
    };
  }, []);
  
  const contextValue = {
    store,
    loadBranchTree,
    focusPersonId,
  };
  
  return (
    <BranchTreeContext.Provider value={contextValue}>
      {children}
    </BranchTreeContext.Provider>
  );
};